// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.

use std::{
    convert::{TryFrom, TryInto},
    ops::{Deref, DerefMut, Range},
    rc::Rc,
};

use super::{rawbytes, transl8::FromV8};

/// A V8Slice encapsulates a slice that's been borrowed from a JavaScript
/// ArrayBuffer object. JavaScript objects can normally be garbage collected,
/// but the existence of a V8Slice inhibits this until it is dropped. It
/// behaves much like an Arc<[u8]>.
///
/// # Cloning
/// Cloning a V8Slice does not clone the contents of the buffer,
/// it creates a new reference to that buffer.
///
/// To actually clone the contents of the buffer do
/// `let copy = Vec::from(&*zero_copy_buf);`
#[derive(Clone)]
pub struct V8Slice {
    pub(crate) store: v8::SharedRef<v8::BackingStore>,
    pub(crate) range: Range<usize>,
}

// SAFETY: unsafe trait must have unsafe implementation
unsafe impl Send for V8Slice {}

impl V8Slice {
    pub fn from_buffer(
        buffer: v8::Local<v8::ArrayBuffer>,
        range: Range<usize>,
    ) -> Result<Self, v8::DataError> {
        let store = buffer.get_backing_store();
        if store.is_shared() {
            return Err(v8::DataError::BadType {
                actual: "shared ArrayBufferView",
                expected: "non-shared ArrayBufferView",
            });
        }
        Ok(Self { store, range })
    }

    fn as_slice(&self) -> &[u8] {
        // SAFETY: v8::SharedRef<v8::BackingStore> is similar to Arc<[u8]>,
        // it points to a fixed continuous slice of bytes on the heap.
        // We assume it's initialized and thus safe to read (though may not contain meaningful data)
        unsafe { &*(&self.store[self.range.clone()] as *const _ as *const [u8]) }
    }

    fn as_slice_mut(&mut self) -> &mut [u8] {
        let store = &self.store;
        let Some(ptr) = store.data() else {
            return &mut [];
        };
        let ptr = ptr.cast::<u8>().as_ptr();
        // SAFETY: v8::SharedRef<v8::BackingStore> is similar to Arc<[u8]>,
        // it points to a fixed continuous slice of bytes on the heap.
        // We assume it's initialized and thus safe to read (though may not contain
        // meaningful data).
        // Note that we are likely violating Rust's safety rules here by assuming
        // nobody is mutating this buffer elsewhere, however in practice V8Slices
        // do not have overlapping read/write phases.
        unsafe {
            let ptr = ptr.add(self.range.start);
            std::slice::from_raw_parts_mut(ptr, self.range.len())
        }
    }
}

pub(crate) fn to_ranged_buffer<'s>(
    scope: &mut v8::HandleScope<'s>,
    value: v8::Local<v8::Value>,
) -> Result<(v8::Local<'s, v8::ArrayBuffer>, Range<usize>), v8::DataError> {
    if let Ok(view) = v8::Local::<v8::ArrayBufferView>::try_from(value) {
        let (offset, len) = (view.byte_offset(), view.byte_length());
        let buffer = view.buffer(scope).ok_or(v8::DataError::NoData {
            expected: "view to have a buffer",
        })?;
        let buffer = v8::Local::new(scope, buffer); // recreate handle to avoid lifetime issues
        return Ok((buffer, offset..offset + len));
    }
    let b: v8::Local<v8::ArrayBuffer> = value.try_into()?;
    let b = v8::Local::new(scope, b); // recreate handle to avoid lifetime issues
    Ok((b, 0..b.byte_length()))
}

impl FromV8 for V8Slice {
    fn from_v8(
        scope: &mut v8::HandleScope,
        value: v8::Local<v8::Value>,
    ) -> Result<Self, crate::Error> {
        to_ranged_buffer(scope, value)
            .and_then(|(b, r)| Self::from_buffer(b, r))
            .map_err(|_| crate::Error::ExpectedBuffer)
    }
}

impl Deref for V8Slice {
    type Target = [u8];
    fn deref(&self) -> &[u8] {
        self.as_slice()
    }
}

impl DerefMut for V8Slice {
    fn deref_mut(&mut self) -> &mut [u8] {
        self.as_slice_mut()
    }
}

impl AsRef<[u8]> for V8Slice {
    fn as_ref(&self) -> &[u8] {
        self.as_slice()
    }
}

impl AsMut<[u8]> for V8Slice {
    fn as_mut(&mut self) -> &mut [u8] {
        self.as_slice_mut()
    }
}

// Implement V8Slice -> bytes::Bytes
impl V8Slice {
    fn rc_into_byte_parts(self: Rc<Self>) -> (*const u8, usize, *mut V8Slice) {
        let (ptr, len) = {
            let slice = self.as_ref();
            (slice.as_ptr(), slice.len())
        };
        let rc_raw = Rc::into_raw(self);
        let data = rc_raw as *mut V8Slice;
        (ptr, len, data)
    }
}

impl From<V8Slice> for bytes::Bytes {
    fn from(v8slice: V8Slice) -> Self {
        let (ptr, len, data) = Rc::new(v8slice).rc_into_byte_parts();
        rawbytes::RawBytes::new_raw(ptr, len, data.cast(), &V8SLICE_VTABLE)
    }
}

// NOTE: in the limit we could avoid extra-indirection and use the C++ shared_ptr
// but we can't store both the underlying data ptr & ctrl ptr ... so instead we
// use a shared rust ptr (Rc/Arc) that itself controls the C++ shared_ptr
const V8SLICE_VTABLE: rawbytes::Vtable = rawbytes::Vtable {
    clone: v8slice_clone,
    drop: v8slice_drop,
    to_vec: v8slice_to_vec,
};

unsafe fn v8slice_clone(
    data: &rawbytes::AtomicPtr<()>,
    ptr: *const u8,
    len: usize,
) -> bytes::Bytes {
    let rc = Rc::from_raw(*data as *const V8Slice);
    let (_, _, data) = rc.clone().rc_into_byte_parts();
    std::mem::forget(rc);
    // NOTE: `bytes::Bytes` does bounds checking so we trust its ptr, len inputs
    // and must use them to allow cloning Bytes it has sliced
    rawbytes::RawBytes::new_raw(ptr, len, data.cast(), &V8SLICE_VTABLE)
}

unsafe fn v8slice_to_vec(data: &rawbytes::AtomicPtr<()>, ptr: *const u8, len: usize) -> Vec<u8> {
    let rc = Rc::from_raw(*data as *const V8Slice);
    std::mem::forget(rc);
    // NOTE: `bytes::Bytes` does bounds checking so we trust its ptr, len inputs
    // and must use them to allow cloning Bytes it has sliced
    Vec::from_raw_parts(ptr as _, len, len)
}

unsafe fn v8slice_drop(data: &mut rawbytes::AtomicPtr<()>, _: *const u8, _: usize) {
    drop(Rc::from_raw(*data as *const V8Slice))
}

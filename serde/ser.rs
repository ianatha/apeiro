// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
extern crate serde;

use std::convert::TryInto;

use self::serde::ser;
use self::serde::ser::Serialize;

use std::cell::RefCell;
use std::ops::DerefMut;

use crate::error::{Error, Result};
use crate::keys::v8_struct_key;
use crate::magic::transl8::MAGIC_FIELD;
use crate::magic::transl8::{opaque_deref_mut, opaque_recv, MagicType, ToV8};
use crate::{magic, ByteString, DetachedBuffer, StringOrBuffer, U16String, ZeroCopyBuf};

type JsValue<'s> = v8::Local<'s, v8::Value>;
type JsResult<'s> = Result<JsValue<'s>>;

type ScopePtr<'a, 'b, 'c> = &'c RefCell<&'b mut v8::HandleScope<'a>>;

pub fn to_v8<'a, T>(scope: &mut v8::HandleScope<'a>, input: T) -> JsResult<'a>
where
    T: Serialize,
{
    let scopeptr = RefCell::new(scope);
    let serializer = Serializer::new(&scopeptr);

    input.serialize(serializer)
}

/// Wraps other serializers into an enum tagged variant form.
/// Uses {"Variant": ...payload...} for compatibility with serde-json.
pub struct VariantSerializer<'a, 'b, 'c, S> {
    inner: S,
    scope: ScopePtr<'a, 'b, 'c>,
    variant: &'static str,
}

impl<'a, 'b, 'c, S> VariantSerializer<'a, 'b, 'c, S> {
    pub fn new(scope: ScopePtr<'a, 'b, 'c>, variant: &'static str, inner: S) -> Self {
        Self {
            inner,
            scope,
            variant,
        }
    }

    fn end(self, inner: impl FnOnce(S) -> JsResult<'a>) -> JsResult<'a> {
        let value = inner(self.inner)?;
        let scope = &mut *self.scope.borrow_mut();
        let null = v8::null(scope).into();
        let key = v8_struct_key(scope, self.variant).into();
        let obj = v8::Object::with_prototype_and_properties(scope, null, &[key], &[value]);
        Ok(obj.into())
    }
}

impl<'a, 'b, 'c, S> ser::SerializeTupleVariant for VariantSerializer<'a, 'b, 'c, S>
where
    S: ser::SerializeTupleStruct<Ok = JsValue<'a>, Error = Error>,
{
    type Ok = JsValue<'a>;
    type Error = Error;

    fn serialize_field<T: ?Sized + Serialize>(&mut self, value: &T) -> Result<()> {
        self.inner.serialize_field(value)
    }

    fn end(self) -> JsResult<'a> {
        self.end(S::end)
    }
}

impl<'a, 'b, 'c, S> ser::SerializeStructVariant for VariantSerializer<'a, 'b, 'c, S>
where
    S: ser::SerializeStruct<Ok = JsValue<'a>, Error = Error>,
{
    type Ok = JsValue<'a>;
    type Error = Error;

    fn serialize_field<T: ?Sized + Serialize>(
        &mut self,
        key: &'static str,
        value: &T,
    ) -> Result<()> {
        self.inner.serialize_field(key, value)
    }

    fn end(self) -> JsResult<'a> {
        self.end(S::end)
    }
}

pub struct ArraySerializer<'a, 'b, 'c> {
    pending: Vec<JsValue<'a>>,
    scope: ScopePtr<'a, 'b, 'c>,
}

impl<'a, 'b, 'c> ArraySerializer<'a, 'b, 'c> {
    pub fn new(scope: ScopePtr<'a, 'b, 'c>, len: Option<usize>) -> Self {
        let pending = match len {
            Some(len) => Vec::with_capacity(len),
            None => vec![],
        };
        Self { pending, scope }
    }
}

impl<'a, 'b, 'c> ser::SerializeSeq for ArraySerializer<'a, 'b, 'c> {
    type Ok = JsValue<'a>;
    type Error = Error;

    fn serialize_element<T: ?Sized + Serialize>(&mut self, value: &T) -> Result<()> {
        let x = value.serialize(Serializer::new(self.scope))?;
        self.pending.push(x);
        Ok(())
    }

    fn end(self) -> JsResult<'a> {
        let elements = self.pending.iter().as_slice();
        let scope = &mut *self.scope.borrow_mut();
        let arr = v8::Array::new_with_elements(scope, elements);
        Ok(arr.into())
    }
}

impl<'a, 'b, 'c> ser::SerializeTuple for ArraySerializer<'a, 'b, 'c> {
    type Ok = JsValue<'a>;
    type Error = Error;

    fn serialize_element<T: ?Sized + Serialize>(&mut self, value: &T) -> Result<()> {
        ser::SerializeSeq::serialize_element(self, value)
    }

    fn end(self) -> JsResult<'a> {
        ser::SerializeSeq::end(self)
    }
}

impl<'a, 'b, 'c> ser::SerializeTupleStruct for ArraySerializer<'a, 'b, 'c> {
    type Ok = JsValue<'a>;
    type Error = Error;

    fn serialize_field<T: ?Sized + Serialize>(&mut self, value: &T) -> Result<()> {
        ser::SerializeTuple::serialize_element(self, value)
    }

    fn end(self) -> JsResult<'a> {
        ser::SerializeTuple::end(self)
    }
}

pub struct ObjectSerializer<'a, 'b, 'c> {
    scope: ScopePtr<'a, 'b, 'c>,
    keys: Vec<v8::Local<'a, v8::Name>>,
    values: Vec<JsValue<'a>>,
}

impl<'a, 'b, 'c> ObjectSerializer<'a, 'b, 'c> {
    pub fn new(scope: ScopePtr<'a, 'b, 'c>, len: usize) -> Self {
        let keys = Vec::with_capacity(len);
        let values = Vec::with_capacity(len);
        Self {
            scope,
            keys,
            values,
        }
    }
}

impl<'a, 'b, 'c> ser::SerializeStruct for ObjectSerializer<'a, 'b, 'c> {
    type Ok = JsValue<'a>;
    type Error = Error;

    fn serialize_field<T: ?Sized + Serialize>(
        &mut self,
        key: &'static str,
        value: &T,
    ) -> Result<()> {
        let value = value.serialize(Serializer::new(self.scope))?;
        let scope = &mut *self.scope.borrow_mut();
        let key = v8_struct_key(scope, key).into();
        self.keys.push(key);
        self.values.push(value);
        Ok(())
    }

    fn end(self) -> JsResult<'a> {
        let scope = &mut *self.scope.borrow_mut();
        let null = v8::null(scope);
        let obj = v8::Object::with_prototype_and_properties(
            scope,
            null.into(),
            &self.keys[..],
            &self.values[..],
        );
        Ok(obj.into())
    }
}

pub struct MagicalSerializer<'a, 'b, 'c, T> {
    scope: ScopePtr<'a, 'b, 'c>,
    opaque: u64,
    p1: std::marker::PhantomData<T>,
}

impl<'a, 'b, 'c, T> MagicalSerializer<'a, 'b, 'c, T> {
    pub fn new(scope: ScopePtr<'a, 'b, 'c>) -> MagicalSerializer<'a, 'b, 'c, T> {
        Self {
            scope,
            opaque: 0,
            p1: std::marker::PhantomData::<T> {},
        }
    }
}

impl<'a, 'b, 'c, T: MagicType + ToV8> ser::SerializeStruct for MagicalSerializer<'a, 'b, 'c, T> {
    type Ok = JsValue<'a>;
    type Error = Error;

    fn serialize_field<U: ?Sized + Serialize>(
        &mut self,
        key: &'static str,
        value: &U,
    ) -> Result<()> {
        assert_eq!(key, MAGIC_FIELD);
        let ptr: &U = value;
        // SAFETY: MagicalSerializer only ever receives single field u64s,
        // type-safety is ensured by MAGIC_NAME checks in `serialize_struct()`
        self.opaque = unsafe { opaque_recv(ptr) };
        Ok(())
    }

    fn end(self) -> JsResult<'a> {
        // SAFETY: transerialization assumptions imply `T` is still alive.
        let x: &mut T = unsafe { opaque_deref_mut(self.opaque) };
        let scope = &mut *self.scope.borrow_mut();
        x.to_v8(scope)
    }
}

// Dispatches between magic and regular struct serializers
pub enum StructSerializers<'a, 'b, 'c> {
    Magic(MagicalSerializer<'a, 'b, 'c, magic::Value<'a>>),
    ZeroCopyBuf(MagicalSerializer<'a, 'b, 'c, ZeroCopyBuf>),
    MagicDetached(MagicalSerializer<'a, 'b, 'c, DetachedBuffer>),
    MagicByteString(MagicalSerializer<'a, 'b, 'c, ByteString>),
    MagicU16String(MagicalSerializer<'a, 'b, 'c, U16String>),
    MagicStringOrBuffer(MagicalSerializer<'a, 'b, 'c, StringOrBuffer>),
    Regular(ObjectSerializer<'a, 'b, 'c>),
}

impl<'a, 'b, 'c> ser::SerializeStruct for StructSerializers<'a, 'b, 'c> {
    type Ok = JsValue<'a>;
    type Error = Error;

    fn serialize_field<T: ?Sized + Serialize>(
        &mut self,
        key: &'static str,
        value: &T,
    ) -> Result<()> {
        match self {
            StructSerializers::Magic(s) => s.serialize_field(key, value),
            StructSerializers::ZeroCopyBuf(s) => s.serialize_field(key, value),
            StructSerializers::MagicDetached(s) => s.serialize_field(key, value),
            StructSerializers::MagicByteString(s) => s.serialize_field(key, value),
            StructSerializers::MagicU16String(s) => s.serialize_field(key, value),
            StructSerializers::MagicStringOrBuffer(s) => s.serialize_field(key, value),
            StructSerializers::Regular(s) => s.serialize_field(key, value),
        }
    }

    fn end(self) -> JsResult<'a> {
        match self {
            StructSerializers::Magic(s) => s.end(),
            StructSerializers::ZeroCopyBuf(s) => s.end(),
            StructSerializers::MagicDetached(s) => s.end(),
            StructSerializers::MagicByteString(s) => s.end(),
            StructSerializers::MagicU16String(s) => s.end(),
            StructSerializers::MagicStringOrBuffer(s) => s.end(),
            StructSerializers::Regular(s) => s.end(),
        }
    }
}

#[derive(Default, PartialEq)]
pub enum MapSerializerMode {
    #[default]
    None,
    ObjWithId(Option<i32>),
}

// Serializes to JS Objects, NOT JS Maps ...
pub struct MapSerializer<'a, 'b, 'c> {
    scope: ScopePtr<'a, 'b, 'c>,
    keys: Vec<v8::Local<'a, v8::Name>>,
    values: Vec<JsValue<'a>>,
    mode: MapSerializerMode,
}

impl<'a, 'b, 'c> MapSerializer<'a, 'b, 'c> {
    pub fn new(scope: ScopePtr<'a, 'b, 'c>, len: Option<usize>) -> Self {
        let keys = Vec::with_capacity(len.unwrap_or_default());
        let values = Vec::with_capacity(len.unwrap_or_default());
        Self {
            scope,
            keys,
            values,
            mode: MapSerializerMode::default(),
        }
    }
}

impl<'a, 'b, 'c> ser::SerializeMap for MapSerializer<'a, 'b, 'c> {
    type Ok = JsValue<'a>;
    type Error = Error;

    fn serialize_key<T: ?Sized + Serialize>(&mut self, key: &T) -> Result<()> {
        let key = key.serialize(Serializer::new(self.scope))?;
        if key.to_rust_string_lossy(&mut self.scope.borrow_mut()) == "$$obj_id" {
            self.mode = MapSerializerMode::ObjWithId(None);
        }
        self.keys.push(
            key.try_into()
                .map_err(|_| Error::Message("Serialized Maps expect String keys".into()))?,
        );
        Ok(())
    }

    fn serialize_value<T: ?Sized + Serialize>(&mut self, value: &T) -> Result<()> {
        match self.mode {
            MapSerializerMode::ObjWithId(None) => {
                let v8_obj_id_ref = value.serialize(Serializer::new(self.scope))?;
                let obj_id_ref = v8_obj_id_ref
                    .int32_value(&mut self.scope.borrow_mut())
                    .unwrap();
                self.mode = MapSerializerMode::ObjWithId(Some(obj_id_ref));
                self.keys.pop();
                Ok(())
            }
            _ => {
                let v8_value = value.serialize(Serializer::new(self.scope))?;
                self.values.push(v8_value);
                Ok(())
            }
        }
    }

    fn end(self) -> JsResult<'a> {
        debug_assert!(self.keys.len() == self.values.len());
        let scope = &mut *self.scope.borrow_mut();
        let null = v8::null(scope).into();
        let obj = v8::Object::with_prototype_and_properties(
            scope,
            null,
            &self.keys[..],
            &self.values[..],
        );
        match self.mode {
            MapSerializerMode::ObjWithId(Some(obj_id_ref)) => {
                set_in_scope_cache(scope, obj_id_ref, obj);
            }
            _ => {}
        }
        Ok(obj.into())
    }
}

pub struct Serializer<'a, 'b, 'c> {
    scope: ScopePtr<'a, 'b, 'c>,
}

impl<'a, 'b, 'c> Serializer<'a, 'b, 'c> {
    pub fn new(scope: ScopePtr<'a, 'b, 'c>) -> Self {
        Serializer { scope }
    }
}

macro_rules! forward_to {
    ($($name:ident($ty:ty, $to:ident, $lt:lifetime);)*) => {
        $(fn $name(self, v: $ty) -> JsResult<$lt> {
            self.$to(v as _)
        })*
    };
}

const MAX_SAFE_INTEGER: i64 = (1 << 53) - 1;
const MIN_SAFE_INTEGER: i64 = -MAX_SAFE_INTEGER;

impl<'a, 'b, 'c> ser::Serializer for Serializer<'a, 'b, 'c> {
    type Ok = v8::Local<'a, v8::Value>;
    type Error = Error;

    type SerializeSeq = ArraySerializer<'a, 'b, 'c>;
    type SerializeTuple = ArraySerializer<'a, 'b, 'c>;
    type SerializeTupleStruct = ArraySerializer<'a, 'b, 'c>;
    type SerializeTupleVariant = VariantSerializer<'a, 'b, 'c, ArraySerializer<'a, 'b, 'c>>;
    type SerializeMap = MapSerializer<'a, 'b, 'c>;
    type SerializeStruct = StructSerializers<'a, 'b, 'c>;
    type SerializeStructVariant = VariantSerializer<'a, 'b, 'c, StructSerializers<'a, 'b, 'c>>;

    forward_to! {
        serialize_i8(i8, serialize_i32, 'a);
        serialize_i16(i16, serialize_i32, 'a);

        serialize_u8(u8, serialize_u32, 'a);
        serialize_u16(u16, serialize_u32, 'a);

        serialize_f32(f32, serialize_f64, 'a);
    }

    fn serialize_i32(self, v: i32) -> JsResult<'a> {
        Ok(v8::Integer::new(&mut self.scope.borrow_mut(), v).into())
    }

    fn serialize_u32(self, v: u32) -> JsResult<'a> {
        Ok(v8::Integer::new_from_unsigned(&mut self.scope.borrow_mut(), v).into())
    }

    fn serialize_i64(self, v: i64) -> JsResult<'a> {
        let s = &mut self.scope.borrow_mut();
        // If i64 can fit in max safe integer bounds then serialize as v8::Number
        // otherwise serialize as v8::BigInt
        if (MIN_SAFE_INTEGER..=MAX_SAFE_INTEGER).contains(&v) {
            Ok(v8::Number::new(s, v as _).into())
        } else {
            Ok(v8::BigInt::new_from_i64(s, v).into())
        }
    }

    fn serialize_u64(self, v: u64) -> JsResult<'a> {
        let s = &mut self.scope.borrow_mut();
        // If u64 can fit in max safe integer bounds then serialize as v8::Number
        // otherwise serialize as v8::BigInt
        if v <= (MAX_SAFE_INTEGER as u64) {
            Ok(v8::Number::new(s, v as _).into())
        } else {
            Ok(v8::BigInt::new_from_u64(s, v).into())
        }
    }

    fn serialize_f64(self, v: f64) -> JsResult<'a> {
        let scope = &mut self.scope.borrow_mut();
        Ok(v8::Number::new(scope.deref_mut(), v).into())
    }

    fn serialize_bool(self, v: bool) -> JsResult<'a> {
        Ok(v8::Boolean::new(&mut *self.scope.borrow_mut(), v).into())
    }

    fn serialize_char(self, v: char) -> JsResult<'a> {
        self.serialize_str(&v.to_string())
    }

    fn serialize_str(self, v: &str) -> JsResult<'a> {
        let maybe_str = v8::String::new(&mut self.scope.borrow_mut(), v);

        // v8 string can return 'None' if buffer length > kMaxLength.
        if let Some(str) = maybe_str {
            Ok(str.into())
        } else {
            Err(Error::Message(String::from(
                "Cannot allocate String: buffer exceeds maximum length.",
            )))
        }
    }

    fn serialize_bytes(self, v: &[u8]) -> JsResult<'a> {
        Ok(slice_to_uint8array(&mut self.scope.borrow_mut(), v).into())
    }

    fn serialize_none(self) -> JsResult<'a> {
        Ok(v8::null(&mut *self.scope.borrow_mut()).into())
    }

    fn serialize_some<T: ?Sized + Serialize>(self, value: &T) -> JsResult<'a> {
        value.serialize(self)
    }

    fn serialize_unit(self) -> JsResult<'a> {
        Ok(v8::null(&mut *self.scope.borrow_mut()).into())
    }

    fn serialize_unit_struct(self, _name: &'static str) -> JsResult<'a> {
        Ok(v8::null(&mut *self.scope.borrow_mut()).into())
    }

    /// For compatibility with serde-json, serialises unit variants as "Variant" strings.
    fn serialize_unit_variant(
        self,
        _name: &'static str,
        _variant_index: u32,
        variant: &'static str,
    ) -> JsResult<'a> {
        Ok(v8_struct_key(&mut self.scope.borrow_mut(), variant).into())
    }

    fn serialize_newtype_struct<T: ?Sized + Serialize>(
        self,
        _name: &'static str,
        value: &T,
    ) -> JsResult<'a> {
        value.serialize(self)
    }

    fn serialize_newtype_variant<T: ?Sized + Serialize>(
        self,
        _name: &'static str,
        _variant_index: u32,
        variant: &'static str,
        value: &T,
    ) -> JsResult<'a> {
        let scope = self.scope;
        let x = self.serialize_newtype_struct(variant, value)?;
        VariantSerializer::new(scope, variant, x).end(Ok)
    }

    /// Serialises any Rust iterable into a JS Array
    fn serialize_seq(self, len: Option<usize>) -> Result<Self::SerializeSeq> {
        Ok(ArraySerializer::new(self.scope, len))
    }

    fn serialize_tuple(self, len: usize) -> Result<Self::SerializeTuple> {
        self.serialize_seq(Some(len))
    }

    fn serialize_tuple_struct(
        self,
        _name: &'static str,
        len: usize,
    ) -> Result<Self::SerializeTupleStruct> {
        self.serialize_tuple(len)
    }

    fn serialize_tuple_variant(
        self,
        _name: &'static str,
        _variant_index: u32,
        variant: &'static str,
        len: usize,
    ) -> Result<Self::SerializeTupleVariant> {
        Ok(VariantSerializer::new(
            self.scope,
            variant,
            self.serialize_tuple_struct(variant, len)?,
        ))
    }

    fn serialize_map(self, len: Option<usize>) -> Result<Self::SerializeMap> {
        // Serializes a rust Map (e.g: BTreeMap, HashMap) to a v8 Object
        // TODO: consider allowing serializing to v8 Maps (e.g: via a magic type)
        // since they're lighter and better suited for K/V data
        // and maybe restrict keys (e.g: strings and numbers)
        Ok(MapSerializer::new(self.scope, len))
    }

    /// Serialises Rust typed structs into plain JS objects.
    fn serialize_struct(self, name: &'static str, len: usize) -> Result<Self::SerializeStruct> {
        match name {
            ByteString::MAGIC_NAME => {
                let m = MagicalSerializer::<ByteString>::new(self.scope);
                Ok(StructSerializers::MagicByteString(m))
            }
            U16String::MAGIC_NAME => {
                let m = MagicalSerializer::<U16String>::new(self.scope);
                Ok(StructSerializers::MagicU16String(m))
            }
            ZeroCopyBuf::MAGIC_NAME => {
                let m = MagicalSerializer::<ZeroCopyBuf>::new(self.scope);
                Ok(StructSerializers::ZeroCopyBuf(m))
            }
            DetachedBuffer::MAGIC_NAME => {
                let m = MagicalSerializer::<DetachedBuffer>::new(self.scope);
                Ok(StructSerializers::MagicDetached(m))
            }
            StringOrBuffer::MAGIC_NAME => {
                let m = MagicalSerializer::<StringOrBuffer>::new(self.scope);
                Ok(StructSerializers::MagicStringOrBuffer(m))
            }
            magic::Value::MAGIC_NAME => {
                let m = MagicalSerializer::<magic::Value<'a>>::new(self.scope);
                Ok(StructSerializers::Magic(m))
            }
            _ => {
                // Regular structs
                let o = ObjectSerializer::new(self.scope, len);
                Ok(StructSerializers::Regular(o))
            }
        }
    }

    fn serialize_struct_variant(
        self,
        _name: &'static str,
        _variant_index: u32,
        variant: &'static str,
        len: usize,
    ) -> Result<Self::SerializeStructVariant> {
        let scope = self.scope;
        let x = self.serialize_struct(variant, len)?;
        Ok(VariantSerializer::new(scope, variant, x))
    }
}

pub fn slice_to_uint8array<'a>(
    scope: &mut v8::HandleScope<'a>,
    buf: &[u8],
) -> v8::Local<'a, v8::Uint8Array> {
    let buffer = if buf.is_empty() {
        v8::ArrayBuffer::new(scope, 0)
    } else {
        let store: v8::UniqueRef<_> = v8::ArrayBuffer::new_backing_store(scope, buf.len());
        // SAFETY: raw memory copy into the v8 ArrayBuffer allocated above
        unsafe {
            std::ptr::copy_nonoverlapping(
                buf.as_ptr(),
                store.data().unwrap().as_ptr() as *mut u8,
                buf.len(),
            )
        }
        v8::ArrayBuffer::with_backing_store(scope, &store.make_shared())
    };
    v8::Uint8Array::new(scope, buffer, 0, buf.len()).expect("Failed to create UintArray8")
}

fn set_in_scope_cache<'s>(
    scope: &mut v8::HandleScope<'s>,
    obj_id: i32,
    obj: v8::Local<'s, v8::Object>,
) {
    let v8_obj_cache_key = v8_struct_key(scope, "__obj_cache");
    let global = scope.get_current_context().global(scope);
    let v8_obj_cache = global.get(scope, v8_obj_cache_key.into()).unwrap();
    let v8_obj_cache = if v8_obj_cache.is_undefined() {
        let v8_obj_cache = v8::Object::new(scope);
        assert!(global
            .set(scope, v8_obj_cache_key.into(), v8_obj_cache.into())
            .unwrap());
        v8_obj_cache
    } else {
        v8_obj_cache.to_object(scope).unwrap()
    };
    let v8_obj_id = v8::Integer::new(scope, obj_id);
    assert!(v8_obj_cache
        .set(scope, v8_obj_id.into(), obj.into())
        .unwrap());
}

fn get_from_scope_cache<'s>(
    scope: &mut v8::HandleScope<'s>,
    obj_id: i32,
) -> Option<v8::Local<'s, v8::Object>> {
    let global = scope.get_current_context().global(scope);
    let v8_obj_cache_key = v8_struct_key(scope, "__obj_cache");
    let v8_obj_cache = global.get(scope, v8_obj_cache_key.into()).unwrap();
    let v8_obj_cache = if v8_obj_cache.is_undefined() {
        return None;
    } else {
        v8_obj_cache.to_object(scope).unwrap()
    };
    let v8_obj_id = v8::Integer::new(scope, obj_id);
    let v8_lookup_res = v8_obj_cache.get(scope, v8_obj_id.into()).unwrap();
    if v8_lookup_res.is_null_or_undefined() {
        return None;
    } else {
        Some(v8_lookup_res.to_object(scope).unwrap())
    }
}

pub fn resolve_fn<'s>(
    scope: &mut v8::HandleScope<'s>,
    obj: v8::Local<'s, v8::Object>,
) -> v8::Local<'s, v8::Function> {
    let src_key = v8_struct_key(scope, "src");
    let scope_key = v8_struct_key(scope, "$$scope");
    let src = obj
        .get(scope, src_key.into())
        .unwrap()
        .to_string(scope)
        .unwrap()
        .to_rust_string_lossy(scope);

    let obj = if let Some(scope_obj) = obj.get(scope, scope_key.into()) {
        if scope_obj.is_object() {
            let scope_obj = scope_obj.to_object(scope).unwrap();

            let obj_id_ref = v8_struct_key(scope, "$$__$$obj_id_ref");

            let obj_ref = scope_obj.get(scope, obj_id_ref.into()).unwrap();

            let obj = if obj_ref.is_number() {
                let obj_ref = obj_ref.int32_value(scope).unwrap();

                let obj = get_from_scope_cache(scope, obj_ref)
                    .expect(format!("obj {} not found in cache", obj_ref).as_str());
                v8_println(scope, obj.into());
                obj
            } else {
                v8::Object::new(scope)
            };

            obj
        } else {
            v8::Object::new(scope)
        }
    } else {
        v8::Object::new(scope)
    };

    let src = format!(
        r#"(function($sc1) {{
    return {};
}})"#,
        src
    );

    println!("{}", src);

    let v8_src = v8::String::new(scope, &src).unwrap();
    let script = v8::Script::compile(scope, v8_src, None);
    if let Some(script) = script {
        func_from_script(script, scope, obj)
    } else {
        println!("failed to compile script: {}", src);
        let src = format!(
            r#"(function x($sc1) {{ return function y() {{ throw new Error("bad function"); }} }})"#
        );
        let v8_src = v8::String::new(scope, &src).unwrap();
        println!("src: {}", src);
        let script = v8::Script::compile(scope, v8_src, None).unwrap();
        func_from_script(script, scope, obj)
    }
}

fn func_from_script<'a>(
    script: v8::Local<'a, v8::Script>,
    scope: &mut v8::HandleScope<'a>,
    obj: v8::Local<'a, v8::Object>,
) -> v8::Local<'a, v8::Function> {
    let script_output = script.run(scope).unwrap();
    let function: v8::Local<v8::Function> = unsafe { v8::Local::cast(script_output) };
    let undefined = v8::undefined(scope);
    let function_res = function
        .call(scope, undefined.into(), &[obj.into()])
        .unwrap();
    let function_res: v8::Local<v8::Function> = unsafe { v8::Local::cast(function_res) };
    if !obj.is_null_or_undefined() {
        let scope_key = v8_struct_key(scope, "$$scope");
        assert!(function_res
            .set(scope, scope_key.into(), obj.into())
            .unwrap());
    }
    return function_res;
}

pub fn is_object_ref<'s>(
    scope: &mut v8::HandleScope<'s>,
    obj: &v8::Local<'s, v8::Object>,
) -> Option<i32> {
    let v8_obj_id_key = v8_struct_key(scope, "$$__$$obj_id_ref");
    let v8_obj_id = obj.get(scope, v8_obj_id_key.into())?;
    if !v8_obj_id.is_null_or_undefined() {
        let obj_ref_id = v8_obj_id.to_integer(scope)?.value() as i32;
        println!("ref id found: {}", obj_ref_id);
        return Some(obj_ref_id);
    }
    None
}

pub fn is_function_ref<'s>(
    scope: &mut v8::HandleScope<'s>,
    obj: &v8::Local<'s, v8::Object>,
) -> Option<bool> {
    let v8_obj_id_key = v8_struct_key(scope, "$$type");
    let v8_obj_id = obj.get(scope, v8_obj_id_key.into())?;
    if !v8_obj_id.is_null_or_undefined() {
        return Some(true);
    }
    None
}

pub fn resolve_ref<'s>(
    scope: &mut v8::HandleScope<'s>,
    obj: v8::Local<'s, v8::Value>,
) -> v8::Local<'s, v8::Value> {
    if obj.is_array() {
        let arr: v8::Local<'s, v8::Array> = unsafe { v8::Local::cast(obj) };
        let len = arr.length();
        if len == 0 {
            return arr.into();
        }
        for i in 0..len {
            let v = arr.get_index(scope, i as u32).unwrap();
            let new_v = resolve_ref(scope, v);
            arr.set_index(scope, i, new_v);
        }
        return arr.into();
    } else if obj.is_object() {
        let obj = obj.to_object(scope).unwrap();
        if let Some(v8_obj_id) = is_object_ref(scope, &obj) {
            let v8_obj_cache = get_from_scope_cache(scope, v8_obj_id);
            return v8_obj_cache.expect("obj_id_ref not found in cache").into();
        }
        if let Some(true) = is_function_ref(scope, &obj) {
            return resolve_fn(scope, obj).into();
        }

        let indices = obj
            .to_object(scope)
            .unwrap()
            .get_own_property_names(
                scope,
                v8::GetPropertyNamesArgs {
                    mode: v8::KeyCollectionMode::OwnOnly,
                    property_filter: v8::ALL_PROPERTIES,
                    index_filter: v8::IndexFilter::SkipIndices,
                    key_conversion: v8::KeyConversionMode::KeepNumbers,
                },
            )
            .unwrap();

        let indices_length = indices.length();

        if indices_length == 0 {
            return obj.into();
        }

        for i in 0..indices_length {
            let k = indices.get_index(scope, i).unwrap();
            let v = obj.get(scope, k).unwrap();
            let new_v = resolve_ref(scope, v);
            obj.set(scope, k, new_v);
        }

        return obj.into();
    }
    return obj;
}

fn v8_println<'s>(
    context_scope: &mut v8::HandleScope<'s, v8::Context>,
    v8_value: v8::Local<'s, v8::Value>,
) {
    let value: serde_json::Value = serde_v8::from_v8(context_scope, v8_value).unwrap();
    let json = serde_json::to_string_pretty(&value).unwrap();
    println!("{}", json);
}

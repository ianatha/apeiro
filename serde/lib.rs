// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
mod de;
mod error;
mod keys;
mod magic;
mod payload;
mod ser;
mod serializable;
pub mod utils;

pub use de::{from_v8, from_v8_advanced, from_v8_cached, to_utf8, Deserializer, OBJ_COUNT_DE};
pub use error::{Error, Result};
pub use keys::KeyCache;
pub use magic::buffer::ZeroCopyBuf;
pub use magic::bytestring::ByteString;
pub use magic::detached_buffer::DetachedBuffer;
pub use magic::string_or_buffer::StringOrBuffer;
pub use magic::u16string::U16String;
pub use magic::Global;
pub use magic::Value;
pub use ser::{resolve_ref, to_v8, Serializer};
pub use serializable::{Serializable, SerializablePkg};

#[cfg(test)]
mod tests {
    use crate::utils::{v8_do, js_exec};

    use super::*;
	
    #[test]
    fn test_fn() -> std::result::Result<(), String> {
		v8_do(|| {
			let mut isolate = v8::Isolate::new(v8::CreateParams::default());
			let mut top_scope = &mut v8::HandleScope::new(&mut isolate);
			let context = v8::Context::new(&mut top_scope);
			let scope = &mut v8::ContextScope::new(top_scope, context);
			
			let input = js_exec(scope, r#"function a(x,y) { return x + y; }; a"#);
			let output = from_v8_advanced::<serde_json::Value>(scope, input.into()).unwrap();
			let obj = output.as_object().unwrap();
			assert_eq!(obj.get("$$type").unwrap().as_str().unwrap(), "$$function");
			assert_eq!(obj.get("$$scope").unwrap(), &serde_json::Value::Null);
			assert_eq!(obj.get("src").unwrap().as_str().unwrap(), "function a(x,y) { return x + y; }");
		});
		Ok(())
    }

	#[test]
    fn test_obj() -> std::result::Result<(), String> {
		v8_do(|| {
			let mut isolate = v8::Isolate::new(v8::CreateParams::default());
			let mut top_scope = &mut v8::HandleScope::new(&mut isolate);
			let context = v8::Context::new(&mut top_scope);
			let scope = &mut v8::ContextScope::new(top_scope, context);
			
			let input = js_exec(scope, r#"var obj_1 = { data: 1 }; var root = { a: obj_1, b: obj_1 }; root"#);
			let output = from_v8_advanced::<serde_json::Value>(scope, input.into()).unwrap();
			let obj = output.as_object().unwrap();
			assert_eq!(obj.get("$$obj_id").unwrap().as_u64().unwrap(), 101);
			assert_eq!(obj.get("a").unwrap().as_object().unwrap().get("$$obj_id").unwrap().as_u64().unwrap(), 102);
			assert_eq!(obj.get("a").unwrap().as_object().unwrap().get("data").unwrap().as_u64().unwrap(), 1);
			assert_eq!(obj.get("b").unwrap().as_object().unwrap().get("$$__$$obj_id_ref").unwrap().as_u64().unwrap(), 102);
			assert_eq!(obj.get("b").unwrap().as_object().unwrap().get("data"), None);
		});
		Ok(())
    }
}
use std::sync::Arc;
use std::sync::atomic::AtomicU32;

use serde::de::{SeqAccess};
use serde::de::{self};

use crate::Deserializer;
use crate::error::Error;
use crate::error::Result;

pub const RAMSON_DEFINITION_TAG: &str = "🐏$def";
pub const RAMSON_REFERENCE_TAG: &str = "🐏$ref";
pub const RAMSON_PROTOTYPE_TAG: &str = "🐏$proto";
pub const RAMSON_VALUE_TAG: &str = "🐏$val";

#[derive(Clone)]
pub struct RamsonType<'s> {
	cache: Option<Arc<AtomicU32>>,
	excluded: Vec<v8::Local::<'s, v8::Value>>,
}

impl<'s> RamsonType<'s> {
	pub fn off() -> Self {
		RamsonType {
			cache: None,
			excluded: vec![],
		}
	}

	pub fn on() -> Self {
		RamsonType {
			cache: Some(Arc::new(AtomicU32::new(0))),
			excluded: vec![],
		}
	}

	#[inline]
	pub fn is_active(&self) -> bool {
		self.cache.is_some()
	}

	pub fn exclude_once(&mut self, val: &v8::Local::<'s, v8::Value>) {
		self.excluded.push(val.clone());
	}

	pub fn is_active_for(&mut self, val: &v8::Local::<v8::Value>) -> bool {
		if self.is_active() {
			let search_in_excluded  = self.excluded.iter().enumerate().find(|&r| r.1 == val);
			if let Some((index_in_excluded, _)) = search_in_excluded {
				self.excluded.remove(index_in_excluded);
				false
			} else {
				true
			}
		} else {
			false
		}
	}

	pub fn next_id(&self) -> u32 {
		if let Some(cache) = &self.cache {
			return (*cache).fetch_add(1, std::sync::atomic::Ordering::SeqCst);
		} else {
			panic!();
		}
	}
}

pub struct ArrayContainer<'a, 'b, 's> {
	pub pos: u32,
	pub scope: &'b mut v8::HandleScope<'s>,
	pub input: v8::Local<'a, v8::Array>,
	pub obj_id_ref: u32,
	pub ramson: RamsonType<'a>,
}

impl<'de, 'a, 'b, 's> de::MapAccess<'de> for ArrayContainer<'a, 'b, 's>
where
	's: 'a
{
	type Error = crate::Error;

	fn next_key_seed<K: de::DeserializeSeed<'de>>(&mut self, seed: K) -> Result<Option<K::Value>> {
		if self.pos == 0 {
			let deserializer = de::IntoDeserializer::into_deserializer(RAMSON_DEFINITION_TAG);
			seed.deserialize(deserializer).map(Some)
		} else if self.pos == 1 {
			let deserializer = de::IntoDeserializer::into_deserializer(RAMSON_VALUE_TAG);
			seed.deserialize(deserializer).map(Some)
		} else {
			Ok(None)
		}
	}

	fn next_value_seed<V: de::DeserializeSeed<'de>>(&mut self, seed: V) -> Result<V::Value> {
		if self.pos == 0 {
			self.pos += 1;
			let deserializer = de::IntoDeserializer::into_deserializer(self.obj_id_ref);
			seed.deserialize(deserializer)	
		} else if self.pos == 1 {
			self.pos += 1;
			let mut deserializer = Deserializer::new(self.scope, self.input.into(), None, self.ramson.clone());
			seed.deserialize(&mut deserializer)	
		} else {
			return Result::Err(crate::Error::Message(
				"Call next_key_seed before next_value_seed".to_string(),
			));
		}
	}

	fn size_hint(&self) -> Option<usize> {
		None
	}
}

pub struct ObjectReference {
	pos: i32,
	obj_id_ref: u32,
}

impl ObjectReference {
	pub fn new(obj_id_ref: u32) -> Self {
		ObjectReference { pos: 0, obj_id_ref }
	}
}

impl<'de> de::MapAccess<'de> for ObjectReference {
	type Error = crate::Error;

	fn next_key_seed<K: de::DeserializeSeed<'de>>(&mut self, seed: K) -> Result<Option<K::Value>> {
		if self.pos != 0 {
			return Ok(None);
		}

		self.pos = 1;
		let deserializer = de::IntoDeserializer::into_deserializer(RAMSON_REFERENCE_TAG);
		return seed.deserialize(deserializer).map(Some);
	}

	fn next_value_seed<V: de::DeserializeSeed<'de>>(&mut self, seed: V) -> Result<V::Value> {
		if self.pos != 1 {
			return Result::Err(crate::Error::Message(
				"Call next_key_seed before next_value_seed".to_string(),
			));
		}

		let deserializer = de::IntoDeserializer::into_deserializer(self.obj_id_ref);
		seed.deserialize(deserializer)
	}

	fn size_hint(&self) -> Option<usize> {
		None
	}
}


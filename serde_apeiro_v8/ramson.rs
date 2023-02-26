use serde::de::SeqAccess;
use serde::de::{self};

use crate::error::Error;
use crate::error::Result;

pub const RAMSON_DEFINITION_TAG: &str = "🐏$def";
pub const RAMSON_REFERENCE_TAG: &str = "🐏$ref";
pub const RAMSON_PROTOTYPE_TAG: &str = "🐏$proto";
pub const RAMSON_VALUE_TAG: &str = "🐏$val";

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
	type Error = Error;

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


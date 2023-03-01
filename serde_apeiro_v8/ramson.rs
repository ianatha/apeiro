use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::sync::atomic::AtomicU32;

use serde::de::{self};

use crate::Deserializer;
use crate::error::Result;

pub const RAMSON_DEFINITION_TAG: &str = "🐏$def";
pub const RAMSON_REFERENCE_TAG: &str = "🐏$ref";
pub const RAMSON_PROTOTYPE_TAG: &str = "🐏$proto";
pub const RAMSON_ARRAY_VALUE_TAG: &str = "🐏$array";
pub const RAMSON_FUNCTION_SRC_TAG: &str = "🐏$src";
pub const RAMSON_FUNCTION_SCOPE_TAG: &str = "🐏$scope";

pub struct RamsonType {
	cache: Option<Arc<AtomicU32>>,
	excluded: Arc<Mutex<Vec<i32>>>,
	assigned: Arc<Mutex<HashMap<i32, u32>>>,
}

impl Clone for RamsonType {
	fn clone(&self) -> Self {
		RamsonType {
			cache: self.cache.clone(),
			excluded: self.excluded.clone(),
			assigned: self.assigned.clone(),
		}
	}
}

pub enum RamsonIdAssignment {
	New(u32),
	Assigned(u32),
	Excluded,
}

impl RamsonType {
	pub fn off() -> Self {
		RamsonType {
			cache: None,
			assigned: Arc::new(Mutex::new(HashMap::new())),
			excluded: Arc::new(Mutex::new(vec![])),
		}
	}

	pub fn on() -> Self {
		RamsonType {
			cache: Some(Arc::new(AtomicU32::new(0))),
			assigned: Arc::new(Mutex::new(HashMap::new())),
			excluded: Arc::new(Mutex::new(vec![])),
		}
	}

	#[inline]
	pub fn is_active(&self) -> bool {
		self.cache.is_some()
	}

	pub fn exclude_once(&mut self, val: &v8::Local::<v8::Value>) {
		let mut x = self.excluded.as_ref().lock().unwrap();
		x.push(val.get_hash().get());
		// self.excluded.get_mut().unwrap().push(val.clone());
		// self.excluded.push(val.clone());
	}

	pub fn cache_id(&mut self, val: &v8::Local::<v8::Value>) -> RamsonIdAssignment {
		if !self.is_active_for(val) {
			return RamsonIdAssignment::Excluded;
		};

		let hash = val.get_hash().get();
		let mut assigned = self.assigned.as_ref().lock().unwrap();
		match assigned.get(&hash) {
			Some(id) => {
				RamsonIdAssignment::Assigned(*id)
			},
			None => {
				let id = self.next_id();
				let prev = assigned.insert(hash, id);
				RamsonIdAssignment::New(id)
			}
		}
	}

	pub fn is_active_for(&mut self, val: &v8::Local::<v8::Value>) -> bool {
		if self.is_active() {
			let val_hash = val.get_hash().get();
			let mut excluded = self.excluded.as_ref().lock().unwrap();
			let search_in_excluded  = excluded.iter().enumerate().find(|&r| r.1 == &val_hash);
			if let Some((index_in_excluded, _)) = search_in_excluded {
				excluded.remove(index_in_excluded);
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

pub struct FunctionContainer<'a, 'b, 's> {
	pub pos: u32,
	pub obj_id_ref: u32,
	pub scope: &'b mut v8::HandleScope<'s>,
	pub input: v8::Local<'a, v8::Function>,
	pub ramson: RamsonType,
}


impl<'de, 'a, 'b, 's> de::MapAccess<'de> for FunctionContainer<'a, 'b, 's>
where
	's: 'a
{
	type Error = crate::Error;

	fn next_key_seed<K: de::DeserializeSeed<'de>>(&mut self, seed: K) -> Result<Option<K::Value>> {
		if self.pos == 0 {
			let deserializer = de::IntoDeserializer::into_deserializer(RAMSON_DEFINITION_TAG);
			seed.deserialize(deserializer).map(Some)
		} else if self.pos == 1 {
			let deserializer = de::IntoDeserializer::into_deserializer(RAMSON_FUNCTION_SCOPE_TAG);
			seed.deserialize(deserializer).map(Some)
		} else if self.pos == 2 {
			let deserializer = de::IntoDeserializer::into_deserializer(RAMSON_FUNCTION_SRC_TAG);
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

			let key = v8::String::new(self.scope, "$$scope").unwrap();
			let fn_scope = self.input.get(self.scope, key.into()).unwrap();
			let mut deserializer = Deserializer::new(self.scope, fn_scope, None, self.ramson.clone());
			seed.deserialize(&mut deserializer)
		} else if self.pos == 2 {
			self.pos += 1;

			let fnwrap_src_key = v8::String::new(self.scope, "$$src").unwrap();
			let src = self.input.get(self.scope, fnwrap_src_key.into()).unwrap();
			let src = if src.is_null_or_undefined() {
				self.input.to_string(self.scope).unwrap()
			} else {
				src.to_string(self.scope).unwrap()
			};
			let mut deserializer = Deserializer::new(self.scope, src.into(), None, self.ramson.clone());
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


pub struct ArrayContainer<'a, 'b, 's> {
	pub pos: u32,
	pub scope: &'b mut v8::HandleScope<'s>,
	pub input: v8::Local<'a, v8::Array>,
	pub obj_id_ref: u32,
	pub ramson: RamsonType,
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
			let deserializer = de::IntoDeserializer::into_deserializer(RAMSON_ARRAY_VALUE_TAG);
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
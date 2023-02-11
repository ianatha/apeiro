// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.

// TODO: maybe add a Payload type that holds scope & v8::Value
// so it can implement Deserialize by itself

// Classifies v8::Values into sub-types
#[derive(Debug)]
pub enum ValueType {
    Null,
    Bool,
    Number,
    String,
    Array,
    ArrayBuffer,
    ArrayBufferView,
    Object,
}

#[derive(Debug)]
pub enum ObjectSubType {
    Function,
    ClassInstance(String),
}

fn is_class_instance(scope: &mut v8::HandleScope, v: v8::Local<v8::Value>) -> Option<String> {
    if let Some(obj) = v.to_object(scope) {
        if let Some(prototype) = obj.get_prototype(scope) {
            if let Some(prototype) = prototype.to_object(scope) {
                let v8_constructor = v8::String::new(scope, "constructor").unwrap();
                if let Some(constructor) = prototype.get(scope, v8_constructor.into()) {
                    let s = constructor
                        .to_string(scope)
                        .map(|s| s.to_rust_string_lossy(scope))
                        .unwrap();
                    if s.contains("[native code]") {
                        return None;
                    }
                    println!("{}", s);
                    return Some(s);
                }
            }
        }
    }
    None
}

impl ObjectSubType {
    pub fn from_v8(scope: &mut v8::HandleScope, v: v8::Local<v8::Value>) -> Option<ObjectSubType> {
        if v.is_function() {
            return Some(Self::Function);
        } else if v.is_object() {
            return match is_class_instance(scope, v) {
                Some(src) => Some(Self::ClassInstance(src)),
                None => None,
            };
        }
        panic!("bad")
    }
}

impl ValueType {
    pub fn from_v8(v: v8::Local<v8::Value>) -> ValueType {
        if v.is_boolean() {
            return Self::Bool;
        } else if v.is_number() {
            return Self::Number;
        } else if v.is_string() {
            return Self::String;
        } else if v.is_array() {
            return Self::Array;
        } else if v.is_array_buffer() {
            return Self::ArrayBuffer;
        } else if v.is_array_buffer_view() {
            return Self::ArrayBufferView;
        } else if v.is_object() {
            return Self::Object;
        } else if v.is_null_or_undefined() {
            return Self::Null;
        }
        panic!("serde_v8: unknown ValueType for v8::Value")
    }
}

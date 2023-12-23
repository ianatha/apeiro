//! Implements a matcher for `serde_json::Value`s using the Mongo Query Language.
//!
//! Currently supports `$eq`, `$in`, `$ne`, `$nin`, `$and`, `$not`, `$or`, `$type` and `$nor`.

use serde::{Deserialize, Serialize};
use serde_json::Value;

trait MatchesValue {
    fn matches(&self, other: &Value) -> bool;
}

macro_rules! operator_struct {
    ($obj_matcher_case:ident, $struct_name:ident, $json_operator:expr) => {
        operator_struct!(
            $obj_matcher_case,
            $struct_name,
            $json_operator,
            Box<ObjMatcher>
        );
    };
    ($obj_matcher_case:ident, $struct_name:ident, $json_operator:expr, $type:ty) => {
        #[derive(Debug, Clone, Serialize, Deserialize)]
        pub struct $struct_name {
            #[serde(rename = $json_operator)]
            val: $type,
        }

        impl From<$struct_name> for ObjMatcher {
            fn from(obj: $struct_name) -> ObjMatcher {
                ObjMatcher::$obj_matcher_case(obj)
            }
        }
    };
}

operator_struct!(Eq, EqOperator, "$eq");

impl MatchesValue for EqOperator {
    #[inline]
    fn matches(&self, other: &Value) -> bool {
        self.val.matches(other)
    }
}

operator_struct!(In, InOperator, "$in", Vec<ObjMatcher>);

impl MatchesValue for InOperator {
    #[inline]
    fn matches(&self, other: &Value) -> bool {
        for v in &self.val {
            if v.matches(other) {
                return true;
            }
        }

        false
    }
}

operator_struct!(Ne, NeOperator, "$ne");

impl MatchesValue for NeOperator {
    #[inline]
    fn matches(&self, other: &Value) -> bool {
        !self.val.matches(other)
    }
}

operator_struct!(Nin, NinOperator, "$nin", Vec<ObjMatcher>);

impl MatchesValue for NinOperator {
    #[inline]
    fn matches(&self, other: &Value) -> bool {
        for v in &self.val {
            if v.matches(other) {
                return false;
            }
        }

        true
    }
}

operator_struct!(And, AndOperator, "$and", Vec<ObjMatcher>);

impl MatchesValue for AndOperator {
    #[inline]
    fn matches(&self, other: &Value) -> bool {
        for v in &self.val {
            if !v.matches(other) {
                return false;
            }
        }

        true
    }
}

operator_struct!(Not, NotOperator, "$not");

impl MatchesValue for NotOperator {
    #[inline]
    fn matches(&self, other: &Value) -> bool {
        if self.val.matches(other) {
            return false;
        }

        true
    }
}

// operator_struct!(NorOperator, "$nor", Vec<ObjMatcher>);

operator_struct!(Or, OrOperator, "$or", Vec<ObjMatcher>);

impl MatchesValue for OrOperator {
    #[inline]
    fn matches(&self, other: &Value) -> bool {
        for v in &self.val {
            if v.matches(other) {
                return true;
            }
        }

        false
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TypeOperator {
    #[serde(rename = "$type")]
    val: Vec<TypeOperatorMatcher>,
}

// impl MatchesValue for TypeOperator {
//     fn matches(&self, other: &Value) -> bool {
//         println!("matches value");
//         TypesOperator {
//             val: vec![self.val.clone()],
//         }.matches(other)
//     }
// }

// #[derive(Debug, Clone, Serialize, Deserialize)]
// pub struct TypesOperator {
//     #[serde(rename = "$type")]
//     val: Vec<TypeOperatorMatcher>,
// }

impl MatchesValue for TypeOperator {
    fn matches(&self, other: &Value) -> bool {
        let other_value_type = match other {
            Value::Null => TypeOperatorMatcher::Null,
            Value::Bool(_) => TypeOperatorMatcher::Bool,
            Value::Number(_) => TypeOperatorMatcher::Number,
            Value::String(_) => TypeOperatorMatcher::String,
            Value::Array(_) => TypeOperatorMatcher::Array,
            Value::Object(_) => TypeOperatorMatcher::Object,
        };

        for v in &self.val {
            if v == &other_value_type {
                return true;
            }
        }
        false
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
enum TypeOperatorMatcher {
    Null,
    Bool,
    Object,
    Array,
    String,
    Number,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ObjMatcher {
    Eq(EqOperator),
    In(InOperator),
    Ne(NeOperator),
    Nin(NinOperator),
    And(AndOperator),
    Not(NotOperator),
    Or(OrOperator),
    Type(TypeOperator),
    Value(Value),
}

impl ObjMatcher {
    #[must_use]
    pub fn matches(&self, other: &Value) -> bool {
        MatchesValue::matches(self, other)
    }
}

fn try_into_operator(value: Value) -> Option<ObjMatcher> {
    if let Some(obj) = value.as_object() {
        if obj.contains_key("$eq") {
            return Some(ObjMatcher::Eq(serde_json::from_value(value).unwrap()));
        } else if obj.contains_key("$in") {
            return Some(ObjMatcher::In(serde_json::from_value(value).unwrap()));
        } else if obj.contains_key("$ne") {
            return Some(ObjMatcher::Ne(serde_json::from_value(value).unwrap()));
        } else if obj.contains_key("$nin") {
            return Some(ObjMatcher::Nin(serde_json::from_value(value).unwrap()));
        } else if obj.contains_key("$and") {
            return Some(ObjMatcher::And(serde_json::from_value(value).unwrap()));
        } else if obj.contains_key("$not") {
            return Some(ObjMatcher::Not(serde_json::from_value(value).unwrap()));
        } else if obj.contains_key("$or") {
            return Some(ObjMatcher::Or(serde_json::from_value(value).unwrap()));
        } else if obj.contains_key("$type") {
            return Some(ObjMatcher::Type(serde_json::from_value(value).unwrap()));
        }
    }
    None
}

impl MatchesValue for ObjMatcher {
    fn matches(&self, other: &Value) -> bool {
        match self {
            ObjMatcher::Eq(op) => op.matches(other),
            ObjMatcher::In(op) => op.matches(other),
            ObjMatcher::Ne(op) => op.matches(other),
            ObjMatcher::Nin(op) => op.matches(other),
            ObjMatcher::And(op) => op.matches(other),
            ObjMatcher::Not(op) => op.matches(other),
            ObjMatcher::Or(op) => op.matches(other),
            ObjMatcher::Type(op) => op.matches(other),
            ObjMatcher::Value(value) => match try_into_operator(value.clone()) {
                Some(obj_matcher) => obj_matcher.matches(other),
                None => match value {
                    Value::Number(n) => match other {
                        Value::Number(n2) => n == n2,
                        _ => false,
                    },
                    Value::Object(o) => {
                        for (key, value) in o {
                            if let Some(obj_matcher) = try_into_operator(value.clone()) {
                                if !obj_matcher.matches(&other[key]) {
                                    return false;
                                }
                            } else if value != &other[key] {
                                return false;
                            }
                        }
                        true
                    }
                    _ => {
                        todo!("not implemented value match {:?}", other)
                    }
                },
            },
        }
    }
}

pub fn from_str(s: &str) -> Result<ObjMatcher, serde_json::Error> {
    let v: Value = serde_json::from_str(s)?;
    if let Some(obj_matcher) = try_into_operator(v.clone()) {
        Ok(obj_matcher)
    } else {
        Ok(ObjMatcher::Value(v))
    }
}

pub fn from_json(v: Value) -> Result<ObjMatcher, serde_json::Error> {
    if let Some(obj_matcher) = try_into_operator(v.clone()) {
        Ok(obj_matcher)
    } else {
        Ok(ObjMatcher::Value(v))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    pub fn test_operator_type() {
        let matcher = from_str(r#"{"a":{"$type":["number", "bool"]}}"#).unwrap();
        assert!(matcher.matches(&json!({"a": 1})));
        assert!(!matcher.matches(&json!({"a": "hello"})));
        assert!(matcher.matches(&json!({"a": true})));
        assert!(matcher.matches(&json!({"a": true, "b": "ignored"})));

        let matcher = from_str(r#"{"a":{"$type":["array"]}}"#).unwrap();
        assert!(!matcher.matches(&json!({"a": true})));
        assert!(matcher.matches(&json!({"a": [1,2,3]})));

        let matcher = from_str(r#"{"a":{"$type":["object"]}}"#).unwrap();
        assert!(!matcher.matches(&json!({"a": true})));
        assert!(matcher.matches(&json!({"a": {"hello":"world"}})));
    }

    #[test]
    pub fn test() {
        let matcher = from_str(r#"{"a":{"$or":[1, 2]}}"#).unwrap();
        assert!(matcher.matches(&json!({"a": 1})));
        assert!(matcher.matches(&json!({"a": 2})));
        assert!(!matcher.matches(&json!({"a": 3})));
    }

    #[test]
    pub fn test_in() {
        let matcher = from_str(r#"{"a":{"$in":[1, 2]}}"#).unwrap();
        assert!(matcher.matches(&json!({"a": 1})));
        assert!(matcher.matches(&json!({"a": 2})));
        assert!(!matcher.matches(&json!({"a": 3})));
    }

    #[test]
    pub fn test_ne() {
        let matcher = from_str(r#"{"a":{"$ne":1}}"#).unwrap();
        assert!(!matcher.matches(&json!({"a": 1})));
        assert!(matcher.matches(&json!({"a": 2})));
        assert!(matcher.matches(&json!({"a": 3})));
        assert!(matcher.matches(&json!({"a": "string"})));
        assert!(matcher.matches(&json!({"hello": "world"})));
    }

    #[test]
    pub fn test_nin() {
        let matcher = from_str(r#"{"a":{"$nin":[1]}}"#).unwrap();
        assert!(!matcher.matches(&json!({"a": 1})));
        assert!(matcher.matches(&json!({"a": 2})));
        assert!(matcher.matches(&json!({"a": 3})));
        assert!(matcher.matches(&json!({"a": "string"})));
        assert!(matcher.matches(&json!({"hello": "world"})));
    }

    #[test]
    pub fn test_and() {
        let matcher = from_str(r#"{"$and": [ {"a":1}, {"b":1} ]}"#).unwrap();
        assert!(matcher.matches(&json!({"a": 1, "b":1})));
        assert!(matcher.matches(&json!({"a": 1, "b":1, "hello": "world"})));
        assert!(!matcher.matches(&json!({"a": 1})));
        assert!(!matcher.matches(&json!({"b": 1})));
        assert!(!matcher.matches(&json!({"hello": "world"})));
    }

    #[test]
    pub fn test1() {
        let matcher = from_str(r#"{"a":{"$type":["number"]}}"#).unwrap();
        assert!(matcher.matches(&json!({"a": 1})));
        assert!(!matcher.matches(&json!({"a": "hello"})));
    }

    #[test]
    pub fn test2() {
        let input = r#"{"$or": [{ "a": {"$or": [ 1, 2 ]} }, { "b": 2 }]}"#;
        let matcher: ObjMatcher = from_str(input).unwrap();
        let val = json!({"a": 1});
        assert!(matcher.matches(&val));
    }

    #[test]
    pub fn test3() {
        let input = r#"{"$or": [{ "a": {"$or": [ 1, 2 ]} }, { "b": 2 }]}"#;
        let matcher: ObjMatcher = from_str(input).unwrap();
        let val = json!({"a": 2});
        assert!(matcher.matches(&val));
        let val = json!({"a": 3});
        assert!(!matcher.matches(&val));
        let val = json!({"b": 1});
        assert!(!matcher.matches(&val));
        let val = json!({"b": 2});
        assert!(matcher.matches(&val));
    }
}

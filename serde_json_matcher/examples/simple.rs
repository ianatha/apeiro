use serde_json::json;
use serde_json_matcher::from_str;

fn main() {
    let matcher = from_str(r#"{"a":{"$type":["number"]}}"#).unwrap();
    assert_eq!(matcher.matches(&json!({"a": 1})), true);
    assert_eq!(matcher.matches(&json!({"a": "hello"})), false);
}

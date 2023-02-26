// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
use serde::Deserialize;
use serde::Deserializer;

use serde_v8::utils::js_exec;
use serde_v8::utils::v8_do;
use serde_v8::ByteString;
use serde_v8::Error;
use serde_v8::U16String;
use serde_v8::ZeroCopyBuf;

fn dedo(
  code: &str,
  f: impl FnOnce(&mut v8::HandleScope, v8::Local<v8::Value>),
) {
  v8_do(|| {
    let isolate = &mut v8::Isolate::new(v8::CreateParams::default());
    let handle_scope = &mut v8::HandleScope::new(isolate);
    let context = v8::Context::new(handle_scope);
    let scope = &mut v8::ContextScope::new(handle_scope, context);
    let v = js_exec(scope, code);

    f(scope, v);
  })
}

#[test]
fn de_ramson_map() {
  dedo("let data = { one: 1 }; let foo = { a: data, b: data }; foo", |scope, v| {
    let map: serde_json::Value = serde_v8::ramson_from_v8(scope, v).unwrap();

    let rehydrated = serde_v8::ramson_to_v8(scope, map).unwrap();
    let global = scope.get_current_context().global(scope);
    let key = v8::String::new(scope, "data_rehydrated").unwrap();
    global.set(scope, key.into(), rehydrated).unwrap();

    let script = v8::String::new(scope, "data_rehydrated.a.two = 2").unwrap();
    let script = v8::Script::compile(
      scope,
      script.into(),
      None,
    ).unwrap();
    script.run(scope).unwrap();
    
    let script = v8::String::new(scope, "data_rehydrated.a.two").unwrap();
    let script = v8::Script::compile(
      scope,
      script.into(),
      None,
    ).unwrap();
    let two_in_a = script.run(scope).unwrap();

    let script = v8::String::new(scope, "data_rehydrated.b.two").unwrap();
    let script = v8::Script::compile(
      scope,
      script.into(),
      None,
    ).unwrap();
    let two_in_b = script.run(scope).unwrap();

    assert_eq!(two_in_a.to_number(scope).unwrap().value(), 2.0);
    assert_eq!(two_in_b.to_number(scope).unwrap().value(), 2.0);
  })
}

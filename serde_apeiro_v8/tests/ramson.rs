// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.

use serde_v8::utils::js_exec;
use serde_v8::utils::v8_do;

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
    println!("map: {:?}", map);

    let rehydrated = serde_v8::ramson_to_v8(scope, map).unwrap();
    let global = scope.get_current_context().global(scope);
    let key = v8::String::new(scope, "foo_rehydrated").unwrap();
    global.set(scope, key.into(), rehydrated).unwrap();

    let script = v8::String::new(scope, "foo_rehydrated.a.two = 2").unwrap();
    let script = v8::Script::compile(
      scope,
      script.into(),
      None,
    ).unwrap();
    script.run(scope).unwrap();
    
    let script = v8::String::new(scope, "foo_rehydrated.a.two").unwrap();
    let script = v8::Script::compile(
      scope,
      script.into(),
      None,
    ).unwrap();
    let two_in_a = script.run(scope).unwrap();

    let script = v8::String::new(scope, "foo_rehydrated.b.two").unwrap();
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

#[test]
fn de_ramson_prototype() {
  dedo("let parent = { one: 1 }; let data = { two: 2 }; Object.setPrototypeOf(data, parent); data", |scope, v| {
    let map: serde_json::Value = serde_v8::ramson_from_v8(scope, v).unwrap();
    println!("map: {:?}", map);

    let rehydrated = serde_v8::ramson_to_v8(scope, map).unwrap();
    let global = scope.get_current_context().global(scope);
    let key = v8::String::new(scope, "data_rehydrated").unwrap();
    global.set(scope, key.into(), rehydrated).unwrap();

    let script = v8::String::new(scope, "data_rehydrated.two").unwrap();
    let script = v8::Script::compile(
      scope,
      script.into(),
      None,
    ).unwrap();
    let data_in_child = script.run(scope).unwrap();

    let script = v8::String::new(scope, "data_rehydrated.one").unwrap();
    let script = v8::Script::compile(
      scope,
      script.into(),
      None,
    ).unwrap();
    let data_in_prototype = script.run(scope).unwrap();

    assert_eq!(data_in_child.to_number(scope).unwrap().value(), 2.0);
    assert_eq!(data_in_prototype.to_number(scope).unwrap().value(), 1.0);
  })
}

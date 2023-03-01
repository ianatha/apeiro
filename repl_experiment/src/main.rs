use std::io::{self, BufRead, Write};

use apeiro_engine::{Engine, DEngine, db::ApeiroPersistence};
use tokio::spawn;
use v8::GetPropertyNamesArgsBuilder;

pub fn v8_init() {
    let platform = v8::new_default_platform(0, false).make_shared();
    v8::V8::initialize_platform(platform);
    v8::V8::initialize();
}

fn js_exec<'s>(
    scope: &mut v8::HandleScope<'s>,
    src: &str,
) -> Option<v8::Local<'s, v8::Value>> {
    let code = v8::String::new(scope, src)?;
    let script = v8::Script::compile(scope, code, None)?;
    script.run(scope)
}
  
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    v8_init();

    let isolate = &mut v8::Isolate::new(v8::CreateParams::default());
    let handle_scope = &mut v8::HandleScope::new(isolate);
    let context = v8::Context::new(handle_scope);
    let scope = &mut v8::ContextScope::new(handle_scope, context);
    let scope = &mut v8::TryCatch::new(scope);

    let v8_key_scope = v8::String::new(scope, "$scope").unwrap();

    let stdin = io::stdin();
    print!("> ");
    io::stdout().flush()?;

    let mut persist_apeiro_scope: Option<serde_json::Value> = None;

    // read file scope.json into a string called x
    if let Result::Ok(stored_scope) = std::fs::read_to_string("scope.json") {
        let x: serde_json::Value = serde_json::from_str(&stored_scope).unwrap();
        let scope_in_v8 = serde_v8::ramson_to_v8(scope, &x).unwrap();
        persist_apeiro_scope = Some(x);
        context.global(scope).set(scope, v8_key_scope.into(), scope_in_v8).unwrap();
    }

    let mut init_script = apeiro_compiler::apeiro_compile("function empty() {}".into()).unwrap().compiled_src;
    init_script.push_str("\n globalThis.$scope = $scope");
    println!("{}", init_script);
    js_exec(scope, &init_script).unwrap();

    for line in stdin.lock().lines() {
        scope.reset();

        let line = line.unwrap();
        println!("{}", line);

        let r = apeiro_compiler::apeiro_compile_for_repl(line).unwrap();
        let line = r.compiled_src;
        println!("{}", line);

        let output = js_exec(scope, &line);
        if scope.has_caught() {
            println!("scope caught");
            let exception = scope.exception().unwrap();
            let s = exception.to_rust_string_lossy(scope);
            println!("!!!! {}", s);
        }
        if let Some(output) = output {
            let output: serde_json::Value = serde_v8::from_v8(scope, output)?;
            println!(">> {:?}", output);
        } else {
            
            println!("no output");
        }

        println!("");
        // let global_props = context.global(scope).get_own_property_names(scope, GetPropertyNamesArgsBuilder::new().build()).unwrap();
        // let global_props: serde_json::Value = serde_v8::from_v8(scope, global_props.into())?;
        // println!("global_props: {:?}", global_props);

        let apeiro_scope = context.global(scope).get(scope, v8_key_scope.into()).unwrap();
        let apeiro_scope: serde_json::Value = serde_v8::ramson_from_v8(scope, apeiro_scope)?;
        println!("apeiro_scope: {:?}", apeiro_scope);
        println!("");
        persist_apeiro_scope = Some(apeiro_scope);

        print!("> ");
        io::stdout().flush()?;
    }

    if let Some(persist_apeiro_scope) = persist_apeiro_scope {
        let x = persist_apeiro_scope.to_string();
        println!("{}", x);

        // write x to file "scope.json"
        let mut file = std::fs::File::create("scope.json")?;
        file.write_all(x.as_bytes())?;
    }

    Ok(())
}

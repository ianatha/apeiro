use std::{io::{self, BufRead, Write}, cell::RefCell, borrow::BorrowMut};

use futures::io::Flush;
use tokio::{sync::mpsc::Sender, io::BufReader};

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

pub struct Container {
    sender: tokio::sync::mpsc::Sender<EventLoopMsg>,
}

pub struct EventLoop {
    receiver: tokio::sync::mpsc::Receiver<EventLoopMsg>,
}


#[derive(Debug)]
pub enum EventLoopMsg {
    Line(String, tokio::sync::oneshot::Sender<serde_json::Value>),
    InspectScope(tokio::sync::oneshot::Sender<Vec<String>>),
    Shutdown,
}

impl EventLoop {
    pub fn new(receiver: tokio::sync::mpsc::Receiver<EventLoopMsg>) -> Self {
        Self {
            receiver,
        }
    }

    pub async fn run(&mut self) {
        let isolate = &mut v8::Isolate::new(v8::CreateParams::default());
        let handle_scope = &mut v8::HandleScope::new(isolate);
        let context = v8::Context::new(handle_scope);
        let scope = &mut v8::ContextScope::new(handle_scope, context);
        let scope = &mut v8::TryCatch::new(scope);
    
        let v8_key_scope = v8::String::new(scope, "$scope").unwrap();
    
        let mut persist_apeiro_scope: Option<serde_json::Value> = None;
    
        let mut init_script = apeiro_compiler::apeiro_compile("function empty() {}".into()).unwrap().compiled_src;
        init_script.push_str("\n globalThis.$scope = $scope");
        js_exec(scope, &init_script).unwrap();
    
        if let Result::Ok(stored_scope) = std::fs::read_to_string("scope.json") {
            let x: serde_json::Value = serde_json::from_str(&stored_scope).unwrap();
            let scope_in_v8 = serde_v8::ramson_to_v8(scope, &x).unwrap();
            persist_apeiro_scope = Some(x);
    
            let proxytoglobal = r#"new Proxy(globalThis, {
                get: function(target, property, receiver) {
                    return {
                        $val: Reflect.get(target, property, receiver),
                    };
                },
            });"#;
            let proxytoglobal = v8::String::new(scope, proxytoglobal).unwrap();
            let proxytoglobal = v8::Script::compile(scope, proxytoglobal, None).unwrap();
            let proxytoglobal = proxytoglobal.run(scope).unwrap();
    
            scope_in_v8.to_object(scope).unwrap().set_prototype(scope, proxytoglobal);
            context.global(scope).set(scope, v8_key_scope.into(), scope_in_v8).unwrap();
        }
    
        println!("event loop running");
        while let Some(msg) = self.receiver.recv().await {
            match msg {
                EventLoopMsg::InspectScope(response) => {
                    let apeiro_scope = context.global(scope).get(scope, v8_key_scope.into()).unwrap();
                    let apeiro_scope: serde_json::Value = serde_v8::ramson_from_v8(scope, apeiro_scope).unwrap();
                    let apeiro_scope_keys: Vec<String> = apeiro_scope.as_object().unwrap().keys().map(|x| x.to_string()).collect();
                    response.send(apeiro_scope_keys).unwrap();
                }
                EventLoopMsg::Line(line, response) => {
                    scope.reset();
            
                    let r = apeiro_compiler::apeiro_compile_for_repl(line);
                    if r.is_err() {
                        println!("apeiro_compiler error: {:?}", r.err().unwrap());
                        continue;
                    }
                    let line = r.unwrap().compiled_src;
            
                    let output = js_exec(scope, &line);
                    if scope.has_caught() {
                        println!("scope caught");
                        let exception = scope.exception().unwrap();
                        let s = exception.to_rust_string_lossy(scope);
                        println!("!!!! {}", s);
                    }
                    if let Some(output) = output {
                        if output.is_function() {
                            response.send(serde_json::Value::String("[Function]".into())).unwrap();
                        } else {
                            let output: serde_json::Value = serde_v8::from_v8(scope, output).unwrap();
                            response.send(output).unwrap();
                        }
                    } else {
                        println!("no output");
                    }
            
                    // let global_props = context.global(scope).get_own_property_names(scope, GetPropertyNamesArgsBuilder::new().build()).unwrap();
                    // let global_props: serde_json::Value = serde_v8::from_v8(scope, global_props.into())?;
                    // println!("global_props: {:?}", global_props);
            
                    let apeiro_scope = context.global(scope).get(scope, v8_key_scope.into()).unwrap();
                    let apeiro_scope: serde_json::Value = serde_v8::ramson_from_v8(scope, apeiro_scope).unwrap();
                    
                    persist_apeiro_scope = Some(apeiro_scope);
            
                    io::stdout().flush().unwrap();
            
                }
                EventLoopMsg::Shutdown => {
                    if let Some(persist_apeiro_scope) = &persist_apeiro_scope {
                        let x = persist_apeiro_scope.to_string();
                        println!("{}", x);
                
                        // write x to file "scope.json"
                let mut file = std::fs::File::create("scope.json").unwrap();
                    file.write_all(x.as_bytes()).unwrap();
                    }
                }
            }
        }
    }
}

impl Container {
	pub fn new_channels() -> (tokio::sync::mpsc::Sender<EventLoopMsg>, tokio::sync::mpsc::Receiver<EventLoopMsg>) {
		tokio::sync::mpsc::channel(100)
	}

    pub fn new(sender: tokio::sync::mpsc::Sender<EventLoopMsg>) -> Self {
        Self {
            sender,
        }
    }

    pub async fn run(&self, line: String) -> serde_json::Value {
        let (sender, receiver) = tokio::sync::oneshot::channel();
        self.sender.send(EventLoopMsg::Line(line, sender)).await.unwrap();
        receiver.await.unwrap()
    }

    pub async fn inspect_scope(&self) -> Vec<String> {
        let (sender, receiver) = tokio::sync::oneshot::channel();
        self.sender.send(EventLoopMsg::InspectScope(sender)).await.unwrap();
        receiver.await.unwrap()
    }

    pub async fn shutdown(&self) {
        self.sender.send(EventLoopMsg::Shutdown).await.unwrap();
    }
}

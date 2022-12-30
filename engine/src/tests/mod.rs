use tracing::{event, Level};

use crate::{Engine, StepResultStatus};

#[tokio::test]
async fn it_maintains_state() {
    let src = include_str!("counter.js").to_string();
    let mut engine = Engine::new_with_name(None, "test_01".into());

    let (mut state, mut snapshot) = engine
        .step_process(
            Some(src),
            None,
            "let counter = $usercode().default; counter.i(); log(\"hello\"); counter.g()"
                .to_string(),
        )
        .await
        .unwrap();

    assert_eq!(state.val.unwrap(), 1);

    for n in 2..100 {
        (state, snapshot) = engine
            .step_process(None, Some(snapshot), "counter.i(); counter.g()".to_string())
            .await
            .unwrap();

        assert_eq!(state.val.unwrap(), n);
    }
}

#[tokio::test]
async fn it_catches_exceptions() {
    let src = include_str!("counter.js").to_string();
    let mut engine = Engine::new(None);

    let (state, snapshot) = engine
        .step_process(
            Some(src),
            None,
            "let counter = $usercode().default; counter.i(); counter.g()".to_string(),
        )
        .await
        .unwrap();

    assert_eq!(state.val.unwrap(), 1);

    let result = engine
        .step_process(None, Some(snapshot), "bad_code_here()".to_string())
        .await;

    match result {
        Ok(_) => panic!("expected an error"),
        Err(e) => assert_eq!(e.to_string(), "Exception: ReferenceError: bad_code_here is not defined at js_stmt (<unknown>, line 1, column 1)"),
    }
}

#[tokio::test]
async fn test_execution() {
    let src = include_str!("counter.js").to_string();
    let mut engine = Engine::new(None);

    let (state, snapshot) = engine
        .step_process(
            Some(src),
            None,
            "let counter = $usercode().default; counter.i(); counter.g()".to_string(),
        )
        .await
        .unwrap();

    assert_eq!(state.val.unwrap(), 1);

    let result = engine
        .step_process(None, Some(snapshot), "bad_code_here()".to_string())
        .await;

    match result {
        Ok(_) => panic!("expected an error"),
        Err(e) => assert_eq!(e.to_string(), "Exception: ReferenceError: bad_code_here is not defined at js_stmt (<unknown>, line 1, column 1)"),
    }
}

// for development-time debugging of engine_runtime
#[allow(unused)]
fn deno_exec(input: &str) {
    let src_user_out = pristine_compiler::pristine_compile(input.to_string()).unwrap();

    let js_stmt = r#"$step(main);"#;
    let mut all_src = String::new();
    all_src.push_str(crate::get_engine_runtime().as_str());
    all_src.push_str(&src_user_out);
    all_src.push_str(js_stmt);

    std::fs::write("./test_for_deno.js", all_src).expect("Unable to read file");

    let child = std::process::Command::new("/usr/bin/env")
        .args(["deno", "run", "--inspect-brk", "./test_for_deno.js"])
        .stdin(std::process::Stdio::inherit())
        .stdout(std::process::Stdio::inherit())
        .stderr(std::process::Stdio::inherit())
        .spawn()
        .unwrap();

    let output = child.wait_with_output().unwrap();
    event!(Level::INFO, "{}", output.status);
}

#[derive(Default)]
struct StepAssertion {
    before_mbox: Vec<serde_json::Value>,
    after_status: StepResultStatus,
    after_suspension: Option<serde_json::Value>,
    after_value: Option<serde_json::Value>,
}

fn multiple_steps(input: &str, steps: Vec<StepAssertion>) {
    let src_user_out = pristine_compiler::pristine_compile(input.to_string()).unwrap();
    let js_stmt = r#"$step($usercode().default);"#;

    let mut engine = crate::Engine::new(Some(crate::get_engine_runtime));

    let mut snapshot = None;

    for assertion_step in steps {
        engine.mbox = assertion_step.before_mbox.into();

        let (state, new_snapshot) = tokio_test::block_on(engine.step_process(
            Some(src_user_out.clone()),
            snapshot,
            js_stmt.to_string(),
        ))
        .unwrap();

        assert_eq!(assertion_step.after_status, state.status);
        if let Some(after_suspension) = assertion_step.after_suspension {
            assert_eq!(after_suspension, state.suspension.unwrap());
        }
        if let Some(after_value) = assertion_step.after_value {
            assert_eq!(after_value, state.val.unwrap());
        }

        snapshot = Some(new_snapshot);
    }
}

#[test]
fn test_execution_recv() {
    let suspension_spec: serde_json::Value =
        serde_json::from_str("{\"$type\":[\"number\"]}").unwrap();

    multiple_steps(
        include_str!("fn_instrument.simple.in.ts"),
        vec![
            StepAssertion {
                after_status: StepResultStatus::SUSPEND,
                after_suspension: Some(suspension_spec.clone()),
                ..Default::default()
            },
            StepAssertion {
                before_mbox: vec![10.into()].into(),
                after_status: StepResultStatus::SUSPEND,
                after_suspension: Some(suspension_spec.clone()),
                ..Default::default()
            },
            StepAssertion {
                before_mbox: vec![100.into()].into(),
                after_status: StepResultStatus::DONE,
                after_value: Some(111.into()),
                ..Default::default()
            },
        ],
    );
}

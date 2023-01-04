use tracing::{event, Level};

use crate::{Engine, StepResultStatus};

#[derive(Default)]
struct StepAssertion {
    before_mbox: Vec<serde_json::Value>,
    after_status: StepResultStatus,
    after_suspension: Option<serde_json::Value>,
    after_value: Option<serde_json::Value>,
}

fn multiple_steps(input: &str, steps: Vec<StepAssertion>) {
    let src_user_out = pristine_compiler::pristine_compile(input.to_string()).unwrap();
    let mut engine = crate::Engine::new(Some(crate::get_engine_runtime));

    let mut funcs = None;
    let mut frames = None;

    for assertion_step in steps {
        engine.mbox = assertion_step.before_mbox.into();

        let (state, new_snapshot) =
            tokio_test::block_on(engine.step_process(src_user_out.clone(), funcs, frames)).unwrap();

        assert_eq!(assertion_step.after_status, state.status);
        if let Some(after_suspension) = assertion_step.after_suspension {
            assert_eq!(after_suspension, state.suspension.unwrap());
        }
        if let Some(after_value) = assertion_step.after_value {
            assert_eq!(after_value, state.val.unwrap());
        }

        funcs = new_snapshot.funcs;
        frames = new_snapshot.frames;

        println!(
            "\n\n\nfuncs: {}\nframes: {}",
            serde_json::to_string_pretty(&funcs).unwrap(),
            serde_json::to_string_pretty(&frames).unwrap()
        );
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

// thread 'tests::test_execution_recv' panicked at 'called `Result::unwrap()` on an `Err` value: Exception: Error: illegal frame restoration, targetting wrong fn, given 9159223381570806684 but it should have been 17061346647277084122 at engine ($new_frame, line 84, column 19)at usercode (secondary, line 127, column 27)at usercode (<unknown>, line 159, column 13)at engine ($step, line 150, column 26)', engine/src/tests/mod.rs:24:92

use crate::engine::{step_process, v8_init};
use std::sync::Once;

static INIT: Once = Once::new();

pub fn initialize() {
    INIT.call_once(|| {
        v8_init();
    });
}

#[tokio::test]
async fn it_maintains_state() {
    initialize();

    let src = include_bytes!("counter.js").to_vec();

    let (mut state, mut snapshot) = step_process(
        Some(src),
        None,
        None,
        "counter.i(); counter.g()".to_string(),
    )
    .await
    .unwrap();

    assert_eq!(state, "1");

    for n in 2..100 {
        (state, snapshot) = step_process(
            None,
            Some(state),
            Some(snapshot),
            "counter.i(); counter.g()".to_string(),
        )
        .await
        .unwrap();

        assert_eq!(state, n.to_string());
    }
}

#[tokio::test]
async fn it_catches_exceptions() {
    initialize();

    let src = include_bytes!("counter.js").to_vec();

    let (state, snapshot) = step_process(
        Some(src),
        None,
        None,
        "counter.i(); counter.g()".to_string(),
    )
    .await
    .unwrap();

    assert_eq!(state, "1");

    let result = step_process(
        None,
        Some(state),
        Some(snapshot),
        "bad_code_here()".to_string(),
    )
    .await;

    match result {
        Ok(_) => panic!("expected an error"),
        Err(e) => assert_eq!(e.to_string(), "Exception: ReferenceError: bad_code_here is not defined at js_stmt (<unknown>, line 1, column 1)"),
    }
}

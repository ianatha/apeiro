use crate::{step_process, v8_init};
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

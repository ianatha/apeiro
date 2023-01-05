use crate::apeiro_bundle_and_compile;

#[test]
fn test_bundle() {
    let _out = apeiro_bundle_and_compile(include_str!("fn_bundle.main.ts").into()).unwrap();
}

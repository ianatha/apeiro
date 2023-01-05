use crate::pristine_bundle_and_compile;

#[test]
fn test_bundle() {
    let _out = pristine_bundle_and_compile(include_str!("fn_bundle.main.ts").into()).unwrap();
}

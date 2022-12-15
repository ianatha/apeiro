use crate::{bundle_phase::pristine_bundle_and_compile_fs, pristine_bundle_and_compile};

#[test]
fn test_bundle() {
    let out = pristine_bundle_and_compile_fs("./src/tests/fn_bundle.main.ts".into()).unwrap();
    println!("{}", out);
    // compiler_test(
    //     include_str!("fn_instrument.simple.in.ts"),
    //     folder_chain!(),
    //     include_str!("fn_instrument.simple.out.js"),
    // );
}

#[test]
fn test_bundle_2() {
    let out = pristine_bundle_and_compile(include_str!("fn_bundle.main.ts").into()).unwrap();
    println!("{}", out);
    // compiler_test(
    //     include_str!("fn_instrument.simple.in.ts"),
    //     folder_chain!(),
    //     include_str!("fn_instrument.simple.out.js"),
    // );
}

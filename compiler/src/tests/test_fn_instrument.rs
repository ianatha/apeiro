use swc_common::chain;

use crate::{fn_decl_to_fn_expr, fn_instrument};

use super::compiler_test;

macro_rules! folder_chain {
    () => {
        |_| chain!(fn_decl_to_fn_expr::folder(), fn_instrument::folder(),)
    };
}

#[test]
fn test_fn_wrap_simple() {
    compiler_test(
        "function one() { return 1;}",
        folder_chain!(),
        r#"let one = $fn(function one() {
    let $f1 = $new_frame("14146478158333422237", null);
    let $sc1 = $scope(undefined, $f1);
    switch($f1.$pc){
        case 0:
            let __return_val = 1;
            $frame_end($f1);
            return __return_val;
    }
}, "14146478158333422237", null);
"#,
    );
}

// #[test]
// fn test_fn_generator() {
//     compiler_test(
//         "function *one() { yield 1; yield 2; return 4;}",
//         |_| generator::generator(Mark::fresh(Mark::root())),
//         r#"import _ts_generator from "@pristine/helpers/src/_ts_generator.mjs";
// function one() {
//     return _ts_generator(this, function(_state) {
//         switch(_state.label){
//             case 0:
//                 return [
//                     4,
//                     1
//                 ];
//             case 1:
//                 _state.sent();
//                 return [
//                     4,
//                     2
//                 ];
//             case 2:
//                 _state.sent();
//                 return [
//                     2,
//                     4
//                 ];
//         }
//     });
// }
// "#,
//     );
// }

#[test]
fn test_fn_wrap_export_default() {
    compiler_test(
        "export default function sum(a, b) { return a + b; }",
        folder_chain!(),
        r#"let sum = $fn(function(a, b) {
    let $f1 = $new_frame("6977906965653910212", null);
    let $sc1 = $scope(undefined, $f1);
    switch($f1.$pc){
        case 0:
            let __return_val = a + b;
            $frame_end($f1);
            return __return_val;
    }
}, "6977906965653910212", null);
export default sum;
"#,
    );
}

#[test]
fn test_fn_wrap_export_named() {
    compiler_test(
        "export function sum(a, b) { return a + b; }",
        folder_chain!(),
        r#"export let sum = $fn(function sum(a, b) {
    let $f1 = $new_frame("10735822781612323506", null);
    let $sc1 = $scope(undefined, $f1);
    switch($f1.$pc){
        case 0:
            let __return_val = a + b;
            $frame_end($f1);
            return __return_val;
    }
}, "10735822781612323506", null);
"#,
    );
}

#[test]
fn test_fn_instrument() {
    compiler_test(
        include_str!("fn_instrument.simple.in.ts"),
        folder_chain!(),
        include_str!("fn_instrument.simple.out.js"),
    );
}

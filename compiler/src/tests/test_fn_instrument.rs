use swc_common::chain;

use crate::{fn_decl_to_fn_expr, fn_instrument, stmt_exploder};

use super::compiler_test;

macro_rules! folder_chain {
    () => {
        |_| {
            chain!(
                fn_decl_to_fn_expr::folder(),
                stmt_exploder::folder(),
                fn_instrument::folder(),
            )
        }
    };
}

#[test]
fn test_fn_calls_many() {
    compiler_test(
        "function calls_many() { return a() + b(); }",
        folder_chain!(),
        r#"let calls_many = $fn(function calls_many() {
    let $f1 = $new_frame("1", null);
    let $sc1 = $scope(undefined, $f1);
    switch($f1.$pc){
        case 0:
            $sc1._temp$1 = {
                value: a()
            };
            $f1.$pc = 1;
        case 1:
            $sc1._temp$2 = {
                value: b()
            };
            $f1.$pc = 2;
        case 2:
            let __return_val = $sc1._temp$1.value + $sc1._temp$2.value;
            $frame_end($f1);
            return __return_val;
    }
}, "1", null);
"#,
    );
}

#[test]
fn test_fn_wrap_simple() {
    compiler_test(
        "function one() { return 1;}",
        folder_chain!(),
        r#"let one = $fn(function one() {
    let $f1 = $new_frame("1", null);
    let $sc1 = $scope(undefined, $f1);
    switch($f1.$pc){
        case 0:
            let __return_val = 1;
            $frame_end($f1);
            return __return_val;
    }
}, "1", null);
"#,
    );
}

#[test]
fn test_fn_wrap_two_receives() {
    compiler_test(
        r#"function two() {
    let a = $recv() + $magic($recv());
    let b = $recv();
    return a + b;
}"#,
        folder_chain!(),
        r#"let two = $fn(function two() {
    let $f1 = $new_frame("1", null);
    let $sc1 = $scope(undefined, $f1);
    switch($f1.$pc){
        case 0:
            $sc1._temp$1 = {
                value: $recv()
            };
            $f1.$pc = 1;
        case 1:
            $sc1._temp$3 = {
                value: $recv()
            };
            $f1.$pc = 2;
        case 2:
            $sc1._temp$2 = {
                value: $magic($sc1._temp$3.value)
            };
            $f1.$pc = 3;
        case 3:
            $sc1.a = {
                value: $sc1._temp$1.value + $sc1._temp$2.value
            };
            $f1.$pc = 4;
        case 4:
            $sc1._temp$1 = {
                value: $recv()
            };
            $f1.$pc = 5;
        case 5:
            $sc1.b = {
                value: $sc1._temp$1.value
            };
            $f1.$pc = 6;
        case 6:
            let __return_val = $sc1.a.value + $sc1.b.value;
            $frame_end($f1);
            return __return_val;
    }
}, "1", null);
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
fn test_fn_multi_assign() {
    compiler_test(
        "function sum() {
    const { a, b } = params()
    return a + b;
}",
        folder_chain!(),
        r#"let sum = $fn(function sum() {
    let $f1 = $new_frame("1", null);
    let $sc1 = $scope(undefined, $f1);
    switch($f1.$pc){
        case 0:
            $sc1._temp$1 = {
                value: params()
            };
            $f1.$pc = 1;
        case 1:
            $sc1._params = {
                value: $sc1._temp$1.value
            };
            $sc1.a = {
                value: $sc1._params.value.a
            };
            $sc1.b = {
                value: $sc1._params.value.b
            };
            $f1.$pc = 2;
        case 2:
            let __return_val = $sc1.a.value + $sc1.b.value;
            $frame_end($f1);
            return __return_val;
    }
}, "1", null);
"#,
    );
}

#[test]
fn test_fn_wrap_export_default() {
    compiler_test(
        "export default function sum(a, b) { return a + b; }",
        folder_chain!(),
        r#"let sum = $fn(function(a, b) {
    let $f1 = $new_frame("1", null);
    let $sc1 = $scope(undefined, $f1);
    switch($f1.$pc){
        case 0:
            let __return_val = a + b;
            $frame_end($f1);
            return __return_val;
    }
}, "1", null);
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
    let $f1 = $new_frame("1", null);
    let $sc1 = $scope(undefined, $f1);
    switch($f1.$pc){
        case 0:
            let __return_val = a + b;
            $frame_end($f1);
            return __return_val;
    }
}, "1", null);
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

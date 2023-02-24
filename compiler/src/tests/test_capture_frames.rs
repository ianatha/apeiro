use super::{compiler_test, functional_compiler_test};
use crate::{capture_frames, capture_scopes, decl_to_expr, hide_internal_arguments, stmt_exploder};
use swc_common::chain;

macro_rules! folder_chain2 {
    () => {
        |_| {
            chain!(
                decl_to_expr::folder(),
                stmt_exploder::folder(),
                capture_scopes::folder(),
                capture_frames::folder(),
                hide_internal_arguments::folder()
            )
        }
    };
}

macro_rules! folder_chain_for_repl {
    () => {
        |_| {
            chain!(
                decl_to_expr::folder(),
                stmt_exploder::folder(),
                capture_scopes::folder_for_repl(),
                capture_frames::folder(),
                hide_internal_arguments::folder()
            )
        }
    };
}

#[test]
fn repl_test() {
    compiler_test(
        "let a = 3 + 2; console.log(a);",
        folder_chain_for_repl!(),
        r#"
$scope.a = {
    $val: 3 + 2
};
console.log($scope.a.$val);
"#,
    );

    compiler_test(
        "let a = 3 + 2;",
        folder_chain_for_repl!(),
        r#"
$scope.a = {
    $val: 3 + 2
};
"#,
    );

    compiler_test(
        "console.log(a);",
        folder_chain_for_repl!(),
        r#"console.log($scope.a.$val);
"#,
    );

    //     compiler_test(
    //         "function test(x) { return x == 1; }",
    //         folder_chain2!(),
    //         r#"import _fn_wrap from "@apeiro/helpers/src/_fn_wrap.mjs";
    // import _new_scope from "@apeiro/helpers/src/_new_scope.mjs";
    // import _new_frame from "@apeiro/helpers/src/_new_frame.mjs";
    // $scope.test = {
    //     $val: _fn_wrap(function test($parentScope, x) {
    //         let $scope1 = _new_scope($parentScope);
    //         return x == 1;
    //     }, $scope)
    // };
    // "#
    //     )
}

#[test]
fn functional_test() {
    functional_compiler_test(
        r#"
        function increase_number(x) {
            return x + 1;
        }
        function newCounter(initValue) {
            let i = initValue;
            let double_i = i * 2;
            return {
                args: function args(arg1) {
                    return arguments;
                },
                inc: function inc() {
                    i = increase_number(i);
                    return i;
                },
                get: function get() {
                    return i;
                },
            };
        }"#,
        folder_chain2!(),
        vec![
            // test general functionality
            ("let a = $scope.newCounter.$val(10); a.get()", "10"),
            ("a.inc(); a.get()", "11"),
            ("a.inc()", "12"),
            ("a.get()", "12"),
            // test arguments
            ("JSON.stringify(a.args(\"hello\"))", "{\"0\":\"hello\"}"),
        ],
    )
}

#[test]
fn functional_expressions_convert_to_temp() {
    functional_compiler_test(
        r#"
        function increase_number(x) {
            return x + 1;
        }
        function return_scope() {
            let double_i = increase_number(2) + increase_number(2);
            return function() {
                return double_i;
            };
        }"#,
        folder_chain2!(),
        vec![(
            "let a = $scope.return_scope.$val(); a.$serialize.$$parentScope._temp$1.$val",
            "3",
        )],
    )
}

#[test]
fn test_fn_wrap_for_loop() {
    functional_compiler_test(
        r#"
        function countUntil(until) {
            var result = [];
            for (var i = 0; i < until; i++) {
                result.push(i);
            }
            return result;
        }"#,
        folder_chain2!(),
        vec![("$scope.countUntil.$val(5)", "0,1,2,3,4")],
    );
}

#[test]
fn functional_test_expand_args() {
    functional_compiler_test(
        r#"
        function noop(x) {
            return x;
        }
        
        function newCounter({ initValue, step }) {
            let i = initValue;
            return {
                inc: function inc() {
                    i = i + step;
                    return i;
                },
                get: function get() {
                    return i;
                },
            };
        }"#,
        folder_chain2!(),
        vec![
            (
                // "let a = newCounter({ initValue: 10, step: -1 }); a.inc()"
                "let a = $scope.newCounter.$val({ initValue: 10, step: -1 }); a.inc()",
                "9",
            ),
            ("a.inc()", "8"),
            ("a.get()", "8"),
        ],
    )
}

#[test]
fn functional_test_arrow_expr() {
    functional_compiler_test(
        r#"
        let newCounter = (initValue) => {
            let i = initValue;
            return {
                inc: () => {
                    i = i + 1;
                    return i;
                },
                get: () => i
            };
        }"#,
        folder_chain2!(),
        vec![
            ("let a = $scope.newCounter.$val(10); a.inc()", "11"),
            ("a.inc()", "12"),
            ("a.get()", "12"),
        ],
    );
}

#[test]
fn test_fn_wrap_example() {
    compiler_test(
        r#"let aqi = async () => {
    let pm25 = (
        await fetchJSON(
        "https://api.openaq.org/v2/latest?" +
            new URLSearchParams({
            limit: "10",
            page: "1",
            location: "San Francisco",
            offset: "0",
            sort: "desc",
            radius: "100000",
            order_by: "lastUpdated",
            dumpRaw: "false",
            })
        )
    ).results[1].measurements.find((m) => m.parameter === "pm25").value;
    if (pm25 > 50) console.email(null, `AQI is ${pm25}, close your windows!`);
};"#,
        folder_chain2!(),
        r#"import _fn_wrap from "@apeiro/helpers/src/_fn_wrap.mjs";
import _new_scope from "@apeiro/helpers/src/_new_scope.mjs";
import _new_frame from "@apeiro/helpers/src/_new_frame.mjs";
let $scope = _new_scope(undefined);
$scope.aqi = {
    $val: _fn_wrap(async function($parentScope) {
        let $scope = _new_scope($parentScope);
        let $frame = _new_frame(undefined, $scope);
        switch($frame.$pc){
            case 0:
                $scope._temp$2 = {
                    $val: fetchJSON("https://api.openaq.org/v2/latest?" + new URLSearchParams({
                        limit: "10",
                        page: "1",
                        location: "San Francisco",
                        offset: "0",
                        sort: "desc",
                        radius: "100000",
                        order_by: "lastUpdated",
                        dumpRaw: "false"
                    }))
                };
                $frame.$pc = 1;
            case 1:
                $scope._temp$1 = {
                    $val: (await $scope._temp$2.$val).results[1].measurements.find(_fn_wrap(function($parentScope, m) {
                        let $scope = _new_scope($parentScope);
                        return m.parameter === "pm25";
                    }, $scope))
                };
                $frame.$pc = 2;
            case 2:
                $scope.pm25 = {
                    $val: $scope._temp$1.$val.value
                };
                $frame.$pc = 3;
            case 3:
                if ($scope.pm25.$val > 50) console.email(null, `AQI is ${$scope.pm25.$val}, close your windows!`);
        }
    }, $scope)
};
"#,
    );
}

#[test]
fn functional_test_fn_if() {
    functional_compiler_test(
        r#"function test(input) {
            let res = "unknown"
            if (input % 2 == 0) {
                res = `${input} is even`;
            } else {
                res = `${input} is odd`;
            }
            return res;
        }"#,
        folder_chain2!(),
        vec![
            ("$scope.test.$val(5)", "5 is odd"),
            ("$scope.test.$val(2)", "2 is even"),
        ],
    )
}

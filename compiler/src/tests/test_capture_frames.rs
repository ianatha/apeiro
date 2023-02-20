use super::{compiler_test, functional_compiler_test};
use crate::{capture_frames, capture_scopes, decl_to_expr, stmt_exploder, hide_internal_arguments};
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

#[test]
fn test_arguments_hiding() {
    functional_compiler_test(
        r#"
        function newCounter(initValue) {
            let i = initValue;
            let double_i = i * 2;
            return {
                args: function args(arg1) {
                    return arguments;
                },
                inc: function inc() {
                    i = i + 1;
                    return i;
                },
                get: function get() {
                    return i;
                },
            };
        }"#,
        folder_chain2!(),
        vec![
            ("let a = $scope.newCounter.$val(10); a.get()", "10"),
            ("a.inc(); a.get()", "11"),
            ("a.inc()", "12"),
            ("a.get()", "12"),
            ("JSON.stringify(a.args(\"hello\"))", "{\"0\":\"hello\"}"),
        ],
    )
}

#[test]
fn test_fn_wrap_simple2() {
    compiler_test(
        r#"
        function func(x) {
            return x;
        }

        function newCounter(initValue) {
            let i = initValue;
            let double_i = func(i * 2) + func(i);
            return {
                init: function init(initValue) {
                    return newCounter(initValue);
                },
                inc: function inc() {
                    i = i + 1;
                    return i;
                },
                get: function get() {
                    return i;
                },
            };
        }"#,
        folder_chain2!(),
        r#"import _fn_wrap from "@apeiro/helpers/src/_fn_wrap.mjs";
import _new_scope from "@apeiro/helpers/src/_new_scope.mjs";
const $scope = _new_scope();
let newCounter = _fn_wrap(function newCounter(_$parentScope, initValue) {
    let $scope = _new_scope();
    $scope.i = {
        value: initValue
    };
    return {
        init: _fn_wrap(function init($parentScope, initValue) {
            const $scope = $parentScope;
            return newCounter(initValue);
        }, $scope, {
            needs_parent_scope: true,
            needs_imports_scope: false
        }),
        inc: _fn_wrap(function inc($parentScope) {
            const $scope = $parentScope;
            $scope.i.value = $scope.i.value + 1;
            return $scope.i.value;
        }, $scope, {
            needs_parent_scope: true,
            needs_imports_scope: false
        }),
        get: _fn_wrap(function get($parentScope) {
            const $scope = $parentScope;
            return $scope.i.value;
        }, $scope, {
            needs_parent_scope: true,
            needs_imports_scope: false
        })
    };
}, null, {
    needs_parent_scope: false,
    needs_imports_scope: false
});
"#,
    );
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
        vec![
            ("$scope.countUntil.$val(5)", "0,1,2,3,4"),
        ],
    );
}

#[test]
fn test_fn_wrap_simple2_run() {
    compiler_test(
        r#"
        function noop(x) {
            return x;
        }
        
        function newCounter({ initValue, config }) {
            let i = initValue;
            return {
                init: function init(initValue) {
                    return newCounter(initValue);
                },
                inc: function inc() {
                    i = i + 1;
                    return i;
                },
                get: function get() {
                    return i;
                },
            };
        }"#,
        folder_chain2!(),
        r#"import _fn_wrap from "@apeiro/helpers/src/_fn_wrap.mjs";
import _new_scope from "@apeiro/helpers/src/_new_scope.mjs";
const $scope = _new_scope();
let newCounter = _fn_wrap(function newCounter(_$parentScope, initValue) {
    let $scope = _new_scope();
    $scope.i = {
        value: initValue
    };
    return {
        init: _fn_wrap(function init($parentScope, initValue) {
            const $scope = $parentScope;
            return newCounter(initValue);
        }, $scope, {
            needs_parent_scope: true,
            needs_imports_scope: false
        }),
        inc: _fn_wrap(function inc($parentScope) {
            const $scope = $parentScope;
            $scope.i.value = $scope.i.value + 1;
            return $scope.i.value;
        }, $scope, {
            needs_parent_scope: true,
            needs_imports_scope: false
        }),
        get: _fn_wrap(function get($parentScope) {
            const $scope = $parentScope;
            return $scope.i.value;
        }, $scope, {
            needs_parent_scope: true,
            needs_imports_scope: false
        })
    };
}, null, {
    needs_parent_scope: false,
    needs_imports_scope: false
});
"#,
    );
}

#[test]
fn test_fn_wrap_arrow_expr() {
    compiler_test(
        r#"
        let newCounter = (initValue) => {
            let i = initValue;
            return {
                init: (initValue) => newCounter(initValue),
                inc: () => {
                    i = i + 1;
                    return i;
                },
                get: () => i
            };
        }"#,
        folder_chain2!(),
        r#"import _fn_wrap from "@apeiro/helpers/src/_fn_wrap.mjs";
import _new_scope from "@apeiro/helpers/src/_new_scope.mjs";
let newCounter = _fn_wrap(function(_$parentScope, initValue) {
    let $scope = _new_scope();
    $scope.i = {
        value: initValue
    };
    return {
        init: _fn_wrap(function($parentScope, initValue) {
            const $scope = $parentScope;
            return newCounter(initValue);
        }, $scope, {
            needs_parent_scope: true,
            needs_imports_scope: false
        }),
        inc: _fn_wrap(function($parentScope) {
            const $scope = $parentScope;
            $scope.i.value = $scope.i.value + 1;
            return $scope.i.value;
        }, $scope, {
            needs_parent_scope: true,
            needs_imports_scope: false
        }),
        get: _fn_wrap(function($parentScope) {
            const $scope = $parentScope;
            return $scope.i.value;
        }, $scope, {
            needs_parent_scope: true,
            needs_imports_scope: false
        })
    };
}, null, {
    needs_parent_scope: false,
    needs_imports_scope: false
});
"#,
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
let aqi = _fn_wrap(async function($parentScope) {
    let $scope = _new_scope($parentScope);
    $scope.pm25 = {
        value: (await fetchJSON("https://api.openaq.org/v2/latest?" + new URLSearchParams({
            limit: "10",
            page: "1",
            location: "San Francisco",
            offset: "0",
            sort: "desc",
            radius: "100000",
            order_by: "lastUpdated",
            dumpRaw: "false"
        }))).results[1].measurements.find(_fn_wrap(function(_$parentScope, m) {
            return m.parameter === "pm25";
        }, null, {
            needs_parent_scope: false,
            needs_imports_scope: false
        })).value
    };
    if ($scope.pm25.value > 50) console.email(null, `AQI is ${$scope.pm25.value}, close your windows!`);
}, $scope, {
    needs_parent_scope: true,
    needs_imports_scope: false
});
"#,
    );
}

#[test]
fn test_fn_if() {
    compiler_test(
        r#"function test() {
            let value = true;
            if (value) {
                console.log(value);
            }
        }"#,
        folder_chain2!(),
        r#"import _fn_wrap from "@apeiro/helpers/src/_fn_wrap.mjs";
import _new_scope from "@apeiro/helpers/src/_new_scope.mjs";
let aqi = _fn_wrap(async function($parentScope) {
    let $scope = _new_scope($parentScope);
    $scope.pm25 = {
        value: (await fetchJSON("https://api.openaq.org/v2/latest?" + new URLSearchParams({
            limit: "10",
            page: "1",
            location: "San Francisco",
            offset: "0",
            sort: "desc",
            radius: "100000",
            order_by: "lastUpdated",
            dumpRaw: "false"
        }))).results[1].measurements.find(_fn_wrap(function(_$parentScope, m) {
            return m.parameter === "pm25";
        }, null, {
            needs_parent_scope: false,
            needs_imports_scope: false
        })).value
    };
    if ($scope.pm25.value > 50) console.email(null, `AQI is ${$scope.pm25.value}, close your windows!`);
}, $scope, {
    needs_parent_scope: true,
    needs_imports_scope: false
});
"#,
    );
}

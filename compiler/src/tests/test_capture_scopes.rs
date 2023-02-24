use super::compiler_test;
use crate::{capture_scopes, decl_to_expr};
use swc_common::chain;

macro_rules! folder_chain2 {
    () => {
        |_| chain!(decl_to_expr::folder(), capture_scopes::folder(),)
    };
}

#[test]
fn test_fn_wrap_for_loop() {
    compiler_test(
        r#"
        function countUntil(until) {
            for (var i = 0; i < until; i++) {
                console.log(i);
            }
        }"#,
        folder_chain2!(),
        r#"import _fn_wrap from "@apeiro/helpers/src/_fn_wrap.mjs";
import _new_scope from "@apeiro/helpers/src/_new_scope.mjs";
let $scope = _new_scope(undefined);
$scope.countUntil = {
    $val: _fn_wrap(function countUntil($parentScope, until) {
        let $scope = _new_scope($parentScope);
        {
            let $scope1 = _new_scope($scope);
            $scope1.i = {
                $val: 0
            };
            while($scope1.i.$val < until){
                let $scope = _new_scope($scope1);
                console.log($scope.i.$val);
                $scope.i.$val++;
            }
        }
    }, $scope)
};
"#,
    );
}

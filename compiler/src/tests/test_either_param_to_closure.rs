use super::compiler_test;
use crate::either_param_to_closure;

#[test]
fn test_either_param_to_closure() {
    compiler_test(
        r#"function one() {
    either([
        [suspend(1, 2), (received) => console.log(received)],
        [suspend(3, 4), function (received) {
            return console.log(received);
        }],
    ]);
}"#,
        |_| either_param_to_closure::folder(),
        r#"function one() {
    either([
        [
            ()=>suspend(1, 2),
            function(received) {
                return console.log(received);
            }
        ],
        [
            ()=>suspend(3, 4),
            function(received) {
                return console.log(received);
            }
        ]
    ]);
}
"#,
    );
}

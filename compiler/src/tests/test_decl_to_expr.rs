use super::compiler_test;
use crate::decl_to_expr;

#[test]
fn test_fn_decl_to_fn_expr_simple() {
    compiler_test(
        "function one() { return 1; }",
        |_| decl_to_expr::folder(),
        r#"let one = function one() {
    return 1;
};
"#,
    );
}

#[test]
fn test_class() {
    compiler_test(
        "class One { constructor() { }
    one() {
        return 1;
    }
}",
        |_| decl_to_expr::folder(),
        r#"let One = class One {
    constructor(){}
    one() {
        return 1;
    }
};
"#,
    );
}

#[test]
fn test_class_2() {
    compiler_test(
        "class One { constructor() { }
    one() {
        return 1;
    }
}

class Two extends One {
    constructor() {
        super();
    }

    two() {
        return 2;
    }
}
",
        |_| decl_to_expr::folder(),
        r#"let One = class One {
    constructor(){}
    one() {
        return 1;
    }
};
let Two = class Two extends One {
    constructor(){
        super();
    }
    two() {
        return 2;
    }
};        
"#,
    );
}

#[test]
fn test_fn_decl_to_fn_expr_simple2() {
    compiler_test(
        "function one() { function two() { return 2; } return two; }",
        |_| decl_to_expr::folder(),
        r#"let one = function one() {
    let two = function two() {
        return 2;
    };
    return two;
};
"#,
    );
}

#[test]
fn test_fn_decl_to_fn_expr_export_default() {
    compiler_test(
        "export default function sum(a, b) { return a + b; }",
        |_| decl_to_expr::folder(),
        "let sum = function(a, b) {
    return a + b;
};
export default sum;
",
    );
}

#[test]
fn test_fn_decl_to_fn_expr_export_named() {
    compiler_test(
        "export function sum(a, b) { return a + b; }",
        |_| decl_to_expr::folder(),
        r#"export let sum = function sum(a, b) {
    return a + b;
};
"#,
    );
}

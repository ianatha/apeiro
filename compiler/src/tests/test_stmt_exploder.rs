use crate::stmt_exploder;

use super::compiler_test;

macro_rules! folder_chain {
    () => {
        |_| stmt_exploder::folder()
    };
}

#[test]
fn test_simple_explosion() {
    compiler_test(
        r#"function gof(x) {
    let y = g(x) + f(x);
    {
        let y = Random.number();
        console.log(y);
    }
    return g(f(y));
}
console.log(g(f(1)));
"#,
        folder_chain!(),
        r#"function gof(x) {
    const _temp$1 = g(x);
    const _temp$2 = f(x);
    let y = _temp$1 + _temp$2;
    delete _temp$1;
    delete _temp$2;
    {
        const _temp$5 = Random.number();
        let y = _temp$5;
        delete _temp$5;
        console.log(y);
    }
    const _temp$4 = f(y);
    const _temp$3 = g(_temp$4);
    return _temp$3;
    delete _temp$4;
    delete _temp$3;
}
console.log(g(f(1)));
"#,
    );
}

#[test]
fn test_while() {
    compiler_test(
        r#"function gof(x) {
    let y = g(x) + f(x);
    while(true) {
        let y = Random.number();
        console.log(y);
    }
    return g(f(y));
}
console.log(g(f(1)));
"#,
        folder_chain!(),
        r#"function gof(x) {
    const _temp$1 = g(x);
    const _temp$2 = f(x);
    let y = _temp$1 + _temp$2;
    delete _temp$1;
    delete _temp$2;
    while(true){
        const _temp$5 = Random.number();
        let y = _temp$5;
        delete _temp$5;
        console.log(y);
    }
    const _temp$4 = f(y);
    const _temp$3 = g(_temp$4);
    return _temp$3;
    delete _temp$4;
    delete _temp$3;
}
console.log(g(f(1)));
"#,
    );
}

#[test]
fn test_console_log() {
    compiler_test(
        r#"function gof(x) {
    console.log(x);
}
"#,
        folder_chain!(),
        r#"function gof(x) {
    console.log(x);
}
"#,
    );
}

#[test]
fn test_console_log_with_expr() {
    compiler_test(
        r#"function gof(x) {
    console.log(f(x));
}
"#,
        folder_chain!(),
        r#"function gof(x) {
    const _temp$2 = f(x);
    console.log(_temp$2);
    delete _temp$2;
}
"#,
    );
}

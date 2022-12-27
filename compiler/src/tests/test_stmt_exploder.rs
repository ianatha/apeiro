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
    var y = _temp$1 + _temp$2;
    delete _temp$1;
    delete _temp$2;
    const _temp$3 = Random.number();
    const _temp$4 = console.log(y1);
    {
        var y1 = _temp$3;
        _temp$4;
    }
    delete _temp$3;
    delete _temp$4;
    const _temp$6 = f(y);
    const _temp$5 = g(_temp$6);
    return _temp$5;
    delete _temp$6;
    delete _temp$5;
}
console.log(g(f(1)));
"#,
    );
}

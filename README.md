# Quickstart

```bash
$ cargo run --bin pristine_cli -- step engine/src/tests/counter "counter.inc(); counter.get()"
state: StepResult { status: SUSPEND, val: Some(Number(1)), suspension: None }

$ cargo run --bin pristine_cli -- step engine/src/tests/counter "counter.i(); counter.g()"
    Finished dev [unoptimized + debuginfo] target(s) in 0.07s
     Running `target/debug/pristine_stepper src/tests/counter 'counter.i(); counter.g()'`
state: StepResult { status: SUSPEND, val: Some(Number(2)), suspension: None }

$ cargo run --bin pristine_cli -- step engine/src/tests/counter "counter.i(); counter.g()"
    Finished dev [unoptimized + debuginfo] target(s) in 0.07s
     Running `target/debug/pristine_stepper src/tests/counter 'counter.i(); counter.g()'`
state: StepResult { status: SUSPEND, val: Some(Number(3)), suspension: None }

$ stat -f "%N %z" src/engine/tests/counter.*
engine/src/tests/counter.js 301
engine/src/tests/counter.snapshot.bin 44787
```
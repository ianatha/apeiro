# Quickstart

```bash
$ cargo run -- src/engine/tests/counter "counter.i(); counter.g()"
Finished dev [unoptimized + debuginfo] target(s) in 0.06s
     Running `target/debug/pristine_stepper src/tests/counter 'counter.i(); counter.g()'`
state: 1

$ cargo run -- src/engine/tests/counter "counter.i(); counter.g()"
    Finished dev [unoptimized + debuginfo] target(s) in 0.07s
     Running `target/debug/pristine_stepper src/tests/counter 'counter.i(); counter.g()'`
state: 2

$ cargo run -- src/engine/tests/counter "counter.i(); counter.g()"
    Finished dev [unoptimized + debuginfo] target(s) in 0.07s
     Running `target/debug/pristine_stepper src/tests/counter 'counter.i(); counter.g()'`
state: 3

$ stat -f "%N %z" src/engine/tests/counter.*
src/engine/tests/counter.js 262
src/engine/tests/counter.snapshot.bin 39836
src/engine/tests/counter.state.json 1
```
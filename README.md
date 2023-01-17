# Quickstart

## Run the daemon
```bash
$ cargo run --bin apeirod 
```

## ApeiroJS

* `log()`
* * `$recv(matcher)`
* `$send(pid, msg)`
* `$pid()`
* `$send("clock", { sender: $pid(), wait: ms });`
* `let new_pid = $spawn(fn)`

Every process must export a default value, that can be:
* a function,
* an async function,
* a generator.

## Create a process that adds two numbers and run through it
```bash
$ echo "export default function main() { let a = $recv({first:1}); let b = $recv({second:2}); return a + b; }" > func.js

$ cargo run --bin apeiro_cli -- new ./func.js

ProcNewOutput { id: "ejOVu8zP1aka3BUZgikTC", state: StepResult { status: SUSPEND, val: None, suspension: Some(Object {"first": Number(1)}) } }

$ cargo run --bin apeiro_cli -- send ejOVu8zP1aka3BUZgikTC 123 

StepResult { status: SUSPEND, val: None, suspension: Some(Object {"second": Number(2)}) }

$ cargo run --bin apeiro_cli -- send ejOVu8zP1aka3BUZgikTC 100

StepResult { status: DONE, val: Some(Number(223)), suspension: None }
```
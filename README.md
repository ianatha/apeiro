# Quickstart

## Run the daemon
```bash
$ cargo run --bin pristined 
```

## Create a process that adds two numbers and run through it
```bash
$ echo "export default function main() { let a = $recv({first:1}); let b = $recv({second:2}); return a + b; }" > func.js

$ cargo run --bin pristine_cli -- new ./func.js

ProcNewOutput { id: "ejOVu8zP1aka3BUZgikTC", state: StepResult { status: SUSPEND, val: None, suspension: Some(Object {"first": Number(1)}) } }

$ cargo run --bin pristine_cli -- send ejOVu8zP1aka3BUZgikTC 123 

StepResult { status: SUSPEND, val: None, suspension: Some(Object {"second": Number(2)}) }

$ cargo run --bin pristine_cli -- send ejOVu8zP1aka3BUZgikTC 100

StepResult { status: DONE, val: Some(Number(223)), suspension: None }
```
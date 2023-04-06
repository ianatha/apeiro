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
$ echo "export default function main() {
	let a = $recv({ a: {$type:["number"]}});

	let b = $recv({ b: {$type:["number"]}});

	if (b.b > 50) {
		let c = $recv({ c: {$type:["number"]}});
		return a.a+b.b;
	}
	
	return a.a+b.b;
}
}" > func.js

$ cargo run --bin ap -- new ./func.js

Object {"mid": String("JivvYkLzqk1q3JKphAffb")}
Ok(ProcNewOutput { id: "z_FciTLcNKnWRhykJbZAR", state: StepResult { status: SUSPEND, val: None, suspension: Some(Object {"a": Object {"$type": Array [String("number")]}}) } })

$ cargo run --bin ap -- send z_FciTLcNKnWRhykJbZAR '{"a":1}'

status: SUSPEND
val: 
suspension: {
  "b": {
    "$type": [
      "number"
    ]
  }
}

$ cargo run --bin ap -- send z_FciTLcNKnWRhykJbZAR '{"b":51}'

status: SUSPEND
val: 
suspension: {
  "c": {
    "$type": [
      "number"
    ]
  }
}

$ cargo run --bin ap -- send z_FciTLcNKnWRhykJbZAR '{"c":100}'

status: DONE
val: 152
```
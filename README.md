# 🚀 Quickstart

## 🏃‍♂️ Run the daemon
```bash
$ cargo run --bin apeirod 
```

## 🧩 ApeiroJS

* 📝 `log()`
* 📬 `$recv(matcher)`
* 📨 `$send(pid, msg)`
* 🔢 `$pid()`
* 🕒 `$send("clock", { sender: $pid(), wait: ms });`
* 🐣 `let new_pid = $spawn(fn)`

Every file declaring a process must export a default value, that can be:
* 🧮 a function,
* 🌐 an async function,
* 🔄 a generator.

## 🔢 Create a process that adds two numbers and run through it
```bash
$ echo 'export default function main() {
	let a = $recv({$type:["number"]});

	let b = $recv({$type:["number"]});

	if (b > 50) {
		let c = $recv({$type:["number"]});
		return a + b + c;
	}
	
	return a + b;
}' > func.js

$ cargo run --bin ap -- new --src ./func.js
Ok(ProcNewOutput { id: "yVPxlQTnVcclpV0c3tSWq", state: StepResult { status: SUSPEND, val: None, suspension: Some(Object {"$type": Array [String("number")]}) } })

$ cargo run --bin ap -- send yVPxlQTnVcclpV0c3tSWq '{"a":1}'

status: SUSPEND
val: 
suspension: {
  "$type": [
    "number"
  ]
}

$ cargo run --bin ap -- send yVPxlQTnVcclpV0c3tSWq '{"b":51}'

status: SUSPEND
val: 
suspension: {
  "c": {
    "$type": [
      "number"
    ]
  }
}

$ cargo run --bin ap -- send yVPxlQTnVcclpV0c3tSWq '{"c":100}'

status: DONE
val: 152
```

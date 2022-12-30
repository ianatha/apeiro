export default function *main() {
	let state = {};
	while (true) {
		yield state;
		let msg = $recv({cmd: {$type:["string"]}});
		log(JSON.stringify(msg));
		if (msg.cmd === "set") {
			state[msg.key] = msg.value;
		} else {
			throw new Error("unknown command");
		}
	}
}

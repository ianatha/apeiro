export default function *main() {
	let state = {};
	while (true) {
		yield state;

		let msg = $recv({cmd: true});
		if (msg.cmd === "set") {
			log("set " + msg.key);
			state[msg.key] = msg.value;
		}
	}
}
export default function *main() {
	let state = [];
	let doit = function(inmsg) {
		state.push(inmsg);
		state = state.slice(-5);
	}
	while (true) {
		yield state;
		let msg = $recv({msg: {$type:["string"]}});
		doit(msg);
	}
}

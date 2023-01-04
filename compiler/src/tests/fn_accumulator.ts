export default function *main() {
	let state = [];
	let doit = function(inmsg) {
		state.push(inmsg);
	}
	while (true) {
		yield Object.keys(state).length;
		let msg = $recv({msg: {$type:["string"]}});
		doit(msg);
	}
}

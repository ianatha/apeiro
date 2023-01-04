export default function *main() {
	while (true) {
		yield {waiting: true};
		let msg = $recv({x: {$type:["number"]}});
		yield msg.x * 100 + 3.14;
	}
}

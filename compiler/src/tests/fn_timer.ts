function every(ms, fn) {
	while (true) {
		$send("clock", {
			sender: $pid(),
			wait: ms,
		});
		let msg = $recv({ type: "$tick" });
		fn();
	}
}

export default function main() {
	every(5000, function() {
		log("tick");
	})	
}

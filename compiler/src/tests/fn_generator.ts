function recvNumber() {
	return $recv({ n : "number" });
}

function calculator(init: number) {
	let acc = init;

	return {
		inc: function () {
			let input = recvNumber();
			acc = acc + input;
			return acc;
		},
	};
};

export default function *main() {
	const a = calculator(1);
	while (true) {
		yield a.inc();
	}
}
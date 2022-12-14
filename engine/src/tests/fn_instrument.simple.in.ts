function addTo(x) {
	return x + $recv({ $type: "number" });
}

function multiplyBy(x) {
	return x * $recv({ $type: "number" });
}

function calculator(init: number) {
	"use strict";

	let acc = init;

	return {
		incTwice: function() {
			acc = acc + $recv({ $type: "number" });;
			acc = addTo(acc);
		},
		inc: function () {
			acc = addTo(acc);
		},
		mul: function() {
			acc = multiplyBy(acc);
		},
		get: function () {
			return acc;
		}
	};
};

function secondary(a) {
	try {
		log("before inc");
		a.inc();
		a.inc();
	} catch (e) {
		// try to swallow exception
	}
}

export default function main() {
	log("init");
	const a = calculator(1);
	log("before secondary")
	secondary(a);
	return a.get();
}
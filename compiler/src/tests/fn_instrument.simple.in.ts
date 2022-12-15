function addTo(x) {
	return x + $recv();
}

function multiplyBy(x) {
	return x * $recv();
}

function calculator(init: number) {
	"use strict";

	let acc = init;

	return {
		incTwice: function() {
			acc = acc + $recv();
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
		a.inc();
		a.inc();
	} catch (e) {
		// try to swallow exception
	}
}

export default function main() {
	const a = calculator(1);
	secondary(a);
	return a.get();
}
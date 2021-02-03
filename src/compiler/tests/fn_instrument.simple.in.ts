function accumulator(init: number) {
	"use strict";
	let sum = init;
	let product = init;

	return {
		acc: function acc(x) {
			sum = sum + x;
			product = product * x;
		},
		get: function get() {
			return [ sum, product ];
		},
	};
};

export { 
	accumulator as default
}
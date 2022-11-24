import { io } from "pristine://$";

function input() {
	"use strict";
	let val = null;

	while (val == null || val.num > 100) {
		val = io.random();
	}

	return val.num;
}

function counter() {
	"use strict";

	let sum = 0;

	while (sum < 100) {
		either([
			[input(), (num) => {
				sum =+ num;
			}],
			[wait(4 * 60 * 60), () => {
				sendEmail("still waiting for counter to reach 100");
			}]
		]);
	}

	return sum;
};

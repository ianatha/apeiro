import { z } from "https://deno.land/x/zod@v3.16.1/mod.ts";
import zodToJsonSchema from "https://esm.sh/zod-to-json-schema@3.17.0";

function recvNumber() {
	let schema = z.object({
		x: z.number(),
	});
	
	return $recv(zodToJsonSchema(schema));
}

function delay(d) {
	let i = 0;
	while (i < d) {
		log(i);
		i = i + 1;
		let j = 0;
		while (j < 10) {
			log(i ** j);
			j = j + 1;
		}
	}
	log("done");
}

function calculator(init: number) {
	let acc = init;

	return {
		inc: function () {
			delay(100);
			let input = recvNumber();
			log(input);
			$send("C5LPOu7JqLRjFQPnIcHb9", input);
			acc = acc + input;
		},
		get: function () {
			return acc;
		}
	};
};

export default function main() {
	const a = calculator(1);
	a.inc();
	a.inc();
	return a.get();
}
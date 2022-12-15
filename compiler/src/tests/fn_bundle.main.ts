import { z } from "https://deno.land/x/zod@v3.16.1/mod.ts";
import zodToJsonSchema from "https://esm.sh/zod-to-json-schema@3.17.0";

function recvNumber() {
	let schema = z.object({
		x: z.number(),
	});
	
	return $recv(zodToJsonSchema(schema));
}

function calculator(init: number) {
	let acc = init;

	return {
		inc: function () {
			acc = acc + recvNumber();
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
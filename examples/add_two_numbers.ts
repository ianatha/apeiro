import { z } from "https://deno.land/x/zod@v3.17.0/mod.ts";
import zodToJsonSchema from "https://esm.sh/zod-to-json-schema@3.17.0";
import { inputRest } from "apeiro://$"

export default function sum() {
	const x = inputRest(zodToJsonSchema(z.object({ val1: z.number().describe("First Number") }), "$"));
	const y = inputRest(zodToJsonSchema(z.object({ val2: z.number().describe("Second Number") }), "$"));
	return x.val1 + y.val2;
}

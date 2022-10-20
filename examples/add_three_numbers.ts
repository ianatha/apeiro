import { z } from "https://deno.land/x/zod@v3.17.0/mod.ts";
import { PristineContext } from "https://raw.githubusercontent.com/ianatha/pristine_std/main/index.ts";

export default function add_three_numbers(ctx: PristineContext) {
  let sum = 0;
  let i = 0;
  while (i < 3) {
    const [ input ] = recv(z.object({ val: z.number() }));
    sum += input.val;
    i++;
  }

  return sum;
}

import { z } from "https://deno.land/x/zod@v3.17.0/mod.ts";
import zodToJsonSchema from "https://esm.sh/zod-to-json-schema@3.17.0";
export default function sum($ctx) {
  const $f0 = $ctx.frame();

  switch ($f0.pc) {
    case 0:
      $f0.s._z$number = $ctx.call(z, z.number);
      $f0.pc++;

    case 1:
      $f0.s._z$object = $ctx.call(z, z.object, {
        val1: $f0.s._z$number
      });
      $f0.pc++;

    case 2:
      delete $f0.s._z$number;
      $f0.pc++;

    case 3:
      $f0.s._zodToJsonSchema = $ctx.call(0, zodToJsonSchema, $f0.s._z$object, "$");
      $f0.pc++;

    case 4:
      delete $f0.s._z$object;
      $f0.pc++;

    case 5:
      $f0.s.x = $ctx.call(0, $ctx.getFunction("$", "inputRest"), $f0.s._zodToJsonSchema);
      $f0.pc++;

    case 6:
      delete $f0.s._zodToJsonSchema;
      $f0.pc++;

    case 7:
      $f0.s._z$number2 = $ctx.call(z, z.number);
      $f0.pc++;

    case 8:
      $f0.s._z$object2 = $ctx.call(z, z.object, {
        val2: $f0.s._z$number2
      });
      $f0.pc++;

    case 9:
      delete $f0.s._z$number2;
      $f0.pc++;

    case 10:
      $f0.s._zodToJsonSchema2 = $ctx.call(0, zodToJsonSchema, $f0.s._z$object2, "$");
      $f0.pc++;

    case 11:
      delete $f0.s._z$object2;
      $f0.pc++;

    case 12:
      $f0.s.y = $ctx.call(0, $ctx.getFunction("$", "inputRest"), $f0.s._zodToJsonSchema2);
      $f0.pc++;

    case 13:
      delete $f0.s._zodToJsonSchema2;
      $f0.pc++;

    case 14:
      return $f0.s.x.val1 + $f0.s.y.val2;
      $f0.pc++;
  }

  $f0.end();
}
sum.$apeiro_func = true;
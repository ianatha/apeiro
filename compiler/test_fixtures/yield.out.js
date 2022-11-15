export default function* email_responder($ctx) {
  const $f0 = $ctx.frame();
  switch ($f0.pc) {
    case 0:
      $f0.s.last_email = {};
      $f0.pc++;
    case 1:
    while (true) {
      const $f1 = $f0.subframe();
      switch ($f1.pc) {
      case 0:
        yield $f0.s.last_email;
        $f1.pc++;
      case 1:
        $f0.s.last_email = $ctx.call(0, $ctx.getFunction("$", "rest", "input"), {
        email: {}
        });
        $f1.pc++;
      case 2:
        $f0.s._JSON$stringify = $ctx.call(JSON, JSON.stringify, $f0.s.last_email);
        $f1.pc++;
      case 3:
        $ctx.call(console, console.log, $f0.s._JSON$stringify);
        $f1.pc++;
      case 4:
        delete $f0.s._JSON$stringify;
        $f1.pc++;
      }
      $f1.end();
    }
    $f0.pc++;
    case 2:
    throw new Error("Should not reach here");
    $f0.pc++;
  }
  $f0.end();
  }
  email_responder.$apeiro_func = true;
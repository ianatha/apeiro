function number($ctx) {
	const $f0 = $ctx.frame();
  
	switch ($f0.pc) {
	  case 0:
		return 100;
		$f0.pc++;
	}
  
	$f0.end();
  }
  
  number.$apeiro_func = true;
  export default function simple($ctx, a, b) {
	const $f0 = $ctx.frame();
  
	switch ($f0.pc) {
	  case 0:
		$f0.s._number = $ctx.call(0, number);
		$f0.pc++;
  
	  case 1:
		$f0.s.c = $f0.s._number + b;
		$f0.pc++;
  
	  case 2:
		delete $f0.s._number;
		$f0.pc++;
  
	  case 3:
		$f0.s._square = $ctx.call(0, square, b);
		$f0.pc++;
  
	  case 4:
		$f0.s._$ctxGetFunction = $ctx.call(0, $ctx.getFunction("$", "input"), 10);
		$f0.pc++;
  
	  case 5:
		$f0.s.d = a * $f0.s._square * $f0.s._$ctxGetFunction;
		$f0.pc++;
  
	  case 6:
		delete $f0.s._$ctxGetFunction;
		$f0.pc++;
  
	  case 7:
		delete $f0.s._square;
		$f0.pc++;
  
	  case 8:
		$f0.s.e = $ctx.call(0, number);
		$f0.pc++;
  
	  case 9:
		return $f0.s.c + $f0.s.d;
		$f0.pc++;
	}
  
	$f0.end();
  }
  simple.$apeiro_func = true;
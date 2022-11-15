function simple($ctx, a, b) {
	const $f0 = $ctx.frame();
  
	switch ($f0.pc) {
	  case 0:
		$f0.s.c = a + b;
		$f0.pc++;
  
	  case 1:
		$f0.s._square = $ctx.call(0, square, b);
		$f0.pc++;
  
	  case 2:
		$f0.s.d = a * $f0.s._square;
		$f0.pc++;
  
	  case 3:
		delete $f0.s._square;
		$f0.pc++;
  
	  case 4:
		return $f0.s.c + $f0.s.d;
		$f0.pc++;
	}
  
	$f0.end();
  }
  
  simple.$apeiro_func = true;
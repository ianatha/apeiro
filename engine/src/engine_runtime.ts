// ## Global Datastoers

const $scopes: Map<number, Scope> = new Map();
let $frames: Frame[] = [];
type FunctionRef = any;
let $fns: Record<string, FunctionRef> = {};

// ## Scopes

interface Scope extends Record<string, any> {
	// [SCOPE_ID]: number;
}

const SYMBOL_SCOPE_ID = Symbol("pristine:scope:id");

$fns.$scopeLastId = 0;

const scopeIdGenerator = function() {
	return () => { return $fns.$scopeLastId++; };
}();

export function $scope(parent = undefined, frame?: Frame) {
	if (frame?.scope) {
		if (parent) {
			Object.setPrototypeOf(frame.scope, parent);
		}
		return frame.scope;
	}

	const newScopeId = scopeIdGenerator();
	const newScope: Scope = {
		// $$scope_id: newScopeId,
	 };

	Object.defineProperty(newScope, SYMBOL_SCOPE_ID, {
		value: newScopeId,
		configurable: false,
		enumerable: false,
		writable: false,
	});

	if (parent) {
		Object.setPrototypeOf(newScope, parent);
	}

	if (frame) {
		if (frame.scope) {
			throw new PristineEngineError("frame already has a scope");
		}
		frame.scope = newScope;
	}

	$fns["scope_" + newScopeId] = new WeakRef(newScope);
	// $scopes.set(newScopeId, new WeakRef(newScope));

	return newScope;
}

function $alive_funcs() {
	let result = {};
	let keys = Object.keys($fns);
	for (const key of keys) {
		let value = $fns[key];
		if (value.deref) {
			value = value.deref();
		};
		if (value !== undefined) {
			result[key] = value;
		}
	}
	return result;
}

function $reanimate_funcs(inp) {
	let keys = Object.keys(inp);
	for (const key of keys) {
		let value = inp[key];
		if (value !== undefined && typeof value == "object") {
			log("creating weakref");
			log(JSON.stringify(value));
			inp[key] = new WeakRef(value);
		}
	}
	return inp;
}
// ## Frames

type FnDeclId = string;

interface Frame {
	$pc: number;
	scope?: Scope;
	fnhash: FnDeclId;
}

class PristineEngineError extends Error {

}

function debugDisplayFrame(frame: Frame) {
	if (!frame) {
		return "null";
	}
	return "[Frame, fnhash=" + frame.fnhash + ", $pc=" + frame.$pc + "]";
}

export function $frame_end(dead_child: Frame) {
	if ($frames[$frames.length - 1] !== dead_child) {
		log("invalid frame");
		throw new PristineEngineError("invalid frame being dropped");
	}
	dead_child.scope = undefined;
	$frames.pop();
}

var current_frame = 0;

export function $new_frame(fnhash, last_fn_hash) {
	if ($frames[current_frame]) {
		if ($frames[current_frame].fnhash !== fnhash) {
			throw new PristineEngineError("illegal frame restoration, targetting wrong fn");
		}
		current_frame++;
		return $frames[current_frame - 1];
	}
	var $new_frame = { $pc: 0, idx: $frames.length, fnhash };
	$frames.push($new_frame);
	current_frame++;
	return $new_frame;
}

// ## Function Declartions


export function $fn(fn, hash, in_scope) {
	// $fns.set(hash, {
	// 	id: hash,
	// 	src: fn.toString(),
	// 	ref: new WeakRef(fn)
	// });
	fn.hash = hash;
	if (in_scope) {
		fn.$$scope = in_scope;
	} else {
		fn.$$scope = "undefined";
	}
	return fn;
}

// ## Suspend

const SYMBOL_SUSPEND = "pristine:suspend";

interface SuspendSignal {
	[SYMBOL_SUSPEND]: true;
	until: Record<string, any>;
}

class PristineSignal {
	constructor(public readonly until: Record<string, any>) {
	}
}

function $isSuspendSignal(e: any): e is PristineSignal {
	return e instanceof PristineSignal || e.pristine_suspend === true;
}

function $suspend(until: Record<string, any>) {
	throw new PristineSignal(until);
}

// ## Engine Entrypoint

interface SuspendStepResult {
	status: "SUSPEND";
	val?: any;
	suspension: Record<string, any>;
}

interface ErrorStepResult {
	status: "ERROR";
	err: any;
}

interface DoneStepResult {
	status: "DONE";
	val: any;
}


type StepResult = SuspendStepResult | ErrorStepResult | DoneStepResult;

function isGenerator(fn) {
	return fn?.constructor?.name === "GeneratorFunction";
}

function garbage_collect() {
	// for (const [key, value] of $scopes) {
	// 	if (!value.deref()) {
	// 		$scopes.delete(key);
	// 	}
	// }
}

export function $get_engine_status(): {
	current_frame: number;
	frames: any;
	funcs: any;
} {
	return {
		current_frame: current_frame,
		frames: $frames,
		funcs: $alive_funcs(),
	};
}

export default function $step(): StepResult {
	let fn = $usercode().default;
	current_frame = 0;
	$frames = $get_frames();
	$fns = $reanimate_funcs($get_funcs());
	let val = undefined;
	try {
		if (isGenerator(fn)) {
			let generator_instance = fn(this);
			val = generator_instance.next().value;
			generator_instance.next().value;
			return {
				status: "SUSPEND",
				suspension: {$generator: true},
				val: val,
			};
		} else {
			const val = fn();
			return {
				status: "DONE",
				val: val,
			};
		}
	} catch (e) {
		if ($isSuspendSignal(e)) {
			log("hello from $step3, before return");
			return {
				status: "SUSPEND",
				val,
				suspension: e.until,
			};
		} else {
			throw e;
		}
	}
}
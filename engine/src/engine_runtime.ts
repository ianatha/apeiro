// ## Global Datastoers

const $scopes: Map<number, Scope> = new Map();
let $frames: Frame[] = [];
type FunctionRef = any;
let $fns: Record<string, FunctionRef> = {};

// ## Scopes

interface Scope extends Record<string, any> {
	// [SCOPE_ID]: number;
}

const SYMBOL_SCOPE_ID = Symbol("apeiro:scope:id");

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
			throw new ApeiroEngineError("frame already has a scope");
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

class ApeiroEngineError extends Error {

}

function isFunctionAsync(fn: any) {
	return fn[Symbol.toStringTag] === 'AsyncFunction';
}

function debugDisplayFrame(frame: Frame) {
	if (!frame) {
		return "null";
	}
	return "[Frame, fnhash=" + frame.fnhash + ", $pc=" + frame.$pc + "]";
}

export function $frame_end(dead_child: Frame) {
	if ($frames[$frames.length - 1] !== dead_child) {
		throw new ApeiroEngineError("invalid frame being dropped");
	}
	dead_child.scope = undefined;
	$frames.pop();
}

var current_frame = 0;

export function $new_frame(fnhash, last_fn_hash) {
	if ($frames[current_frame]) {
		if ($frames[current_frame].fnhash !== fnhash) {
			throw new ApeiroEngineError("illegal frame restoration, targetting wrong fn, given " + fnhash + " but it should have been " + $frames[current_frame].fnhash);
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

const SYMBOL_SUSPEND = "apeiro:suspend";

interface SuspendSignal {
	[SYMBOL_SUSPEND]: true;
	until: Record<string, any>;
}

class ApeiroSignal {
	constructor(public readonly until: Record<string, any>) {
	}
}

export function $isSuspendSignal(e: any): e is ApeiroSignal {
	return e instanceof ApeiroSignal || e.apeiro_suspend === true;
}

function $suspend(until: Record<string, any>) {
	throw new ApeiroSignal(until);
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
	globalThis.$frames_snapshot_store = $frames;
	return {
		current_frame: current_frame,
		frames: $frames,
		funcs: $alive_funcs(),
	};
}

export default async function $step(): Promise<StepResult> {
	let fn = $usercode().default;
	current_frame = 0;
	if (globalThis.$frames_snapshot_store === undefined) {
		log("v2 reanimation")
		$frames = $get_frames();
		$fns = $reanimate_funcs($get_funcs());
	} else {
		$frames = globalThis.$frames_snapshot_store;
		log("frames length " + $frames.length);
		log("fns length " + Object.keys($fns).length);
	}
	let val = undefined;
	try {
		if (isGenerator(fn)) {
			let generator_instance = fn(this);
			val = generator_instance.next().value;
			let next_step = generator_instance.next();
			if (next_step.done) {
				log("generator done");
				return {
					status: "DONE",
					val: val,
				};
			} else {
				log("generator suspended");
				return {
					status: "SUSPEND",
					suspension: {$generator: true},
					val: val,
				};	
			}
		} else {
			if (isFunctionAsync(fn)) {
				log("async fn running");
				const val = await fn();
				log("async fn done");
				return {
					status: "DONE",
					val: val,
				};
			} else {
				const val = fn();
				log("sync fn done");
				return {
					status: "DONE",
					val: val,
				};
			}
		}
	} catch (e) {
		if ($isSuspendSignal(e)) {
			log("suspend");
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
// ## Global Datastoers

// const $scopes: Map<number, Scope> = new Map();
let $frames: Frame[] = [];
const $fns: Map<string, Function> = new Map();

// ## Scopes

interface Scope extends Record<string, any> {
	// [SCOPE_ID]: number;
}

const SYMBOL_SCOPE_ID = Symbol("pristine:scope:id");

const scopeIdGenerator = function() {
	let i = 0;
	return () => { return i++; };
}();

function $scope(parent = undefined, frame?: Frame) {
	if (frame?.scope) {
		return frame.scope;
	}

	log("new scope for frame " + (frame === undefined ? "undefined frame" : (frame?.fnhash ?? "nofnhash")));
	const newScopeId = scopeIdGenerator();
	const newScope: Scope = { };

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

	// $scopes.set(newScopeId, new WeakRef(newScope));

	return newScope;
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

function $frame_end(dead_child: Frame) {
	if ($frames[$frames.length - 1] !== dead_child) {
		log("invalid frame");
		throw new PristineEngineError("invalid frame being dropped");
	}
	dead_child.scope = undefined;
	$frames.pop();
}

var current_frame = 0;

function $new_frame(fnhash, last_fn_hash) {
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

function $fn(fn, hash, in_scope) {
	$fns.set(hash, new WeakRef(fn));
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
	current_frame: number;
	frames: any;
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

function $step(fn): StepResult {
	current_frame = 0;
	let val = undefined;
	try {
		if (isGenerator(fn)) {
			let generator_instance = fn(this);
			let attempts = 0;
			val = generator_instance.next().value;
			generator_instance.next().value; // this call should throw suspension

			return {
				status: "SUSPEND",
				suspension: {$generator: true},
				val: val,
				current_frame: current_frame,
				frames: $frames,
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
			return {
				status: "SUSPEND",
				val,
				suspension: e.until,
				current_frame: current_frame,
				frames: $frames,
			};
		} else {
			throw e;
		}
	}
}
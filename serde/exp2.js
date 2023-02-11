var scopeCounter = 0;

function $$new_scope(parentScope) {
	const result = {
		_id: scopeCounter++,
	};
	if (parentScope) {
		Object.setPrototypeOf(result, parentScope);
	}
	return result;
}

function $reifyReceivedFn(fnReceived) {
	const fn = eval("var " + fnReceived.$$name + " = " + fnReceived.$$src + "; " + fnReceived.$$name);
	const scope = fnReceived.$$parentScope;
	return $fn(fn, scope);
}


function $fn(functionDecl, scope) {
	const proxy = new Proxy(functionDecl, {
		has: function(target, property) {
			return property === "name" || property === "$serialize" || Reflect.has(target, property);
		},
		get: function(target, property, receiver) {
			if (property === "name") {
				return target.name + "_synthetic";
			} else if (property == "$serialize") {
				return {
					"$$parentScope": scope,
					"$$src": target.toString(),
					"$$name": target.name,
				}
			} else {
				return Reflect.get(target, property, receiver);
			}
		},
		apply: function(target, thisArg, parameters) {
			return target.apply(thisArg, [ scope, ...parameters ]);
		}		
	});

	return proxy;
}

const $scope = $$new_scope();


var refmap = new WeakMap();
var memson_id = 0;

function isClassInstance(x) {
	return Object.getPrototypeOf(x) !== Object.prototype &&
		Object.getPrototypeOf(x).constructor.toString().startsWith("class");
}

function pub_memson(d) {
	const refs = {}
	const data = memson(d, refs);
	return {
		data,
		refs,
	};
}

function memson(d, refs) {
	// Object.getPrototypeOf(a).constructor.toString()
// 
	if (typeof d === "object") {
		if (d._id) {
			if (refs[d._id] === undefined) {
				refs[d._id] = d;
			}
			return { $$ref: d._id };
		}
		const res = {};
		if (isClassInstance(d)) {
			res['$$class'] = true;
			res['$$src'] = Object.getPrototypeOf(d).constructor.toString();
		}
		for (let k in d) {
			res[k] = memson(d[k], refs);
		}
		return res;
	} else if (typeof d === "function") {
		return memson(d.$serialize, refs);
	}
	return d;
}

let refs = {};

function unmemson(d, refs) {
	if (typeof d === "object") {
		if (d.$$ref) {
			return refs[d.$$ref];
		}
		if (d.$$src && d.$$name) {
			d.$$parentScope = unmemson(d.$$parentScope, refs);
			return $reifyReceivedFn(d);
		}
		const res = {};
		for (let k in d) {
			if (k === "$$class") continue;
			if (k === "$$src") continue;
			res[k] = unmemson(d[k], refs);
		}
		if (d.$$class && d.$$src) {
			let k = eval("var k = " + d.$$src + "; k");
			Object.setPrototypeOf(res, k.prototype);
		}
		return res;
	}
	return d;
}


function $class(k) {
	return k;
}

let $state = {};
$state.get = function () {
	return class LolaMarker {
		constructor() {
			this.marker = true;
		}
	}	
}

$state.Ouija = class  {
	constructor() {
		this.marker = true;
	}
}

class Better extends $state.get("Ouija") {

}

console.log(new Better());
const test = new Better();

let stored = JSON.parse(`{"$$class":true,"$$src":"class Counter extends SimpleCounter {\\n\\tconstructor() {\\n\\t\\tsuper();\\n\\t\\tthis.i = 0;\\n\\t}\\n\\t\\n\\tinc() {\\n\\t\\tthis.i++;\\n\\t}\\n\\t\\n\\tget() {\\n\\t\\treturn this.i;\\n\\t}\\n}","magic":"potter","i":1}`);

class SimpleCounter {
	constructor() {
		this.magic = "potter";
	}

}
// only works if SimpleCounter is already defined
let counter_instance = unmemson(stored, []);
console.log(counter_instance);

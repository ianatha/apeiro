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

let newCounter = $fn(function newCounter($parentScope, initValue) {
    let $scope = $$new_scope($parentScope);
    $scope.i = {
        value: initValue
    };
    console.log(arguments);
    console.log($parentScope);
    return {
        fourty_two: $fn(function fourty_two($parentScope) {
            const $scope = $parentScope;
            return {
                val: 42,
                double: $fn(function double($parentScope) {
                    const $scope = $parentScope;
                    $scope.i.value = $scope.i.value * 2;
                },  $scope)
            };
        }, $scope),
        inc: $fn(function inc($parentScope) {
            let $scope = $$new_scope($parentScope);
            $scope.x = {
                value: 2
            };
            $scope.i.value = $scope.i.value + 1;
        }, $scope),
        get: $fn(function get($parentScope) {
            const $scope = $parentScope;
            return $scope.i.value;
        }, $scope)
    };
}, $scope);

$scope.a = newCounter(10);

console.log($scope.a.get());
console.log($scope.a.inc());
console.log($scope.a.get());

let b = $scope.a.fourty_two();
b.double();
console.log($scope.a.get());
console.log($scope.a.get());
console.log($scope.a.get());

var refmap = new WeakMap();
var memson_id = 0;

function isClassInstance(x) {
	return Object.getPrototypeOf(x) !== Object.prototype &&
		Object.getPrototypeOf(x).constructor.toString().startsWith("class");
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
let serialiazable = memson($scope.a, refs);
console.log(serialiazable);
console.log(refs);

let instr = JSON.parse(JSON.stringify(serialiazable));
let in_refs = JSON.parse(JSON.stringify(refs));

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

const new_a = unmemson(instr, in_refs);
console.log();
console.log();
console.log(new_a);
console.log(new_a.get());
console.log(new_a.inc());
console.log(new_a.get());

// var lue = 10;

function $class(k) {
	return k;
}

class SimpleCounter {
	constructor() {
		this.magic = "potter";
	}

}

class Counter extends SimpleCounter {
	constructor() {
		super();
		this.i = 0;
	}
	
	inc() {
		this.i++;
	}
	
	get() {
		return this.i;
	}
};

$scope.counter = new Counter();
console.log("class");
console.log($scope.counter.get());
console.log($scope.counter.inc());
console.log($scope.counter.get());
const refs2 = {};
console.log(JSON.stringify(memson($scope.counter, refs2)));
console.log(refs2);
let counter_instance = unmemson(memson($scope.counter, refs2), refs2)
console.log($scope.counter);
console.log(counter_instance);
counter_instance.inc();
counter_instance.inc();
counter_instance.inc();
console.log(counter_instance.get());
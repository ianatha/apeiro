function _$$fn(functionDecl, scope) {
	console.log("generating _$$fn");
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
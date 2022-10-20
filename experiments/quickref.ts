import {markdownTable} from "https://esm.sh/markdown-table@3.0.2";

class A {

}

class B extends A {

}

let samples = {
  "Object": { v: 1 },
  "Class Instance": new A(),
  "Class Definition": A,
  "Extended Class Def": B,
  "Anonymous Class Definition": class { method() { return 1 } },
  "Function": function() { return 1 },
  "Closure": () => { return 1 },
}

function trimString(s: string): string {
	if (s === undefined) {
		return "undefined"
	}
	if (typeof s === "string") {
		return s.replace(/[\r\n]/gm, " ").substring(0, 20);
	} else {
		return trimString(s.toString());
	}
}

function isObject(v: any): boolean {
	return typeof v === "object" && v.constructor === Object;
}

function isClassInstance(v: any): boolean {
	return typeof v === "object" && !(v.constructor === Object);
}

function isFunction(v: any): boolean {
	return typeof v === "function" && !(v.toString().substring(0, 5) === "class");
}

function isClassDefinition(v: any): boolean {
	return typeof v === "function" && v.toString().substring(0, 5) === "class";
}


console.log(markdownTable([
	[
		'value',
		'Object',
		'Class Instance',
		'Function',
		'Class Definition',
	],
	...Object.entries(samples).map(([name, v]) => [
		name,
		isObject(v),
		isClassInstance(v),
		isFunction(v),
		isClassDefinition(v),
		// trimString(typeof v),
		// trimString(v.toString()),
		// trimString(v.constructor),
		// trimString(v.prototype),
		// trimString(Object.getPrototypeOf(v)),
	])
  ]));

console.log();
console.log();

console.log(markdownTable([
[
	'value',
	'typeof',
	'.toString()',
	'.constructor',
	'.prototype',
	'getPrototypeOf',
],
...Object.entries(samples).map(([name, v]) => [
	name,
	trimString(typeof v),
	trimString(v.toString()),
	trimString(v.constructor),
	trimString(v.prototype),
	trimString(Object.getPrototypeOf(v)),
])
]));
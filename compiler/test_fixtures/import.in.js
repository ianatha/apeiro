import { receive } from "pristine://$";

export default function simple(a, b) {
	let c = a + b;
	let d = a * b;
	let e = receive('specifier');
	return c + d + e;
}
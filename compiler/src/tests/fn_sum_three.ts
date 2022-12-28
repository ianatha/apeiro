export default function sum_three() {
	let schema = {$type: ["number"]};
	return $recv(schema) + $recv(schema) + $recv(schema) ;
}

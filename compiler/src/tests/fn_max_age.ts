export default function main() {
	let siblings_count = $recv({siblings_count: {$type:["number"]}});
	siblings_count = siblings_count.siblings_count;
	let siblings = [];
	let i = 0;
	while (i < siblings_count) {
		let sibling = $recv({age: {$type:["number"]}, name: {$type:["string"]}});
		siblings.push(sibling);
		i++;
	}
	let max_age = 0;
	let max_age_name = "";
	for (let sibling of siblings) {
		if (sibling.age > max_age) {
			max_age = sibling.age;
			max_age_name = sibling.name;
		}
	}
	return {
		name: max_age_name,
		max_age: max_age,
	};
}

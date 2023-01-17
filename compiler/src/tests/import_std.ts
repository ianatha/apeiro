/// pristine.version=alpha.0

import io from "https://raw.githubusercontent.com/ianatha/experiment_io/main/index.ts"

export default function sum_of_two_numbers() {
	const v1 = io.input({
		first_number: io.number(),
	});
	const v2 = io.input({
		second_number: io.number(),
	});
	return v1.first_number + v2.second_number;
}
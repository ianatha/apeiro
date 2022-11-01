// Prompt: ask for two numbers and return their their sum
import { io } from "apeiro://$";

export default function sum_of_two_numbers() {
		const n = io.input({
			number1: io.number(),
			number2: io.number(),
		});

		return n.number1 + n.number2;
}
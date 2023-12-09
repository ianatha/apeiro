export const quickstarts: Record<string, {
  name: string;
  code: string;
}> = {
  empty: {
    name: "Hello World",
    code: `/// apeiro.version=alpha.0

export default function main() {
	return "Hello, world!";
}`,
  },
  simple: {
    name: "Add Two Numbers",
    code: `/// apeiro.version=alpha.0

import { io } from "apeiro://$";

export default function sum_of_two_numbers() {
	const v1 = io.input({
		first_number: io.number(),
	});
	const v2 = io.input({
		second_number: io.number(),
	});
	return v1.first_number + v2.second_number;
}`,
  },
  adv: {
    name: "Counter",
    code: `/// apeiro.version=alpha.0

import { io } from "apeiro://$";

export default function *sum_of_infinite_numbers() {
	let sum = 0;
	while (true) {
		yield sum;
		const input = io.input({
			val: io.number(),
		});
		sum = sum + input.val;
	}
	throw new Error("Will never reach here!");
}`,
  },
  email: {
    name: "Email Calculator",
    code: `/// apeiro.version=alpha.0

import { recvEmail, sendEmail } from "apeiro://$/emailbox";

export default function *email_responder() {
	let last_email = {
		sender: "",
		subject: "",
		result: "",
	};
	while (true) {
		yield last_email;
		let new_email = recvEmail();
		
		let subject = new_email.commonHeaders.subject;
		let sender = new_email.commonHeaders.from[0];
		let result = eval(subject);

		last_email = {
			subject,
			sender,
			result,
		};
		
		sendEmail(sender, "Re: " + subject, JSON.stringify(result) + "\\n\\nProvided by Apeirocalc!");
	}
	throw new Error("Will never reach here!");
}`,
  },
  email_with_approval: {
    name: "Email Calculator with Approval",
    code: `/// apeiro.version=alpha.0

import { io } from "apeiro://$";
import { recvEmail, sendEmail } from "apeiro://$/emailbox"

export default function *email_responder() {
	let last_email: Record<string, string> = {};
	while (true) {
		yield last_email;
		let new_email = recvEmail();
		
		let subject = new_email.commonHeaders.subject;
		let sender = new_email.commonHeaders.from[0];
		let result = eval(subject);

		last_email = {
			subject,
			sender,
			result,
		};

		const approval = io.input({
			approved: io.boolean({
				desc: \`Should I respond to \${sender}?\`
			})
		});
		
		if (approval.approved) {
			sendEmail(
				sender,
				\`Re: \${subject}\`,
				JSON.stringify(result) + "\\n\\nProvided by Apeirocalc!"
			);
		}
	}
	throw new Error("Will never reach here!");
}`,
  },
};

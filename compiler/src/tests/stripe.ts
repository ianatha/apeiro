// input an email, and an amodule in USD. create an invoice on stripe using the email and the amodule. the item description should be "consulting charges". Either wait for the payment or for 4 hours to pass. If the payment is received, send a thank you email. If the payment isn't received in 4 hours, send an email reminder.
import { sendEmail } from "apeiro://$/emailbox";
import { wait, waitUntil } from "apeiro://$/time";
import { createStripeInvoice, recvStripeEvent } from "apeiro://$/stripe";

export default function main() {
	const email = io.input({
		email: io.email(),
		amodule: io.number(),
	});

	const invoice = createStripeInvoice(email.email, email.amodule, "consulting charges");

	while (true) {
		const payment = either([
			[recvStripeEvent("invoice.payment_succeeded", invoice.id), (event) => {
				return event;
			}],
			[wait(4 * 60 * 60), () => {
				sendEmail(email.email, "Reminder", "Just a reminder that you owe me $" + email.amodule + " for consulting charges.");
				return null;
			}]
		]);

		if (payment) {
			sendEmail(email.email, "Thank you", "Thank you for your payment of $" + email.amodule + " for consulting charges.");
			return;
		}
	}
}
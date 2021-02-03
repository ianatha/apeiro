// input an email, and an amount in USD. create an invoice on stripe using the email and the amount. the item description should be "consulting charges". Either wait for the payment or for 4 hours to pass. If the payment is received, send a thank you email. If the payment isn't received in 4 hours, send an email reminder.
import { sendEmail } from "pristine://$/emailbox";
import { wait, waitUntil } from "pristine://$/time";
import { createStripeInvoice, recvStripeEvent } from "pristine://$/stripe";

export default function main() {
	const email = io.input({
		email: io.email(),
		amount: io.number(),
	});

	const invoice = createStripeInvoice(email.email, email.amount, "consulting charges");

	while (true) {
		const payment = either([
			[recvStripeEvent("invoice.payment_succeeded", invoice.id), (event) => {
				return event;
			}],
			[wait(4 * 60 * 60), () => {
				sendEmail(email.email, "Reminder", "Just a reminder that you owe me $" + email.amount + " for consulting charges.");
				return null;
			}]
		]);

		if (payment) {
			sendEmail(email.email, "Thank you", "Thank you for your payment of $" + email.amount + " for consulting charges.");
			return;
		}
	}
}
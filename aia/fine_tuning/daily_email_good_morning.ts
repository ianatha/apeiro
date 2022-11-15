// Prompt: email me good morning every morning
import { sendEmail } from "pristine://$/emailbox";
import { time } from "pristine://$/time";

export default function daily_email_good_morning() {
	let me = "you@example.com";
	while (true) {
		sendEmail(me, "Good Morning", "Just wanted to say good morning!");
		waitUntil(time.NextMorning());
	}
}
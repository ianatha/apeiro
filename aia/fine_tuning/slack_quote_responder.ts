// Prompt: respond with a random quote when I message you on Slack
import { recvMessage, respondToMessage } from "apeiro://$/slack";

export default function slack_quote_responder() {
	while (true) {
		const msg = recvMessage();
		const quoteResponse = fetchjson("https://zenquotes.io/api/random");
		const quote = quoteResponse[0].q;
		const author = quoteResponse[0].a;
		respondToMessage(msg, "You say " + msg.text + ", but " + author + " said " + quote);
	}
	return "Hello, world!";
}

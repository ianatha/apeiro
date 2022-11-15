// Prompt: repond with a random quote when you get an email

// To query Yahoo Finance for SYMB you must call https://query1.finance.yahoo.com/v7/finance/quote?symbols=SYMB
// let price = response.quoteResponse.result[0].regularMarketPrice
import { recvEmail, sendEmail } from "pristine://$/emailbox"

export default function respond_to_email_with_quote() {
	while (true) {
		let new_email = recvEmail();

		let subject = new_email.commonHeaders.subject;
		let sender = new_email.commonHeaders.from[0];

		let quote = fetchjson("https://api.random_quote_api.com");
		
		sendEmail(
			sender,
			`+"`"+`Re: ${subject}`+"`"+`,
			quote.content
		);
	}
}

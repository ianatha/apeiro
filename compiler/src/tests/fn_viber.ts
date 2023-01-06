function *user_state_machine() {
	let texts: string[] = [];
	while (true) {
		yield texts;
		let user_event = $recv({}); // receive viber event from specific user
		let user_text = user_event.message.text;
		if (user_text != undefined) {
			texts.push(user_text);
		}
	}
}

export default function *main() {
	let procs = {};
	while (true) {
		yield Object.keys(procs).length;
		let event = $recv({}); // receive viber event
		log(JSON.stringify(event));
		let event_sender_id = event.sender.id;
		if (event_sender_id != undefined) {
			if (procs[event_sender_id] === undefined) {
				procs[event_sender_id] = $spawn(user_state_machine);
			}
			$send(procs[event_sender_id], event);
		}
	}
}

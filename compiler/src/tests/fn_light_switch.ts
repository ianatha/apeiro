export default function *main() {
	let state = 0;
	while (true) {
		yield state;
		let inmsg = $recv({});
		if (inmsg.event_data.event == 1000) {
			state = 100;
		} else if (inmsg.event_data.event == 2000) {
			state = state + 10;
			if (state > 100) {
				state = 100;
			}
		} else if (inmsg.event_data.event == 3000) {
			state = state - 10;
			if (state < 0) {
				state = 0;
			}
		} else if (inmsg.event_data.event == 4000) {
			state = 0;
		} else if (inmsg.event_data.event == 5002) {
			state = "right";
		} else if (inmsg.event_data.event == 4002) {
			state = "left";
		} else if (inmsg.event_data.event == 2002) {
			state = "up";
		} else if (inmsg.event_data.event == 3002) {
			state = "down";
		} else if (inmsg.event_data.event == 1002) {
			state = "tap";
		} else {
			state = "unknown " + inmsg.event_data.event;
		}
	}
}

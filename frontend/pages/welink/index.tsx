import { useEffect, useState } from "react";
import {QRCodeSVG} from 'qrcode.react';

const WelinkPage = () => {
	const [displayToUser, setDisplayToUser] = useState<string|undefined>(undefined);
	const [points, setPoints] = useState<string|undefined>(undefined);
	
	useEffect(() => {
		const sse = new EventSource('http://localhost:5151/proc/9ngFDxN4v0Ve6zU4WkLmY/watch');

		function getRealtimeData(data: Record<string, any>) {
			console.log(data);
			if (data?.StepResult?.val) {
				let val = data?.StepResult?.val;
				if (val?.display_to_user) {
					setDisplayToUser(val?.display_to_user);
					setPoints(val?.display_points);

					setTimeout(() => {
						if (displayToUser === val?.displayToUser) {
							setDisplayToUser(undefined);
						}
					}, 10000);
				}
			}
		}

		sse.onmessage = e => getRealtimeData(JSON.parse(e.data));
		sse.onerror = () => {
		  // error log here 
		  
		  sse.close();
		}
		return () => {
		  sse.close();
		};
	  }, [displayToUser]);
	  
	return <h1>
		Welink
		{displayToUser && <>
			<QRCodeSVG value={`https://reactjs.org/${displayToUser}`} />,	
			<h2>Scan to receive {points} points</h2>
		</>}
	</h1>
}

export default WelinkPage;
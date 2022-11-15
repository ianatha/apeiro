import { input as io } from "pristine://$/rest";

export default function *email_responder() {
    let last_email = {};
    while (true) {
        yield last_email;
        last_email = io({
            email: {}
        });
        console.log(JSON.stringify(last_email));
    }
    throw new Error("Should not reach here");
}
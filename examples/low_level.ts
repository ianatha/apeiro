import { self, spawn, send, receive } from "https://raw.githubusercontent.com/ianatha/pristine_std/main/index.ts";

function child() {
  while (true) {
    const msg: string|number|{x:string} = recv(
      [ { $type: "number" }, (msg: number) => {
        return msg;
      } ],
      [ { $type: "string" }, (msg: string) => {
  
      } ],
      [ { x: { $type: "string" } }, (msg: { x: string }) => {
  
      } ],
    );
  }
}

export default function() {
  const foreignPid = spawn(child);
  send(foreignPid, [2, self()]);
  const msg: string|number|{x:string} = receive(
    [ { $type: "number" }, (msg: number) => {
      return msg;
    } ],
    [ { $type: "string" }, (msg: string) => {

    } ],
    [ { x: { $type: "string" } }, (msg: { x: string }) => {

    } ],
  );
}

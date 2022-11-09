import { Decoder } from "./decoder.ts";
import { Encoder } from "./encoder.ts";
import { IPristineFrame, PristineFrame } from "./frame.ts";
import {
  PristineSignal,
  serializeSuspension,
  Suspension,
  SuspensionUntilInput,
  SuspensionGeneric
} from "./suspension.ts";
import { SESV2 } from "https://aws-api.deno.dev/v0.3/services/sesv2.ts?actions=SendEmail&docs=";
import { ApiFactory } from "https://deno.land/x/aws_api@v0.6.0/client/mod.ts";
import { z } from "https://deno.land/x/zod@v3.17.0/mod.ts";
import zodToJsonSchema from "https://esm.sh/zod-to-json-schema@3.17.0";

export interface PristineContext {
  useUIInput<T>(schema: any): T;
  frame(): PristineFrame;
}

interface PendingUIInputState {
  t: string;
  pending: boolean;
  schema: Record<string, any>;
}

const STATE_TYPE_EXTERNAL = "$ext";

function isGenerator(fn) {
  return fn?.constructor?.name === "GeneratorFunction";
}

var pid: string = "workspace";

class InternalPristineContext implements PristineContext {
  private _counter: number = 0;
  private readonly _lastSuspension?: Record<string, any> = undefined;
  private _frame: PristineFrame | undefined = undefined;
  private msgToSupply: any = undefined;

  run_fn(fn: any): PristineFrame {
    try {
      let res = null;
      res = fn(this);
      this._frame!.res = res;
    } catch (e) {
      if (e instanceof Suspension) {
        this._frame!.aw = serializeSuspension(e);
      } else {
        throw e;
      }
    }

    return this._frame;
  }

  run_generator(fn: any): PristineFrame {
    try {
      let res = null;
      const generator_instance = fn(this);
      res = generator_instance.next().value;
      this._frame!.res = res;
      // TODO: probabilistic
      generator_instance.next().value;
    } catch (e) {
      if (e instanceof Suspension) {
        this._frame!.aw = serializeSuspension(e);
      } else {
        throw e;
      }
    }

    return this._frame;
  }

  async run(fn: any): Promise<PristineFrame> {
    let res;
    if (isGenerator(fn)) {
      res = this.run_generator(fn);
    } else {
      res = this.run_fn(fn);
    }

    console.log("Awaiting on queued promises: " + this.promises.length);
    await Promise.all(this.promises);
    console.log("Promises resolved");

    return res;
  }

  call(fn: any, ...args: any[]): any {
    if (!fn) {
      return null;
    }
    if (fn.$apeiro_func) {
      return fn(this, ...args);
    } else {
      return fn(...args);
    }
  }

  public useUIInput(schema: any) {
    if (this._frame!.aw === undefined || this._frame!.aw === null) {
      throw new SuspensionUntilInput(schema);
    } else {
      if (this.msgToSupply != undefined) {
        const res = this.msgToSupply;
        this.msgToSupply = undefined;
        this._frame!.aw = undefined;
        return res;
      } else {
        throw new Error("No message to supply");
      }
    }
  }

  public useGeneric(provider: string, schema: any) {
    if (this._frame!.aw === undefined || this._frame!.aw === null) {
      throw new SuspensionGeneric(provider, schema);
    } else {
      if (this.msgToSupply != undefined) {
        const res = this.msgToSupply;
        this.msgToSupply = undefined;
        this._frame!.aw = undefined;
        return res;
      } else {
        throw new Error("No message to supply");
      }
    }
  }


  public suspend() {
    throw new SuspensionUntilInput({ wait_forever: true });
  }

  frame() {
    if (!this._frame) {
      this._frame = new IPristineFrame(undefined);
    }
    return this._frame;
  }

  loadFrame(state: PristineFrame) {
    this._frame = new IPristineFrame(undefined, state);
  }

  supply(newMsg) {
    this.msgToSupply = newMsg;
  }

  log(msg) {
    this._frame?.log(msg);
  }

  constructor(public readonly _pid: string) {
    console.log("new context " + _pid);
  }

  promises: Promise<any>[] = [];

  getFunction([namespace, fn]: [string, string]) {
    console.log("in GetFunction " + JSON.stringify([namespace, fn]) + " my pid is " + this._pid);
    const ctx = this;

    if (namespace == "$.io" && fn === "number") {
      return (desc) => {
        return z.number().describe(desc);
      }
    }

    if (namespace == "$.io" && fn === "string") {
      return (desc) => {
        return z.string().describe(desc);
      }
    }

    if (namespace == "$.io" && fn === "boolean") {
      return (desc) => {
        return z.boolean().describe(desc);
      }
    }
  
    if (fn === "io") {
      const obj = {
        ...z,
        number(...args) {
          return {
            ...z.number(...args),
            $from_apeiro_ctx: ["$.io", "number"],
          }
        },
        boolean({ desc }) {
          return {
            ...z.boolean().describe(desc),
            $from_apeiro_ctx: ["$.io", "boolean"],
          }
        },
        string(...args) {
          return {
            ...z.string(...args),
            $from_apeiro_ctx: ["$.io", "string"],
          }
        },
        input(arg: any) {
          return ctx.useUIInput(zodToJsonSchema(
            z.object(arg), "$"
          ),);
        },
        $from_apeiro_ctx: ["$", "io"],
      }
      return obj;
    }

    return function (...args: any[]) {
      if (fn === "inputUI" || fn === "inputRest") {
        return ctx.useUIInput(args[0]);
      } else if (fn == "secret") {
        let stored_secret = getSecret(args[0]);
        console.log(JSON.stringify({
          stored_secret
        }));
        if (stored_secret === "") {
          const new_secret_val = ctx.useUIInput(zodToJsonSchema(
            z.object({
              "secret": z.string().describe("Secret for " + args[0]),
            }), "$"
          )).secret;
          stored_secret = new_secret_val;
          setSecret(args[0], new_secret_val);
        }
        return stored_secret;
      } else if (fn == "recvStripeEvent") {
        return ctx.useGeneric("stripe", {});
      } else if (fn == "ownerEmail") {
        return "ian@apeiromont.com";
      } else if (fn == "waitUntil") {
        return ctx.suspend();
      } else if (fn == "nextMorning") {
        return { next_morning: true };
      } else if (fn == "recvMessage") {
        return ctx.useUIInput(args[0]);
      } else if (fn == "recvEmail") {
        return ctx.useUIInput(args[0]).mail;
      } else if (fn === "recv") {
        return ctx.useUIInput(args[0]);
      } else if (fn == "respondToMessage") {
        ctx.promises.push(sendSlackMessage(ctx._pid, args[0], args[1]));
        return { $ext: "sendEmail" };
      } else if (fn == "sendEmail") {
        console.log("enqueueing email from " + ctx._pid);
        ctx.promises.push(sendEmail(ctx._pid, args[0], args[1], args[2]));
        return { $ext: "sendEmail" };
      } else {
        throw new Error("unknown function " + fn);
      }
    };
  }
}

export type StepResult = [
  // frame
  ReturnType<typeof Encoder.encode>,
  // result
  any,
  // awaiting
  Record<string, any>,
];

export async function step(
  pid: string,
  fn: any,
  serializedPreviousFrame?: string,
  newMsg?: string,
): Promise<StepResult> {
  console.log("stepping " + pid)
  const ctx = new InternalPristineContext(pid);
  if (serializedPreviousFrame && serializedPreviousFrame != "") {
    const decoder = new Decoder();
    const previousFrame = decoder.decode(serializedPreviousFrame, ctx);
    ctx.loadFrame(previousFrame);
  }
  if (newMsg && newMsg != "") {
    ctx.supply(JSON.parse(newMsg));
  }

  const nextFrame = await ctx.run(fn);

  const encoder = new Encoder();
  return [
    encoder.encode(nextFrame.serialize()),
    nextFrame.res,
    nextFrame.aw,
  ];
}

const SLACK_TOKEN = "***REMOVED***";

export async function sendSlackMessage(pid: string, {
  channel,
  thread_ts,
}: {
  channel: string,
  thread_ts: string,
}, text: string) {
  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + SLACK_TOKEN
    },
    body: JSON.stringify({
      channel,
      thread_ts,
      text,
    })
  });
  console.log(JSON.stringify({
    token: SLACK_TOKEN,
    channel,
    thread_ts,
    text,
  }));
  console.log(JSON.stringify(await res.json()));
  return res;
}

export async function sendEmail(pid: string, to: string, subject: string, body: string) {
  const ses = new ApiFactory({
    region: 'us-east-1',
    credentials: {
      awsAccessKeyId: "***REMOVED***",
      awsSecretKey: "***REMOVED***",
    },
  }).makeNew(SESV2);

  console.log(JSON.stringify({
    func: "send_email",
    pid,
    subject,
  }));
  
  const res = await ses.sendEmail({
    FromEmailAddress: pid + "@test.apeiromont.com",
    Content: {
      Simple: {
        Body: {
          Text: {
            Data: body,
          },
        },
        Subject: {
          Data: subject,
        },
      },
    },
    Destination: {
      ToAddresses: [to],
    }
  });
  return res;
}

export function importFunction(
  namespace: string,
  fn: string,
): [string, string] {
  return [namespace, fn];
}

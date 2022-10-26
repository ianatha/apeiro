import { Decoder } from "./decoder.ts";
import { Encoder } from "./encoder.ts";
import { IPristineFrame, PristineFrame } from "./frame.ts";
import {
  PristineSignal,
  serializeSuspension,
  Suspension,
  SuspensionUntilInput,
} from "./suspension.ts";
import { SESV2 } from "https://aws-api.deno.dev/v0.3/services/sesv2.ts?actions=SendEmail&docs=";
import { ApiFactory } from "https://deno.land/x/aws_api@v0.6.0/client/mod.ts";

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

    console.log("awaiting on all promises: " + this.promises.length);
    await Promise.all(this.promises);
    console.log("promises ok");

    return res;
  }

  call(fn: any, ...args: any[]): any {
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

  constructor() {
  }

  promises: Promise<any>[] = [];

  getFunction([namespace, fn]: [string, string]) {
    return (...args: any[]) => {
      if (fn === "inputUI" || fn === "inputRest" || fn === "recvEmail") {
        return this.useUIInput(args[0]);
      } else if (fn === "recv") {
        return this.useUIInput(args[0]);
      } else if (fn == "sendEmail") {
        console.log("before sendEmail");
        this.promises.push(sendEmail(args[0], args[1], args[2]));
        console.log("after sendEmail promise push");
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
  fn: any,
  serializedPreviousFrame?: string,
  newMsg?: string,
): Promise<StepResult> {
  const ctx = new InternalPristineContext();
  if (serializedPreviousFrame && serializedPreviousFrame != "") {
    const decoder = new Decoder();
    const previousFrame = decoder.decode(serializedPreviousFrame, fn);
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


export async function sendEmail(to: string, subject: string, body: string) {
  console.log(JSON.stringify({
    sendEmail: {
      to,
      subject,
      body
    }
  }))
  const ses = new ApiFactory({
    region: 'us-east-1',
    credentials: {
      awsAccessKeyId: "***REMOVED***",
      awsSecretKey: "***REMOVED***",
    },
  }).makeNew(SESV2);
  
  const myip = await fetch("https://api.ipify.org?format=json");
  const myipjson = await myip.json();
  console.log(JSON.stringify(myipjson));
  
  const res = await ses.sendEmail({
    FromEmailAddress: "demo@test.apeiromont.com",
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
  console.log(JSON.stringify({ res }))
  return res;
}

export function importFunction(
  namespace: string,
  fn: string,
): [string, string] {
  return [namespace, fn];
}

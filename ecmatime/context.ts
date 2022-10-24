import { z } from "https://deno.land/x/zod@v3.17.0/mod.ts";
import zodToJsonSchema from "https://esm.sh/zod-to-json-schema@3.17.0";
import { Decoder } from "./decoder.ts";
import { Encoder } from "./encoder.ts";
import { IPristineFrame, PristineFrame } from "./frame.ts";
import {
  PristineSignal,
  serializeSuspension,
  Suspension,
  SuspensionUntilInput,
} from "./suspension.ts";

export interface PristineContext {
  useUIInput<T extends z.ZodRawShape>(
    spec: z.ZodObject<T>,
  ): z.infer<typeof spec>;
  frame(): PristineFrame;
}

interface PendingUIInputState {
  t: string;
  pending: boolean;
  schema: Record<string, any>;
}

function zodToSchema(spec: any) {
  return zodToJsonSchema(spec, "$");
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

  run(fn: any): PristineFrame {
    if (isGenerator(fn)) {
      return this.run_generator(fn);
    } else {
      return this.run_fn(fn);
    }
  }

  public useUIInput<T extends z.ZodRawShape>(
    spec: z.ZodObject<T>,
  ): z.infer<typeof spec> {
    const schema = zodToSchema(spec);
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

  getFunction([namespace, fn]: [string, string]) {
    return (args) => {
      this.useUIInput(args);
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

export function step(
  fn: any,
  serializedPreviousFrame?: string,
  newMsg?: string,
): StepResult {
  const ctx = new InternalPristineContext();
  if (serializedPreviousFrame) {
    const decoder = new Decoder();
    const previousFrame = decoder.decode(serializedPreviousFrame, null);
    ctx.loadFrame(previousFrame);
  }
  if (newMsg) {
    ctx.supply(JSON.parse(newMsg));
  }

  const nextFrame = ctx.run(fn);

  const encoder = new Encoder();
  return [
    encoder.encode(nextFrame.serialize()),
    nextFrame.res,
    nextFrame.aw,
  ];
}

export function importFunction(
  namespace: string,
  fn: string,
): [string, string] {
  return [namespace, fn];
}

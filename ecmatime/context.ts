import { z } from "https://deno.land/x/zod@v3.17.0/mod.ts";
import zodToJsonSchema from "https://esm.sh/zod-to-json-schema@3.17.0";
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
  private readonly _state: any[] = [];
  private _data: Record<string, any> = {};
  private readonly _lastSuspension?: Record<string, any> = undefined;
  private _frame: PristineFrame | undefined = undefined;

  run_fn() {
    try {
      let res = null;
      res = this.f(this);
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

  run_generator() {
    try {
      let res = null;
      const generator_instance = this.f(this);
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

  run() {
    if (isGenerator(this.f)) {
      return this.run_generator();
    } else {
      return this.run_fn();
    }
  }

  public setData(data: Record<string, any>) {
    this._data = data;
  }

  public getData() {
    return {
      ...this._data,
    };
  }

  private newSuspensionUntilInput(schema: any) {
    return new SuspensionUntilInput(this._counter - 1, schema);
  }

  public recv(spec: [z.ZodObject<any>, (x: any) => any][]) {
  }

  public useUIInput<T extends z.ZodRawShape>(
    spec: z.ZodObject<T>,
  ): z.infer<typeof spec> {
    const schema = zodToSchema(spec);
    if (this._frame!.aw && this._frame!.aw?.until_input === undefined) {
      const res = this._frame!.aw;
      this._frame!.aw = undefined;
      return res;
    } else {
      throw this.newSuspensionUntilInput(schema);
    }
  }

  frame() {
    if (!this._frame) {
      this._frame = new PristineFrame(undefined);
    }
    return this._frame;
  }

  loadFrame(state: PristineFrame) {
    this._frame = new IPristineFrame(undefined, state);
  }

  supply(newMsg) {
    this._frame!.aw = newMsg;
  }

  log(msg) {
    this._frame?.log(msg);
  }

  constructor(private readonly f: any, serialized_state?: Record<string, any>) {
    if (serialized_state) {
      this._state = serialized_state?.s;
      this._data = serialized_state?.d;
      this._lastSuspension = serialized_state?.suspended;
    }
  }
}

export function step(fn, state?, newMsg?) {
  const ctx = new InternalPristineContext(fn, {});
  if (state) {
    ctx.loadFrame(state);
  }
  if (newMsg) {
    ctx.supply(newMsg);
  }
  return ctx.run();
}

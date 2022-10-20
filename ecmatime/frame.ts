export interface PristineFrame {
  s: Record<string | symbol, any>;
  pc: number;
  ch: PristineFrame[];
  aw: any;

  serialize(): Record<string, any>;
}

export class IPristineFrame implements PristineFrame {
  s: Record<string | symbol, any> = {};
  pc = 0;
  ch: PristineFrame[] = [];
  aw: any = null;

  logs: string[] = [];
  root: IPristineFrame | undefined = undefined;
  res: any = undefined;

  debug() {
    console.log(">>> start");
    if (this.aw) {
      console.log("awaiting:", this.aw);
    }
    if (this.res) {
      console.log("result:", this.res);
    }
    console.log(">>> end");
    console.log();
  }

  constructor(
    public readonly parent: IPristineFrame | undefined,
    state: PristineFrame | undefined = undefined,
  ) {
    if (state) {
      this.s = state.s;
      this.pc = state.pc;
      this.ch = state.ch.map((f) => new IPristineFrame(this, f));
      this.aw = state.aw;
    }
    if (parent) {
      this.root = parent.root;
    }
  }

  log(msg: string) {
    if (this.root) {
      this.root.log(msg);
    } else {
      this.logs.push(msg);
    }
  }

  subframe(): PristineFrame {
    if (this.ch.length > 0) {
      return this.ch[0];
    }
    const subframe = new IPristineFrame(this.root || this);
    this.ch.push(subframe);
    return subframe;
  }

  end(val: any = undefined) {
    this.res = val;
    this.parent?.ch.pop();
    return val;
  }

  serialize(): Record<string, any> {
    return encode({
      s: this.s,
      pc: this.pc,
      ch: this.ch.map((f) => f.serialize()),

      aw: this.aw,
      logs: this.logs,
      res: this.res,
    });
  }
}

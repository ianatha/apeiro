var $apeiro = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // index.ts
  var ecmatime_exports = {};
  __export(ecmatime_exports, {
    Decoder: () => Decoder,
    Encoder: () => Encoder,
    importFunction: () => importFunction,
    step: () => step
  });

  // decoder.ts
  var Decoder = class {
    constructor() {
      this.ctx = null;
      this.BY_TAG = {};
    }
    evalInContext(src) {
      if (src.indexOf(" [native code] ") >= 0) {
        return function() {
          throw new Error("cannot deserialize native function");
        };
      }
      const evalFunction = () => {
        console.log("evaluating " + src);
        try {
          return (0, eval)(src);
        } catch (e) {
          return () => {
            throw new Error("couldn't deserialize function " + src);
          };
        }
      };
      return evalFunction.call(this.ctx);
    }
    decodeObject(v) {
      let decoded = {};
      Object.keys(v.value).forEach((k) => {
        decoded[k] = this.decodeValue(v.value[k]);
      });
      if (v.tag) {
        this.BY_TAG[v.tag] = decoded;
      }
      return decoded;
    }
    decodeArray(v) {
      const decoded = [];
      Object.keys(v.value).forEach((k) => {
        decoded.push(this.decodeValue(v.value[k]));
      });
      this.BY_TAG[v.tag] = decoded;
      return decoded;
    }
    isFunctionMissingKeyword(src) {
      if (src.substring(0, 9) === "function ") {
        return false;
      }
      const reClosure1 = /^\(([a-zA-Z0-9_$]+,?)*\)=>/;
      const reClosure2 = /^[a-zA-Z0-9_$]+=>/;
      if (src.match(reClosure1) || src.match(reClosure2)) {
        return false;
      } else {
        return true;
      }
    }
    decodeFunction(v) {
      if (this.isFunctionMissingKeyword(v.src)) {
        v.src = "function _" + v.src;
      }
      let decoded = this.evalInContext(`const fn = ${v.src}; fn`);
      if (v.props) {
        const propsDecoded = this.decodeObject(v.props);
        for (const k in propsDecoded) {
          decoded[k] = propsDecoded[k];
        }
      }
      this.BY_TAG[v.tag] = decoded;
      return decoded;
    }
    decodeFunctionBound(v) {
      let propsDecoded = this.decodeObject(v.props);
      let decoded = propsDecoded.target.bind(propsDecoded.thisArg, ...propsDecoded.boundedArgs);
      this.BY_TAG[v.tag] = decoded;
      return decoded;
    }
    decodeClassDefinition(v) {
      let classDef = this.evalInContext(`let fn = ${v.src}; fn`);
      this.BY_TAG[v.tag] = classDef;
      return classDef;
    }
    decodeClassInstance(v) {
      const decoded = {};
      Object.keys(v.value).forEach((k) => {
        decoded[k] = this.decodeValue(v.value[k]);
      });
      let classDef = this.decodeValue(v.constructor);
      if (classDef === void 0) {
        throw new Error("failed to deserialize " + JSON.stringify(v));
      }
      if (classDef.prototype != void 0) {
        Object.setPrototypeOf(decoded, classDef.prototype);
      } else {
        console.log("TODO prototype undefined");
      }
      return decoded;
    }
    decodeValue(v) {
      if (v === void 0 || v === null || v.type === void 0) {
        throw new Error("attempting to decode undefined");
      }
      if (v.type === "undefined") {
        return void 0;
      } else if (v.type === "null") {
        return null;
      } else if (v.type === "ref") {
        return this.BY_TAG[v.tag];
      } else if (v.type === "number") {
        return v.value;
      } else if (v.type === "string") {
        return v.value;
      } else if (v.type === "boolean") {
        return v.value;
      } else if (v.type === "object") {
        return this.decodeObject(v);
      } else if (v.type === "function") {
        return this.decodeFunction(v);
      } else if (v.type === "function_bound") {
        return this.decodeFunctionBound(v);
      } else if (v.type === "class_definition") {
        return this.decodeClassDefinition(v);
      } else if (v.type === "class_instance") {
        return this.decodeClassInstance(v);
      } else if (v.type === "array") {
        return this.decodeArray(v);
      } else {
        throw new Error("cannot decode " + v);
      }
    }
    decode(input, ctx) {
      this.ctx = ctx;
      this.BY_TAG = {};
      const v = JSON.parse(input);
      if (v.type !== "object") {
        throw new Error("root must be an object");
      }
      return this.decodeValue(v);
    }
  };

  // encoder.ts
  var TAG = Symbol("APEIRO_TAG");
  var Encoder = class {
    constructor() {
      this.id = 0;
    }
    encodeClassDefinition(v) {
      this.assignTag(v);
      return {
        type: "class_definition",
        src: v.toString(),
        tag: v[TAG]
      };
    }
    encodeFunction(v, debug) {
      this.assignTag(v);
      if (v.toString().indexOf(" [native code]") >= 0) {
        console.log("encountered native function at " + debug);
      }
      let res = {
        type: "function",
        tag: v[TAG],
        src: v.toString()
      };
      if (Object.keys(v).length > 0) {
        res.props = this.encodeObject(v, debug + ".props", false);
      }
      if (v?.$bound) {
        delete res.src;
        res.type = "function_bound";
      }
      return res;
    }
    assignTag(v) {
      if (v[TAG] === void 0) {
        v[TAG] = this.id;
        this.id++;
        return true;
      } else {
        return false;
      }
    }
    encodeObject(v, debug) {
      this.assignTag(v);
      const value = {};
      Object.keys(v).forEach((k) => {
        value[k] = this.encodeValue(v[k], debug + "." + k);
      });
      return {
        type: "object",
        value,
        tag: v[TAG]
      };
    }
    encodeNumber(v) {
      return { type: "number", value: v };
    }
    encodeString(v) {
      return { type: "string", value: v };
    }
    encodeBoolean(v) {
      return { type: "boolean", value: v };
    }
    encodeClassInstance(v, debug) {
      this.assignTag(v);
      const value = {};
      Object.keys(v).forEach((k) => {
        value[k] = this.encodeValue(v[k], debug + "." + k);
      });
      return {
        type: "class_instance",
        constructor: this.encodeClassDefinition(v.constructor),
        value,
        tag: v[TAG]
      };
    }
    encodeArray(v, debug) {
      this.assignTag(v);
      let value = [];
      Object.keys(v).forEach((k) => {
        value.push(this.encodeValue(v[k], debug + "." + k));
      });
      return {
        type: "array",
        value,
        tag: v[TAG]
      };
    }
    encodeValue(v, debug) {
      if (v === null) {
        return { type: "null" };
      } else if (typeof v === "undefined") {
        return { type: "undefined" };
      } else if (v[TAG]) {
        return { type: "ref", tag: v[TAG] };
      } else if (typeof v === "number") {
        return this.encodeNumber(v);
      } else if (typeof v === "string") {
        return this.encodeString(v);
      } else if (typeof v === "boolean") {
        return this.encodeBoolean(v);
      } else if (isObject(v)) {
        return this.encodeObject(v, debug);
      } else if (isFunction(v)) {
        return this.encodeFunction(v, debug);
      } else if (isClassInstance(v)) {
        return this.encodeClassInstance(v, debug);
      } else if (isClassDefinition(v)) {
        return this.encodeClassDefinition(v);
      } else if (isArray(v)) {
        return this.encodeArray(v, debug);
      } else {
        throw new Error("unsupported type " + typeof v);
      }
    }
    cleanValue(v) {
      if (v !== null && v !== void 0 && (typeof v === "object" || typeof v === "function")) {
        delete v[TAG];
        Object.keys(v).forEach((k) => {
          this.cleanValue(v[k]);
        });
      }
    }
    encode(v) {
      this.id = 0;
      if (typeof v !== "object") {
        throw new Error("root must be an object");
      }
      const result = this.encodeValue(v, "");
      return JSON.stringify(result);
    }
  };
  function isObject(v) {
    return typeof v === "object" && v !== null && v.constructor === Object;
  }
  function isArray(v) {
    return typeof v === "object" && v.constructor === Array;
  }
  function isClassInstance(v) {
    return typeof v === "object" && !(v.constructor === Object) && !(v.constructor === Array);
  }
  function isFunction(v) {
    return typeof v === "function" && !(v.toString().substring(0, 5) === "class");
  }
  function isClassDefinition(v) {
    return typeof v === "function" && v.toString().substring(0, 5) === "class";
  }

  // frame.ts
  var IPristineFrame = class {
    constructor(parent, state = void 0) {
      this.parent = parent;
      this.s = {};
      this.pc = 0;
      this.ch = [];
      this.aw = null;
      this.logs = [];
      this.root = void 0;
      this.res = void 0;
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
    log(msg) {
      if (this.root) {
        this.root.log(msg);
      } else {
        this.logs.push(msg);
      }
    }
    subframe() {
      if (this.ch.length > 0) {
        return this.ch[0];
      }
      const subframe = new IPristineFrame(this.root || this);
      this.ch.push(subframe);
      return subframe;
    }
    end(val = void 0) {
      this.res = val;
      this.parent?.ch.pop();
      return val;
    }
    serialize() {
      return {
        s: this.s,
        pc: this.pc,
        ch: this.ch.map((f) => f.serialize()),
        aw: this.aw,
        logs: this.logs,
        res: this.res
      };
    }
  };

  // suspension.ts
  var PristineSignal = class extends Error {
    constructor() {
      super();
    }
  };
  var Suspension = class extends PristineSignal {
    constructor(idx) {
      super();
      this.idx = idx;
    }
  };
  function serializeSuspension(e) {
    if (e instanceof SuspensionUntilInput) {
      return { until_input: e.serialize() };
    }
    if (e instanceof SuspensionUntilTime) {
      return { until_time: e.serialize() };
    } else {
      return true;
    }
  }
  var SuspensionUntilTime = class extends Suspension {
    constructor(time) {
      super();
      this.time = time;
    }
    serialize() {
      return this.time;
    }
  };
  var SuspensionUntilInput = class extends Suspension {
    constructor(schema) {
      super();
      this.schema = schema;
    }
    serialize() {
      return this.schema;
    }
  };

  // context.ts
  function isGenerator(fn) {
    return fn?.constructor?.name === "GeneratorFunction";
  }
  var InternalPristineContext = class {
    constructor() {
      this._counter = 0;
      this._lastSuspension = void 0;
      this._frame = void 0;
      this.msgToSupply = void 0;
    }
    run_fn(fn) {
      try {
        let res = null;
        res = fn(this);
        this._frame.res = res;
      } catch (e) {
        if (e instanceof Suspension) {
          this._frame.aw = serializeSuspension(e);
        } else {
          throw e;
        }
      }
      return this._frame;
    }
    run_generator(fn) {
      try {
        let res = null;
        const generator_instance = fn(this);
        res = generator_instance.next().value;
        this._frame.res = res;
        generator_instance.next().value;
      } catch (e) {
        if (e instanceof Suspension) {
          this._frame.aw = serializeSuspension(e);
        } else {
          throw e;
        }
      }
      return this._frame;
    }
    run(fn) {
      if (isGenerator(fn)) {
        return this.run_generator(fn);
      } else {
        return this.run_fn(fn);
      }
    }
    call(fn, ...args) {
      if (fn.$apeiro_func) {
        return fn(this, ...args);
      } else {
        return fn(...args);
      }
    }
    useUIInput(schema) {
      if (this._frame.aw === void 0 || this._frame.aw === null) {
        throw new SuspensionUntilInput(schema);
      } else {
        if (this.msgToSupply != void 0) {
          const res = this.msgToSupply;
          this.msgToSupply = void 0;
          this._frame.aw = void 0;
          return res;
        } else {
          throw new Error("No message to supply");
        }
      }
    }
    frame() {
      if (!this._frame) {
        this._frame = new IPristineFrame(void 0);
      }
      return this._frame;
    }
    loadFrame(state) {
      this._frame = new IPristineFrame(void 0, state);
    }
    supply(newMsg) {
      this.msgToSupply = newMsg;
    }
    log(msg) {
      this._frame?.log(msg);
    }
    getFunction([namespace, fn]) {
      return (args) => {
        if (fn === "inputUI" || fn === "inputRest") {
          return this.useUIInput(args);
        } else if (fn === "recv") {
          return this.useUIInput(args);
        } else {
          throw new Error("unknown function " + fn);
        }
      };
    }
  };
  function step(fn, serializedPreviousFrame, newMsg) {
    const ctx = new InternalPristineContext();
    if (serializedPreviousFrame && serializedPreviousFrame != "") {
      const decoder = new Decoder();
      const previousFrame = decoder.decode(serializedPreviousFrame, fn);
      ctx.loadFrame(previousFrame);
    }
    if (newMsg && newMsg != "") {
      ctx.supply(JSON.parse(newMsg));
    }
    const nextFrame = ctx.run(fn);
    const encoder = new Encoder();
    return [
      encoder.encode(nextFrame.serialize()),
      nextFrame.res,
      nextFrame.aw
    ];
  }
  function importFunction(namespace, fn) {
    return [namespace, fn];
  }

  // index.ts
  Function.prototype.$bind = Function.prototype.bind;
  Function.prototype.bind = function(thisArg, ...boundedArgs) {
    const fn = this;
    const BoundFunction = (...args) => {
      return fn.apply(thisArg, [...boundedArgs, ...args]);
    };
    BoundFunction.thisArg = thisArg;
    BoundFunction.boundedArgs = boundedArgs;
    BoundFunction.target = fn;
    BoundFunction.$bound = true;
    return BoundFunction;
  };
  return __toCommonJS(ecmatime_exports);
})();

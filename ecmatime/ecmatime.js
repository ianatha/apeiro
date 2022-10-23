var $apeiro = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __require = /* @__PURE__ */ ((x2) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x2, {
    get: (a, b2) => (typeof require !== "undefined" ? require : a)[b2]
  }) : x2)(function(x2) {
    if (typeof require !== "undefined")
      return require.apply(this, arguments);
    throw new Error('Dynamic require of "' + x2 + '" is not supported');
  });
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key2 of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key2) && key2 !== except)
          __defProp(to, key2, { get: () => from[key2], enumerable: !(desc = __getOwnPropDesc(from, key2)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // index.ts
  var ecmatime_exports = {};
  __export(ecmatime_exports, {
    Decoder: () => Decoder,
    Encoder: () => Encoder,
    step: () => step
  });

  // decoder.ts
  var Decoder = class {
    constructor() {
      this.ctx = null;
      this.BY_TAG = {};
    }
    evalInContext(src) {
      const evalFunction = () => {
        return eval(src);
      };
      return evalFunction.call(this.ctx);
    }
    decodeObject(v2) {
      let decoded = {};
      Object.keys(v2.value).forEach((k2) => {
        decoded[k2] = this.decodeValue(v2.value[k2]);
      });
      this.BY_TAG[v2.tag] = decoded;
      return decoded;
    }
    decodeFunction(v2) {
      let decoded = this.evalInContext(`const fn = ${v2.src}; fn`);
      this.BY_TAG[v2.tag] = decoded;
      return decoded;
    }
    decodeClassDefinition(v2) {
      let classDef = this.evalInContext(`let fn = ${v2.src}; fn`);
      this.BY_TAG[v2.tag] = classDef;
      return classDef;
    }
    decodeClassInstance(v2) {
      const decoded = {};
      Object.keys(v2.value).forEach((k2) => {
        decoded[k2] = this.decodeValue(v2.value[k2]);
      });
      let classDef = this.decodeValue(v2.constructor);
      if (classDef === void 0) {
        throw new Error("failed to deserialize " + JSON.stringify(v2));
      }
      Object.setPrototypeOf(decoded, classDef.prototype);
      return decoded;
    }
    decodeValue(v2) {
      if (v2 === void 0) {
        throw new Error("attempting to decode undefined");
      }
      if (v2.type === "number") {
        return v2.value;
      } else if (v2.type === "string") {
        return v2.value;
      } else if (v2.type === "boolean") {
        return v2.value;
      } else if (v2.type === "object") {
        return this.decodeObject(v2);
      } else if (v2.type === "object_ref") {
        return this.BY_TAG[v2.tag];
      } else if (v2.type === "function") {
        return this.decodeFunction(v2);
      } else if (v2.type === "function_ref") {
        return this.BY_TAG[v2.tag];
      } else if (v2.type === "class_definition") {
        return this.decodeClassDefinition(v2);
      } else if (v2.type === "class_instance") {
        return this.decodeClassInstance(v2);
      } else if (v2.type === "class_definition_ref") {
        return this.BY_TAG[v2.tag];
      } else {
        throw new Error("cannot decode " + v2);
      }
    }
    decode(input, ctx) {
      this.ctx = ctx;
      this.BY_TAG = {};
      const v2 = JSON.parse(input);
      if (v2.type !== "object") {
        throw new Error("root must be an object");
      }
      return this.decodeValue(v2);
    }
  };

  // encoder.ts
  var TAG = Symbol("APEIRO_TAG");
  var Encoder = class {
    constructor() {
      this.id = 0;
    }
    encodeClassDefinition(v2) {
      if (!this.assignTag(v2)) {
        return { type: "class_definition_ref", tag: v2[TAG] };
      }
      return {
        type: "class_definition",
        src: v2.toString(),
        tag: v2[TAG]
      };
    }
    encodeFunction(v2) {
      if (v2[TAG] === void 0) {
        v2[TAG] = this.id;
        this.id++;
        return {
          type: "function",
          tag: v2[TAG],
          src: v2.toString()
        };
      } else {
        return {
          type: "function_ref",
          tag: v2[TAG]
        };
      }
    }
    assignTag(v2) {
      if (v2[TAG] === void 0) {
        v2[TAG] = this.id;
        this.id++;
        return true;
      } else {
        return false;
      }
    }
    encodeObject(v2) {
      if (!this.assignTag(v2)) {
        return { type: "object_ref", tag: v2[TAG] };
      }
      const value = {};
      Object.keys(v2).forEach((k2) => {
        value[k2] = this.encodeValue(v2[k2]);
      });
      return {
        type: "object",
        value,
        tag: v2[TAG]
      };
    }
    encodeNumber(v2) {
      return { type: "number", value: v2 };
    }
    encodeString(v2) {
      return { type: "string", value: v2 };
    }
    encodeBoolean(v2) {
      return { type: "boolean", value: v2 };
    }
    encodeClassInstance(v2) {
      const value = {};
      Object.keys(v2).forEach((k2) => {
        value[k2] = this.encodeValue(v2[k2]);
      });
      return {
        type: "class_instance",
        constructor: this.encodeClassDefinition(v2.constructor),
        value
      };
    }
    encodeValue(v2) {
      if (typeof v2 === "number") {
        return this.encodeNumber(v2);
      } else if (typeof v2 === "string") {
        return this.encodeString(v2);
      } else if (typeof v2 === "boolean") {
        return this.encodeBoolean(v2);
      } else if (isObject(v2)) {
        return this.encodeObject(v2);
      } else if (isFunction(v2)) {
        return this.encodeFunction(v2);
      } else if (isClassInstance(v2)) {
        return this.encodeClassInstance(v2);
      } else if (isClassDefinition(v2)) {
        return this.encodeClassDefinition(v2);
      } else if (typeof v2 === "undefined") {
        return { type: "undefined" };
      } else {
        throw new Error("unsupported type " + typeof v2 + " at key " + key);
      }
    }
    cleanValue(v2) {
      if (typeof v2 === "object" || typeof v2 === "function") {
        delete v2[TAG];
        Object.keys(v2).forEach((k2) => {
          this.cleanValue(v2[k2]);
        });
      }
    }
    encode(v2) {
      this.id = 0;
      if (typeof v2 !== "object") {
        throw new Error("root must be an object");
      }
      const result = this.encodeValue(v2);
      this.cleanValue(v2);
      return JSON.stringify(result);
    }
  };
  function isObject(v2) {
    return typeof v2 === "object" && v2.constructor === Object;
  }
  function isClassInstance(v2) {
    return typeof v2 === "object" && !(v2.constructor === Object);
  }
  function isFunction(v2) {
    return typeof v2 === "function" && !(v2.toString().substring(0, 5) === "class");
  }
  function isClassDefinition(v2) {
    return typeof v2 === "function" && v2.toString().substring(0, 5) === "class";
  }

  // web:https://esm.sh/v96/zod@3.19.1/es2015/zod.js
  var zod_exports = {};
  __export(zod_exports, {
    BRAND: () => Ue,
    DIRTY: () => Pe,
    EMPTY_PATH: () => Ve,
    INVALID: () => m,
    NEVER: () => wt,
    OK: () => T,
    ParseStatus: () => k,
    Schema: () => v,
    ZodAny: () => L,
    ZodArray: () => O,
    ZodBigInt: () => K,
    ZodBoolean: () => H,
    ZodBranded: () => pe,
    ZodDate: () => $,
    ZodDefault: () => oe,
    ZodDiscriminatedUnion: () => F,
    ZodEffects: () => I,
    ZodEnum: () => se,
    ZodError: () => j,
    ZodFirstPartyTypeKind: () => f,
    ZodFunction: () => D,
    ZodIntersection: () => B,
    ZodIssueCode: () => u,
    ZodLazy: () => te,
    ZodLiteral: () => re,
    ZodMap: () => ee,
    ZodNaN: () => ae,
    ZodNativeEnum: () => ne,
    ZodNever: () => C,
    ZodNull: () => Q,
    ZodNullable: () => V,
    ZodNumber: () => A,
    ZodObject: () => w,
    ZodOptional: () => S,
    ZodParsedType: () => p,
    ZodPromise: () => U,
    ZodRecord: () => q,
    ZodSchema: () => v,
    ZodSet: () => M,
    ZodString: () => R,
    ZodTransformer: () => I,
    ZodTuple: () => N,
    ZodType: () => v,
    ZodUndefined: () => G,
    ZodUnion: () => W,
    ZodUnknown: () => Z,
    ZodVoid: () => X,
    addIssueToContext: () => h,
    any: () => Ge,
    array: () => et,
    bigint: () => Je,
    boolean: () => Ne,
    custom: () => Se,
    date: () => Ye,
    default: () => Tt,
    defaultErrorMap: () => ie,
    discriminatedUnion: () => nt,
    effect: () => we,
    enum: () => ht,
    function: () => dt,
    getErrorMap: () => ce,
    getParsedType: () => z,
    instanceof: () => Be,
    intersection: () => at,
    isAborted: () => fe,
    isAsync: () => ye,
    isDirty: () => me,
    isValid: () => de,
    late: () => We,
    lazy: () => lt,
    literal: () => pt,
    makeIssue: () => ue,
    map: () => ct,
    nan: () => qe,
    nativeEnum: () => ft,
    never: () => Xe,
    null: () => He,
    nullable: () => vt,
    number: () => Oe,
    object: () => tt,
    objectUtil: () => le,
    oboolean: () => bt,
    onumber: () => xt,
    optional: () => yt,
    ostring: () => gt,
    preprocess: () => _t,
    promise: () => mt,
    quotelessJson: () => Ae,
    record: () => ot,
    set: () => ut,
    setErrorMap: () => Me,
    strictObject: () => rt,
    string: () => Ee,
    transformer: () => we,
    tuple: () => it,
    undefined: () => Ke,
    union: () => st,
    unknown: () => Qe,
    void: () => Fe,
    z: () => Tt
  });
  var Ie = Object.defineProperty;
  var je = Object.defineProperties;
  var Ce = Object.getOwnPropertyDescriptors;
  var _e = Object.getOwnPropertySymbols;
  var Re = Object.prototype.hasOwnProperty;
  var Ze = Object.prototype.propertyIsEnumerable;
  var ge = (r, e, t) => e in r ? Ie(r, e, { enumerable: true, configurable: true, writable: true, value: t }) : r[e] = t;
  var c = (r, e) => {
    for (var t in e || (e = {}))
      Re.call(e, t) && ge(r, t, e[t]);
    if (_e)
      for (var t of _e(e))
        Ze.call(e, t) && ge(r, t, e[t]);
    return r;
  };
  var g = (r, e) => je(r, Ce(e));
  var P = (r, e, t) => new Promise((s2, n) => {
    var a = (d2) => {
      try {
        o(t.next(d2));
      } catch (l) {
        n(l);
      }
    }, i = (d2) => {
      try {
        o(t.throw(d2));
      } catch (l) {
        n(l);
      }
    }, o = (d2) => d2.done ? s2(d2.value) : Promise.resolve(d2.value).then(a, i);
    o((t = t.apply(r, e)).next());
  });
  var b;
  (function(r) {
    r.assertEqual = (n) => n;
    function e(n) {
    }
    r.assertIs = e;
    function t(n) {
      throw new Error();
    }
    r.assertNever = t, r.arrayToEnum = (n) => {
      let a = {};
      for (let i of n)
        a[i] = i;
      return a;
    }, r.getValidEnumValues = (n) => {
      let a = r.objectKeys(n).filter((o) => typeof n[n[o]] != "number"), i = {};
      for (let o of a)
        i[o] = n[o];
      return r.objectValues(i);
    }, r.objectValues = (n) => r.objectKeys(n).map(function(a) {
      return n[a];
    }), r.objectKeys = typeof Object.keys == "function" ? (n) => Object.keys(n) : (n) => {
      let a = [];
      for (let i in n)
        Object.prototype.hasOwnProperty.call(n, i) && a.push(i);
      return a;
    }, r.find = (n, a) => {
      for (let i of n)
        if (a(i))
          return i;
    }, r.isInteger = typeof Number.isInteger == "function" ? (n) => Number.isInteger(n) : (n) => typeof n == "number" && isFinite(n) && Math.floor(n) === n;
    function s2(n, a = " | ") {
      return n.map((i) => typeof i == "string" ? `'${i}'` : i).join(a);
    }
    r.joinValues = s2, r.jsonStringifyReplacer = (n, a) => typeof a == "bigint" ? a.toString() : a;
  })(b || (b = {}));
  var p = b.arrayToEnum(["string", "nan", "number", "integer", "float", "boolean", "date", "bigint", "symbol", "function", "undefined", "null", "array", "object", "unknown", "promise", "void", "never", "map", "set"]);
  var z = (r) => {
    switch (typeof r) {
      case "undefined":
        return p.undefined;
      case "string":
        return p.string;
      case "number":
        return isNaN(r) ? p.nan : p.number;
      case "boolean":
        return p.boolean;
      case "function":
        return p.function;
      case "bigint":
        return p.bigint;
      case "object":
        return Array.isArray(r) ? p.array : r === null ? p.null : r.then && typeof r.then == "function" && r.catch && typeof r.catch == "function" ? p.promise : typeof Map != "undefined" && r instanceof Map ? p.map : typeof Set != "undefined" && r instanceof Set ? p.set : typeof Date != "undefined" && r instanceof Date ? p.date : p.object;
      default:
        return p.unknown;
    }
  };
  var u = b.arrayToEnum(["invalid_type", "invalid_literal", "custom", "invalid_union", "invalid_union_discriminator", "invalid_enum_value", "unrecognized_keys", "invalid_arguments", "invalid_return_type", "invalid_date", "invalid_string", "too_small", "too_big", "invalid_intersection_types", "not_multiple_of"]);
  var Ae = (r) => JSON.stringify(r, null, 2).replace(/"([^"]+)":/g, "$1:");
  var j = class extends Error {
    constructor(e) {
      super(), this.issues = [], this.addIssue = (s2) => {
        this.issues = [...this.issues, s2];
      }, this.addIssues = (s2 = []) => {
        this.issues = [...this.issues, ...s2];
      };
      let t = new.target.prototype;
      Object.setPrototypeOf ? Object.setPrototypeOf(this, t) : this.__proto__ = t, this.name = "ZodError", this.issues = e;
    }
    get errors() {
      return this.issues;
    }
    format(e) {
      let t = e || function(a) {
        return a.message;
      }, s2 = { _errors: [] }, n = (a) => {
        for (let i of a.issues)
          if (i.code === "invalid_union")
            i.unionErrors.map(n);
          else if (i.code === "invalid_return_type")
            n(i.returnTypeError);
          else if (i.code === "invalid_arguments")
            n(i.argumentsError);
          else if (i.path.length === 0)
            s2._errors.push(t(i));
          else {
            let o = s2, d2 = 0;
            for (; d2 < i.path.length; ) {
              let l = i.path[d2];
              d2 === i.path.length - 1 ? (o[l] = o[l] || { _errors: [] }, o[l]._errors.push(t(i))) : o[l] = o[l] || { _errors: [] }, o = o[l], d2++;
            }
          }
      };
      return n(this), s2;
    }
    toString() {
      return this.message;
    }
    get message() {
      return JSON.stringify(this.issues, b.jsonStringifyReplacer, 2);
    }
    get isEmpty() {
      return this.issues.length === 0;
    }
    flatten(e = (t) => t.message) {
      let t = {}, s2 = [];
      for (let n of this.issues)
        n.path.length > 0 ? (t[n.path[0]] = t[n.path[0]] || [], t[n.path[0]].push(e(n))) : s2.push(e(n));
      return { formErrors: s2, fieldErrors: t };
    }
    get formErrors() {
      return this.flatten();
    }
  };
  j.create = (r) => new j(r);
  var ie = (r, e) => {
    let t;
    switch (r.code) {
      case u.invalid_type:
        r.received === p.undefined ? t = "Required" : t = `Expected ${r.expected}, received ${r.received}`;
        break;
      case u.invalid_literal:
        t = `Invalid literal value, expected ${JSON.stringify(r.expected, b.jsonStringifyReplacer)}`;
        break;
      case u.unrecognized_keys:
        t = `Unrecognized key(s) in object: ${b.joinValues(r.keys, ", ")}`;
        break;
      case u.invalid_union:
        t = "Invalid input";
        break;
      case u.invalid_union_discriminator:
        t = `Invalid discriminator value. Expected ${b.joinValues(r.options)}`;
        break;
      case u.invalid_enum_value:
        t = `Invalid enum value. Expected ${b.joinValues(r.options)}, received '${r.received}'`;
        break;
      case u.invalid_arguments:
        t = "Invalid function arguments";
        break;
      case u.invalid_return_type:
        t = "Invalid function return type";
        break;
      case u.invalid_date:
        t = "Invalid date";
        break;
      case u.invalid_string:
        typeof r.validation == "object" ? "startsWith" in r.validation ? t = `Invalid input: must start with "${r.validation.startsWith}"` : "endsWith" in r.validation ? t = `Invalid input: must end with "${r.validation.endsWith}"` : b.assertNever(r.validation) : r.validation !== "regex" ? t = `Invalid ${r.validation}` : t = "Invalid";
        break;
      case u.too_small:
        r.type === "array" ? t = `Array must contain ${r.inclusive ? "at least" : "more than"} ${r.minimum} element(s)` : r.type === "string" ? t = `String must contain ${r.inclusive ? "at least" : "over"} ${r.minimum} character(s)` : r.type === "number" ? t = `Number must be greater than ${r.inclusive ? "or equal to " : ""}${r.minimum}` : r.type === "date" ? t = `Date must be greater than ${r.inclusive ? "or equal to " : ""}${new Date(r.minimum)}` : t = "Invalid input";
        break;
      case u.too_big:
        r.type === "array" ? t = `Array must contain ${r.inclusive ? "at most" : "less than"} ${r.maximum} element(s)` : r.type === "string" ? t = `String must contain ${r.inclusive ? "at most" : "under"} ${r.maximum} character(s)` : r.type === "number" ? t = `Number must be less than ${r.inclusive ? "or equal to " : ""}${r.maximum}` : r.type === "date" ? t = `Date must be smaller than ${r.inclusive ? "or equal to " : ""}${new Date(r.maximum)}` : t = "Invalid input";
        break;
      case u.custom:
        t = "Invalid input";
        break;
      case u.invalid_intersection_types:
        t = "Intersection results could not be merged";
        break;
      case u.not_multiple_of:
        t = `Number must be a multiple of ${r.multipleOf}`;
        break;
      default:
        t = e.defaultError, b.assertNever(r);
    }
    return { message: t };
  };
  var ke = ie;
  function Me(r) {
    ke = r;
  }
  function ce() {
    return ke;
  }
  var ue = (r) => {
    let { data: e, path: t, errorMaps: s2, issueData: n } = r, a = [...t, ...n.path || []], i = g(c({}, n), { path: a }), o = "", d2 = s2.filter((l) => !!l).slice().reverse();
    for (let l of d2)
      o = l(i, { data: e, defaultError: o }).message;
    return g(c({}, n), { path: a, message: n.message || o });
  };
  var Ve = [];
  function h(r, e) {
    let t = ue({ issueData: e, data: r.data, path: r.path, errorMaps: [r.common.contextualErrorMap, r.schemaErrorMap, ce(), ie].filter((s2) => !!s2) });
    r.common.issues.push(t);
  }
  var k = class {
    constructor() {
      this.value = "valid";
    }
    dirty() {
      this.value === "valid" && (this.value = "dirty");
    }
    abort() {
      this.value !== "aborted" && (this.value = "aborted");
    }
    static mergeArray(e, t) {
      let s2 = [];
      for (let n of t) {
        if (n.status === "aborted")
          return m;
        n.status === "dirty" && e.dirty(), s2.push(n.value);
      }
      return { status: e.value, value: s2 };
    }
    static mergeObjectAsync(e, t) {
      return P(this, null, function* () {
        let s2 = [];
        for (let n of t)
          s2.push({ key: yield n.key, value: yield n.value });
        return k.mergeObjectSync(e, s2);
      });
    }
    static mergeObjectSync(e, t) {
      let s2 = {};
      for (let n of t) {
        let { key: a, value: i } = n;
        if (a.status === "aborted" || i.status === "aborted")
          return m;
        a.status === "dirty" && e.dirty(), i.status === "dirty" && e.dirty(), (typeof i.value != "undefined" || n.alwaysSet) && (s2[a.value] = i.value);
      }
      return { status: e.value, value: s2 };
    }
  };
  var m = Object.freeze({ status: "aborted" });
  var Pe = (r) => ({ status: "dirty", value: r });
  var T = (r) => ({ status: "valid", value: r });
  var fe = (r) => r.status === "aborted";
  var me = (r) => r.status === "dirty";
  var de = (r) => r.status === "valid";
  var ye = (r) => typeof Promise !== void 0 && r instanceof Promise;
  var x;
  (function(r) {
    r.errToObj = (e) => typeof e == "string" ? { message: e } : e || {}, r.toString = (e) => typeof e == "string" ? e : e == null ? void 0 : e.message;
  })(x || (x = {}));
  var E = class {
    constructor(e, t, s2, n) {
      this.parent = e, this.data = t, this._path = s2, this._key = n;
    }
    get path() {
      return this._path.concat(this._key);
    }
  };
  var xe = (r, e) => {
    if (de(e))
      return { success: true, data: e.value };
    {
      if (!r.common.issues.length)
        throw new Error("Validation failed but no issues detected.");
      let t = new j(r.common.issues);
      return { success: false, error: t };
    }
  };
  function _(r) {
    if (!r)
      return {};
    let { errorMap: e, invalid_type_error: t, required_error: s2, description: n } = r;
    if (e && (t || s2))
      throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
    return e ? { errorMap: e, description: n } : { errorMap: (i, o) => i.code !== "invalid_type" ? { message: o.defaultError } : typeof o.data == "undefined" ? { message: s2 != null ? s2 : o.defaultError } : { message: t != null ? t : o.defaultError }, description: n };
  }
  var v = class {
    constructor(e) {
      this.spa = this.safeParseAsync, this.superRefine = this._refinement, this._def = e, this.parse = this.parse.bind(this), this.safeParse = this.safeParse.bind(this), this.parseAsync = this.parseAsync.bind(this), this.safeParseAsync = this.safeParseAsync.bind(this), this.spa = this.spa.bind(this), this.refine = this.refine.bind(this), this.refinement = this.refinement.bind(this), this.superRefine = this.superRefine.bind(this), this.optional = this.optional.bind(this), this.nullable = this.nullable.bind(this), this.nullish = this.nullish.bind(this), this.array = this.array.bind(this), this.promise = this.promise.bind(this), this.or = this.or.bind(this), this.and = this.and.bind(this), this.transform = this.transform.bind(this), this.default = this.default.bind(this), this.describe = this.describe.bind(this), this.isNullable = this.isNullable.bind(this), this.isOptional = this.isOptional.bind(this);
    }
    get description() {
      return this._def.description;
    }
    _getType(e) {
      return z(e.data);
    }
    _getOrReturnCtx(e, t) {
      return t || { common: e.parent.common, data: e.data, parsedType: z(e.data), schemaErrorMap: this._def.errorMap, path: e.path, parent: e.parent };
    }
    _processInputParams(e) {
      return { status: new k(), ctx: { common: e.parent.common, data: e.data, parsedType: z(e.data), schemaErrorMap: this._def.errorMap, path: e.path, parent: e.parent } };
    }
    _parseSync(e) {
      let t = this._parse(e);
      if (ye(t))
        throw new Error("Synchronous parse encountered promise.");
      return t;
    }
    _parseAsync(e) {
      let t = this._parse(e);
      return Promise.resolve(t);
    }
    parse(e, t) {
      let s2 = this.safeParse(e, t);
      if (s2.success)
        return s2.data;
      throw s2.error;
    }
    safeParse(e, t) {
      var s2;
      let n = { common: { issues: [], async: (s2 = t == null ? void 0 : t.async) !== null && s2 !== void 0 ? s2 : false, contextualErrorMap: t == null ? void 0 : t.errorMap }, path: (t == null ? void 0 : t.path) || [], schemaErrorMap: this._def.errorMap, parent: null, data: e, parsedType: z(e) }, a = this._parseSync({ data: e, path: n.path, parent: n });
      return xe(n, a);
    }
    parseAsync(e, t) {
      return P(this, null, function* () {
        let s2 = yield this.safeParseAsync(e, t);
        if (s2.success)
          return s2.data;
        throw s2.error;
      });
    }
    safeParseAsync(e, t) {
      return P(this, null, function* () {
        let s2 = { common: { issues: [], contextualErrorMap: t == null ? void 0 : t.errorMap, async: true }, path: (t == null ? void 0 : t.path) || [], schemaErrorMap: this._def.errorMap, parent: null, data: e, parsedType: z(e) }, n = this._parse({ data: e, path: [], parent: s2 }), a = yield ye(n) ? n : Promise.resolve(n);
        return xe(s2, a);
      });
    }
    refine(e, t) {
      let s2 = (n) => typeof t == "string" || typeof t == "undefined" ? { message: t } : typeof t == "function" ? t(n) : t;
      return this._refinement((n, a) => {
        let i = e(n), o = () => a.addIssue(c({ code: u.custom }, s2(n)));
        return typeof Promise != "undefined" && i instanceof Promise ? i.then((d2) => d2 ? true : (o(), false)) : i ? true : (o(), false);
      });
    }
    refinement(e, t) {
      return this._refinement((s2, n) => e(s2) ? true : (n.addIssue(typeof t == "function" ? t(s2, n) : t), false));
    }
    _refinement(e) {
      return new I({ schema: this, typeName: f.ZodEffects, effect: { type: "refinement", refinement: e } });
    }
    optional() {
      return S.create(this);
    }
    nullable() {
      return V.create(this);
    }
    nullish() {
      return this.optional().nullable();
    }
    array() {
      return O.create(this);
    }
    promise() {
      return U.create(this);
    }
    or(e) {
      return W.create([this, e]);
    }
    and(e) {
      return B.create(this, e);
    }
    transform(e) {
      return new I({ schema: this, typeName: f.ZodEffects, effect: { type: "transform", transform: e } });
    }
    default(e) {
      let t = typeof e == "function" ? e : () => e;
      return new oe({ innerType: this, defaultValue: t, typeName: f.ZodDefault });
    }
    brand() {
      return new pe(c({ typeName: f.ZodBranded, type: this }, _(void 0)));
    }
    describe(e) {
      let t = this.constructor;
      return new t(g(c({}, this._def), { description: e }));
    }
    isOptional() {
      return this.safeParse(void 0).success;
    }
    isNullable() {
      return this.safeParse(null).success;
    }
  };
  var ze = /^c[^\s-]{8,}$/i;
  var De = /^([a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[a-f0-9]{4}-[a-f0-9]{12}|00000000-0000-0000-0000-000000000000)$/i;
  var $e = /^(([^<>()[\]\.,;:\s@\"]+(\.[^<>()[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\.,;:\s@\"]+\.)+[^<>()[\]\.,;:\s@\"]{2,})$/i;
  var R = class extends v {
    constructor() {
      super(...arguments), this._regex = (e, t, s2) => this.refinement((n) => e.test(n), c({ validation: t, code: u.invalid_string }, x.errToObj(s2))), this.nonempty = (e) => this.min(1, x.errToObj(e)), this.trim = () => new R(g(c({}, this._def), { checks: [...this._def.checks, { kind: "trim" }] }));
    }
    _parse(e) {
      if (this._getType(e) !== p.string) {
        let a = this._getOrReturnCtx(e);
        return h(a, { code: u.invalid_type, expected: p.string, received: a.parsedType }), m;
      }
      let s2 = new k(), n;
      for (let a of this._def.checks)
        if (a.kind === "min")
          e.data.length < a.value && (n = this._getOrReturnCtx(e, n), h(n, { code: u.too_small, minimum: a.value, type: "string", inclusive: true, message: a.message }), s2.dirty());
        else if (a.kind === "max")
          e.data.length > a.value && (n = this._getOrReturnCtx(e, n), h(n, { code: u.too_big, maximum: a.value, type: "string", inclusive: true, message: a.message }), s2.dirty());
        else if (a.kind === "email")
          $e.test(e.data) || (n = this._getOrReturnCtx(e, n), h(n, { validation: "email", code: u.invalid_string, message: a.message }), s2.dirty());
        else if (a.kind === "uuid")
          De.test(e.data) || (n = this._getOrReturnCtx(e, n), h(n, { validation: "uuid", code: u.invalid_string, message: a.message }), s2.dirty());
        else if (a.kind === "cuid")
          ze.test(e.data) || (n = this._getOrReturnCtx(e, n), h(n, { validation: "cuid", code: u.invalid_string, message: a.message }), s2.dirty());
        else if (a.kind === "url")
          try {
            new URL(e.data);
          } catch (i) {
            n = this._getOrReturnCtx(e, n), h(n, { validation: "url", code: u.invalid_string, message: a.message }), s2.dirty();
          }
        else
          a.kind === "regex" ? (a.regex.lastIndex = 0, a.regex.test(e.data) || (n = this._getOrReturnCtx(e, n), h(n, { validation: "regex", code: u.invalid_string, message: a.message }), s2.dirty())) : a.kind === "trim" ? e.data = e.data.trim() : a.kind === "startsWith" ? e.data.startsWith(a.value) || (n = this._getOrReturnCtx(e, n), h(n, { code: u.invalid_string, validation: { startsWith: a.value }, message: a.message }), s2.dirty()) : a.kind === "endsWith" ? e.data.endsWith(a.value) || (n = this._getOrReturnCtx(e, n), h(n, { code: u.invalid_string, validation: { endsWith: a.value }, message: a.message }), s2.dirty()) : b.assertNever(a);
      return { status: s2.value, value: e.data };
    }
    _addCheck(e) {
      return new R(g(c({}, this._def), { checks: [...this._def.checks, e] }));
    }
    email(e) {
      return this._addCheck(c({ kind: "email" }, x.errToObj(e)));
    }
    url(e) {
      return this._addCheck(c({ kind: "url" }, x.errToObj(e)));
    }
    uuid(e) {
      return this._addCheck(c({ kind: "uuid" }, x.errToObj(e)));
    }
    cuid(e) {
      return this._addCheck(c({ kind: "cuid" }, x.errToObj(e)));
    }
    regex(e, t) {
      return this._addCheck(c({ kind: "regex", regex: e }, x.errToObj(t)));
    }
    startsWith(e, t) {
      return this._addCheck(c({ kind: "startsWith", value: e }, x.errToObj(t)));
    }
    endsWith(e, t) {
      return this._addCheck(c({ kind: "endsWith", value: e }, x.errToObj(t)));
    }
    min(e, t) {
      return this._addCheck(c({ kind: "min", value: e }, x.errToObj(t)));
    }
    max(e, t) {
      return this._addCheck(c({ kind: "max", value: e }, x.errToObj(t)));
    }
    length(e, t) {
      return this.min(e, t).max(e, t);
    }
    get isEmail() {
      return !!this._def.checks.find((e) => e.kind === "email");
    }
    get isURL() {
      return !!this._def.checks.find((e) => e.kind === "url");
    }
    get isUUID() {
      return !!this._def.checks.find((e) => e.kind === "uuid");
    }
    get isCUID() {
      return !!this._def.checks.find((e) => e.kind === "cuid");
    }
    get minLength() {
      let e = null;
      for (let t of this._def.checks)
        t.kind === "min" && (e === null || t.value > e) && (e = t.value);
      return e;
    }
    get maxLength() {
      let e = null;
      for (let t of this._def.checks)
        t.kind === "max" && (e === null || t.value < e) && (e = t.value);
      return e;
    }
  };
  R.create = (r) => new R(c({ checks: [], typeName: f.ZodString }, _(r)));
  function Le(r, e) {
    let t = (r.toString().split(".")[1] || "").length, s2 = (e.toString().split(".")[1] || "").length, n = t > s2 ? t : s2, a = parseInt(r.toFixed(n).replace(".", "")), i = parseInt(e.toFixed(n).replace(".", ""));
    return a % i / Math.pow(10, n);
  }
  var A = class extends v {
    constructor() {
      super(...arguments), this.min = this.gte, this.max = this.lte, this.step = this.multipleOf;
    }
    _parse(e) {
      if (this._getType(e) !== p.number) {
        let a = this._getOrReturnCtx(e);
        return h(a, { code: u.invalid_type, expected: p.number, received: a.parsedType }), m;
      }
      let s2, n = new k();
      for (let a of this._def.checks)
        a.kind === "int" ? b.isInteger(e.data) || (s2 = this._getOrReturnCtx(e, s2), h(s2, { code: u.invalid_type, expected: "integer", received: "float", message: a.message }), n.dirty()) : a.kind === "min" ? (a.inclusive ? e.data < a.value : e.data <= a.value) && (s2 = this._getOrReturnCtx(e, s2), h(s2, { code: u.too_small, minimum: a.value, type: "number", inclusive: a.inclusive, message: a.message }), n.dirty()) : a.kind === "max" ? (a.inclusive ? e.data > a.value : e.data >= a.value) && (s2 = this._getOrReturnCtx(e, s2), h(s2, { code: u.too_big, maximum: a.value, type: "number", inclusive: a.inclusive, message: a.message }), n.dirty()) : a.kind === "multipleOf" ? Le(e.data, a.value) !== 0 && (s2 = this._getOrReturnCtx(e, s2), h(s2, { code: u.not_multiple_of, multipleOf: a.value, message: a.message }), n.dirty()) : b.assertNever(a);
      return { status: n.value, value: e.data };
    }
    gte(e, t) {
      return this.setLimit("min", e, true, x.toString(t));
    }
    gt(e, t) {
      return this.setLimit("min", e, false, x.toString(t));
    }
    lte(e, t) {
      return this.setLimit("max", e, true, x.toString(t));
    }
    lt(e, t) {
      return this.setLimit("max", e, false, x.toString(t));
    }
    setLimit(e, t, s2, n) {
      return new A(g(c({}, this._def), { checks: [...this._def.checks, { kind: e, value: t, inclusive: s2, message: x.toString(n) }] }));
    }
    _addCheck(e) {
      return new A(g(c({}, this._def), { checks: [...this._def.checks, e] }));
    }
    int(e) {
      return this._addCheck({ kind: "int", message: x.toString(e) });
    }
    positive(e) {
      return this._addCheck({ kind: "min", value: 0, inclusive: false, message: x.toString(e) });
    }
    negative(e) {
      return this._addCheck({ kind: "max", value: 0, inclusive: false, message: x.toString(e) });
    }
    nonpositive(e) {
      return this._addCheck({ kind: "max", value: 0, inclusive: true, message: x.toString(e) });
    }
    nonnegative(e) {
      return this._addCheck({ kind: "min", value: 0, inclusive: true, message: x.toString(e) });
    }
    multipleOf(e, t) {
      return this._addCheck({ kind: "multipleOf", value: e, message: x.toString(t) });
    }
    get minValue() {
      let e = null;
      for (let t of this._def.checks)
        t.kind === "min" && (e === null || t.value > e) && (e = t.value);
      return e;
    }
    get maxValue() {
      let e = null;
      for (let t of this._def.checks)
        t.kind === "max" && (e === null || t.value < e) && (e = t.value);
      return e;
    }
    get isInt() {
      return !!this._def.checks.find((e) => e.kind === "int");
    }
  };
  A.create = (r) => new A(c({ checks: [], typeName: f.ZodNumber }, _(r)));
  var K = class extends v {
    _parse(e) {
      if (this._getType(e) !== p.bigint) {
        let s2 = this._getOrReturnCtx(e);
        return h(s2, { code: u.invalid_type, expected: p.bigint, received: s2.parsedType }), m;
      }
      return T(e.data);
    }
  };
  K.create = (r) => new K(c({ typeName: f.ZodBigInt }, _(r)));
  var H = class extends v {
    _parse(e) {
      if (this._getType(e) !== p.boolean) {
        let s2 = this._getOrReturnCtx(e);
        return h(s2, { code: u.invalid_type, expected: p.boolean, received: s2.parsedType }), m;
      }
      return T(e.data);
    }
  };
  H.create = (r) => new H(c({ typeName: f.ZodBoolean }, _(r)));
  var $ = class extends v {
    _parse(e) {
      if (this._getType(e) !== p.date) {
        let a = this._getOrReturnCtx(e);
        return h(a, { code: u.invalid_type, expected: p.date, received: a.parsedType }), m;
      }
      if (isNaN(e.data.getTime())) {
        let a = this._getOrReturnCtx(e);
        return h(a, { code: u.invalid_date }), m;
      }
      let s2 = new k(), n;
      for (let a of this._def.checks)
        a.kind === "min" ? e.data.getTime() < a.value && (n = this._getOrReturnCtx(e, n), h(n, { code: u.too_small, message: a.message, inclusive: true, minimum: a.value, type: "date" }), s2.dirty()) : a.kind === "max" ? e.data.getTime() > a.value && (n = this._getOrReturnCtx(e, n), h(n, { code: u.too_big, message: a.message, inclusive: true, maximum: a.value, type: "date" }), s2.dirty()) : b.assertNever(a);
      return { status: s2.value, value: new Date(e.data.getTime()) };
    }
    _addCheck(e) {
      return new $(g(c({}, this._def), { checks: [...this._def.checks, e] }));
    }
    min(e, t) {
      return this._addCheck({ kind: "min", value: e.getTime(), message: x.toString(t) });
    }
    max(e, t) {
      return this._addCheck({ kind: "max", value: e.getTime(), message: x.toString(t) });
    }
    get minDate() {
      let e = null;
      for (let t of this._def.checks)
        t.kind === "min" && (e === null || t.value > e) && (e = t.value);
      return e != null ? new Date(e) : null;
    }
    get maxDate() {
      let e = null;
      for (let t of this._def.checks)
        t.kind === "max" && (e === null || t.value < e) && (e = t.value);
      return e != null ? new Date(e) : null;
    }
  };
  $.create = (r) => new $(c({ checks: [], typeName: f.ZodDate }, _(r)));
  var G = class extends v {
    _parse(e) {
      if (this._getType(e) !== p.undefined) {
        let s2 = this._getOrReturnCtx(e);
        return h(s2, { code: u.invalid_type, expected: p.undefined, received: s2.parsedType }), m;
      }
      return T(e.data);
    }
  };
  G.create = (r) => new G(c({ typeName: f.ZodUndefined }, _(r)));
  var Q = class extends v {
    _parse(e) {
      if (this._getType(e) !== p.null) {
        let s2 = this._getOrReturnCtx(e);
        return h(s2, { code: u.invalid_type, expected: p.null, received: s2.parsedType }), m;
      }
      return T(e.data);
    }
  };
  Q.create = (r) => new Q(c({ typeName: f.ZodNull }, _(r)));
  var L = class extends v {
    constructor() {
      super(...arguments), this._any = true;
    }
    _parse(e) {
      return T(e.data);
    }
  };
  L.create = (r) => new L(c({ typeName: f.ZodAny }, _(r)));
  var Z = class extends v {
    constructor() {
      super(...arguments), this._unknown = true;
    }
    _parse(e) {
      return T(e.data);
    }
  };
  Z.create = (r) => new Z(c({ typeName: f.ZodUnknown }, _(r)));
  var C = class extends v {
    _parse(e) {
      let t = this._getOrReturnCtx(e);
      return h(t, { code: u.invalid_type, expected: p.never, received: t.parsedType }), m;
    }
  };
  C.create = (r) => new C(c({ typeName: f.ZodNever }, _(r)));
  var X = class extends v {
    _parse(e) {
      if (this._getType(e) !== p.undefined) {
        let s2 = this._getOrReturnCtx(e);
        return h(s2, { code: u.invalid_type, expected: p.void, received: s2.parsedType }), m;
      }
      return T(e.data);
    }
  };
  X.create = (r) => new X(c({ typeName: f.ZodVoid }, _(r)));
  var O = class extends v {
    _parse(e) {
      let { ctx: t, status: s2 } = this._processInputParams(e), n = this._def;
      if (t.parsedType !== p.array)
        return h(t, { code: u.invalid_type, expected: p.array, received: t.parsedType }), m;
      if (n.minLength !== null && t.data.length < n.minLength.value && (h(t, { code: u.too_small, minimum: n.minLength.value, type: "array", inclusive: true, message: n.minLength.message }), s2.dirty()), n.maxLength !== null && t.data.length > n.maxLength.value && (h(t, { code: u.too_big, maximum: n.maxLength.value, type: "array", inclusive: true, message: n.maxLength.message }), s2.dirty()), t.common.async)
        return Promise.all(t.data.map((i, o) => n.type._parseAsync(new E(t, i, t.path, o)))).then((i) => k.mergeArray(s2, i));
      let a = t.data.map((i, o) => n.type._parseSync(new E(t, i, t.path, o)));
      return k.mergeArray(s2, a);
    }
    get element() {
      return this._def.type;
    }
    min(e, t) {
      return new O(g(c({}, this._def), { minLength: { value: e, message: x.toString(t) } }));
    }
    max(e, t) {
      return new O(g(c({}, this._def), { maxLength: { value: e, message: x.toString(t) } }));
    }
    length(e, t) {
      return this.min(e, t).max(e, t);
    }
    nonempty(e) {
      return this.min(1, e);
    }
  };
  O.create = (r, e) => new O(c({ type: r, minLength: null, maxLength: null, typeName: f.ZodArray }, _(e)));
  var le;
  (function(r) {
    r.mergeShapes = (e, t) => c(c({}, e), t);
  })(le || (le = {}));
  var be = (r) => (e) => new w(g(c({}, r), { shape: () => c(c({}, r.shape()), e) }));
  function Y(r) {
    if (r instanceof w) {
      let e = {};
      for (let t in r.shape) {
        let s2 = r.shape[t];
        e[t] = S.create(Y(s2));
      }
      return new w(g(c({}, r._def), { shape: () => e }));
    } else
      return r instanceof O ? O.create(Y(r.element)) : r instanceof S ? S.create(Y(r.unwrap())) : r instanceof V ? V.create(Y(r.unwrap())) : r instanceof N ? N.create(r.items.map((e) => Y(e))) : r;
  }
  var w = class extends v {
    constructor() {
      super(...arguments), this._cached = null, this.nonstrict = this.passthrough, this.augment = be(this._def), this.extend = be(this._def);
    }
    _getCached() {
      if (this._cached !== null)
        return this._cached;
      let e = this._def.shape(), t = b.objectKeys(e);
      return this._cached = { shape: e, keys: t };
    }
    _parse(e) {
      if (this._getType(e) !== p.object) {
        let l = this._getOrReturnCtx(e);
        return h(l, { code: u.invalid_type, expected: p.object, received: l.parsedType }), m;
      }
      let { status: s2, ctx: n } = this._processInputParams(e), { shape: a, keys: i } = this._getCached(), o = [];
      if (!(this._def.catchall instanceof C && this._def.unknownKeys === "strip"))
        for (let l in n.data)
          i.includes(l) || o.push(l);
      let d2 = [];
      for (let l of i) {
        let y = a[l], J = n.data[l];
        d2.push({ key: { status: "valid", value: l }, value: y._parse(new E(n, J, n.path, l)), alwaysSet: l in n.data });
      }
      if (this._def.catchall instanceof C) {
        let l = this._def.unknownKeys;
        if (l === "passthrough")
          for (let y of o)
            d2.push({ key: { status: "valid", value: y }, value: { status: "valid", value: n.data[y] } });
        else if (l === "strict")
          o.length > 0 && (h(n, { code: u.unrecognized_keys, keys: o }), s2.dirty());
        else if (l !== "strip")
          throw new Error("Internal ZodObject error: invalid unknownKeys value.");
      } else {
        let l = this._def.catchall;
        for (let y of o) {
          let J = n.data[y];
          d2.push({ key: { status: "valid", value: y }, value: l._parse(new E(n, J, n.path, y)), alwaysSet: y in n.data });
        }
      }
      return n.common.async ? Promise.resolve().then(() => P(this, null, function* () {
        let l = [];
        for (let y of d2) {
          let J = yield y.key;
          l.push({ key: J, value: yield y.value, alwaysSet: y.alwaysSet });
        }
        return l;
      })).then((l) => k.mergeObjectSync(s2, l)) : k.mergeObjectSync(s2, d2);
    }
    get shape() {
      return this._def.shape();
    }
    strict(e) {
      return x.errToObj, new w(c(g(c({}, this._def), { unknownKeys: "strict" }), e !== void 0 ? { errorMap: (t, s2) => {
        var n, a, i, o;
        let d2 = (i = (a = (n = this._def).errorMap) === null || a === void 0 ? void 0 : a.call(n, t, s2).message) !== null && i !== void 0 ? i : s2.defaultError;
        return t.code === "unrecognized_keys" ? { message: (o = x.errToObj(e).message) !== null && o !== void 0 ? o : d2 } : { message: d2 };
      } } : {}));
    }
    strip() {
      return new w(g(c({}, this._def), { unknownKeys: "strip" }));
    }
    passthrough() {
      return new w(g(c({}, this._def), { unknownKeys: "passthrough" }));
    }
    setKey(e, t) {
      return this.augment({ [e]: t });
    }
    merge(e) {
      return new w({ unknownKeys: e._def.unknownKeys, catchall: e._def.catchall, shape: () => le.mergeShapes(this._def.shape(), e._def.shape()), typeName: f.ZodObject });
    }
    catchall(e) {
      return new w(g(c({}, this._def), { catchall: e }));
    }
    pick(e) {
      let t = {};
      return b.objectKeys(e).map((s2) => {
        this.shape[s2] && (t[s2] = this.shape[s2]);
      }), new w(g(c({}, this._def), { shape: () => t }));
    }
    omit(e) {
      let t = {};
      return b.objectKeys(this.shape).map((s2) => {
        b.objectKeys(e).indexOf(s2) === -1 && (t[s2] = this.shape[s2]);
      }), new w(g(c({}, this._def), { shape: () => t }));
    }
    deepPartial() {
      return Y(this);
    }
    partial(e) {
      let t = {};
      if (e)
        return b.objectKeys(this.shape).map((s2) => {
          b.objectKeys(e).indexOf(s2) === -1 ? t[s2] = this.shape[s2] : t[s2] = this.shape[s2].optional();
        }), new w(g(c({}, this._def), { shape: () => t }));
      for (let s2 in this.shape) {
        let n = this.shape[s2];
        t[s2] = n.optional();
      }
      return new w(g(c({}, this._def), { shape: () => t }));
    }
    required() {
      let e = {};
      for (let t in this.shape) {
        let n = this.shape[t];
        for (; n instanceof S; )
          n = n._def.innerType;
        e[t] = n;
      }
      return new w(g(c({}, this._def), { shape: () => e }));
    }
    keyof() {
      return Te(b.objectKeys(this.shape));
    }
  };
  w.create = (r, e) => new w(c({ shape: () => r, unknownKeys: "strip", catchall: C.create(), typeName: f.ZodObject }, _(e)));
  w.strictCreate = (r, e) => new w(c({ shape: () => r, unknownKeys: "strict", catchall: C.create(), typeName: f.ZodObject }, _(e)));
  w.lazycreate = (r, e) => new w(c({ shape: r, unknownKeys: "strip", catchall: C.create(), typeName: f.ZodObject }, _(e)));
  var W = class extends v {
    _parse(e) {
      let { ctx: t } = this._processInputParams(e), s2 = this._def.options;
      function n(a) {
        for (let o of a)
          if (o.result.status === "valid")
            return o.result;
        for (let o of a)
          if (o.result.status === "dirty")
            return t.common.issues.push(...o.ctx.common.issues), o.result;
        let i = a.map((o) => new j(o.ctx.common.issues));
        return h(t, { code: u.invalid_union, unionErrors: i }), m;
      }
      if (t.common.async)
        return Promise.all(s2.map((a) => P(this, null, function* () {
          let i = g(c({}, t), { common: g(c({}, t.common), { issues: [] }), parent: null });
          return { result: yield a._parseAsync({ data: t.data, path: t.path, parent: i }), ctx: i };
        }))).then(n);
      {
        let a, i = [];
        for (let d2 of s2) {
          let l = g(c({}, t), { common: g(c({}, t.common), { issues: [] }), parent: null }), y = d2._parseSync({ data: t.data, path: t.path, parent: l });
          if (y.status === "valid")
            return y;
          y.status === "dirty" && !a && (a = { result: y, ctx: l }), l.common.issues.length && i.push(l.common.issues);
        }
        if (a)
          return t.common.issues.push(...a.ctx.common.issues), a.result;
        let o = i.map((d2) => new j(d2));
        return h(t, { code: u.invalid_union, unionErrors: o }), m;
      }
    }
    get options() {
      return this._def.options;
    }
  };
  W.create = (r, e) => new W(c({ options: r, typeName: f.ZodUnion }, _(e)));
  var F = class extends v {
    _parse(e) {
      let { ctx: t } = this._processInputParams(e);
      if (t.parsedType !== p.object)
        return h(t, { code: u.invalid_type, expected: p.object, received: t.parsedType }), m;
      let s2 = this.discriminator, n = t.data[s2], a = this.options.get(n);
      return a ? t.common.async ? a._parseAsync({ data: t.data, path: t.path, parent: t }) : a._parseSync({ data: t.data, path: t.path, parent: t }) : (h(t, { code: u.invalid_union_discriminator, options: this.validDiscriminatorValues, path: [s2] }), m);
    }
    get discriminator() {
      return this._def.discriminator;
    }
    get validDiscriminatorValues() {
      return Array.from(this.options.keys());
    }
    get options() {
      return this._def.options;
    }
    static create(e, t, s2) {
      let n = /* @__PURE__ */ new Map();
      try {
        t.forEach((a) => {
          let i = a.shape[e].value;
          n.set(i, a);
        });
      } catch (a) {
        throw new Error("The discriminator value could not be extracted from all the provided schemas");
      }
      if (n.size !== t.length)
        throw new Error("Some of the discriminator values are not unique");
      return new F(c({ typeName: f.ZodDiscriminatedUnion, discriminator: e, options: n }, _(s2)));
    }
  };
  function ve(r, e) {
    let t = z(r), s2 = z(e);
    if (r === e)
      return { valid: true, data: r };
    if (t === p.object && s2 === p.object) {
      let n = b.objectKeys(e), a = b.objectKeys(r).filter((o) => n.indexOf(o) !== -1), i = c(c({}, r), e);
      for (let o of a) {
        let d2 = ve(r[o], e[o]);
        if (!d2.valid)
          return { valid: false };
        i[o] = d2.data;
      }
      return { valid: true, data: i };
    } else if (t === p.array && s2 === p.array) {
      if (r.length !== e.length)
        return { valid: false };
      let n = [];
      for (let a = 0; a < r.length; a++) {
        let i = r[a], o = e[a], d2 = ve(i, o);
        if (!d2.valid)
          return { valid: false };
        n.push(d2.data);
      }
      return { valid: true, data: n };
    } else
      return t === p.date && s2 === p.date && +r == +e ? { valid: true, data: r } : { valid: false };
  }
  var B = class extends v {
    _parse(e) {
      let { status: t, ctx: s2 } = this._processInputParams(e), n = (a, i) => {
        if (fe(a) || fe(i))
          return m;
        let o = ve(a.value, i.value);
        return o.valid ? ((me(a) || me(i)) && t.dirty(), { status: t.value, value: o.data }) : (h(s2, { code: u.invalid_intersection_types }), m);
      };
      return s2.common.async ? Promise.all([this._def.left._parseAsync({ data: s2.data, path: s2.path, parent: s2 }), this._def.right._parseAsync({ data: s2.data, path: s2.path, parent: s2 })]).then(([a, i]) => n(a, i)) : n(this._def.left._parseSync({ data: s2.data, path: s2.path, parent: s2 }), this._def.right._parseSync({ data: s2.data, path: s2.path, parent: s2 }));
    }
  };
  B.create = (r, e, t) => new B(c({ left: r, right: e, typeName: f.ZodIntersection }, _(t)));
  var N = class extends v {
    _parse(e) {
      let { status: t, ctx: s2 } = this._processInputParams(e);
      if (s2.parsedType !== p.array)
        return h(s2, { code: u.invalid_type, expected: p.array, received: s2.parsedType }), m;
      if (s2.data.length < this._def.items.length)
        return h(s2, { code: u.too_small, minimum: this._def.items.length, inclusive: true, type: "array" }), m;
      !this._def.rest && s2.data.length > this._def.items.length && (h(s2, { code: u.too_big, maximum: this._def.items.length, inclusive: true, type: "array" }), t.dirty());
      let a = s2.data.map((i, o) => {
        let d2 = this._def.items[o] || this._def.rest;
        return d2 ? d2._parse(new E(s2, i, s2.path, o)) : null;
      }).filter((i) => !!i);
      return s2.common.async ? Promise.all(a).then((i) => k.mergeArray(t, i)) : k.mergeArray(t, a);
    }
    get items() {
      return this._def.items;
    }
    rest(e) {
      return new N(g(c({}, this._def), { rest: e }));
    }
  };
  N.create = (r, e) => {
    if (!Array.isArray(r))
      throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
    return new N(c({ items: r, typeName: f.ZodTuple, rest: null }, _(e)));
  };
  var q = class extends v {
    get keySchema() {
      return this._def.keyType;
    }
    get valueSchema() {
      return this._def.valueType;
    }
    _parse(e) {
      let { status: t, ctx: s2 } = this._processInputParams(e);
      if (s2.parsedType !== p.object)
        return h(s2, { code: u.invalid_type, expected: p.object, received: s2.parsedType }), m;
      let n = [], a = this._def.keyType, i = this._def.valueType;
      for (let o in s2.data)
        n.push({ key: a._parse(new E(s2, o, s2.path, o)), value: i._parse(new E(s2, s2.data[o], s2.path, o)) });
      return s2.common.async ? k.mergeObjectAsync(t, n) : k.mergeObjectSync(t, n);
    }
    get element() {
      return this._def.valueType;
    }
    static create(e, t, s2) {
      return t instanceof v ? new q(c({ keyType: e, valueType: t, typeName: f.ZodRecord }, _(s2))) : new q(c({ keyType: R.create(), valueType: e, typeName: f.ZodRecord }, _(t)));
    }
  };
  var ee = class extends v {
    _parse(e) {
      let { status: t, ctx: s2 } = this._processInputParams(e);
      if (s2.parsedType !== p.map)
        return h(s2, { code: u.invalid_type, expected: p.map, received: s2.parsedType }), m;
      let n = this._def.keyType, a = this._def.valueType, i = [...s2.data.entries()].map(([o, d2], l) => ({ key: n._parse(new E(s2, o, s2.path, [l, "key"])), value: a._parse(new E(s2, d2, s2.path, [l, "value"])) }));
      if (s2.common.async) {
        let o = /* @__PURE__ */ new Map();
        return Promise.resolve().then(() => P(this, null, function* () {
          for (let d2 of i) {
            let l = yield d2.key, y = yield d2.value;
            if (l.status === "aborted" || y.status === "aborted")
              return m;
            (l.status === "dirty" || y.status === "dirty") && t.dirty(), o.set(l.value, y.value);
          }
          return { status: t.value, value: o };
        }));
      } else {
        let o = /* @__PURE__ */ new Map();
        for (let d2 of i) {
          let l = d2.key, y = d2.value;
          if (l.status === "aborted" || y.status === "aborted")
            return m;
          (l.status === "dirty" || y.status === "dirty") && t.dirty(), o.set(l.value, y.value);
        }
        return { status: t.value, value: o };
      }
    }
  };
  ee.create = (r, e, t) => new ee(c({ valueType: e, keyType: r, typeName: f.ZodMap }, _(t)));
  var M = class extends v {
    _parse(e) {
      let { status: t, ctx: s2 } = this._processInputParams(e);
      if (s2.parsedType !== p.set)
        return h(s2, { code: u.invalid_type, expected: p.set, received: s2.parsedType }), m;
      let n = this._def;
      n.minSize !== null && s2.data.size < n.minSize.value && (h(s2, { code: u.too_small, minimum: n.minSize.value, type: "set", inclusive: true, message: n.minSize.message }), t.dirty()), n.maxSize !== null && s2.data.size > n.maxSize.value && (h(s2, { code: u.too_big, maximum: n.maxSize.value, type: "set", inclusive: true, message: n.maxSize.message }), t.dirty());
      let a = this._def.valueType;
      function i(d2) {
        let l = /* @__PURE__ */ new Set();
        for (let y of d2) {
          if (y.status === "aborted")
            return m;
          y.status === "dirty" && t.dirty(), l.add(y.value);
        }
        return { status: t.value, value: l };
      }
      let o = [...s2.data.values()].map((d2, l) => a._parse(new E(s2, d2, s2.path, l)));
      return s2.common.async ? Promise.all(o).then((d2) => i(d2)) : i(o);
    }
    min(e, t) {
      return new M(g(c({}, this._def), { minSize: { value: e, message: x.toString(t) } }));
    }
    max(e, t) {
      return new M(g(c({}, this._def), { maxSize: { value: e, message: x.toString(t) } }));
    }
    size(e, t) {
      return this.min(e, t).max(e, t);
    }
    nonempty(e) {
      return this.min(1, e);
    }
  };
  M.create = (r, e) => new M(c({ valueType: r, minSize: null, maxSize: null, typeName: f.ZodSet }, _(e)));
  var D = class extends v {
    constructor() {
      super(...arguments), this.validate = this.implement;
    }
    _parse(e) {
      let { ctx: t } = this._processInputParams(e);
      if (t.parsedType !== p.function)
        return h(t, { code: u.invalid_type, expected: p.function, received: t.parsedType }), m;
      function s2(o, d2) {
        return ue({ data: o, path: t.path, errorMaps: [t.common.contextualErrorMap, t.schemaErrorMap, ce(), ie].filter((l) => !!l), issueData: { code: u.invalid_arguments, argumentsError: d2 } });
      }
      function n(o, d2) {
        return ue({ data: o, path: t.path, errorMaps: [t.common.contextualErrorMap, t.schemaErrorMap, ce(), ie].filter((l) => !!l), issueData: { code: u.invalid_return_type, returnTypeError: d2 } });
      }
      let a = { errorMap: t.common.contextualErrorMap }, i = t.data;
      return this._def.returns instanceof U ? T((...o) => P(this, null, function* () {
        let d2 = new j([]), l = yield this._def.args.parseAsync(o, a).catch((he) => {
          throw d2.addIssue(s2(o, he)), d2;
        }), y = yield i(...l);
        return yield this._def.returns._def.type.parseAsync(y, a).catch((he) => {
          throw d2.addIssue(n(y, he)), d2;
        });
      })) : T((...o) => {
        let d2 = this._def.args.safeParse(o, a);
        if (!d2.success)
          throw new j([s2(o, d2.error)]);
        let l = i(...d2.data), y = this._def.returns.safeParse(l, a);
        if (!y.success)
          throw new j([n(l, y.error)]);
        return y.data;
      });
    }
    parameters() {
      return this._def.args;
    }
    returnType() {
      return this._def.returns;
    }
    args(...e) {
      return new D(g(c({}, this._def), { args: N.create(e).rest(Z.create()) }));
    }
    returns(e) {
      return new D(g(c({}, this._def), { returns: e }));
    }
    implement(e) {
      return this.parse(e);
    }
    strictImplement(e) {
      return this.parse(e);
    }
    static create(e, t, s2) {
      return new D(c({ args: e || N.create([]).rest(Z.create()), returns: t || Z.create(), typeName: f.ZodFunction }, _(s2)));
    }
  };
  var te = class extends v {
    get schema() {
      return this._def.getter();
    }
    _parse(e) {
      let { ctx: t } = this._processInputParams(e);
      return this._def.getter()._parse({ data: t.data, path: t.path, parent: t });
    }
  };
  te.create = (r, e) => new te(c({ getter: r, typeName: f.ZodLazy }, _(e)));
  var re = class extends v {
    _parse(e) {
      if (e.data !== this._def.value) {
        let t = this._getOrReturnCtx(e);
        return h(t, { code: u.invalid_literal, expected: this._def.value }), m;
      }
      return { status: "valid", value: e.data };
    }
    get value() {
      return this._def.value;
    }
  };
  re.create = (r, e) => new re(c({ value: r, typeName: f.ZodLiteral }, _(e)));
  function Te(r, e) {
    return new se(c({ values: r, typeName: f.ZodEnum }, _(e)));
  }
  var se = class extends v {
    _parse(e) {
      if (typeof e.data != "string") {
        let t = this._getOrReturnCtx(e), s2 = this._def.values;
        return h(t, { expected: b.joinValues(s2), received: t.parsedType, code: u.invalid_type }), m;
      }
      if (this._def.values.indexOf(e.data) === -1) {
        let t = this._getOrReturnCtx(e), s2 = this._def.values;
        return h(t, { received: t.data, code: u.invalid_enum_value, options: s2 }), m;
      }
      return T(e.data);
    }
    get options() {
      return this._def.values;
    }
    get enum() {
      let e = {};
      for (let t of this._def.values)
        e[t] = t;
      return e;
    }
    get Values() {
      let e = {};
      for (let t of this._def.values)
        e[t] = t;
      return e;
    }
    get Enum() {
      let e = {};
      for (let t of this._def.values)
        e[t] = t;
      return e;
    }
  };
  se.create = Te;
  var ne = class extends v {
    _parse(e) {
      let t = b.getValidEnumValues(this._def.values), s2 = this._getOrReturnCtx(e);
      if (s2.parsedType !== p.string && s2.parsedType !== p.number) {
        let n = b.objectValues(t);
        return h(s2, { expected: b.joinValues(n), received: s2.parsedType, code: u.invalid_type }), m;
      }
      if (t.indexOf(e.data) === -1) {
        let n = b.objectValues(t);
        return h(s2, { received: s2.data, code: u.invalid_enum_value, options: n }), m;
      }
      return T(e.data);
    }
    get enum() {
      return this._def.values;
    }
  };
  ne.create = (r, e) => new ne(c({ values: r, typeName: f.ZodNativeEnum }, _(e)));
  var U = class extends v {
    _parse(e) {
      let { ctx: t } = this._processInputParams(e);
      if (t.parsedType !== p.promise && t.common.async === false)
        return h(t, { code: u.invalid_type, expected: p.promise, received: t.parsedType }), m;
      let s2 = t.parsedType === p.promise ? t.data : Promise.resolve(t.data);
      return T(s2.then((n) => this._def.type.parseAsync(n, { path: t.path, errorMap: t.common.contextualErrorMap })));
    }
  };
  U.create = (r, e) => new U(c({ type: r, typeName: f.ZodPromise }, _(e)));
  var I = class extends v {
    innerType() {
      return this._def.schema;
    }
    _parse(e) {
      let { status: t, ctx: s2 } = this._processInputParams(e), n = this._def.effect || null;
      if (n.type === "preprocess") {
        let i = n.transform(s2.data);
        return s2.common.async ? Promise.resolve(i).then((o) => this._def.schema._parseAsync({ data: o, path: s2.path, parent: s2 })) : this._def.schema._parseSync({ data: i, path: s2.path, parent: s2 });
      }
      let a = { addIssue: (i) => {
        h(s2, i), i.fatal ? t.abort() : t.dirty();
      }, get path() {
        return s2.path;
      } };
      if (a.addIssue = a.addIssue.bind(a), n.type === "refinement") {
        let i = (o) => {
          let d2 = n.refinement(o, a);
          if (s2.common.async)
            return Promise.resolve(d2);
          if (d2 instanceof Promise)
            throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
          return o;
        };
        if (s2.common.async === false) {
          let o = this._def.schema._parseSync({ data: s2.data, path: s2.path, parent: s2 });
          return o.status === "aborted" ? m : (o.status === "dirty" && t.dirty(), i(o.value), { status: t.value, value: o.value });
        } else
          return this._def.schema._parseAsync({ data: s2.data, path: s2.path, parent: s2 }).then((o) => o.status === "aborted" ? m : (o.status === "dirty" && t.dirty(), i(o.value).then(() => ({ status: t.value, value: o.value }))));
      }
      if (n.type === "transform")
        if (s2.common.async === false) {
          let i = this._def.schema._parseSync({ data: s2.data, path: s2.path, parent: s2 });
          if (!de(i))
            return i;
          let o = n.transform(i.value, a);
          if (o instanceof Promise)
            throw new Error("Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.");
          return { status: t.value, value: o };
        } else
          return this._def.schema._parseAsync({ data: s2.data, path: s2.path, parent: s2 }).then((i) => de(i) ? Promise.resolve(n.transform(i.value, a)).then((o) => ({ status: t.value, value: o })) : i);
      b.assertNever(n);
    }
  };
  I.create = (r, e, t) => new I(c({ schema: r, typeName: f.ZodEffects, effect: e }, _(t)));
  I.createWithPreprocess = (r, e, t) => new I(c({ schema: e, effect: { type: "preprocess", transform: r }, typeName: f.ZodEffects }, _(t)));
  var S = class extends v {
    _parse(e) {
      return this._getType(e) === p.undefined ? T(void 0) : this._def.innerType._parse(e);
    }
    unwrap() {
      return this._def.innerType;
    }
  };
  S.create = (r, e) => new S(c({ innerType: r, typeName: f.ZodOptional }, _(e)));
  var V = class extends v {
    _parse(e) {
      return this._getType(e) === p.null ? T(null) : this._def.innerType._parse(e);
    }
    unwrap() {
      return this._def.innerType;
    }
  };
  V.create = (r, e) => new V(c({ innerType: r, typeName: f.ZodNullable }, _(e)));
  var oe = class extends v {
    _parse(e) {
      let { ctx: t } = this._processInputParams(e), s2 = t.data;
      return t.parsedType === p.undefined && (s2 = this._def.defaultValue()), this._def.innerType._parse({ data: s2, path: t.path, parent: t });
    }
    removeDefault() {
      return this._def.innerType;
    }
  };
  oe.create = (r, e) => new S(c({ innerType: r, typeName: f.ZodOptional }, _(e)));
  var ae = class extends v {
    _parse(e) {
      if (this._getType(e) !== p.nan) {
        let s2 = this._getOrReturnCtx(e);
        return h(s2, { code: u.invalid_type, expected: p.nan, received: s2.parsedType }), m;
      }
      return { status: "valid", value: e.data };
    }
  };
  ae.create = (r) => new ae(c({ typeName: f.ZodNaN }, _(r)));
  var Ue = Symbol("zod_brand");
  var pe = class extends v {
    _parse(e) {
      let { ctx: t } = this._processInputParams(e), s2 = t.data;
      return this._def.type._parse({ data: s2, path: t.path, parent: t });
    }
    unwrap() {
      return this._def.type;
    }
  };
  var Se = (r, e = {}, t) => r ? L.create().superRefine((s2, n) => {
    if (!r(s2)) {
      let a = typeof e == "function" ? e(s2) : e, i = typeof a == "string" ? { message: a } : a;
      n.addIssue(g(c({ code: "custom" }, i), { fatal: t }));
    }
  }) : L.create();
  var We = { object: w.lazycreate };
  var f;
  (function(r) {
    r.ZodString = "ZodString", r.ZodNumber = "ZodNumber", r.ZodNaN = "ZodNaN", r.ZodBigInt = "ZodBigInt", r.ZodBoolean = "ZodBoolean", r.ZodDate = "ZodDate", r.ZodUndefined = "ZodUndefined", r.ZodNull = "ZodNull", r.ZodAny = "ZodAny", r.ZodUnknown = "ZodUnknown", r.ZodNever = "ZodNever", r.ZodVoid = "ZodVoid", r.ZodArray = "ZodArray", r.ZodObject = "ZodObject", r.ZodUnion = "ZodUnion", r.ZodDiscriminatedUnion = "ZodDiscriminatedUnion", r.ZodIntersection = "ZodIntersection", r.ZodTuple = "ZodTuple", r.ZodRecord = "ZodRecord", r.ZodMap = "ZodMap", r.ZodSet = "ZodSet", r.ZodFunction = "ZodFunction", r.ZodLazy = "ZodLazy", r.ZodLiteral = "ZodLiteral", r.ZodEnum = "ZodEnum", r.ZodEffects = "ZodEffects", r.ZodNativeEnum = "ZodNativeEnum", r.ZodOptional = "ZodOptional", r.ZodNullable = "ZodNullable", r.ZodDefault = "ZodDefault", r.ZodPromise = "ZodPromise", r.ZodBranded = "ZodBranded";
  })(f || (f = {}));
  var Be = (r, e = { message: `Input not instance of ${r.name}` }) => Se((t) => t instanceof r, e, true);
  var Ee = R.create;
  var Oe = A.create;
  var qe = ae.create;
  var Je = K.create;
  var Ne = H.create;
  var Ye = $.create;
  var Ke = G.create;
  var He = Q.create;
  var Ge = L.create;
  var Qe = Z.create;
  var Xe = C.create;
  var Fe = X.create;
  var et = O.create;
  var tt = w.create;
  var rt = w.strictCreate;
  var st = W.create;
  var nt = F.create;
  var at = B.create;
  var it = N.create;
  var ot = q.create;
  var ct = ee.create;
  var ut = M.create;
  var dt = D.create;
  var lt = te.create;
  var pt = re.create;
  var ht = se.create;
  var ft = ne.create;
  var mt = U.create;
  var we = I.create;
  var yt = S.create;
  var vt = V.create;
  var _t = I.createWithPreprocess;
  var gt = () => Ee().optional();
  var xt = () => Oe().optional();
  var bt = () => Ne().optional();
  var wt = m;
  var Tt = Object.freeze({ __proto__: null, getParsedType: z, ZodParsedType: p, defaultErrorMap: ie, setErrorMap: Me, getErrorMap: ce, makeIssue: ue, EMPTY_PATH: Ve, addIssueToContext: h, ParseStatus: k, INVALID: m, DIRTY: Pe, OK: T, isAborted: fe, isDirty: me, isValid: de, isAsync: ye, ZodType: v, ZodString: R, ZodNumber: A, ZodBigInt: K, ZodBoolean: H, ZodDate: $, ZodUndefined: G, ZodNull: Q, ZodAny: L, ZodUnknown: Z, ZodNever: C, ZodVoid: X, ZodArray: O, get objectUtil() {
    return le;
  }, ZodObject: w, ZodUnion: W, ZodDiscriminatedUnion: F, ZodIntersection: B, ZodTuple: N, ZodRecord: q, ZodMap: ee, ZodSet: M, ZodFunction: D, ZodLazy: te, ZodLiteral: re, ZodEnum: se, ZodNativeEnum: ne, ZodPromise: U, ZodEffects: I, ZodTransformer: I, ZodOptional: S, ZodNullable: V, ZodDefault: oe, ZodNaN: ae, BRAND: Ue, ZodBranded: pe, custom: Se, Schema: v, ZodSchema: v, late: We, get ZodFirstPartyTypeKind() {
    return f;
  }, any: Ge, array: et, bigint: Je, boolean: Ne, date: Ye, discriminatedUnion: nt, effect: we, enum: ht, function: dt, instanceof: Be, intersection: at, lazy: lt, literal: pt, map: ct, nan: qe, nativeEnum: ft, never: Xe, null: He, nullable: vt, number: Oe, object: tt, oboolean: bt, onumber: xt, optional: yt, ostring: gt, preprocess: _t, promise: mt, record: ot, set: ut, strictObject: rt, string: Ee, transformer: we, tuple: it, undefined: Ke, union: st, unknown: Qe, void: Fe, NEVER: wt, ZodIssueCode: u, quotelessJson: Ae, ZodError: j });

  // web:https://esm.sh/v96/zod-to-json-schema@3.17.0/es2015/zod-to-json-schema.js
  var __zod$ = Object.assign({ default: Tt }, zod_exports);
  var He2 = Object.create;
  var ue2 = Object.defineProperty;
  var Qe2 = Object.getOwnPropertyDescriptor;
  var We2 = Object.getOwnPropertyNames;
  var se2 = Object.getOwnPropertySymbols;
  var Xe2 = Object.getPrototypeOf;
  var oe2 = Object.prototype.hasOwnProperty;
  var Ye2 = Object.prototype.propertyIsEnumerable;
  var te2 = ((e) => typeof __require != "undefined" ? __require : typeof Proxy != "undefined" ? new Proxy(e, { get: (t, r) => (typeof __require != "undefined" ? __require : t)[r] }) : e)(function(e) {
    if (typeof __require != "undefined")
      return __require.apply(this, arguments);
    throw new Error('Dynamic require of "' + e + '" is not supported');
  });
  var de2 = (e, t) => {
    var r = {};
    for (var n in e)
      oe2.call(e, n) && t.indexOf(n) < 0 && (r[n] = e[n]);
    if (e != null && se2)
      for (var n of se2(e))
        t.indexOf(n) < 0 && Ye2.call(e, n) && (r[n] = e[n]);
    return r;
  };
  var s = (e, t) => () => (t || e((t = { exports: {} }).exports, t), t.exports);
  var et2 = (e, t, r, n) => {
    if (t && typeof t == "object" || typeof t == "function")
      for (let i of We2(t))
        !oe2.call(e, i) && i !== r && ue2(e, i, { get: () => t[i], enumerable: !(n = Qe2(t, i)) || n.enumerable });
    return e;
  };
  var tt2 = (e, t, r) => (r = e != null ? He2(Xe2(e)) : {}, et2(t || !e || !e.__esModule ? ue2(r, "default", { value: e, enumerable: true }) : r, e));
  var pe2 = s((D2) => {
    "use strict";
    Object.defineProperty(D2, "__esModule", { value: true });
    D2.parseOptionalDef = void 0;
    var ce2 = d(), rt2 = (e, t) => {
      if (t.currentPath.toString() === t.propertyPath.toString())
        return (0, ce2.parseDef)(e.innerType._def, t);
      let r = (0, ce2.parseDef)(e.innerType._def, t.addToPath("anyOf", "1"));
      return r ? { anyOf: [{ not: {} }, r] } : {};
    };
    D2.parseOptionalDef = rt2;
  });
  var le2 = s((g2) => {
    "use strict";
    Object.defineProperty(g2, "__esModule", { value: true });
    g2.parseAnyDef = void 0;
    function nt2() {
      return {};
    }
    g2.parseAnyDef = nt2;
  });
  var fe2 = s((h2) => {
    "use strict";
    Object.defineProperty(h2, "__esModule", { value: true });
    h2.parseArrayDef = void 0;
    var it2 = __zod$, at2 = d();
    function st2(e, t) {
      var r, n;
      let i = { type: "array" };
      return ((n = (r = e.type) === null || r === void 0 ? void 0 : r._def) === null || n === void 0 ? void 0 : n.typeName) !== it2.ZodFirstPartyTypeKind.ZodAny && (i.items = (0, at2.parseDef)(e.type._def, t.addToPath("items"))), e.minLength && (i.minItems = e.minLength.value), e.maxLength && (i.maxItems = e.maxLength.value), i;
    }
    h2.parseArrayDef = st2;
  });
  var ye2 = s((b2) => {
    "use strict";
    Object.defineProperty(b2, "__esModule", { value: true });
    b2.parseBigintDef = void 0;
    function ut2() {
      return { type: "integer", format: "int64" };
    }
    b2.parseBigintDef = ut2;
  });
  var me2 = s((P2) => {
    "use strict";
    Object.defineProperty(P2, "__esModule", { value: true });
    P2.parseBooleanDef = void 0;
    function ot2() {
      return { type: "boolean" };
    }
    P2.parseBooleanDef = ot2;
  });
  var _e2 = s((T2) => {
    "use strict";
    Object.defineProperty(T2, "__esModule", { value: true });
    T2.parseDateDef = void 0;
    function dt2() {
      return { type: "string", format: "date-time" };
    }
    T2.parseDateDef = dt2;
  });
  var ve2 = s((Z2) => {
    "use strict";
    Object.defineProperty(Z2, "__esModule", { value: true });
    Z2.parseDefaultDef = void 0;
    var ct2 = d();
    function pt2(e, t) {
      return Object.assign(Object.assign({}, (0, ct2.parseDef)(e.innerType._def, t)), { default: e.defaultValue() });
    }
    Z2.parseDefaultDef = pt2;
  });
  var De2 = s((O2) => {
    "use strict";
    Object.defineProperty(O2, "__esModule", { value: true });
    O2.parseEffectsDef = void 0;
    var lt2 = d();
    function ft2(e, t) {
      return t.effectStrategy === "input" ? (0, lt2.parseDef)(e.schema._def, t) : {};
    }
    O2.parseEffectsDef = ft2;
  });
  var ge2 = s((j2) => {
    "use strict";
    Object.defineProperty(j2, "__esModule", { value: true });
    j2.parseEnumDef = void 0;
    function yt2(e) {
      return { type: "string", enum: e.values };
    }
    j2.parseEnumDef = yt2;
  });
  var be2 = s((S2) => {
    "use strict";
    Object.defineProperty(S2, "__esModule", { value: true });
    S2.parseIntersectionDef = void 0;
    var he = d();
    function mt2(e, t) {
      let r = [(0, he.parseDef)(e.left._def, t.addToPath("allOf", "0")), (0, he.parseDef)(e.right._def, t.addToPath("allOf", "1"))].filter((n) => !!n);
      return r.length ? { allOf: r } : void 0;
    }
    S2.parseIntersectionDef = mt2;
  });
  var Pe2 = s((q2) => {
    "use strict";
    Object.defineProperty(q2, "__esModule", { value: true });
    q2.parseLiteralDef = void 0;
    function _t2(e, t) {
      let r = typeof e.value;
      return r !== "bigint" && r !== "number" && r !== "boolean" && r !== "string" ? { type: Array.isArray(e.value) ? "array" : "object" } : t.target === "openApi3" ? { type: r === "bigint" ? "integer" : r, enum: [e.value] } : { type: r === "bigint" ? "integer" : r, const: e.value };
    }
    q2.parseLiteralDef = _t2;
  });
  var Ze2 = s((M2) => {
    "use strict";
    Object.defineProperty(M2, "__esModule", { value: true });
    M2.parseMapDef = void 0;
    var Te2 = d();
    function vt2(e, t) {
      let r = (0, Te2.parseDef)(e.keyType._def, t.addToPath("items", "items", "0")) || {}, n = (0, Te2.parseDef)(e.valueType._def, t.addToPath("items", "items", "1")) || {};
      return { type: "array", maxItems: 125, items: { type: "array", items: [r, n], minItems: 2, maxItems: 2 } };
    }
    M2.parseMapDef = vt2;
  });
  var Oe2 = s((N2) => {
    "use strict";
    Object.defineProperty(N2, "__esModule", { value: true });
    N2.parseNativeEnumDef = void 0;
    function Dt(e) {
      let t = Object.values(e.values).filter((n) => typeof n == "number").map(toString), r = Object.values(e.values).filter((n, i) => i >= t.length);
      return { type: t.length === 0 ? "string" : t.length === r.length ? "number" : ["string", "number"], enum: r };
    }
    N2.parseNativeEnumDef = Dt;
  });
  var je2 = s((k2) => {
    "use strict";
    Object.defineProperty(k2, "__esModule", { value: true });
    k2.parseNeverDef = void 0;
    function gt2() {
      return { not: {} };
    }
    k2.parseNeverDef = gt2;
  });
  var Se2 = s((F2) => {
    "use strict";
    Object.defineProperty(F2, "__esModule", { value: true });
    F2.parseNullDef = void 0;
    function ht2(e) {
      return e.target === "openApi3" ? { enum: ["null"], nullable: true } : { type: "null" };
    }
    F2.parseNullDef = ht2;
  });
  var re2 = s((p2) => {
    "use strict";
    Object.defineProperty(p2, "__esModule", { value: true });
    p2.parseUnionDef = p2.primitiveMappings = void 0;
    var bt2 = d();
    p2.primitiveMappings = { ZodString: "string", ZodNumber: "number", ZodBigInt: "integer", ZodBoolean: "boolean", ZodNull: "null" };
    function Pt(e, t) {
      if (t.target === "openApi3")
        return qe2(e, t);
      let r = e.options instanceof Map ? Array.from(e.options.values()) : e.options;
      if (r.every((n) => n._def.typeName in p2.primitiveMappings && (!n._def.checks || !n._def.checks.length))) {
        let n = r.reduce((i, u2) => {
          let o = p2.primitiveMappings[u2._def.typeName];
          return o && !i.includes(o) ? [...i, o] : i;
        }, []);
        return { type: n.length > 1 ? n : n[0] };
      } else if (r.every((n) => n._def.typeName === "ZodLiteral")) {
        let n = r.reduce((i, u2) => {
          let o = typeof u2._def.value;
          switch (o) {
            case "string":
            case "number":
            case "boolean":
              return [...i, o];
            case "bigint":
              return [...i, "integer"];
            case "object":
              if (u2._def.value === null)
                return [...i, "null"];
            case "symbol":
            case "undefined":
            case "function":
            default:
              return i;
          }
        }, []);
        if (n.length === r.length) {
          let i = n.filter((u2, o, c2) => c2.indexOf(u2) === o);
          return { type: i.length > 1 ? i : i[0], enum: r.reduce((u2, o) => u2.includes(o._def.value) ? u2 : [...u2, o._def.value], []) };
        }
      } else if (r.every((n) => n._def.typeName === "ZodEnum"))
        return { type: "string", enum: r.reduce((n, i) => [...n, ...i._def.values.filter((u2) => !n.includes(u2))], []) };
      return qe2(e, t);
    }
    p2.parseUnionDef = Pt;
    var qe2 = (e, t) => {
      let r = (e.options instanceof Map ? Array.from(e.options.values()) : e.options).map((n, i) => (0, bt2.parseDef)(n._def, t.addToPath("anyOf", i.toString()))).filter((n) => !!n);
      return r.length ? { anyOf: r } : void 0;
    };
  });
  var Ne2 = s((K2) => {
    "use strict";
    Object.defineProperty(K2, "__esModule", { value: true });
    K2.parseNullableDef = void 0;
    var Tt2 = d(), Me2 = re2();
    function Zt(e, t) {
      if (["ZodString", "ZodNumber", "ZodBigInt", "ZodBoolean", "ZodNull"].includes(e.innerType._def.typeName) && (!e.innerType._def.checks || !e.innerType._def.checks.length))
        return t.target === "openApi3" ? { type: Me2.primitiveMappings[e.innerType._def.typeName], nullable: true } : { type: [Me2.primitiveMappings[e.innerType._def.typeName], "null"] };
      let r = (0, Tt2.parseDef)(e.innerType._def, t.addToPath("anyOf", "0"));
      return r ? t.target === "openApi3" ? Object.assign(Object.assign({}, r), { nullable: true }) : { anyOf: [r, { type: "null" }] } : void 0;
    }
    K2.parseNullableDef = Zt;
  });
  var ke2 = s(($2) => {
    "use strict";
    Object.defineProperty($2, "__esModule", { value: true });
    $2.parseNumberDef = void 0;
    function Ot(e, t) {
      let r = { type: "number" };
      if (e.checks)
        for (let n of e.checks)
          switch (n.kind) {
            case "int":
              r.type = "integer";
              break;
            case "min":
              t.target === "jsonSchema7" ? n.inclusive ? r.minimum = n.value : r.exclusiveMinimum = n.value : (n.inclusive || (r.exclusiveMinimum = true), r.minimum = n.value);
              break;
            case "max":
              t.target === "jsonSchema7" ? n.inclusive ? r.maximum = n.value : r.exclusiveMaximum = n.value : (n.inclusive || (r.exclusiveMaximum = true), r.maximum = n.value);
              break;
            case "multipleOf":
              r.multipleOf = n.value;
              break;
          }
      return r;
    }
    $2.parseNumberDef = Ot;
  });
  var Ke2 = s((A2) => {
    "use strict";
    Object.defineProperty(A2, "__esModule", { value: true });
    A2.parseObjectDef = void 0;
    var Fe2 = d();
    function jt(e, t) {
      var r;
      let n = Object.assign(Object.assign({ type: "object" }, Object.entries(e.shape()).reduce((i, [u2, o]) => {
        if (o === void 0 || o._def === void 0)
          return i;
        let c2 = (0, Fe2.parseDef)(o._def, t.addToPathAsProperty("properties", u2));
        return c2 === void 0 ? i : { properties: Object.assign(Object.assign({}, i.properties), { [u2]: c2 }), required: o.isOptional() ? i.required : [...i.required, u2] };
      }, { properties: {}, required: [] })), { additionalProperties: e.catchall._def.typeName === "ZodNever" ? e.unknownKeys === "passthrough" : (r = (0, Fe2.parseDef)(e.catchall._def, t.addToPath("additionalProperties"))) !== null && r !== void 0 ? r : true });
      return n.required.length || delete n.required, n;
    }
    A2.parseObjectDef = jt;
  });
  var $e2 = s((w2) => {
    "use strict";
    Object.defineProperty(w2, "__esModule", { value: true });
    w2.parsePromiseDef = void 0;
    var St = d();
    function qt(e, t) {
      return (0, St.parseDef)(e.type._def, t);
    }
    w2.parsePromiseDef = qt;
  });
  var ne2 = s((I2) => {
    "use strict";
    Object.defineProperty(I2, "__esModule", { value: true });
    I2.parseStringDef = void 0;
    function Mt(e) {
      let t = { type: "string" };
      if (e.checks)
        for (let r of e.checks)
          switch (r.kind) {
            case "min":
              t.minLength = r.value;
              break;
            case "max":
              t.maxLength = r.value;
              break;
            case "email":
              t.format = "email";
              break;
            case "url":
              t.format = "uri";
              break;
            case "uuid":
              t.format = "uuid";
              break;
            case "regex":
              t.pattern = r.regex.source;
              break;
            case "cuid":
              t.pattern = "^c[^\\s-]{8,}$";
              break;
            case "trim":
              break;
            default:
              ((n) => {
              })(r);
          }
      return t;
    }
    I2.parseStringDef = Mt;
  });
  var we2 = s((x2) => {
    "use strict";
    Object.defineProperty(x2, "__esModule", { value: true });
    x2.parseRecordDef = void 0;
    var Ae2 = __zod$, Nt = d(), kt = ne2();
    function Ft(e, t) {
      var r, n, i;
      let u2 = { type: "object", additionalProperties: (0, Nt.parseDef)(e.valueType._def, t.addToPath("additionalProperties")) || {} };
      if (((r = e.keyType) === null || r === void 0 ? void 0 : r._def.typeName) === Ae2.ZodFirstPartyTypeKind.ZodString && ((n = e.keyType._def.checks) === null || n === void 0 ? void 0 : n.length)) {
        let o = Object.entries((0, kt.parseStringDef)(e.keyType._def)).reduce((c2, [l, _2]) => l === "type" ? c2 : Object.assign(Object.assign({}, c2), { [l]: _2 }), {});
        return Object.assign(Object.assign({}, u2), { propertyNames: o });
      } else if (((i = e.keyType) === null || i === void 0 ? void 0 : i._def.typeName) === Ae2.ZodFirstPartyTypeKind.ZodEnum)
        return Object.assign(Object.assign({}, u2), { propertyNames: { enum: e.keyType._def.values } });
      return u2;
    }
    x2.parseRecordDef = Ft;
  });
  var Ie2 = s((E2) => {
    "use strict";
    Object.defineProperty(E2, "__esModule", { value: true });
    E2.parseSetDef = void 0;
    var Kt = d();
    function $t(e, t) {
      let r = (0, Kt.parseDef)(e.valueType._def, t.addToPath("items")), n = { type: "array", items: r };
      return e.minSize && (n.minItems = e.minSize.value), e.maxSize && (n.maxItems = e.maxSize.value), n;
    }
    E2.parseSetDef = $t;
  });
  var xe2 = s((z2) => {
    "use strict";
    Object.defineProperty(z2, "__esModule", { value: true });
    z2.parseTupleDef = void 0;
    var ie2 = d();
    function At(e, t) {
      return e.rest ? { type: "array", minItems: e.items.length, items: e.items.map((r, n) => (0, ie2.parseDef)(r._def, t.addToPath("items", n.toString()))).reduce((r, n) => n === void 0 ? r : [...r, n], []), additionalItems: (0, ie2.parseDef)(e.rest._def, t.addToPath("additionalItems")) } : { type: "array", minItems: e.items.length, maxItems: e.items.length, items: e.items.map((r, n) => (0, ie2.parseDef)(r._def, t.addToPath("items", n.toString()))).reduce((r, n) => n === void 0 ? r : [...r, n], []) };
    }
    z2.parseTupleDef = At;
  });
  var Ee2 = s((U2) => {
    "use strict";
    Object.defineProperty(U2, "__esModule", { value: true });
    U2.parseUndefinedDef = void 0;
    function wt2() {
      return { not: {} };
    }
    U2.parseUndefinedDef = wt2;
  });
  var ze2 = s((L2) => {
    "use strict";
    Object.defineProperty(L2, "__esModule", { value: true });
    L2.parseUnknownDef = void 0;
    function It() {
      return {};
    }
    L2.parseUnknownDef = It;
  });
  var d = s((R2) => {
    "use strict";
    Object.defineProperty(R2, "__esModule", { value: true });
    R2.parseDef = void 0;
    var a = __zod$, xt2 = pe2(), Et = le2(), zt = fe2(), Ut = ye2(), Lt = me2(), Rt = _e2(), Bt = ve2(), Jt = De2(), Vt = ge2(), Ct = be2(), Gt = Pe2(), Ht = Ze2(), Qt = Oe2(), Wt = je2(), Xt = Se2(), Yt = Ne2(), er = ke2(), tr = Ke2(), rr = $e2(), nr = we2(), ir = Ie2(), ar = ne2(), sr = xe2(), ur = Ee2(), or = re2(), dr = ze2();
    function Ue2(e, t) {
      let r = t.items.find((u2) => Object.is(u2.def, e));
      if (r)
        return cr(r, t);
      let n = { def: e, path: t.currentPath, jsonSchema: void 0 };
      t.items.push(n);
      let i = lr(e, e.typeName, t);
      return i && fr(e, i), n.jsonSchema = i, i;
    }
    R2.parseDef = Ue2;
    var cr = (e, t) => {
      switch (t.$refStrategy) {
        case "root":
          return { $ref: e.path.length === 0 ? "" : e.path.length === 1 ? `${e.path[0]}/` : e.path.join("/") };
        case "relative":
          return { $ref: pr(t.currentPath, e.path) };
        case "none":
          return e.path.length < t.currentPath.length && e.path.every((r, n) => t.currentPath[n] === r) ? (console.warn(`Recursive reference detected at ${t.currentPath.join("/")}! Defaulting to any`), {}) : e.jsonSchema;
      }
    }, pr = (e, t) => {
      let r = 0;
      for (; r < e.length && r < t.length && e[r] === t[r]; r++)
        ;
      return [(e.length - r).toString(), ...t.slice(r)].join("/");
    }, lr = (e, t, r) => {
      switch (t) {
        case a.ZodFirstPartyTypeKind.ZodString:
          return (0, ar.parseStringDef)(e);
        case a.ZodFirstPartyTypeKind.ZodNumber:
          return (0, er.parseNumberDef)(e, r);
        case a.ZodFirstPartyTypeKind.ZodObject:
          return (0, tr.parseObjectDef)(e, r);
        case a.ZodFirstPartyTypeKind.ZodBigInt:
          return (0, Ut.parseBigintDef)();
        case a.ZodFirstPartyTypeKind.ZodBoolean:
          return (0, Lt.parseBooleanDef)();
        case a.ZodFirstPartyTypeKind.ZodDate:
          return (0, Rt.parseDateDef)();
        case a.ZodFirstPartyTypeKind.ZodUndefined:
          return (0, ur.parseUndefinedDef)();
        case a.ZodFirstPartyTypeKind.ZodNull:
          return (0, Xt.parseNullDef)(r);
        case a.ZodFirstPartyTypeKind.ZodArray:
          return (0, zt.parseArrayDef)(e, r);
        case a.ZodFirstPartyTypeKind.ZodUnion:
        case a.ZodFirstPartyTypeKind.ZodDiscriminatedUnion:
          return (0, or.parseUnionDef)(e, r);
        case a.ZodFirstPartyTypeKind.ZodIntersection:
          return (0, Ct.parseIntersectionDef)(e, r);
        case a.ZodFirstPartyTypeKind.ZodTuple:
          return (0, sr.parseTupleDef)(e, r);
        case a.ZodFirstPartyTypeKind.ZodRecord:
          return (0, nr.parseRecordDef)(e, r);
        case a.ZodFirstPartyTypeKind.ZodLiteral:
          return (0, Gt.parseLiteralDef)(e, r);
        case a.ZodFirstPartyTypeKind.ZodEnum:
          return (0, Vt.parseEnumDef)(e);
        case a.ZodFirstPartyTypeKind.ZodNativeEnum:
          return (0, Qt.parseNativeEnumDef)(e);
        case a.ZodFirstPartyTypeKind.ZodNullable:
          return (0, Yt.parseNullableDef)(e, r);
        case a.ZodFirstPartyTypeKind.ZodOptional:
          return (0, xt2.parseOptionalDef)(e, r);
        case a.ZodFirstPartyTypeKind.ZodMap:
          return (0, Ht.parseMapDef)(e, r);
        case a.ZodFirstPartyTypeKind.ZodSet:
          return (0, ir.parseSetDef)(e, r);
        case a.ZodFirstPartyTypeKind.ZodLazy:
          return Ue2(e.getter()._def, r);
        case a.ZodFirstPartyTypeKind.ZodPromise:
          return (0, rr.parsePromiseDef)(e, r);
        case a.ZodFirstPartyTypeKind.ZodNaN:
        case a.ZodFirstPartyTypeKind.ZodNever:
          return (0, Wt.parseNeverDef)();
        case a.ZodFirstPartyTypeKind.ZodEffects:
          return (0, Jt.parseEffectsDef)(e, r);
        case a.ZodFirstPartyTypeKind.ZodAny:
          return (0, Et.parseAnyDef)();
        case a.ZodFirstPartyTypeKind.ZodUnknown:
          return (0, dr.parseUnknownDef)();
        case a.ZodFirstPartyTypeKind.ZodDefault:
          return (0, Bt.parseDefaultDef)(e, r);
        case a.ZodFirstPartyTypeKind.ZodFunction:
        case a.ZodFirstPartyTypeKind.ZodVoid:
          return;
        default:
          return ((n) => {
          })(t);
      }
    }, fr = (e, t) => (e.description && (t.description = e.description), t);
  });
  var Le2 = s((B2) => {
    "use strict";
    Object.defineProperty(B2, "__esModule", { value: true });
    B2.References = void 0;
    var f2 = class {
      constructor(t = ["#"], r = [], n = "root", i = "input", u2 = "jsonSchema7", o = []) {
        this.currentPath = t, this.items = r, this.$refStrategy = n, this.effectStrategy = i, this.target = u2, this.propertyPath = o;
      }
      addToPath(...t) {
        return new f2([...this.currentPath, ...t], this.items, this.$refStrategy, this.effectStrategy, this.target, this.propertyPath);
      }
      addToPathAsProperty(...t) {
        return new f2([...this.currentPath, ...t], this.items, this.$refStrategy, this.effectStrategy, this.target, [...this.currentPath, ...t]);
      }
    };
    B2.References = f2;
  });
  var Re2 = s((V2) => {
    "use strict";
    Object.defineProperty(V2, "__esModule", { value: true });
    V2.zodToJsonSchema = void 0;
    var y = d(), m2 = Le2(), J = "http://json-schema.org/draft-07/schema#";
    function yr(e, t) {
      var r, n, i, u2, o, c2, l, _2, C2, G2, H2, Q2, W2, X2, Y2, ee2;
      if (typeof t == "object")
        return t.name === void 0 ? t.target === "openApi3" ? (0, y.parseDef)(e._def, new m2.References((r = t.basePath) !== null && r !== void 0 ? r : ["#"], [], (n = t.$refStrategy) !== null && n !== void 0 ? n : "root", t.effectStrategy, t.target)) : Object.assign({ $schema: J }, (0, y.parseDef)(e._def, new m2.References((i = t.basePath) !== null && i !== void 0 ? i : ["#"], [], (u2 = t.$refStrategy) !== null && u2 !== void 0 ? u2 : "root", t.effectStrategy, t.target))) : t.target === "openApi3" ? { $ref: t.$refStrategy === "relative" ? `0/${(o = t.definitionPath) !== null && o !== void 0 ? o : "definitions"}/${t.name}` : `#/${(c2 = t.definitionPath) !== null && c2 !== void 0 ? c2 : "definitions"}/${t.name}`, [(l = t.definitionPath) !== null && l !== void 0 ? l : "definitions"]: { [t.name]: (0, y.parseDef)(e._def, new m2.References([...(_2 = t.basePath) !== null && _2 !== void 0 ? _2 : ["#"], (C2 = t.definitionPath) !== null && C2 !== void 0 ? C2 : "definitions", t.name], [], (G2 = t.$refStrategy) !== null && G2 !== void 0 ? G2 : "root", t.effectStrategy, t.target)) || {} } } : { $schema: J, $ref: t.$refStrategy === "relative" ? `0/${(H2 = t.definitionPath) !== null && H2 !== void 0 ? H2 : "definitions"}/${t.name}` : `#/${(Q2 = t.definitionPath) !== null && Q2 !== void 0 ? Q2 : "definitions"}/${t.name}`, [(W2 = t.definitionPath) !== null && W2 !== void 0 ? W2 : "definitions"]: { [t.name]: (0, y.parseDef)(e._def, new m2.References([...(X2 = t.basePath) !== null && X2 !== void 0 ? X2 : ["#"], (Y2 = t.definitionPath) !== null && Y2 !== void 0 ? Y2 : "definitions", t.name], [], (ee2 = t.$refStrategy) !== null && ee2 !== void 0 ? ee2 : "root", t.effectStrategy, t.target)) || {} } };
      if (typeof t == "string") {
        let ae2 = t;
        return { $schema: J, $ref: `#/definitions/${ae2}`, definitions: { [ae2]: (0, y.parseDef)(e._def, new m2.References()) || {} } };
      } else
        return Object.assign({ $schema: J }, (0, y.parseDef)(e._def, new m2.References()));
    }
    V2.zodToJsonSchema = yr;
  });
  var Je2 = s((v2) => {
    "use strict";
    Object.defineProperty(v2, "__esModule", { value: true });
    v2.zodToJsonSchema = void 0;
    var Be2 = Re2();
    Object.defineProperty(v2, "zodToJsonSchema", { enumerable: true, get: function() {
      return Be2.zodToJsonSchema;
    } });
    v2.default = Be2.zodToJsonSchema;
  });
  var Ge2 = tt2(Je2());
  var { zodToJsonSchema: Gr } = Ge2;
  var Ve2 = Ge2;
  var { default: Ce2 } = Ve2;
  var mr = de2(Ve2, ["default"]);
  var Hr = Ce2 !== void 0 ? Ce2 : mr;

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
        this.ch = state.ch.map((f2) => new IPristineFrame(this, f2));
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
      return encode({
        s: this.s,
        pc: this.pc,
        ch: this.ch.map((f2) => f2.serialize()),
        aw: this.aw,
        logs: this.logs,
        res: this.res
      });
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
      return { until_input: e.serialize(), idx: e.idx };
    } else {
      return true;
    }
  }
  var SuspensionUntilInput = class extends Suspension {
    constructor(idx, schema) {
      super(idx);
      this.idx = idx;
      this.schema = schema;
    }
    serialize() {
      return this.schema;
    }
  };

  // context.ts
  function zodToSchema(spec) {
    return Hr(spec, "$");
  }
  function isGenerator(fn) {
    return fn?.constructor?.name === "GeneratorFunction";
  }
  var InternalPristineContext = class {
    constructor(f2, serialized_state) {
      this.f = f2;
      this._counter = 0;
      this._state = [];
      this._data = {};
      this._lastSuspension = void 0;
      this._frame = void 0;
      if (serialized_state) {
        this._state = serialized_state?.s;
        this._data = serialized_state?.d;
        this._lastSuspension = serialized_state?.suspended;
      }
    }
    run_fn() {
      try {
        let res = null;
        res = this.f(this);
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
    run_generator() {
      try {
        let res = null;
        const generator_instance = this.f(this);
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
    run() {
      if (isGenerator(this.f)) {
        return this.run_generator();
      } else {
        return this.run_fn();
      }
    }
    setData(data) {
      this._data = data;
    }
    getData() {
      return {
        ...this._data
      };
    }
    newSuspensionUntilInput(schema) {
      return new SuspensionUntilInput(this._counter - 1, schema);
    }
    recv(spec) {
    }
    useUIInput(spec) {
      const schema = zodToSchema(spec);
      if (this._frame.aw && this._frame.aw?.until_input === void 0) {
        const res = this._frame.aw;
        this._frame.aw = void 0;
        return res;
      } else {
        throw this.newSuspensionUntilInput(schema);
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
      this._frame.aw = newMsg;
    }
    log(msg) {
      this._frame?.log(msg);
    }
  };
  function step(fn, state, newMsg) {
    const ctx = new InternalPristineContext(fn, {});
    if (state) {
      ctx.loadFrame(state);
    }
    if (newMsg) {
      ctx.supply(newMsg);
    }
    return ctx.run();
  }
  return __toCommonJS(ecmatime_exports);
})();

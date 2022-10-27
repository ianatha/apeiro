var $apeiro = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __require = /* @__PURE__ */ ((x2) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x2, {
    get: (a2, b3) => (typeof require !== "undefined" ? require : a2)[b3]
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
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
  var __accessCheck = (obj, member, msg) => {
    if (!member.has(obj))
      throw TypeError("Cannot " + msg);
  };
  var __privateGet = (obj, member, getter) => {
    __accessCheck(obj, member, "read from private field");
    return getter ? getter.call(obj) : member.get(obj);
  };
  var __privateAdd = (obj, member, value) => {
    if (member.has(obj))
      throw TypeError("Cannot add the same private member more than once");
    member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
  };
  var __privateSet = (obj, member, value, setter) => {
    __accessCheck(obj, member, "write to private field");
    setter ? setter.call(obj, value) : member.set(obj, value);
    return value;
  };

  // index.ts
  var ecmatime_exports = {};
  __export(ecmatime_exports, {
    Decoder: () => Decoder,
    Encoder: () => Encoder,
    Headers: () => Headers2,
    Request: () => Request2,
    Response: () => Response,
    flattenHeadersList: () => g2,
    flattenHeadersObject: () => O2,
    headersToList: () => H2,
    headersToObject: () => j2,
    headersToString: () => E2,
    importFunction: () => importFunction,
    listToHeaders: () => b2,
    objectToHeaders: () => w2,
    reduceHeadersObject: () => f2,
    sendEmail: () => sendEmail,
    step: () => step,
    stringToHeaders: () => A2
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
    decodeObject(v2) {
      let decoded = {};
      Object.keys(v2.value).forEach((k2) => {
        decoded[k2] = this.decodeValue(v2.value[k2]);
      });
      if (v2.tag) {
        this.BY_TAG[v2.tag] = decoded;
      }
      return decoded;
    }
    decodeArray(v2) {
      const decoded = [];
      Object.keys(v2.value).forEach((k2) => {
        decoded.push(this.decodeValue(v2.value[k2]));
      });
      this.BY_TAG[v2.tag] = decoded;
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
    decodeFunction(v2) {
      if (this.isFunctionMissingKeyword(v2.src)) {
        v2.src = "function _" + v2.src;
      }
      let decoded = this.evalInContext(`const fn = ${v2.src}; fn`);
      if (v2.props) {
        const propsDecoded = this.decodeObject(v2.props);
        for (const k2 in propsDecoded) {
          decoded[k2] = propsDecoded[k2];
        }
      }
      this.BY_TAG[v2.tag] = decoded;
      return decoded;
    }
    decodeFunctionBound(v2) {
      let propsDecoded = this.decodeObject(v2.props);
      let decoded = propsDecoded.target.bind(propsDecoded.thisArg, ...propsDecoded.boundedArgs);
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
      if (classDef.prototype != void 0) {
        Object.setPrototypeOf(decoded, classDef.prototype);
      } else {
        console.log("TODO prototype undefined");
      }
      return decoded;
    }
    decodeValue(v2) {
      if (v2 === void 0 || v2 === null || v2.type === void 0) {
        throw new Error("attempting to decode undefined");
      }
      if (v2.type === "undefined") {
        return void 0;
      } else if (v2.type === "null") {
        return null;
      } else if (v2.type === "ref") {
        return this.BY_TAG[v2.tag];
      } else if (v2.type === "number") {
        return v2.value;
      } else if (v2.type === "string") {
        return v2.value;
      } else if (v2.type === "boolean") {
        return v2.value;
      } else if (v2.type == "object_from_ctx") {
        return this.ctx.getFunction(v2.value);
      } else if (v2.type === "object") {
        return this.decodeObject(v2);
      } else if (v2.type === "function") {
        return this.decodeFunction(v2);
      } else if (v2.type === "function_bound") {
        return this.decodeFunctionBound(v2);
      } else if (v2.type === "class_definition") {
        return this.decodeClassDefinition(v2);
      } else if (v2.type === "class_instance") {
        return this.decodeClassInstance(v2);
      } else if (v2.type === "array") {
        return this.decodeArray(v2);
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
      this.assignTag(v2);
      return {
        type: "class_definition",
        src: v2.toString(),
        tag: v2[TAG]
      };
    }
    encodeFunction(v2, debug) {
      this.assignTag(v2);
      if (v2.toString().indexOf(" [native code]") >= 0) {
        console.log("encountered native function at " + debug);
      }
      let res = {
        type: "function",
        tag: v2[TAG],
        src: v2.toString()
      };
      if (Object.keys(v2).length > 0) {
        res.props = this.encodeObject(v2, debug + ".props", false);
      }
      if (v2?.$bound) {
        delete res.src;
        res.type = "function_bound";
      }
      return res;
    }
    assignTag(v2) {
      if (v2[TAG] === void 0) {
        try {
          v2[TAG] = this.id;
          this.id++;
        } catch (e) {
          console.log("failed tagging ", JSON.stringify(v2));
        }
        return true;
      } else {
        return false;
      }
    }
    encodeObject(v2, debug) {
      if (v2.$from_apeiro_ctx) {
        return {
          type: "object_from_ctx",
          value: v2.$from_apeiro_ctx
        };
      }
      this.assignTag(v2);
      const value = {};
      Object.keys(v2).forEach((k2) => {
        value[k2] = this.encodeValue(v2[k2], debug + "." + k2);
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
    encodeClassInstance(v2, debug) {
      this.assignTag(v2);
      const value = {};
      Object.keys(v2).forEach((k2) => {
        value[k2] = this.encodeValue(v2[k2], debug + "." + k2);
      });
      return {
        type: "class_instance",
        constructor: this.encodeClassDefinition(v2.constructor),
        value,
        tag: v2[TAG]
      };
    }
    encodeArray(v2, debug) {
      this.assignTag(v2);
      let value = [];
      Object.keys(v2).forEach((k2) => {
        value.push(this.encodeValue(v2[k2], debug + "." + k2));
      });
      return {
        type: "array",
        value,
        tag: v2[TAG]
      };
    }
    encodeValue(v2, debug) {
      if (v2 === null) {
        return { type: "null" };
      } else if (typeof v2 === "undefined") {
        return { type: "undefined" };
      } else if (v2[TAG]) {
        return { type: "ref", tag: v2[TAG] };
      } else if (typeof v2 === "number") {
        return this.encodeNumber(v2);
      } else if (typeof v2 === "string") {
        return this.encodeString(v2);
      } else if (typeof v2 === "boolean") {
        return this.encodeBoolean(v2);
      } else if (isObject(v2)) {
        return this.encodeObject(v2, debug);
      } else if (isFunction(v2)) {
        return this.encodeFunction(v2, debug);
      } else if (isClassInstance(v2)) {
        return this.encodeClassInstance(v2, debug);
      } else if (isClassDefinition(v2)) {
        return this.encodeClassDefinition(v2);
      } else if (isArray(v2)) {
        return this.encodeArray(v2, debug);
      } else {
        throw new Error("unsupported type " + typeof v2);
      }
    }
    cleanValue(v2) {
      if (v2 !== null && v2 !== void 0 && (typeof v2 === "object" || typeof v2 === "function")) {
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
      const result = this.encodeValue(v2, "");
      return JSON.stringify(result);
    }
  };
  function isObject(v2) {
    return typeof v2 === "object" && v2 !== null && v2.constructor === Object;
  }
  function isArray(v2) {
    return typeof v2 === "object" && v2.constructor === Array;
  }
  function isClassInstance(v2) {
    return typeof v2 === "object" && !(v2.constructor === Object) && !(v2.constructor === Array);
  }
  function isFunction(v2) {
    return typeof v2 === "function" && !(v2.toString().substring(0, 5) === "class");
  }
  function isClassDefinition(v2) {
    return typeof v2 === "function" && v2.toString().substring(0, 5) === "class";
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
        this.ch = state.ch.map((f3) => new IPristineFrame(this, f3));
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
        ch: this.ch.map((f3) => f3.serialize()),
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

  // web:https://deno.land/std@0.120.0/encoding/base64.ts
  var base64abc = [
    "A",
    "B",
    "C",
    "D",
    "E",
    "F",
    "G",
    "H",
    "I",
    "J",
    "K",
    "L",
    "M",
    "N",
    "O",
    "P",
    "Q",
    "R",
    "S",
    "T",
    "U",
    "V",
    "W",
    "X",
    "Y",
    "Z",
    "a",
    "b",
    "c",
    "d",
    "e",
    "f",
    "g",
    "h",
    "i",
    "j",
    "k",
    "l",
    "m",
    "n",
    "o",
    "p",
    "q",
    "r",
    "s",
    "t",
    "u",
    "v",
    "w",
    "x",
    "y",
    "z",
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "+",
    "/"
  ];
  function encode(data) {
    const uint8 = typeof data === "string" ? new TextEncoder().encode(data) : data instanceof Uint8Array ? data : new Uint8Array(data);
    let result = "", i;
    const l2 = uint8.length;
    for (i = 2; i < l2; i += 3) {
      result += base64abc[uint8[i - 2] >> 2];
      result += base64abc[(uint8[i - 2] & 3) << 4 | uint8[i - 1] >> 4];
      result += base64abc[(uint8[i - 1] & 15) << 2 | uint8[i] >> 6];
      result += base64abc[uint8[i] & 63];
    }
    if (i === l2 + 1) {
      result += base64abc[uint8[i - 2] >> 2];
      result += base64abc[(uint8[i - 2] & 3) << 4];
      result += "==";
    }
    if (i === l2) {
      result += base64abc[uint8[i - 2] >> 2];
      result += base64abc[(uint8[i - 2] & 3) << 4 | uint8[i - 1] >> 4];
      result += base64abc[(uint8[i - 1] & 15) << 2];
      result += "=";
    }
    return result;
  }

  // web:https://deno.land/x/aws_api@v0.6.0/encoding/json.ts
  var FieldTypeNames = {
    s: "string",
    n: "number",
    b: "boolean",
    d: "date",
    a: "blob"
  };
  function readObj(opts, data) {
    if (data === null || typeof data !== "object" || Array.isArray(data)) {
      throw new Error(`Object wasn't an object, was ${typeof data}, wanted keys ${JSON.stringify(Object.keys(opts.required).concat(Object.keys(opts.optional)))}`);
    }
    const remap = opts.remap ?? {};
    const missing = new Set(Object.keys(opts.required));
    const problems = new Array();
    const obj = /* @__PURE__ */ Object.create(null);
    for (const [key, raw] of Object.entries(data)) {
      const targetName = key in remap ? remap[key].toString() : key;
      const isRequired = targetName in opts.required;
      if (!isRequired && !(targetName in opts.optional))
        continue;
      if (raw == null) {
        obj[targetName] = null;
      } else {
        const typeSig = isRequired ? opts.required[targetName] : opts.optional[targetName];
        const value = readField(typeSig, raw);
        if (value == null) {
          problems.push(`Key ${key} of type ${typeof raw} failed to parse as ${typeof typeSig === "string" ? FieldTypeNames[typeSig] : typeof typeSig}`);
        } else {
          missing.delete(targetName);
        }
        obj[targetName] = value;
      }
    }
    if (problems.length > 0)
      throw new Error(`BUG: JSON object failed to read some keys: ${problems.join(" ; ")} - had keys ${JSON.stringify(Object.keys(data))}`);
    if (missing.size > 0)
      throwMissingKeys(missing, Object.keys(data));
    return obj;
  }
  function readField(typeSig, raw) {
    if (raw == null)
      return null;
    switch (typeSig) {
      case "s":
        return typeof raw === "string" ? raw : null;
      case "n":
        return typeof raw === "number" ? raw : null;
      case "b":
        return typeof raw === "boolean" ? raw : null;
      case "d":
        return readDate(raw);
      case "a":
        if (typeof raw === "string") {
          return decodeBase64(raw);
        }
        break;
      default:
        if (typeof typeSig === "function") {
          return typeSig(raw);
        } else if (Array.isArray(typeSig)) {
          if (Array.isArray(raw)) {
            return raw.map(readField.bind(null, typeSig[0]));
          }
        }
    }
    return null;
  }
  function throwMissingKeys(missingKeys, hadKeys) {
    throw new Error(`BUG: JSON object missing required keys ${JSON.stringify(Array.from(missingKeys))} - had keys ${JSON.stringify(Array.from(hadKeys))}`);
  }
  function readDate(raw) {
    if (typeof raw === "string") {
      const date = new Date(raw);
      if (!isNaN(date.valueOf()))
        return date;
    } else if (typeof raw === "number") {
      return new Date(raw * 1e3);
    }
    return null;
  }
  function decodeBase64(b64) {
    const binString = atob(b64);
    const size = binString.length;
    const bytes = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      bytes[i] = binString.charCodeAt(i);
    }
    return bytes;
  }

  // web:https://aws-api.deno.dev/v0.3/services/sesv2.ts?actions=SendEmail&docs=
  function serializeBlob(input) {
    if (input == null)
      return input;
    return encode(input);
  }
  var _client;
  var _SESV2 = class {
    constructor(apiFactory) {
      __privateAdd(this, _client, void 0);
      __privateSet(this, _client, apiFactory.buildServiceClient(_SESV2.ApiMetadata));
    }
    async sendEmail(params, opts = {}) {
      const body = {
        FromEmailAddress: params["FromEmailAddress"],
        FromEmailAddressIdentityArn: params["FromEmailAddressIdentityArn"],
        Destination: fromDestination(params["Destination"]),
        ReplyToAddresses: params["ReplyToAddresses"],
        FeedbackForwardingEmailAddress: params["FeedbackForwardingEmailAddress"],
        FeedbackForwardingEmailAddressIdentityArn: params["FeedbackForwardingEmailAddressIdentityArn"],
        Content: fromEmailContent(params["Content"]),
        EmailTags: params["EmailTags"]?.map((x2) => fromMessageTag(x2)),
        ConfigurationSetName: params["ConfigurationSetName"],
        ListManagementOptions: fromListManagementOptions(params["ListManagementOptions"])
      };
      const resp = await __privateGet(this, _client).performRequest({
        opts,
        body,
        action: "SendEmail",
        requestUri: "/v2/email/outbound-emails"
      });
      return readObj({
        required: {},
        optional: {
          "MessageId": "s"
        }
      }, await resp.json());
    }
  };
  var SESV2 = _SESV2;
  _client = new WeakMap();
  SESV2.ApiMetadata = {
    "apiVersion": "2019-09-27",
    "endpointPrefix": "email",
    "jsonVersion": "1.1",
    "protocol": "rest-json",
    "serviceAbbreviation": "Amazon SES V2",
    "serviceFullName": "Amazon Simple Email Service",
    "serviceId": "SESv2",
    "signatureVersion": "v4",
    "signingName": "ses",
    "uid": "sesv2-2019-09-27"
  };
  function fromDestination(input) {
    if (!input)
      return input;
    return {
      ToAddresses: input["ToAddresses"],
      CcAddresses: input["CcAddresses"],
      BccAddresses: input["BccAddresses"]
    };
  }
  function fromEmailContent(input) {
    if (!input)
      return input;
    return {
      Simple: fromMessage(input["Simple"]),
      Raw: fromRawMessage(input["Raw"]),
      Template: fromTemplate(input["Template"])
    };
  }
  function fromMessage(input) {
    if (!input)
      return input;
    return {
      Subject: fromContent(input["Subject"]),
      Body: fromBody(input["Body"])
    };
  }
  function fromContent(input) {
    if (!input)
      return input;
    return {
      Data: input["Data"],
      Charset: input["Charset"]
    };
  }
  function fromBody(input) {
    if (!input)
      return input;
    return {
      Text: fromContent(input["Text"]),
      Html: fromContent(input["Html"])
    };
  }
  function fromRawMessage(input) {
    if (!input)
      return input;
    return {
      Data: serializeBlob(input["Data"])
    };
  }
  function fromTemplate(input) {
    if (!input)
      return input;
    return {
      TemplateName: input["TemplateName"],
      TemplateArn: input["TemplateArn"],
      TemplateData: input["TemplateData"]
    };
  }
  function fromMessageTag(input) {
    if (!input)
      return input;
    return {
      Name: input["Name"],
      Value: input["Value"]
    };
  }
  function fromListManagementOptions(input) {
    if (!input)
      return input;
    return {
      ContactListName: input["ContactListName"],
      TopicName: input["TopicName"]
    };
  }

  // web:https://deno.land/x/aws_api@v0.6.0/client/common.ts
  function getRequestId(headers) {
    return headers.get("x-amzn-requestid") ?? headers.get("x-amz-request-id");
  }
  var AwsServiceError = class extends Error {
    constructor(resp, code, error, requestId) {
      requestId = requestId ?? "MISSING REQUEST ID";
      const shortCode = code.split(":")[0].split("#").slice(-1)[0];
      const typePart = error.Type ? `Type: ${error.Type}, ` : "";
      super(`${shortCode}: ${error.Message || new.target.name} [${typePart}Request ID: ${requestId}]`);
      this.origResponse = resp;
      this.code = code;
      this.shortCode = shortCode;
      this.errorType = error.Type ?? "Unknown";
      this.requestId = requestId;
      this.internal = error;
      this.name = new.target.name;
      if (Error.captureStackTrace) {
        Error.captureStackTrace(this, new.target);
      }
    }
    get originalMessage() {
      return this.internal.Message;
    }
  };

  // web:https://deno.land/x/aws_api@v0.6.0/client/endpoints.ts
  var AwsEndpointResolver = class {
    constructor({
      useDualstack = true,
      forceRegional = false
    } = {}) {
      this.useDualstack = useDualstack;
      this.forceRegional = forceRegional;
    }
    resolveUrl(parameters) {
      const { serviceId, globalEndpoint } = parameters.apiMetadata;
      let serviceLabel = parameters.apiMetadata.endpointPrefix;
      let signingRegion = parameters.region;
      if (serviceId === "S3") {
        if (this.useDualstack)
          serviceLabel += ".dualstack";
        perhapsUpgradeEndpointParametersToHostStyleRouting(parameters);
      }
      let rootDomain = getRootDomain(parameters.region);
      if (globalEndpoint && !this.forceRegional) {
        signingRegion = "us-east-1";
        serviceLabel = globalEndpoint.replace(/\.amazonaws\.com$/, "");
      } else {
        serviceLabel = `${serviceLabel}.${parameters.region}`;
      }
      if (serviceId === "EC2" && this.useDualstack && dualStackEc2Regions.has(parameters.region)) {
        parameters.hostPrefix = `${parameters.hostPrefix ?? ""}api.`;
        rootDomain = ".aws";
      }
      if (serviceId === "Lambda" && this.useDualstack) {
        if (rootDomain == ".amazonaws.com" && !parameters.region.includes("-gov-")) {
          rootDomain = ".api.aws";
        }
      }
      const urlPrefix = `https://${parameters.hostPrefix ?? ""}`;
      const fullUrl = `${urlPrefix}${serviceLabel}${rootDomain}`;
      return {
        url: new URL(parameters.requestPath, fullUrl),
        signingRegion
      };
    }
  };
  function getRootDomain(region) {
    if (region.startsWith("cn-"))
      return ".amazonaws.com.cn";
    if (region.startsWith("us-iso-"))
      return ".c2s.ic.gov";
    if (region.startsWith("us-isob-"))
      return ".sc2s.sgov.gov";
    return ".amazonaws.com";
  }
  var dualStackEc2Regions = /* @__PURE__ */ new Set([
    "us-east-1",
    "us-east-2",
    "us-west-2",
    "eu-west-1",
    "ap-south-1",
    "sa-east-1"
  ]);
  var FixedBaseEndpointResolver = class {
    constructor(baseUrl) {
      if (!baseUrl.includes("://"))
        throw new Error(
          `Fixed endpoint must be a full URL including https:// or http://`
        );
      this.baseUrl = new URL(baseUrl);
    }
    resolveUrl(parameters) {
      return {
        url: new URL(parameters.requestPath.slice(1), this.baseUrl),
        signingRegion: parameters.region
      };
    }
  };
  function perhapsUpgradeEndpointParametersToHostStyleRouting(parameters) {
    if (!parameters.requestPath || parameters.hostPrefix)
      return;
    const [bucketName] = parameters.requestPath.slice(1).split(/[?/]/);
    if (bucketName.length > 0 && !bucketName.includes(".")) {
      parameters.hostPrefix = `${bucketName}.`;
      const path = parameters.requestPath.slice(bucketName.length + 1);
      parameters.requestPath = path.startsWith("/") ? path : `/${path}`;
    }
  }

  // web:https://deno.land/x/aws_api@v0.6.0/client/instance-metadata.ts
  var IMDSv2 = class {
    constructor({
      serviceEndpoint,
      endpointMode,
      endpointPath = "latest/",
      timeoutMs = 1e3,
      apiTimeoutMs = 5e3,
      tokenTtlSeconds = 21600
    } = {}) {
      this.cachedToken = null;
      let disabled = false;
      try {
        disabled = Deno.env.get("AWS_EC2_METADATA_DISABLED") == "true";
      } catch (err) {
      }
      if (disabled)
        throw new Error(
          `IMDSv2 client is disabled via environment: AWS_EC2_METADATA_DISABLED=true`
        );
      if (!serviceEndpoint) {
        try {
          serviceEndpoint = Deno.env.get("AWS_EC2_METADATA_SERVICE_ENDPOINT");
        } catch (err) {
        }
      }
      if (!serviceEndpoint) {
        try {
          if (!endpointMode && Deno.env.get("AWS_EC2_METADATA_SERVICE_ENDPOINT_MODE") == "IPv6") {
            endpointMode = "IPv6";
          }
        } catch (err) {
        }
        if (endpointMode == "IPv6") {
          serviceEndpoint = "http://[fd00:ec2::254]";
        } else {
          serviceEndpoint = "http://169.254.169.254";
        }
      }
      this.baseUrl = new URL(endpointPath, serviceEndpoint);
      this.timeoutMs = Math.floor(timeoutMs);
      this.apiTimeoutMs = Math.floor(apiTimeoutMs);
      this.tokenTtlSeconds = Math.floor(tokenTtlSeconds);
    }
    async getToken() {
      if (this.cachedToken)
        return this.cachedToken;
      const [newToken, expireAfterMillis] = await this.fetchNewToken();
      this.cachedToken = newToken;
      setTimeout(() => {
        if (this.cachedToken === newToken) {
          this.cachedToken = null;
        }
      }, Math.max(1e3, expireAfterMillis));
      return newToken;
    }
    async fetchNewToken() {
      const ttlSeconds = this.tokenTtlSeconds;
      const respText = await this.#performRawRequest({
        method: "PUT",
        path: "api/token",
        timeoutMs: this.cachedToken ? this.apiTimeoutMs : this.timeoutMs,
        headers: {
          "x-aws-ec2-metadata-token-ttl-seconds": ttlSeconds.toFixed(0)
        }
      });
      return [
        respText,
        Math.floor(ttlSeconds * 0.95 * 1e3)
      ];
    }
    async performRequest(method = "GET", path = "meta-data/") {
      return await this.#performRawRequest({
        method,
        path,
        timeoutMs: this.apiTimeoutMs,
        headers: {
          "x-aws-ec2-metadata-token": await this.getToken()
        }
      });
    }
    async #performRawRequest(opts) {
      const aborter = new AbortController();
      const timeoutText = `Instance Metadata Timeout: ${opts.timeoutMs}ms`;
      const stopTimeout = setTimeout(() => aborter.abort(new Error(timeoutText)), opts.timeoutMs);
      const resp = await fetch(new URL(opts.path, this.baseUrl), {
        method: opts.method,
        headers: opts.headers,
        signal: aborter.signal
      }).catch((err) => {
        if (err instanceof DOMException && err.message.includes("aborted")) {
          return Promise.reject(new Error(timeoutText));
        }
        return Promise.reject(err);
      }).finally(() => {
        clearTimeout(stopTimeout);
      });
      if (resp.status >= 400 && resp.status < 500 && opts.path == "api/token") {
        resp.body?.cancel();
        throw new Error(`Metadata server gave HTTP ${resp.status} when asked for an IMDSv2 token; is this not AWS?`);
      } else if (resp.status > 299) {
        resp.body?.cancel();
        const err = new Error(
          `Metadata server gave HTTP ${resp.status} to ${opts.method} /${opts.path}`
        );
        err.status = resp.status;
        throw err;
      }
      return await resp.text();
    }
  };

  // web:https://deno.land/std@0.120.0/hash/sha256.ts
  var HEX_CHARS = "0123456789abcdef".split("");
  var EXTRA = [-2147483648, 8388608, 32768, 128];
  var SHIFT = [24, 16, 8, 0];
  var K = [
    1116352408,
    1899447441,
    3049323471,
    3921009573,
    961987163,
    1508970993,
    2453635748,
    2870763221,
    3624381080,
    310598401,
    607225278,
    1426881987,
    1925078388,
    2162078206,
    2614888103,
    3248222580,
    3835390401,
    4022224774,
    264347078,
    604807628,
    770255983,
    1249150122,
    1555081692,
    1996064986,
    2554220882,
    2821834349,
    2952996808,
    3210313671,
    3336571891,
    3584528711,
    113926993,
    338241895,
    666307205,
    773529912,
    1294757372,
    1396182291,
    1695183700,
    1986661051,
    2177026350,
    2456956037,
    2730485921,
    2820302411,
    3259730800,
    3345764771,
    3516065817,
    3600352804,
    4094571909,
    275423344,
    430227734,
    506948616,
    659060556,
    883997877,
    958139571,
    1322822218,
    1537002063,
    1747873779,
    1955562222,
    2024104815,
    2227730452,
    2361852424,
    2428436474,
    2756734187,
    3204031479,
    3329325298
  ];
  var blocks = [];
  var Sha256 = class {
    #block;
    #blocks;
    #bytes;
    #finalized;
    #first;
    #h0;
    #h1;
    #h2;
    #h3;
    #h4;
    #h5;
    #h6;
    #h7;
    #hashed;
    #hBytes;
    #is224;
    #lastByteIndex = 0;
    #start;
    constructor(is224 = false, sharedMemory = false) {
      this.init(is224, sharedMemory);
    }
    init(is224, sharedMemory) {
      if (sharedMemory) {
        blocks[0] = blocks[16] = blocks[1] = blocks[2] = blocks[3] = blocks[4] = blocks[5] = blocks[6] = blocks[7] = blocks[8] = blocks[9] = blocks[10] = blocks[11] = blocks[12] = blocks[13] = blocks[14] = blocks[15] = 0;
        this.#blocks = blocks;
      } else {
        this.#blocks = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      }
      if (is224) {
        this.#h0 = 3238371032;
        this.#h1 = 914150663;
        this.#h2 = 812702999;
        this.#h3 = 4144912697;
        this.#h4 = 4290775857;
        this.#h5 = 1750603025;
        this.#h6 = 1694076839;
        this.#h7 = 3204075428;
      } else {
        this.#h0 = 1779033703;
        this.#h1 = 3144134277;
        this.#h2 = 1013904242;
        this.#h3 = 2773480762;
        this.#h4 = 1359893119;
        this.#h5 = 2600822924;
        this.#h6 = 528734635;
        this.#h7 = 1541459225;
      }
      this.#block = this.#start = this.#bytes = this.#hBytes = 0;
      this.#finalized = this.#hashed = false;
      this.#first = true;
      this.#is224 = is224;
    }
    update(message) {
      if (this.#finalized) {
        return this;
      }
      let msg;
      if (message instanceof ArrayBuffer) {
        msg = new Uint8Array(message);
      } else {
        msg = message;
      }
      let index = 0;
      const length = msg.length;
      const blocks2 = this.#blocks;
      while (index < length) {
        let i;
        if (this.#hashed) {
          this.#hashed = false;
          blocks2[0] = this.#block;
          blocks2[16] = blocks2[1] = blocks2[2] = blocks2[3] = blocks2[4] = blocks2[5] = blocks2[6] = blocks2[7] = blocks2[8] = blocks2[9] = blocks2[10] = blocks2[11] = blocks2[12] = blocks2[13] = blocks2[14] = blocks2[15] = 0;
        }
        if (typeof msg !== "string") {
          for (i = this.#start; index < length && i < 64; ++index) {
            blocks2[i >> 2] |= msg[index] << SHIFT[i++ & 3];
          }
        } else {
          for (i = this.#start; index < length && i < 64; ++index) {
            let code = msg.charCodeAt(index);
            if (code < 128) {
              blocks2[i >> 2] |= code << SHIFT[i++ & 3];
            } else if (code < 2048) {
              blocks2[i >> 2] |= (192 | code >> 6) << SHIFT[i++ & 3];
              blocks2[i >> 2] |= (128 | code & 63) << SHIFT[i++ & 3];
            } else if (code < 55296 || code >= 57344) {
              blocks2[i >> 2] |= (224 | code >> 12) << SHIFT[i++ & 3];
              blocks2[i >> 2] |= (128 | code >> 6 & 63) << SHIFT[i++ & 3];
              blocks2[i >> 2] |= (128 | code & 63) << SHIFT[i++ & 3];
            } else {
              code = 65536 + ((code & 1023) << 10 | msg.charCodeAt(++index) & 1023);
              blocks2[i >> 2] |= (240 | code >> 18) << SHIFT[i++ & 3];
              blocks2[i >> 2] |= (128 | code >> 12 & 63) << SHIFT[i++ & 3];
              blocks2[i >> 2] |= (128 | code >> 6 & 63) << SHIFT[i++ & 3];
              blocks2[i >> 2] |= (128 | code & 63) << SHIFT[i++ & 3];
            }
          }
        }
        this.#lastByteIndex = i;
        this.#bytes += i - this.#start;
        if (i >= 64) {
          this.#block = blocks2[16];
          this.#start = i - 64;
          this.hash();
          this.#hashed = true;
        } else {
          this.#start = i;
        }
      }
      if (this.#bytes > 4294967295) {
        this.#hBytes += this.#bytes / 4294967296 << 0;
        this.#bytes = this.#bytes % 4294967296;
      }
      return this;
    }
    finalize() {
      if (this.#finalized) {
        return;
      }
      this.#finalized = true;
      const blocks2 = this.#blocks;
      const i = this.#lastByteIndex;
      blocks2[16] = this.#block;
      blocks2[i >> 2] |= EXTRA[i & 3];
      this.#block = blocks2[16];
      if (i >= 56) {
        if (!this.#hashed) {
          this.hash();
        }
        blocks2[0] = this.#block;
        blocks2[16] = blocks2[1] = blocks2[2] = blocks2[3] = blocks2[4] = blocks2[5] = blocks2[6] = blocks2[7] = blocks2[8] = blocks2[9] = blocks2[10] = blocks2[11] = blocks2[12] = blocks2[13] = blocks2[14] = blocks2[15] = 0;
      }
      blocks2[14] = this.#hBytes << 3 | this.#bytes >>> 29;
      blocks2[15] = this.#bytes << 3;
      this.hash();
    }
    hash() {
      let a2 = this.#h0;
      let b3 = this.#h1;
      let c3 = this.#h2;
      let d3 = this.#h3;
      let e = this.#h4;
      let f3 = this.#h5;
      let g3 = this.#h6;
      let h2 = this.#h7;
      const blocks2 = this.#blocks;
      let s0;
      let s1;
      let maj;
      let t1;
      let t2;
      let ch;
      let ab;
      let da;
      let cd;
      let bc;
      for (let j3 = 16; j3 < 64; ++j3) {
        t1 = blocks2[j3 - 15];
        s0 = (t1 >>> 7 | t1 << 25) ^ (t1 >>> 18 | t1 << 14) ^ t1 >>> 3;
        t1 = blocks2[j3 - 2];
        s1 = (t1 >>> 17 | t1 << 15) ^ (t1 >>> 19 | t1 << 13) ^ t1 >>> 10;
        blocks2[j3] = blocks2[j3 - 16] + s0 + blocks2[j3 - 7] + s1 << 0;
      }
      bc = b3 & c3;
      for (let j3 = 0; j3 < 64; j3 += 4) {
        if (this.#first) {
          if (this.#is224) {
            ab = 300032;
            t1 = blocks2[0] - 1413257819;
            h2 = t1 - 150054599 << 0;
            d3 = t1 + 24177077 << 0;
          } else {
            ab = 704751109;
            t1 = blocks2[0] - 210244248;
            h2 = t1 - 1521486534 << 0;
            d3 = t1 + 143694565 << 0;
          }
          this.#first = false;
        } else {
          s0 = (a2 >>> 2 | a2 << 30) ^ (a2 >>> 13 | a2 << 19) ^ (a2 >>> 22 | a2 << 10);
          s1 = (e >>> 6 | e << 26) ^ (e >>> 11 | e << 21) ^ (e >>> 25 | e << 7);
          ab = a2 & b3;
          maj = ab ^ a2 & c3 ^ bc;
          ch = e & f3 ^ ~e & g3;
          t1 = h2 + s1 + ch + K[j3] + blocks2[j3];
          t2 = s0 + maj;
          h2 = d3 + t1 << 0;
          d3 = t1 + t2 << 0;
        }
        s0 = (d3 >>> 2 | d3 << 30) ^ (d3 >>> 13 | d3 << 19) ^ (d3 >>> 22 | d3 << 10);
        s1 = (h2 >>> 6 | h2 << 26) ^ (h2 >>> 11 | h2 << 21) ^ (h2 >>> 25 | h2 << 7);
        da = d3 & a2;
        maj = da ^ d3 & b3 ^ ab;
        ch = h2 & e ^ ~h2 & f3;
        t1 = g3 + s1 + ch + K[j3 + 1] + blocks2[j3 + 1];
        t2 = s0 + maj;
        g3 = c3 + t1 << 0;
        c3 = t1 + t2 << 0;
        s0 = (c3 >>> 2 | c3 << 30) ^ (c3 >>> 13 | c3 << 19) ^ (c3 >>> 22 | c3 << 10);
        s1 = (g3 >>> 6 | g3 << 26) ^ (g3 >>> 11 | g3 << 21) ^ (g3 >>> 25 | g3 << 7);
        cd = c3 & d3;
        maj = cd ^ c3 & a2 ^ da;
        ch = g3 & h2 ^ ~g3 & e;
        t1 = f3 + s1 + ch + K[j3 + 2] + blocks2[j3 + 2];
        t2 = s0 + maj;
        f3 = b3 + t1 << 0;
        b3 = t1 + t2 << 0;
        s0 = (b3 >>> 2 | b3 << 30) ^ (b3 >>> 13 | b3 << 19) ^ (b3 >>> 22 | b3 << 10);
        s1 = (f3 >>> 6 | f3 << 26) ^ (f3 >>> 11 | f3 << 21) ^ (f3 >>> 25 | f3 << 7);
        bc = b3 & c3;
        maj = bc ^ b3 & d3 ^ cd;
        ch = f3 & g3 ^ ~f3 & h2;
        t1 = e + s1 + ch + K[j3 + 3] + blocks2[j3 + 3];
        t2 = s0 + maj;
        e = a2 + t1 << 0;
        a2 = t1 + t2 << 0;
      }
      this.#h0 = this.#h0 + a2 << 0;
      this.#h1 = this.#h1 + b3 << 0;
      this.#h2 = this.#h2 + c3 << 0;
      this.#h3 = this.#h3 + d3 << 0;
      this.#h4 = this.#h4 + e << 0;
      this.#h5 = this.#h5 + f3 << 0;
      this.#h6 = this.#h6 + g3 << 0;
      this.#h7 = this.#h7 + h2 << 0;
    }
    hex() {
      this.finalize();
      const h0 = this.#h0;
      const h1 = this.#h1;
      const h2 = this.#h2;
      const h3 = this.#h3;
      const h4 = this.#h4;
      const h5 = this.#h5;
      const h6 = this.#h6;
      const h7 = this.#h7;
      let hex = HEX_CHARS[h0 >> 28 & 15] + HEX_CHARS[h0 >> 24 & 15] + HEX_CHARS[h0 >> 20 & 15] + HEX_CHARS[h0 >> 16 & 15] + HEX_CHARS[h0 >> 12 & 15] + HEX_CHARS[h0 >> 8 & 15] + HEX_CHARS[h0 >> 4 & 15] + HEX_CHARS[h0 & 15] + HEX_CHARS[h1 >> 28 & 15] + HEX_CHARS[h1 >> 24 & 15] + HEX_CHARS[h1 >> 20 & 15] + HEX_CHARS[h1 >> 16 & 15] + HEX_CHARS[h1 >> 12 & 15] + HEX_CHARS[h1 >> 8 & 15] + HEX_CHARS[h1 >> 4 & 15] + HEX_CHARS[h1 & 15] + HEX_CHARS[h2 >> 28 & 15] + HEX_CHARS[h2 >> 24 & 15] + HEX_CHARS[h2 >> 20 & 15] + HEX_CHARS[h2 >> 16 & 15] + HEX_CHARS[h2 >> 12 & 15] + HEX_CHARS[h2 >> 8 & 15] + HEX_CHARS[h2 >> 4 & 15] + HEX_CHARS[h2 & 15] + HEX_CHARS[h3 >> 28 & 15] + HEX_CHARS[h3 >> 24 & 15] + HEX_CHARS[h3 >> 20 & 15] + HEX_CHARS[h3 >> 16 & 15] + HEX_CHARS[h3 >> 12 & 15] + HEX_CHARS[h3 >> 8 & 15] + HEX_CHARS[h3 >> 4 & 15] + HEX_CHARS[h3 & 15] + HEX_CHARS[h4 >> 28 & 15] + HEX_CHARS[h4 >> 24 & 15] + HEX_CHARS[h4 >> 20 & 15] + HEX_CHARS[h4 >> 16 & 15] + HEX_CHARS[h4 >> 12 & 15] + HEX_CHARS[h4 >> 8 & 15] + HEX_CHARS[h4 >> 4 & 15] + HEX_CHARS[h4 & 15] + HEX_CHARS[h5 >> 28 & 15] + HEX_CHARS[h5 >> 24 & 15] + HEX_CHARS[h5 >> 20 & 15] + HEX_CHARS[h5 >> 16 & 15] + HEX_CHARS[h5 >> 12 & 15] + HEX_CHARS[h5 >> 8 & 15] + HEX_CHARS[h5 >> 4 & 15] + HEX_CHARS[h5 & 15] + HEX_CHARS[h6 >> 28 & 15] + HEX_CHARS[h6 >> 24 & 15] + HEX_CHARS[h6 >> 20 & 15] + HEX_CHARS[h6 >> 16 & 15] + HEX_CHARS[h6 >> 12 & 15] + HEX_CHARS[h6 >> 8 & 15] + HEX_CHARS[h6 >> 4 & 15] + HEX_CHARS[h6 & 15];
      if (!this.#is224) {
        hex += HEX_CHARS[h7 >> 28 & 15] + HEX_CHARS[h7 >> 24 & 15] + HEX_CHARS[h7 >> 20 & 15] + HEX_CHARS[h7 >> 16 & 15] + HEX_CHARS[h7 >> 12 & 15] + HEX_CHARS[h7 >> 8 & 15] + HEX_CHARS[h7 >> 4 & 15] + HEX_CHARS[h7 & 15];
      }
      return hex;
    }
    toString() {
      return this.hex();
    }
    digest() {
      this.finalize();
      const h0 = this.#h0;
      const h1 = this.#h1;
      const h2 = this.#h2;
      const h3 = this.#h3;
      const h4 = this.#h4;
      const h5 = this.#h5;
      const h6 = this.#h6;
      const h7 = this.#h7;
      const arr = [
        h0 >> 24 & 255,
        h0 >> 16 & 255,
        h0 >> 8 & 255,
        h0 & 255,
        h1 >> 24 & 255,
        h1 >> 16 & 255,
        h1 >> 8 & 255,
        h1 & 255,
        h2 >> 24 & 255,
        h2 >> 16 & 255,
        h2 >> 8 & 255,
        h2 & 255,
        h3 >> 24 & 255,
        h3 >> 16 & 255,
        h3 >> 8 & 255,
        h3 & 255,
        h4 >> 24 & 255,
        h4 >> 16 & 255,
        h4 >> 8 & 255,
        h4 & 255,
        h5 >> 24 & 255,
        h5 >> 16 & 255,
        h5 >> 8 & 255,
        h5 & 255,
        h6 >> 24 & 255,
        h6 >> 16 & 255,
        h6 >> 8 & 255,
        h6 & 255
      ];
      if (!this.#is224) {
        arr.push(
          h7 >> 24 & 255,
          h7 >> 16 & 255,
          h7 >> 8 & 255,
          h7 & 255
        );
      }
      return arr;
    }
    array() {
      return this.digest();
    }
    arrayBuffer() {
      this.finalize();
      const buffer = new ArrayBuffer(this.#is224 ? 28 : 32);
      const dataView = new DataView(buffer);
      dataView.setUint32(0, this.#h0);
      dataView.setUint32(4, this.#h1);
      dataView.setUint32(8, this.#h2);
      dataView.setUint32(12, this.#h3);
      dataView.setUint32(16, this.#h4);
      dataView.setUint32(20, this.#h5);
      dataView.setUint32(24, this.#h6);
      if (!this.#is224) {
        dataView.setUint32(28, this.#h7);
      }
      return buffer;
    }
  };
  var HmacSha256 = class extends Sha256 {
    #inner;
    #is224;
    #oKeyPad;
    #sharedMemory;
    constructor(secretKey, is224 = false, sharedMemory = false) {
      super(is224, sharedMemory);
      let key;
      if (typeof secretKey === "string") {
        const bytes = [];
        const length = secretKey.length;
        let index = 0;
        for (let i = 0; i < length; ++i) {
          let code = secretKey.charCodeAt(i);
          if (code < 128) {
            bytes[index++] = code;
          } else if (code < 2048) {
            bytes[index++] = 192 | code >> 6;
            bytes[index++] = 128 | code & 63;
          } else if (code < 55296 || code >= 57344) {
            bytes[index++] = 224 | code >> 12;
            bytes[index++] = 128 | code >> 6 & 63;
            bytes[index++] = 128 | code & 63;
          } else {
            code = 65536 + ((code & 1023) << 10 | secretKey.charCodeAt(++i) & 1023);
            bytes[index++] = 240 | code >> 18;
            bytes[index++] = 128 | code >> 12 & 63;
            bytes[index++] = 128 | code >> 6 & 63;
            bytes[index++] = 128 | code & 63;
          }
        }
        key = bytes;
      } else {
        if (secretKey instanceof ArrayBuffer) {
          key = new Uint8Array(secretKey);
        } else {
          key = secretKey;
        }
      }
      if (key.length > 64) {
        key = new Sha256(is224, true).update(key).array();
      }
      const oKeyPad = [];
      const iKeyPad = [];
      for (let i = 0; i < 64; ++i) {
        const b3 = key[i] || 0;
        oKeyPad[i] = 92 ^ b3;
        iKeyPad[i] = 54 ^ b3;
      }
      this.update(iKeyPad);
      this.#oKeyPad = oKeyPad;
      this.#inner = true;
      this.#is224 = is224;
      this.#sharedMemory = sharedMemory;
    }
    finalize() {
      super.finalize();
      if (this.#inner) {
        this.#inner = false;
        const innerHash = this.array();
        super.init(this.#is224, this.#sharedMemory);
        this.update(this.#oKeyPad);
        this.update(innerHash);
        super.finalize();
      }
    }
  };

  // web:https://deno.land/x/aws_api@v0.6.0/client/signing.ts
  function sha256(data) {
    const hasher = new Sha256();
    hasher.update(data);
    return hasher;
  }
  function hmacSha256(key, message) {
    const hasher = new HmacSha256(key);
    hasher.update(message);
    return hasher;
  }
  var ANY_BUT_DIGITS = /[^\d]/g;
  var ANY_BUT_DIGITS_T = /[^\dT]/g;
  var toAmz = (date) => {
    return `${date.toISOString().slice(0, 19).replace(ANY_BUT_DIGITS_T, "")}Z`;
  };
  var toDateStamp = (date) => {
    return date.toISOString().slice(0, 10).replace(ANY_BUT_DIGITS, "");
  };
  var encoder = new TextEncoder();
  var AWS4 = encoder.encode("AWS4");
  var getSignatureKey = (key, dateStamp, region, service) => {
    if (typeof key === "string") {
      key = encoder.encode(key);
    }
    const paddedKey = new Uint8Array(4 + key.byteLength);
    paddedKey.set(AWS4, 0);
    paddedKey.set(key, 4);
    let mac = hmacSha256(paddedKey, dateStamp).array();
    mac = hmacSha256(mac, region).array();
    mac = hmacSha256(mac, service).array();
    mac = hmacSha256(mac, "aws4_request").array();
    return mac;
  };
  var AWSSignerV4 = class {
    constructor(region, credentials) {
      this.region = region;
      this.credentials = credentials;
    }
    async sign(service, request) {
      const date = new Date();
      const amzdate = toAmz(date);
      const datestamp = toDateStamp(date);
      const { host, pathname, searchParams } = new URL(request.url);
      searchParams.sort();
      const canonicalQuerystring = searchParams.toString();
      const headers = new Headers(request.headers);
      headers.set("x-amz-date", amzdate);
      if (this.credentials.sessionToken) {
        headers.set("x-amz-security-token", this.credentials.sessionToken);
      }
      headers.set("host", host);
      let canonicalHeaders = "";
      let signedHeaders = "";
      for (const key of [...headers.keys()].sort()) {
        if (unsignableHeaders.has(key.toLowerCase()))
          continue;
        canonicalHeaders += `${key.toLowerCase()}:${headers.get(key)}
`;
        signedHeaders += `${key.toLowerCase()};`;
      }
      signedHeaders = signedHeaders.substring(0, signedHeaders.length - 1);
      const body = request.body ? new Uint8Array(await request.arrayBuffer()) : null;
      const payloadHash = sha256(body ?? new Uint8Array()).hex();
      if (service === "s3") {
        headers.set("x-amz-content-sha256", payloadHash);
      }
      const canonicalRequest = `${request.method}
${pathname}
${canonicalQuerystring}
${canonicalHeaders}
${signedHeaders}
${payloadHash}`;
      const canonicalRequestDigest = sha256(canonicalRequest).hex();
      const algorithm = "AWS4-HMAC-SHA256";
      const credentialScope = `${datestamp}/${this.region}/${service}/aws4_request`;
      const stringToSign = `${algorithm}
${amzdate}
${credentialScope}
${canonicalRequestDigest}`;
      const signingKey = getSignatureKey(
        this.credentials.awsSecretKey,
        datestamp,
        this.region,
        service
      );
      const signature = hmacSha256(signingKey, stringToSign).hex();
      const authHeader = `${algorithm} Credential=${this.credentials.awsAccessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
      headers.set("Authorization", authHeader);
      return new Request(
        request.url,
        {
          headers,
          method: request.method,
          body,
          redirect: request.redirect,
          signal: request.signal
        }
      );
    }
  };
  var unsignableHeaders = /* @__PURE__ */ new Set([
    "authorization",
    "content-type",
    "content-length",
    "user-agent",
    "presigned-expires",
    "expect",
    "x-amzn-trace-id"
  ]);

  // web:https://deno.land/x/aws_api@v0.6.0/encoding/xml.ts
  function readXmlResult(text, resultWrapper) {
    const doc = parseXml(text);
    if (!doc.root) {
      console.log("Non-XML text:", text);
      throw new Error(`Response lacking XML root`);
    }
    if (resultWrapper) {
      const result = doc.root.first(resultWrapper);
      if (!result)
        throw new Error(`Result Wrapper ${JSON.stringify(resultWrapper)} is missing. Present keys: ${doc.root.children.map((x2) => x2.name).join(", ")}`);
      return result;
    }
    return doc.root;
  }
  var XmlNode = class {
    constructor(name) {
      this.attributes = {};
      this.children = [];
      this.name = name;
    }
    first(name, required = false, accessor) {
      const node = this.children.find((x2) => x2.name === name);
      if (!node && required) {
        this.throwMissingKeys([name]);
      } else if (accessor) {
        if (node) {
          const value = accessor(node);
          if (value != void 0)
            return value;
        }
        if (required)
          this.throwMissingKeys([name]);
      } else {
        return node;
      }
    }
    getList(...names) {
      let listParent = this;
      while (names.length > 1) {
        listParent = listParent?.first(names.shift() ?? "");
      }
      return listParent?.children.filter((x2) => x2.name === names[0]) ?? [];
    }
    strings(opts) {
      const required = Object.keys(opts.required ?? {});
      const optional = Object.keys(opts.optional ?? {});
      const obj = /* @__PURE__ */ Object.create(null);
      const missing = new Set(required);
      const strings = new Set(new Array().concat(required, optional));
      for (const child of this.children) {
        if (strings.has(child.name)) {
          obj[child.name] = child.content ?? "";
          missing.delete(child.name);
        }
      }
      if (missing.size > 0)
        this.throwMissingKeys(missing);
      return obj;
    }
    throwMissingKeys(missingKeys) {
      throw new Error(`BUG: XmlNode ${JSON.stringify(this.name)} missing required keys ${JSON.stringify(Array.from(missingKeys))} - had keys ${JSON.stringify(Array.from(new Set(this.children.map((x2) => x2.name))))}`);
    }
  };
  function parseXml(xml, inline = false) {
    xml = xml.trim();
    xml = xml.replace(/<!--[\s\S]*?-->/g, "");
    return {
      declaration: declaration(),
      root: tag()
    };
    function declaration() {
      var m3 = match(/^<\?xml\s*/);
      if (!m3)
        return null;
      var node = {
        attributes: {}
      };
      while (!(eos() || is("?>"))) {
        var attr = attribute();
        if (!attr)
          return node;
        node.attributes[attr.name] = attr.value;
      }
      match(/\?>\s*/);
      return node;
    }
    function tag() {
      var m3 = match(/^<([\w-:.]+)\s*/);
      if (!m3)
        return null;
      var node = new XmlNode(m3[1]);
      while (!(eos() || is(">") || is("?>") || is("/>"))) {
        var attr = attribute();
        if (!attr)
          return node;
        node.attributes[attr.name] = attr.value;
      }
      if (inline) {
        if (match(/^\s*\/>/)) {
          return node;
        }
        match(/\??>/);
        const first = content();
        if (first) {
          const textNode = new XmlNode("");
          textNode.content = first;
          node.children.push(textNode);
        }
        let any;
        do {
          any = false;
          const text = content();
          if (text) {
            const textNode = new XmlNode("");
            textNode.content = text;
            node.children.push(textNode);
            any = true;
          }
          var child;
          while (child = tag()) {
            node.children.push(child);
            any = true;
          }
        } while (any);
        match(/^<\/[\w-:.]+>/);
      } else {
        if (match(/^\s*\/>\s*/)) {
          return node;
        }
        match(/\??>\s*/);
        node.content = content();
        var child;
        while (child = tag()) {
          node.children.push(child);
        }
        match(/^<\/[\w-:.]+>\s*/);
      }
      return node;
    }
    function content() {
      var m3 = match(/^([^<]*)/);
      if (m3)
        return decodeXmlEntities(m3[1]);
      return "";
    }
    function attribute() {
      var m3 = match(/([\w:-]+)\s*=\s*("[^"]*"|'[^']*'|\w+)\s*/);
      if (!m3)
        return;
      return { name: m3[1], value: strip(m3[2]) };
    }
    function strip(val) {
      return val.replace(/^['"]|['"]$/g, "");
    }
    function match(re3) {
      var m3 = xml.match(re3);
      if (!m3)
        return;
      xml = xml.slice(m3[0].length);
      return m3;
    }
    function eos() {
      return 0 == xml.length;
    }
    function is(prefix) {
      return xml.startsWith(prefix);
    }
  }
  var ALPHA_INDEX = {
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&apos;": "'",
    "&amp;": "&"
  };
  var CHAR_S_INDEX = {
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
    "&": "&amp;"
  };
  function encodeXmlEntities(str) {
    return str.replace(/<|>|"|'|&/g, function(s2) {
      return CHAR_S_INDEX[s2];
    });
  }
  function decodeXmlEntities(str) {
    return str.replace(/&#?[0-9a-zA-Z]+;?/g, function(s2) {
      if (s2.charAt(1) === "#") {
        const code = s2.charAt(2).toLowerCase() === "x" ? parseInt(s2.substr(3), 16) : parseInt(s2.substr(2));
        if (isNaN(code) || code < -32768 || code > 65535) {
          return "";
        }
        return String.fromCharCode(code);
      }
      return ALPHA_INDEX[s2] || s2;
    });
  }
  function stringify(root) {
    const attrs = root.attributes ? Object.entries(root.attributes).filter((x2) => x2[1] !== void 0).map((x2) => ` ${x2[0]}="${encodeXmlEntities(x2[1])}"`).join("") : "";
    if (root.children && !root.content) {
      const contents = root.children.map((x2) => stringify(x2)).filter((x2) => x2);
      if (contents.length < 1) {
        return `<${root.name}${attrs} />`;
      }
      return `<${root.name}${attrs}>${contents.join("")}</${root.name}>`;
    } else {
      const contents = root.content !== void 0 ? [encodeXmlEntities(root.content ?? "")] : [];
      if (contents.length < 1) {
        if (!attrs)
          return "";
        return `<${root.name}${attrs} />`;
      }
      return `<${root.name}${attrs}>${contents.join("")}</${root.name}>`;
    }
  }

  // web:https://deno.land/x/aws_api@v0.6.0/client/client.ts
  var BaseApiFactory = class {
    #credentials;
    #endpointResolver;
    #region;
    #extras;
    constructor(opts) {
      if (opts.credentials != null) {
        const { credentials } = opts;
        this.#credentials = { getCredentials: () => Promise.resolve(credentials) };
      } else if (opts.credentialProvider != null) {
        this.#credentials = opts.credentialProvider;
      } else
        throw new Error(
          `No credentials or credential source provided -- you must provide one to use this class directly`
        );
      try {
        this.#region = opts.region ?? Deno.env.get("AWS_REGION");
      } catch (err) {
        if (err.name !== "PermissionDenied")
          throw err;
      }
      this.#endpointResolver = opts.endpointResolver;
      this.#extras = opts.extras ?? {};
    }
    makeNew(apiConstructor) {
      return new apiConstructor(this);
    }
    buildServiceClient(apiMetadata, extras) {
      if (apiMetadata.signatureVersion === "v2")
        throw new Error(
          `TODO: signature version ${apiMetadata.signatureVersion}`
        );
      const signingFetcher = async (baseRequest, opts) => {
        if (this.#region === void 0 && !opts.region) {
          this.#region = await this.#credentials.getCredentials().then((x2) => x2.region, () => null);
        }
        const { url, signingRegion } = this.#endpointResolver.resolveUrl({
          apiMetadata,
          region: opts.region ?? this.#region ?? throwMissingRegion(),
          requestPath: opts.urlPath,
          hostPrefix: opts.hostPrefix
        });
        let request = new Request(url.toString(), baseRequest);
        if (extras?.mutateRequest) {
          request = await extras.mutateRequest(request);
        }
        if (this.#extras.mutateRequest) {
          request = await this.#extras.mutateRequest(request);
        }
        if (!opts.skipSigning) {
          const credentials = await this.#credentials.getCredentials();
          const signer = new AWSSignerV4(signingRegion, credentials);
          const signingName = apiMetadata.signingName ?? apiMetadata.endpointPrefix;
          request = await signer.sign(signingName, request);
        }
        const response = await fetch(request);
        if (extras?.afterFetch) {
          await extras.afterFetch(response, request);
        }
        if (this.#extras.afterFetch) {
          await this.#extras.afterFetch(response, request);
        }
        return response;
      };
      return wrapServiceClient(apiMetadata, signingFetcher);
    }
    async ensureCredentialsAvailable() {
      const creds = await this.#credentials.getCredentials();
      if (creds.awsAccessKeyId)
        return;
      throw new Error(`Empty credentials were returned successfully (somehow?)`);
    }
    async determineCurrentRegion() {
      if (this.#region != null)
        return this.#region;
      const credentials = await this.#credentials.getCredentials();
      return credentials.region ?? throwMissingRegion();
    }
  };
  function throwMissingRegion() {
    throw new Error(`No region provided, try setting AWS_REGION or passing a region when constructing your client`);
  }
  function wrapServiceClient(apiMetadata, signingFetcher) {
    switch (apiMetadata.protocol) {
      case "query":
      case "ec2":
        return new QueryServiceClient(apiMetadata.apiVersion, signingFetcher);
      case "json":
        return new JsonServiceClient(apiMetadata.targetPrefix ?? "TODO", apiMetadata.jsonVersion ?? "1.0", signingFetcher);
      case "rest-json":
        return new RestJsonServiceClient(signingFetcher);
      case "rest-xml":
        return new XmlServiceClient(signingFetcher);
      default:
        throw new Error(`TODO: protocol ${apiMetadata.protocol}`);
    }
  }
  var BaseServiceClient = class {
    constructor(signedFetcher, protocol) {
      this.signedFetcher = signedFetcher;
      this.protocol = protocol;
    }
    async performRequest(config) {
      const headers = config.headers;
      const serviceUrl = config.requestUri ?? "/";
      const method = config.method ?? "POST";
      if (config.body) {
        headers.append("content-length", config.body.length.toString());
      }
      let query = "";
      const queryS = config.query?.toString();
      if (queryS) {
        query = (serviceUrl.includes("?") ? "&" : "?") + queryS;
      }
      const request = new Request("https://example.com/", {
        method,
        headers,
        body: config.body,
        redirect: "manual",
        signal: config.opts?.signal
      });
      const response = await this.signedFetcher(request, {
        urlPath: serviceUrl + query,
        region: config.region,
        skipSigning: config.authType == "anonymous" || config.skipSigning,
        hostPrefix: config.hostPrefix
      });
      if (response.status == (config.responseCode ?? 200)) {
        return response;
      } else if (response.status >= 400) {
        await handleErrorResponse(response, request.method, this.protocol);
      } else if (response.status >= 200 && response.status < 300) {
        console.log(`WARN: ${config.action} response was unexpected success ${response.status}`);
        return response;
      }
      throw new Error(`BUG: Unexpected HTTP response status ${response.status}`);
    }
  };
  var XmlServiceClient = class extends BaseServiceClient {
    constructor(signedFetcher) {
      super(signedFetcher, "xml");
    }
    async performRequest(config) {
      const headers = config.headers ?? new Headers();
      headers.append("accept", "text/xml");
      let reqBody;
      if (config.body instanceof Uint8Array) {
        reqBody = config.body;
      } else if (typeof config.body === "string") {
        reqBody = new TextEncoder().encode(config.body);
        headers.append("content-type", "text/xml");
      } else if (config.body)
        throw new Error(
          `TODO: non-string body to XmlServiceClient`
        );
      return super.performRequest({
        ...config,
        headers,
        body: reqBody
      });
    }
  };
  var JsonServiceClient = class extends BaseServiceClient {
    constructor(serviceTarget, jsonVersion, signedFetcher) {
      super(signedFetcher, "json");
      this.serviceTarget = serviceTarget;
      this.jsonVersion = jsonVersion;
    }
    async performRequest(config) {
      const headers = config.headers ?? new Headers();
      headers.append("x-amz-target", `${this.serviceTarget}.${config.action}`);
      headers.append("accept", "application/x-amz-json-" + this.jsonVersion);
      let reqBody;
      if (config.body instanceof Uint8Array) {
        reqBody = config.body;
      } else if (config.body) {
        reqBody = new TextEncoder().encode(JSON.stringify(config.body));
        headers.append("content-type", "application/x-amz-json-" + this.jsonVersion);
      }
      return super.performRequest({
        ...config,
        headers,
        body: reqBody
      });
    }
  };
  var RestJsonServiceClient = class extends BaseServiceClient {
    constructor(signedFetcher) {
      super(signedFetcher, "rest-json");
    }
    async performRequest(config) {
      const headers = config.headers ?? new Headers();
      headers.append("accept", "application/json");
      let reqBody;
      if (config.body instanceof Uint8Array) {
        reqBody = config.body;
      } else if (config.body) {
        reqBody = new TextEncoder().encode(JSON.stringify(config.body));
        headers.append("content-type", "application/json");
      }
      return super.performRequest({
        ...config,
        headers,
        body: reqBody
      });
    }
  };
  var QueryServiceClient = class extends BaseServiceClient {
    #serviceVersion;
    constructor(serviceVersion, signedFetcher) {
      super(signedFetcher, "query");
      this.#serviceVersion = serviceVersion;
    }
    async performRequest(config) {
      const headers = config.headers ?? new Headers();
      headers.append("accept", "text/xml");
      const method = config.method ?? "POST";
      let reqBody;
      if (config.body instanceof URLSearchParams) {
        if (method !== "POST")
          throw new Error(`query is supposed to be POSTed`);
        const params = new URLSearchParams();
        params.set("Action", config.action);
        params.set("Version", this.#serviceVersion);
        for (const [k2, v2] of config.body) {
          params.append(k2, v2);
        }
        reqBody = new TextEncoder().encode(params.toString());
        headers.append("content-type", "application/x-www-form-urlencoded; charset=utf-8");
      } else if (config.body)
        throw new Error(`BUG: non-query based request body passed to query client`);
      return super.performRequest({
        ...config,
        headers,
        body: reqBody
      });
    }
  };
  async function handleErrorResponse(response, reqMethod, protocol) {
    if (reqMethod === "HEAD") {
      throw new AwsServiceError(response, `Http${response.status}`, {
        Code: `Http${response.status}`,
        Message: `HTTP error status: ${response.statusText}`
      }, getRequestId(response.headers));
    }
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("json") || protocol == "rest-json" || protocol == "json") {
      const data = await response.json();
      if (data.Error?.Code) {
        throw new AwsServiceError(response, data.Error.Code, data.Error, data.RequestId);
      }
      const Code = response.headers.get("x-amzn-errortype") || data.__type || data.code || data.Code || "UnknownError";
      const Message2 = Code === "RequestEntityTooLarge" ? "Request body must be less than 1 MB" : data.message || data.Message || null;
      throw new AwsServiceError(response, Code, {
        Status: response.status,
        Code,
        Message: Message2,
        ...data
      }, getRequestId(response.headers));
    } else if (contentType?.startsWith("text/xml") || contentType?.startsWith("application/xml") || protocol == "query" || protocol == "rest-xml" || !contentType) {
      const xml = readXmlResult(await response.text());
      const requestId = xml.first("RequestId", false, (x2) => x2.content) || xml.first("RequestID", false, (x2) => x2.content) || getRequestId(response.headers);
      switch (xml.name) {
        case "ErrorResponse":
          const errNode = xml.first("Error");
          if (errNode)
            throw readXmlError(response, errNode, requestId);
          break;
        case "Response":
          const errors = xml.getList("Errors", "Error").map((errNode2) => readXmlError(response, errNode2, requestId));
          if (errors.length > 0) {
            throw errors[0];
          }
          break;
        case "Error":
          throw readXmlError(response, xml, requestId);
      }
      if (xml.name.endsWith("Exception")) {
        throw readXmlError(response, xml, requestId, xml.name);
      }
      console.log("Error DOM:", stringify(xml));
      throw new Error(`Unrecognizable XML error response of type ${contentType} / ${protocol}`);
    } else {
      console.log("Error body:", await response.text());
      throw new Error(`Not sure about error response for ${contentType} / ${protocol}`);
    }
  }
  function readXmlError(response, errNode, requestId, defaultCode = "UnknownError") {
    const data = {
      Status: response.status,
      Code: defaultCode
    };
    for (const child of errNode.children) {
      if (child.content) {
        data[child.name] = child.content;
      }
    }
    return new AwsServiceError(response, data.Code, data, requestId);
  }

  // web:https://deno.land/x/aws_api@v0.6.0/client/ini.ts
  var DEFAULT_SECTION = Symbol.for("ini default section");
  function decode(str) {
    const out = {
      [DEFAULT_SECTION]: {}
    };
    let p3 = out[DEFAULT_SECTION];
    const re3 = /^\[([^\]]*)\]$|^([^=]+)(=(.*))?$/i;
    const lines = str.split(/[\r\n]+/g);
    for (const line of lines) {
      if (!line || line.match(/^\s*[;#]/))
        continue;
      const match = line.match(re3);
      if (!match)
        continue;
      if (match[1] !== void 0) {
        let section = unsafe(match[1]);
        p3 = out[section] = out[section] || {};
        continue;
      }
      let key = unsafe(match[2]);
      let value = match[3] ? unsafe(match[4]) : "";
      p3[key] = value;
    }
    return out;
  }
  function isQuoted(val) {
    return val.charAt(0) === '"' && val.slice(-1) === '"' || val.charAt(0) === "'" && val.slice(-1) === "'";
  }
  function unsafe(val = "") {
    val = val.trim();
    if (isQuoted(val)) {
      val = val.substr(1, -1);
    } else {
      let esc = false;
      let unesc = "";
      for (let i = 0, l2 = val.length; i < l2; i++) {
        const c3 = val.charAt(i);
        if (esc) {
          if ("\\;#".indexOf(c3) !== -1) {
            unesc += c3;
          } else {
            unesc += "\\" + c3;
          }
          esc = false;
        } else if (";#".indexOf(c3) !== -1) {
          break;
        } else if (c3 === "\\") {
          esc = true;
        } else {
          unesc += c3;
        }
      }
      if (esc) {
        unesc += "\\";
      }
      return unesc.trim();
    }
    return val;
  }

  // web:https://deno.land/x/aws_api@v0.6.0/client/credentials.ts
  var CredentialsProviderChain = class {
    #chain;
    #supplier;
    constructor(chain) {
      this.#chain = chain;
    }
    async getCredentials() {
      if (this.#supplier)
        return this.#supplier.getCredentials();
      const errors = [];
      for (const providerFunc of this.#chain) {
        try {
          const provider = providerFunc();
          const creds = await provider.getCredentials();
          this.#supplier = provider;
          return creds;
        } catch (err) {
          const providerLabel = providerFunc.toString().replace(/^\(\) => new /, "");
          const srcName = `    - ${providerLabel} `;
          if (err instanceof Error) {
            errors.push(srcName + (err.stack?.split("\n")[0] || err.message));
          } else if (err) {
            errors.push(srcName + err.toString());
          }
        }
      }
      return Promise.reject(new Error([
        `Failed to load any possible AWS credentials:`,
        ...errors
      ].join("\n")));
    }
  };
  var DefaultCredentialsProvider = new CredentialsProviderChain([
    () => new EnvironmentCredentials("AWS"),
    () => new EnvironmentCredentials("AMAZON"),
    () => new SharedIniFileCredentials(),
    () => new TokenFileWebIdentityCredentials(),
    () => new EC2MetadataCredentials()
  ]);
  var SharedIniFileCredentials = class {
    #filename;
    #filedata;
    #profile;
    #promise;
    constructor({
      profile,
      filename,
      filedata
    } = {}) {
      if (filedata) {
        filename = filename || "tmp://supplied-inline";
        this.#filedata = filedata;
      }
      if (!filename) {
        filename = Deno.env.get("AWS_SHARED_CREDENTIALS_FILE");
      }
      if (!filename) {
        const HOME = Deno.env.get("HOME");
        filename = HOME + "/.aws/credentials";
      }
      this.#filename = filename;
      if (!profile) {
        profile = Deno.env.get("AWS_PROFILE");
      }
      this.#profile = profile || "default";
    }
    getCredentials() {
      if (!this.#promise)
        this.#promise = this.load();
      return this.#promise;
    }
    async load() {
      const text = this.#filedata ?? await Deno.readTextFile(this.#filename);
      const data = decode(text);
      const config = data[`profile ${this.#profile}`] ?? data[this.#profile];
      if (!config)
        throw new Error(`Profile ${this.#profile} not found in credentials file`);
      if (!config.aws_access_key_id || !config.aws_secret_access_key) {
        throw new Error(`Profile ${this.#profile} lacks static credentials`);
      }
      return {
        awsAccessKeyId: config.aws_access_key_id,
        awsSecretKey: config.aws_secret_access_key,
        sessionToken: config.aws_session_token,
        region: config.region
      };
    }
  };
  var EnvironmentCredentials = class {
    #prefix;
    #promise;
    constructor(prefix = "AWS") {
      this.#prefix = prefix;
    }
    getCredentials() {
      if (!this.#promise)
        this.#promise = this.load();
      return this.#promise;
    }
    load() {
      const AWS_ACCESS_KEY_ID = Deno.env.get(this.#prefix + "_ACCESS_KEY_ID");
      const AWS_SECRET_ACCESS_KEY = Deno.env.get(this.#prefix + "_SECRET_ACCESS_KEY");
      const AWS_SESSION_TOKEN = Deno.env.get(this.#prefix + "_SESSION_TOKEN");
      if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
        return Promise.reject(new Error(`${this.#prefix} environment variables not set`));
      }
      return Promise.resolve({
        awsAccessKeyId: AWS_ACCESS_KEY_ID,
        awsSecretKey: AWS_SECRET_ACCESS_KEY,
        sessionToken: AWS_SESSION_TOKEN
      });
    }
  };
  var TokenFileWebIdentityCredentials = class {
    #roleArn;
    #tokenPath;
    #sessionName;
    #promise = null;
    #expireAfter = null;
    constructor(opts = {}) {
      this.#roleArn = opts.roleArn || Deno.env.get("AWS_ROLE_ARN");
      this.#tokenPath = opts.tokenPath || Deno.env.get("AWS_WEB_IDENTITY_TOKEN_FILE");
      this.#sessionName = opts.sessionName || Deno.env.get("AWS_ROLE_SESSION_NAME") || "token-file-web-identity";
    }
    getCredentials() {
      if (this.#expireAfter && this.#expireAfter < new Date()) {
        this.#expireAfter = null;
        this.#promise = null;
      }
      if (!this.#promise) {
        const promise = this.load();
        this.#promise = promise.then((x2) => {
          if (x2.expiresAt && x2.expiresAt > new Date()) {
            this.#expireAfter = new Date(x2.expiresAt.valueOf() - 60 * 1e3);
          }
          return x2;
        }, (err) => {
          this.#expireAfter = new Date(Date.now() + 30 * 1e3);
          return Promise.reject(err);
        });
      }
      return this.#promise;
    }
    async load() {
      if (!this.#tokenPath)
        throw new Error(`No WebIdentityToken file path is set`);
      if (!this.#roleArn)
        throw new Error(`No Role ARN is set`);
      const client = new BaseApiFactory({
        region: "us-east-1",
        endpointResolver: new AwsEndpointResolver({
          forceRegional: false
        }),
        credentialProvider: { getCredentials: () => Promise.reject(new Error(
          `No credentials necesary to AssumeRoleWithWebIdentity`
        )) }
      }).buildServiceClient(StsApiMetadata);
      const resp = await assumeRoleWithWebIdentity(client, {
        RoleArn: this.#roleArn,
        RoleSessionName: this.#sessionName,
        WebIdentityToken: await Deno.readTextFile(this.#tokenPath)
      });
      return Promise.resolve({
        awsAccessKeyId: resp.AccessKeyId,
        awsSecretKey: resp.SecretAccessKey,
        sessionToken: resp.SessionToken,
        expiresAt: resp.Expiration
      });
    }
  };
  var EC2MetadataCredentials = class {
    #service;
    #promise = null;
    #expireAfter = null;
    constructor(opts = {}) {
      this.#service = opts.client ?? new IMDSv2();
    }
    getCredentials() {
      if (this.#expireAfter && this.#expireAfter < new Date()) {
        this.#expireAfter = null;
        this.#promise = null;
      }
      if (!this.#promise) {
        const promise = this.load();
        this.#promise = promise.then((x2) => {
          if (x2.expiresAt && x2.expiresAt > new Date()) {
            this.#expireAfter = new Date(x2.expiresAt.valueOf() - 60 * 1e3);
          }
          return x2;
        }, (err) => {
          this.#expireAfter = new Date(Date.now() + 30 * 1e3);
          return Promise.reject(err);
        });
      }
      return this.#promise;
    }
    async load() {
      const roleListReq = this.#service.performRequest("GET", "meta-data/iam/security-credentials/").then((x2) => x2 ? x2.split("\n") : []).catch((err) => {
        if ("status" in err && err.status === 404)
          throw new Error(
            `This EC2 Instance doesn't have an IAM instance role attached`
          );
        throw err;
      });
      const roleList = await roleListReq;
      if (roleList.length !== 1 || !roleList[0])
        throw new Error(
          `Unexpected EC2 instance role list: ${JSON.stringify(roleList)}`
        );
      const credential = JSON.parse(await this.#service.performRequest("GET", "meta-data/iam/security-credentials/" + roleList[0]));
      if (credential.Code !== "Success")
        throw new Error(
          `Unexpected EC2 instance credential code: ${credential.Code}`
        );
      if (credential.Type !== "AWS-HMAC")
        throw new Error(
          `Unexpected EC2 instance credential type: ${credential.Type}`
        );
      return Promise.resolve({
        awsAccessKeyId: credential.AccessKeyId,
        awsSecretKey: credential.SecretAccessKey,
        sessionToken: credential.Token,
        expiresAt: new Date(credential.Expiration),
        region: await this.#service.performRequest("GET", "meta-data/placement/region")
      });
    }
  };
  var StsApiMetadata = {
    apiVersion: "2011-06-15",
    endpointPrefix: "sts",
    globalEndpoint: "sts.amazonaws.com",
    protocol: "query",
    serviceAbbreviation: "AWS STS",
    serviceFullName: "AWS Security Token Service",
    serviceId: "STS",
    signatureVersion: "v4",
    uid: "sts-2011-06-15",
    xmlNamespace: "https://sts.amazonaws.com/doc/2011-06-15/"
  };
  async function assumeRoleWithWebIdentity(sts, params) {
    const body = new URLSearchParams([
      ["RoleArn", params["RoleArn"] ?? ""],
      ["RoleSessionName", params["RoleSessionName"] ?? ""],
      ["WebIdentityToken", params["WebIdentityToken"] ?? ""]
    ]);
    const resp = await sts.performRequest({
      action: "AssumeRoleWithWebIdentity",
      authType: "anonymous",
      body
    });
    const xml = readXmlResult(await resp.text(), "AssumeRoleWithWebIdentityResult");
    return xml.first("Credentials", true, parseAssumedCredentials);
  }
  function parseAssumedCredentials(node) {
    return {
      ...node.strings({
        required: { "AccessKeyId": true, "SecretAccessKey": true, "SessionToken": true }
      }),
      Expiration: node.first("Expiration", true, (x2) => parseXmlTimestamp(x2.content))
    };
  }
  function parseXmlTimestamp(str) {
    if (str?.includes("T"))
      return new Date(str);
    if (str?.length === 10)
      return new Date(parseInt(str) * 1e3);
    throw new Error(`Timestamp from STS is unparsable: '${str}'`);
  }

  // web:https://deno.land/x/aws_api@v0.6.0/client/mod.ts
  var ApiFactory2 = class extends BaseApiFactory {
    constructor(opts = {}) {
      super({
        credentialProvider: DefaultCredentialsProvider,
        endpointResolver: typeof opts.fixedEndpoint == "string" ? new FixedBaseEndpointResolver(opts.fixedEndpoint) : new AwsEndpointResolver(),
        ...opts
      });
    }
  };

  // web:https://deno.land/x/zod@v3.17.0/external.ts
  var external_exports = {};
  __export(external_exports, {
    DIRTY: () => DIRTY,
    EMPTY_PATH: () => EMPTY_PATH,
    INVALID: () => INVALID,
    OK: () => OK,
    ParseStatus: () => ParseStatus,
    Schema: () => ZodType,
    ZodAny: () => ZodAny,
    ZodArray: () => ZodArray,
    ZodBigInt: () => ZodBigInt,
    ZodBoolean: () => ZodBoolean,
    ZodDate: () => ZodDate,
    ZodDefault: () => ZodDefault,
    ZodDiscriminatedUnion: () => ZodDiscriminatedUnion,
    ZodEffects: () => ZodEffects,
    ZodEnum: () => ZodEnum,
    ZodError: () => ZodError,
    ZodFirstPartyTypeKind: () => ZodFirstPartyTypeKind,
    ZodFunction: () => ZodFunction,
    ZodIntersection: () => ZodIntersection,
    ZodIssueCode: () => ZodIssueCode,
    ZodLazy: () => ZodLazy,
    ZodLiteral: () => ZodLiteral,
    ZodMap: () => ZodMap,
    ZodNaN: () => ZodNaN,
    ZodNativeEnum: () => ZodNativeEnum,
    ZodNever: () => ZodNever,
    ZodNull: () => ZodNull,
    ZodNullable: () => ZodNullable,
    ZodNumber: () => ZodNumber,
    ZodObject: () => ZodObject,
    ZodOptional: () => ZodOptional,
    ZodParsedType: () => ZodParsedType,
    ZodPromise: () => ZodPromise,
    ZodRecord: () => ZodRecord,
    ZodSchema: () => ZodType,
    ZodSet: () => ZodSet,
    ZodString: () => ZodString,
    ZodTransformer: () => ZodEffects,
    ZodTuple: () => ZodTuple,
    ZodType: () => ZodType,
    ZodUndefined: () => ZodUndefined,
    ZodUnion: () => ZodUnion,
    ZodUnknown: () => ZodUnknown,
    ZodVoid: () => ZodVoid,
    addIssueToContext: () => addIssueToContext,
    any: () => anyType,
    array: () => arrayType,
    bigint: () => bigIntType,
    boolean: () => booleanType,
    custom: () => custom,
    date: () => dateType,
    defaultErrorMap: () => defaultErrorMap,
    discriminatedUnion: () => discriminatedUnionType,
    effect: () => effectsType,
    enum: () => enumType,
    function: () => functionType,
    getParsedType: () => getParsedType,
    instanceof: () => instanceOfType,
    intersection: () => intersectionType,
    isAborted: () => isAborted,
    isAsync: () => isAsync,
    isDirty: () => isDirty,
    isValid: () => isValid,
    late: () => late,
    lazy: () => lazyType,
    literal: () => literalType,
    makeIssue: () => makeIssue,
    map: () => mapType,
    nan: () => nanType,
    nativeEnum: () => nativeEnumType,
    never: () => neverType,
    null: () => nullType,
    nullable: () => nullableType,
    number: () => numberType,
    object: () => objectType,
    objectUtil: () => objectUtil,
    oboolean: () => oboolean,
    onumber: () => onumber,
    optional: () => optionalType,
    ostring: () => ostring,
    overrideErrorMap: () => overrideErrorMap,
    preprocess: () => preprocessType,
    promise: () => promiseType,
    quotelessJson: () => quotelessJson,
    record: () => recordType,
    set: () => setType,
    setErrorMap: () => setErrorMap,
    strictObject: () => strictObjectType,
    string: () => stringType,
    transformer: () => effectsType,
    tuple: () => tupleType,
    undefined: () => undefinedType,
    union: () => unionType,
    unknown: () => unknownType,
    void: () => voidType
  });

  // web:https://deno.land/x/zod@v3.17.0/helpers/util.ts
  var util;
  ((util2) => {
    function assertNever(_x) {
      throw new Error();
    }
    util2.assertNever = assertNever;
    util2.arrayToEnum = (items) => {
      const obj = {};
      for (const item of items) {
        obj[item] = item;
      }
      return obj;
    };
    util2.getValidEnumValues = (obj) => {
      const validKeys = util2.objectKeys(obj).filter(
        (k2) => typeof obj[obj[k2]] !== "number"
      );
      const filtered = {};
      for (const k2 of validKeys) {
        filtered[k2] = obj[k2];
      }
      return util2.objectValues(filtered);
    };
    util2.objectValues = (obj) => {
      return util2.objectKeys(obj).map(function(e) {
        return obj[e];
      });
    };
    util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
      const keys = [];
      for (const key in object) {
        if (Object.prototype.hasOwnProperty.call(object, key)) {
          keys.push(key);
        }
      }
      return keys;
    };
    util2.find = (arr, checker) => {
      for (const item of arr) {
        if (checker(item))
          return item;
      }
      return void 0;
    };
    util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && isFinite(val) && Math.floor(val) === val;
    function joinValues(array, separator = " | ") {
      return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
    }
    util2.joinValues = joinValues;
  })(util || (util = {}));

  // web:https://deno.land/x/zod@v3.17.0/ZodError.ts
  var ZodIssueCode = util.arrayToEnum([
    "invalid_type",
    "invalid_literal",
    "custom",
    "invalid_union",
    "invalid_union_discriminator",
    "invalid_enum_value",
    "unrecognized_keys",
    "invalid_arguments",
    "invalid_return_type",
    "invalid_date",
    "invalid_string",
    "too_small",
    "too_big",
    "invalid_intersection_types",
    "not_multiple_of"
  ]);
  var quotelessJson = (obj) => {
    const json = JSON.stringify(obj, null, 2);
    return json.replace(/"([^"]+)":/g, "$1:");
  };
  var _ZodError = class extends Error {
    constructor(issues) {
      super();
      this.issues = [];
      this.addIssue = (sub) => {
        this.issues = [...this.issues, sub];
      };
      this.addIssues = (subs = []) => {
        this.issues = [...this.issues, ...subs];
      };
      const actualProto = new.target.prototype;
      if (Object.setPrototypeOf) {
        Object.setPrototypeOf(this, actualProto);
      } else {
        this.__proto__ = actualProto;
      }
      this.name = "ZodError";
      this.issues = issues;
    }
    get errors() {
      return this.issues;
    }
    format(_mapper) {
      const mapper = _mapper || function(issue) {
        return issue.message;
      };
      const fieldErrors = { _errors: [] };
      const processError = (error) => {
        for (const issue of error.issues) {
          if (issue.code === "invalid_union") {
            issue.unionErrors.map(processError);
          } else if (issue.code === "invalid_return_type") {
            processError(issue.returnTypeError);
          } else if (issue.code === "invalid_arguments") {
            processError(issue.argumentsError);
          } else if (issue.path.length === 0) {
            fieldErrors._errors.push(mapper(issue));
          } else {
            let curr = fieldErrors;
            let i = 0;
            while (i < issue.path.length) {
              const el = issue.path[i];
              const terminal = i === issue.path.length - 1;
              if (!terminal) {
                curr[el] = curr[el] || { _errors: [] };
              } else {
                curr[el] = curr[el] || { _errors: [] };
                curr[el]._errors.push(mapper(issue));
              }
              curr = curr[el];
              i++;
            }
          }
        }
      };
      processError(this);
      return fieldErrors;
    }
    toString() {
      return this.message;
    }
    get message() {
      return JSON.stringify(this.issues, null, 2);
    }
    get isEmpty() {
      return this.issues.length === 0;
    }
    flatten(mapper = (issue) => issue.message) {
      const fieldErrors = {};
      const formErrors = [];
      for (const sub of this.issues) {
        if (sub.path.length > 0) {
          fieldErrors[sub.path[0]] = fieldErrors[sub.path[0]] || [];
          fieldErrors[sub.path[0]].push(mapper(sub));
        } else {
          formErrors.push(mapper(sub));
        }
      }
      return { formErrors, fieldErrors };
    }
    get formErrors() {
      return this.flatten();
    }
  };
  var ZodError = _ZodError;
  ZodError.create = (issues) => {
    const error = new _ZodError(issues);
    return error;
  };
  var defaultErrorMap = (issue, _ctx) => {
    let message;
    switch (issue.code) {
      case ZodIssueCode.invalid_type:
        if (issue.received === ZodParsedType.undefined) {
          message = "Required";
        } else {
          message = `Expected ${issue.expected}, received ${issue.received}`;
        }
        break;
      case ZodIssueCode.invalid_literal:
        message = `Invalid literal value, expected ${JSON.stringify(
          issue.expected
        )}`;
        break;
      case ZodIssueCode.unrecognized_keys:
        message = `Unrecognized key(s) in object: ${util.joinValues(
          issue.keys,
          ", "
        )}`;
        break;
      case ZodIssueCode.invalid_union:
        message = `Invalid input`;
        break;
      case ZodIssueCode.invalid_union_discriminator:
        message = `Invalid discriminator value. Expected ${util.joinValues(
          issue.options
        )}`;
        break;
      case ZodIssueCode.invalid_enum_value:
        message = `Invalid enum value. Expected ${util.joinValues(
          issue.options
        )}, received '${issue.received}'`;
        break;
      case ZodIssueCode.invalid_arguments:
        message = `Invalid function arguments`;
        break;
      case ZodIssueCode.invalid_return_type:
        message = `Invalid function return type`;
        break;
      case ZodIssueCode.invalid_date:
        message = `Invalid date`;
        break;
      case ZodIssueCode.invalid_string:
        if (issue.validation !== "regex")
          message = `Invalid ${issue.validation}`;
        else
          message = "Invalid";
        break;
      case ZodIssueCode.too_small:
        if (issue.type === "array")
          message = `Array must contain ${issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
        else if (issue.type === "string")
          message = `String must contain ${issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
        else if (issue.type === "number")
          message = `Number must be greater than ${issue.inclusive ? `or equal to ` : ``}${issue.minimum}`;
        else
          message = "Invalid input";
        break;
      case ZodIssueCode.too_big:
        if (issue.type === "array")
          message = `Array must contain ${issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
        else if (issue.type === "string")
          message = `String must contain ${issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
        else if (issue.type === "number")
          message = `Number must be less than ${issue.inclusive ? `or equal to ` : ``}${issue.maximum}`;
        else
          message = "Invalid input";
        break;
      case ZodIssueCode.custom:
        message = `Invalid input`;
        break;
      case ZodIssueCode.invalid_intersection_types:
        message = `Intersection results could not be merged`;
        break;
      case ZodIssueCode.not_multiple_of:
        message = `Number must be a multiple of ${issue.multipleOf}`;
        break;
      default:
        message = _ctx.defaultError;
        util.assertNever(issue);
    }
    return { message };
  };
  var overrideErrorMap = defaultErrorMap;
  var setErrorMap = (map) => {
    overrideErrorMap = map;
  };

  // web:https://deno.land/x/zod@v3.17.0/helpers/parseUtil.ts
  var ZodParsedType = util.arrayToEnum([
    "string",
    "nan",
    "number",
    "integer",
    "float",
    "boolean",
    "date",
    "bigint",
    "symbol",
    "function",
    "undefined",
    "null",
    "array",
    "object",
    "unknown",
    "promise",
    "void",
    "never",
    "map",
    "set"
  ]);
  var getParsedType = (data) => {
    const t = typeof data;
    switch (t) {
      case "undefined":
        return ZodParsedType.undefined;
      case "string":
        return ZodParsedType.string;
      case "number":
        return isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
      case "boolean":
        return ZodParsedType.boolean;
      case "function":
        return ZodParsedType.function;
      case "bigint":
        return ZodParsedType.bigint;
      case "object":
        if (Array.isArray(data)) {
          return ZodParsedType.array;
        }
        if (data === null) {
          return ZodParsedType.null;
        }
        if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
          return ZodParsedType.promise;
        }
        if (typeof Map !== "undefined" && data instanceof Map) {
          return ZodParsedType.map;
        }
        if (typeof Set !== "undefined" && data instanceof Set) {
          return ZodParsedType.set;
        }
        if (typeof Date !== "undefined" && data instanceof Date) {
          return ZodParsedType.date;
        }
        return ZodParsedType.object;
      default:
        return ZodParsedType.unknown;
    }
  };
  var makeIssue = (params) => {
    const { data, path, errorMaps, issueData } = params;
    const fullPath = [...path, ...issueData.path || []];
    const fullIssue = {
      ...issueData,
      path: fullPath
    };
    let errorMessage = "";
    const maps = errorMaps.filter((m3) => !!m3).slice().reverse();
    for (const map of maps) {
      errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
    }
    return {
      ...issueData,
      path: fullPath,
      message: issueData.message || errorMessage
    };
  };
  var EMPTY_PATH = [];
  function addIssueToContext(ctx, issueData) {
    const issue = makeIssue({
      issueData,
      data: ctx.data,
      path: ctx.path,
      errorMaps: [
        ctx.common.contextualErrorMap,
        ctx.schemaErrorMap,
        overrideErrorMap,
        defaultErrorMap
      ].filter((x2) => !!x2)
    });
    ctx.common.issues.push(issue);
  }
  var ParseStatus = class {
    constructor() {
      this.value = "valid";
    }
    dirty() {
      if (this.value === "valid")
        this.value = "dirty";
    }
    abort() {
      if (this.value !== "aborted")
        this.value = "aborted";
    }
    static mergeArray(status, results) {
      const arrayValue = [];
      for (const s2 of results) {
        if (s2.status === "aborted")
          return INVALID;
        if (s2.status === "dirty")
          status.dirty();
        arrayValue.push(s2.value);
      }
      return { status: status.value, value: arrayValue };
    }
    static async mergeObjectAsync(status, pairs) {
      const syncPairs = [];
      for (const pair of pairs) {
        syncPairs.push({
          key: await pair.key,
          value: await pair.value
        });
      }
      return ParseStatus.mergeObjectSync(status, syncPairs);
    }
    static mergeObjectSync(status, pairs) {
      const finalObject = {};
      for (const pair of pairs) {
        const { key, value } = pair;
        if (key.status === "aborted")
          return INVALID;
        if (value.status === "aborted")
          return INVALID;
        if (key.status === "dirty")
          status.dirty();
        if (value.status === "dirty")
          status.dirty();
        if (typeof value.value !== "undefined" || pair.alwaysSet) {
          finalObject[key.value] = value.value;
        }
      }
      return { status: status.value, value: finalObject };
    }
  };
  var INVALID = Object.freeze({
    status: "aborted"
  });
  var DIRTY = (value) => ({ status: "dirty", value });
  var OK = (value) => ({ status: "valid", value });
  var isAborted = (x2) => x2.status === "aborted";
  var isDirty = (x2) => x2.status === "dirty";
  var isValid = (x2) => x2.status === "valid";
  var isAsync = (x2) => typeof Promise !== void 0 && x2 instanceof Promise;

  // web:https://deno.land/x/zod@v3.17.0/helpers/errorUtil.ts
  var errorUtil;
  ((errorUtil2) => {
    errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
    errorUtil2.toString = (message) => typeof message === "string" ? message : message?.message;
  })(errorUtil || (errorUtil = {}));

  // web:https://deno.land/x/zod@v3.17.0/types.ts
  var ParseInputLazyPath = class {
    constructor(parent, value, path, key) {
      this.parent = parent;
      this.data = value;
      this._path = path;
      this._key = key;
    }
    get path() {
      return this._path.concat(this._key);
    }
  };
  var handleResult = (ctx, result) => {
    if (isValid(result)) {
      return { success: true, data: result.value };
    } else {
      if (!ctx.common.issues.length) {
        throw new Error("Validation failed but no issues detected.");
      }
      const error = new ZodError(ctx.common.issues);
      return { success: false, error };
    }
  };
  function processCreateParams(params) {
    if (!params)
      return {};
    const { errorMap, invalid_type_error, required_error, description } = params;
    if (errorMap && (invalid_type_error || required_error)) {
      throw new Error(
        `Can't use "invalid" or "required" in conjunction with custom error map.`
      );
    }
    if (errorMap)
      return { errorMap, description };
    const customMap = (iss, ctx) => {
      if (iss.code !== "invalid_type")
        return { message: ctx.defaultError };
      if (typeof ctx.data === "undefined" && required_error)
        return { message: required_error };
      if (params.invalid_type_error)
        return { message: params.invalid_type_error };
      return { message: ctx.defaultError };
    };
    return { errorMap: customMap, description };
  }
  var ZodType = class {
    constructor(def) {
      this.spa = this.safeParseAsync;
      this.superRefine = this._refinement;
      this._def = def;
      this.parse = this.parse.bind(this);
      this.safeParse = this.safeParse.bind(this);
      this.parseAsync = this.parseAsync.bind(this);
      this.safeParseAsync = this.safeParseAsync.bind(this);
      this.spa = this.spa.bind(this);
      this.refine = this.refine.bind(this);
      this.refinement = this.refinement.bind(this);
      this.superRefine = this.superRefine.bind(this);
      this.optional = this.optional.bind(this);
      this.nullable = this.nullable.bind(this);
      this.nullish = this.nullish.bind(this);
      this.array = this.array.bind(this);
      this.promise = this.promise.bind(this);
      this.or = this.or.bind(this);
      this.and = this.and.bind(this);
      this.transform = this.transform.bind(this);
      this.default = this.default.bind(this);
      this.describe = this.describe.bind(this);
      this.isNullable = this.isNullable.bind(this);
      this.isOptional = this.isOptional.bind(this);
    }
    get description() {
      return this._def.description;
    }
    _getType(input) {
      return getParsedType(input.data);
    }
    _getOrReturnCtx(input, ctx) {
      return ctx || {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      };
    }
    _processInputParams(input) {
      return {
        status: new ParseStatus(),
        ctx: {
          common: input.parent.common,
          data: input.data,
          parsedType: getParsedType(input.data),
          schemaErrorMap: this._def.errorMap,
          path: input.path,
          parent: input.parent
        }
      };
    }
    _parseSync(input) {
      const result = this._parse(input);
      if (isAsync(result)) {
        throw new Error("Synchronous parse encountered promise.");
      }
      return result;
    }
    _parseAsync(input) {
      const result = this._parse(input);
      return Promise.resolve(result);
    }
    parse(data, params) {
      const result = this.safeParse(data, params);
      if (result.success)
        return result.data;
      throw result.error;
    }
    safeParse(data, params) {
      const ctx = {
        common: {
          issues: [],
          async: params?.async ?? false,
          contextualErrorMap: params?.errorMap
        },
        path: params?.path || [],
        schemaErrorMap: this._def.errorMap,
        parent: null,
        data,
        parsedType: getParsedType(data)
      };
      const result = this._parseSync({ data, path: ctx.path, parent: ctx });
      return handleResult(ctx, result);
    }
    async parseAsync(data, params) {
      const result = await this.safeParseAsync(data, params);
      if (result.success)
        return result.data;
      throw result.error;
    }
    async safeParseAsync(data, params) {
      const ctx = {
        common: {
          issues: [],
          contextualErrorMap: params?.errorMap,
          async: true
        },
        path: params?.path || [],
        schemaErrorMap: this._def.errorMap,
        parent: null,
        data,
        parsedType: getParsedType(data)
      };
      const maybeAsyncResult = this._parse({ data, path: [], parent: ctx });
      const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
      return handleResult(ctx, result);
    }
    refine(check, message) {
      const getIssueProperties = (val) => {
        if (typeof message === "string" || typeof message === "undefined") {
          return { message };
        } else if (typeof message === "function") {
          return message(val);
        } else {
          return message;
        }
      };
      return this._refinement((val, ctx) => {
        const result = check(val);
        const setError = () => ctx.addIssue({
          code: ZodIssueCode.custom,
          ...getIssueProperties(val)
        });
        if (typeof Promise !== "undefined" && result instanceof Promise) {
          return result.then((data) => {
            if (!data) {
              setError();
              return false;
            } else {
              return true;
            }
          });
        }
        if (!result) {
          setError();
          return false;
        } else {
          return true;
        }
      });
    }
    refinement(check, refinementData) {
      return this._refinement((val, ctx) => {
        if (!check(val)) {
          ctx.addIssue(
            typeof refinementData === "function" ? refinementData(val, ctx) : refinementData
          );
          return false;
        } else {
          return true;
        }
      });
    }
    _refinement(refinement) {
      return new ZodEffects({
        schema: this,
        typeName: ZodFirstPartyTypeKind.ZodEffects,
        effect: { type: "refinement", refinement }
      });
    }
    optional() {
      return ZodOptional.create(this);
    }
    nullable() {
      return ZodNullable.create(this);
    }
    nullish() {
      return this.optional().nullable();
    }
    array() {
      return ZodArray.create(this);
    }
    promise() {
      return ZodPromise.create(this);
    }
    or(option) {
      return ZodUnion.create([this, option]);
    }
    and(incoming) {
      return ZodIntersection.create(this, incoming);
    }
    transform(transform) {
      return new ZodEffects({
        schema: this,
        typeName: ZodFirstPartyTypeKind.ZodEffects,
        effect: { type: "transform", transform }
      });
    }
    default(def) {
      const defaultValueFunc = typeof def === "function" ? def : () => def;
      return new ZodDefault({
        innerType: this,
        defaultValue: defaultValueFunc,
        typeName: ZodFirstPartyTypeKind.ZodDefault
      });
    }
    describe(description) {
      const This = this.constructor;
      return new This({
        ...this._def,
        description
      });
    }
    isOptional() {
      return this.safeParse(void 0).success;
    }
    isNullable() {
      return this.safeParse(null).success;
    }
  };
  var cuidRegex = /^c[^\s-]{8,}$/i;
  var uuidRegex = /^([a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[a-f0-9]{4}-[a-f0-9]{12}|00000000-0000-0000-0000-000000000000)$/i;
  var emailRegex = /^(([^<>()[\]\.,;:\s@\"]+(\.[^<>()[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\.,;:\s@\"]+\.)+[^<>()[\]\.,;:\s@\"]{2,})$/i;
  var _ZodString = class extends ZodType {
    constructor() {
      super(...arguments);
      this._regex = (regex, validation, message) => this.refinement((data) => regex.test(data), {
        validation,
        code: ZodIssueCode.invalid_string,
        ...errorUtil.errToObj(message)
      });
      this.nonempty = (message) => this.min(1, errorUtil.errToObj(message));
      this.trim = () => new _ZodString({
        ...this._def,
        checks: [...this._def.checks, { kind: "trim" }]
      });
    }
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.string) {
        const ctx2 = this._getOrReturnCtx(input);
        addIssueToContext(
          ctx2,
          {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.string,
            received: ctx2.parsedType
          }
        );
        return INVALID;
      }
      const status = new ParseStatus();
      let ctx = void 0;
      for (const check of this._def.checks) {
        if (check.kind === "min") {
          if (input.data.length < check.value) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "max") {
          if (input.data.length > check.value) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "email") {
          if (!emailRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "email",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "uuid") {
          if (!uuidRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "uuid",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "cuid") {
          if (!cuidRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "cuid",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "url") {
          try {
            new URL(input.data);
          } catch {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "url",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "regex") {
          check.regex.lastIndex = 0;
          const testResult = check.regex.test(input.data);
          if (!testResult) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "regex",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "trim") {
          input.data = input.data.trim();
        } else {
          util.assertNever(check);
        }
      }
      return { status: status.value, value: input.data };
    }
    _addCheck(check) {
      return new _ZodString({
        ...this._def,
        checks: [...this._def.checks, check]
      });
    }
    email(message) {
      return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
    }
    url(message) {
      return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
    }
    uuid(message) {
      return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
    }
    cuid(message) {
      return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
    }
    regex(regex, message) {
      return this._addCheck({
        kind: "regex",
        regex,
        ...errorUtil.errToObj(message)
      });
    }
    min(minLength, message) {
      return this._addCheck({
        kind: "min",
        value: minLength,
        ...errorUtil.errToObj(message)
      });
    }
    max(maxLength, message) {
      return this._addCheck({
        kind: "max",
        value: maxLength,
        ...errorUtil.errToObj(message)
      });
    }
    length(len, message) {
      return this.min(len, message).max(len, message);
    }
    get isEmail() {
      return !!this._def.checks.find((ch) => ch.kind === "email");
    }
    get isURL() {
      return !!this._def.checks.find((ch) => ch.kind === "url");
    }
    get isUUID() {
      return !!this._def.checks.find((ch) => ch.kind === "uuid");
    }
    get isCUID() {
      return !!this._def.checks.find((ch) => ch.kind === "cuid");
    }
    get minLength() {
      let min = -Infinity;
      this._def.checks.map((ch) => {
        if (ch.kind === "min") {
          if (min === null || ch.value > min) {
            min = ch.value;
          }
        }
      });
      return min;
    }
    get maxLength() {
      let max = null;
      this._def.checks.map((ch) => {
        if (ch.kind === "max") {
          if (max === null || ch.value < max) {
            max = ch.value;
          }
        }
      });
      return max;
    }
  };
  var ZodString = _ZodString;
  ZodString.create = (params) => {
    return new _ZodString({
      checks: [],
      typeName: ZodFirstPartyTypeKind.ZodString,
      ...processCreateParams(params)
    });
  };
  function floatSafeRemainder(val, step2) {
    const valDecCount = (val.toString().split(".")[1] || "").length;
    const stepDecCount = (step2.toString().split(".")[1] || "").length;
    const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
    const valInt = parseInt(val.toFixed(decCount).replace(".", ""));
    const stepInt = parseInt(step2.toFixed(decCount).replace(".", ""));
    return valInt % stepInt / Math.pow(10, decCount);
  }
  var _ZodNumber = class extends ZodType {
    constructor() {
      super(...arguments);
      this.min = this.gte;
      this.max = this.lte;
      this.step = this.multipleOf;
    }
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.number) {
        const ctx2 = this._getOrReturnCtx(input);
        addIssueToContext(ctx2, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.number,
          received: ctx2.parsedType
        });
        return INVALID;
      }
      let ctx = void 0;
      const status = new ParseStatus();
      for (const check of this._def.checks) {
        if (check.kind === "int") {
          if (!util.isInteger(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_type,
              expected: "integer",
              received: "float",
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "min") {
          const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
          if (tooSmall) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "number",
              inclusive: check.inclusive,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "max") {
          const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
          if (tooBig) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "number",
              inclusive: check.inclusive,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "multipleOf") {
          if (floatSafeRemainder(input.data, check.value) !== 0) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.not_multiple_of,
              multipleOf: check.value,
              message: check.message
            });
            status.dirty();
          }
        } else {
          util.assertNever(check);
        }
      }
      return { status: status.value, value: input.data };
    }
    gte(value, message) {
      return this.setLimit("min", value, true, errorUtil.toString(message));
    }
    gt(value, message) {
      return this.setLimit("min", value, false, errorUtil.toString(message));
    }
    lte(value, message) {
      return this.setLimit("max", value, true, errorUtil.toString(message));
    }
    lt(value, message) {
      return this.setLimit("max", value, false, errorUtil.toString(message));
    }
    setLimit(kind, value, inclusive, message) {
      return new _ZodNumber({
        ...this._def,
        checks: [
          ...this._def.checks,
          {
            kind,
            value,
            inclusive,
            message: errorUtil.toString(message)
          }
        ]
      });
    }
    _addCheck(check) {
      return new _ZodNumber({
        ...this._def,
        checks: [...this._def.checks, check]
      });
    }
    int(message) {
      return this._addCheck({
        kind: "int",
        message: errorUtil.toString(message)
      });
    }
    positive(message) {
      return this._addCheck({
        kind: "min",
        value: 0,
        inclusive: false,
        message: errorUtil.toString(message)
      });
    }
    negative(message) {
      return this._addCheck({
        kind: "max",
        value: 0,
        inclusive: false,
        message: errorUtil.toString(message)
      });
    }
    nonpositive(message) {
      return this._addCheck({
        kind: "max",
        value: 0,
        inclusive: true,
        message: errorUtil.toString(message)
      });
    }
    nonnegative(message) {
      return this._addCheck({
        kind: "min",
        value: 0,
        inclusive: true,
        message: errorUtil.toString(message)
      });
    }
    multipleOf(value, message) {
      return this._addCheck({
        kind: "multipleOf",
        value,
        message: errorUtil.toString(message)
      });
    }
    get minValue() {
      let min = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "min") {
          if (min === null || ch.value > min)
            min = ch.value;
        }
      }
      return min;
    }
    get maxValue() {
      let max = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "max") {
          if (max === null || ch.value < max)
            max = ch.value;
        }
      }
      return max;
    }
    get isInt() {
      return !!this._def.checks.find((ch) => ch.kind === "int");
    }
  };
  var ZodNumber = _ZodNumber;
  ZodNumber.create = (params) => {
    return new _ZodNumber({
      checks: [],
      typeName: ZodFirstPartyTypeKind.ZodNumber,
      ...processCreateParams(params)
    });
  };
  var _ZodBigInt = class extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.bigint) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.bigint,
          received: ctx.parsedType
        });
        return INVALID;
      }
      return OK(input.data);
    }
  };
  var ZodBigInt = _ZodBigInt;
  ZodBigInt.create = (params) => {
    return new _ZodBigInt({
      typeName: ZodFirstPartyTypeKind.ZodBigInt,
      ...processCreateParams(params)
    });
  };
  var _ZodBoolean = class extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.boolean) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.boolean,
          received: ctx.parsedType
        });
        return INVALID;
      }
      return OK(input.data);
    }
  };
  var ZodBoolean = _ZodBoolean;
  ZodBoolean.create = (params) => {
    return new _ZodBoolean({
      typeName: ZodFirstPartyTypeKind.ZodBoolean,
      ...processCreateParams(params)
    });
  };
  var _ZodDate = class extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.date) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.date,
          received: ctx.parsedType
        });
        return INVALID;
      }
      if (isNaN(input.data.getTime())) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_date
        });
        return INVALID;
      }
      return {
        status: "valid",
        value: new Date(input.data.getTime())
      };
    }
  };
  var ZodDate = _ZodDate;
  ZodDate.create = (params) => {
    return new _ZodDate({
      typeName: ZodFirstPartyTypeKind.ZodDate,
      ...processCreateParams(params)
    });
  };
  var _ZodUndefined = class extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.undefined) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.undefined,
          received: ctx.parsedType
        });
        return INVALID;
      }
      return OK(input.data);
    }
  };
  var ZodUndefined = _ZodUndefined;
  ZodUndefined.create = (params) => {
    return new _ZodUndefined({
      typeName: ZodFirstPartyTypeKind.ZodUndefined,
      ...processCreateParams(params)
    });
  };
  var _ZodNull = class extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.null) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.null,
          received: ctx.parsedType
        });
        return INVALID;
      }
      return OK(input.data);
    }
  };
  var ZodNull = _ZodNull;
  ZodNull.create = (params) => {
    return new _ZodNull({
      typeName: ZodFirstPartyTypeKind.ZodNull,
      ...processCreateParams(params)
    });
  };
  var _ZodAny = class extends ZodType {
    constructor() {
      super(...arguments);
      this._any = true;
    }
    _parse(input) {
      return OK(input.data);
    }
  };
  var ZodAny = _ZodAny;
  ZodAny.create = (params) => {
    return new _ZodAny({
      typeName: ZodFirstPartyTypeKind.ZodAny,
      ...processCreateParams(params)
    });
  };
  var _ZodUnknown = class extends ZodType {
    constructor() {
      super(...arguments);
      this._unknown = true;
    }
    _parse(input) {
      return OK(input.data);
    }
  };
  var ZodUnknown = _ZodUnknown;
  ZodUnknown.create = (params) => {
    return new _ZodUnknown({
      typeName: ZodFirstPartyTypeKind.ZodUnknown,
      ...processCreateParams(params)
    });
  };
  var _ZodNever = class extends ZodType {
    _parse(input) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.never,
        received: ctx.parsedType
      });
      return INVALID;
    }
  };
  var ZodNever = _ZodNever;
  ZodNever.create = (params) => {
    return new _ZodNever({
      typeName: ZodFirstPartyTypeKind.ZodNever,
      ...processCreateParams(params)
    });
  };
  var _ZodVoid = class extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.undefined) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.void,
          received: ctx.parsedType
        });
        return INVALID;
      }
      return OK(input.data);
    }
  };
  var ZodVoid = _ZodVoid;
  ZodVoid.create = (params) => {
    return new _ZodVoid({
      typeName: ZodFirstPartyTypeKind.ZodVoid,
      ...processCreateParams(params)
    });
  };
  var _ZodArray = class extends ZodType {
    _parse(input) {
      const { ctx, status } = this._processInputParams(input);
      const def = this._def;
      if (ctx.parsedType !== ZodParsedType.array) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.array,
          received: ctx.parsedType
        });
        return INVALID;
      }
      if (def.minLength !== null) {
        if (ctx.data.length < def.minLength.value) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: def.minLength.value,
            type: "array",
            inclusive: true,
            message: def.minLength.message
          });
          status.dirty();
        }
      }
      if (def.maxLength !== null) {
        if (ctx.data.length > def.maxLength.value) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: def.maxLength.value,
            type: "array",
            inclusive: true,
            message: def.maxLength.message
          });
          status.dirty();
        }
      }
      if (ctx.common.async) {
        return Promise.all(
          ctx.data.map((item, i) => {
            return def.type._parseAsync(
              new ParseInputLazyPath(ctx, item, ctx.path, i)
            );
          })
        ).then((result2) => {
          return ParseStatus.mergeArray(status, result2);
        });
      }
      const result = ctx.data.map((item, i) => {
        return def.type._parseSync(
          new ParseInputLazyPath(ctx, item, ctx.path, i)
        );
      });
      return ParseStatus.mergeArray(status, result);
    }
    get element() {
      return this._def.type;
    }
    min(minLength, message) {
      return new _ZodArray({
        ...this._def,
        minLength: { value: minLength, message: errorUtil.toString(message) }
      });
    }
    max(maxLength, message) {
      return new _ZodArray({
        ...this._def,
        maxLength: { value: maxLength, message: errorUtil.toString(message) }
      });
    }
    length(len, message) {
      return this.min(len, message).max(len, message);
    }
    nonempty(message) {
      return this.min(1, message);
    }
  };
  var ZodArray = _ZodArray;
  ZodArray.create = (schema, params) => {
    return new _ZodArray({
      type: schema,
      minLength: null,
      maxLength: null,
      typeName: ZodFirstPartyTypeKind.ZodArray,
      ...processCreateParams(params)
    });
  };
  var objectUtil;
  ((objectUtil2) => {
    objectUtil2.mergeShapes = (first, second) => {
      return {
        ...first,
        ...second
      };
    };
  })(objectUtil || (objectUtil = {}));
  var AugmentFactory = (def) => (augmentation) => {
    return new ZodObject({
      ...def,
      shape: () => ({
        ...def.shape(),
        ...augmentation
      })
    });
  };
  function deepPartialify(schema) {
    if (schema instanceof ZodObject) {
      const newShape = {};
      for (const key in schema.shape) {
        const fieldSchema = schema.shape[key];
        newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
      }
      return new ZodObject({
        ...schema._def,
        shape: () => newShape
      });
    } else if (schema instanceof ZodArray) {
      return ZodArray.create(deepPartialify(schema.element));
    } else if (schema instanceof ZodOptional) {
      return ZodOptional.create(deepPartialify(schema.unwrap()));
    } else if (schema instanceof ZodNullable) {
      return ZodNullable.create(deepPartialify(schema.unwrap()));
    } else if (schema instanceof ZodTuple) {
      return ZodTuple.create(
        schema.items.map((item) => deepPartialify(item))
      );
    } else {
      return schema;
    }
  }
  var _ZodObject = class extends ZodType {
    constructor() {
      super(...arguments);
      this._cached = null;
      this.nonstrict = this.passthrough;
      this.augment = AugmentFactory(this._def);
      this.extend = AugmentFactory(this._def);
    }
    _getCached() {
      if (this._cached !== null)
        return this._cached;
      const shape = this._def.shape();
      const keys = util.objectKeys(shape);
      return this._cached = { shape, keys };
    }
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.object) {
        const ctx2 = this._getOrReturnCtx(input);
        addIssueToContext(ctx2, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.object,
          received: ctx2.parsedType
        });
        return INVALID;
      }
      const { status, ctx } = this._processInputParams(input);
      const { shape, keys: shapeKeys } = this._getCached();
      const extraKeys = [];
      for (const key in ctx.data) {
        if (!shapeKeys.includes(key)) {
          extraKeys.push(key);
        }
      }
      const pairs = [];
      for (const key of shapeKeys) {
        const keyValidator = shape[key];
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: keyValidator._parse(
            new ParseInputLazyPath(ctx, value, ctx.path, key)
          ),
          alwaysSet: key in ctx.data
        });
      }
      if (this._def.catchall instanceof ZodNever) {
        const unknownKeys = this._def.unknownKeys;
        if (unknownKeys === "passthrough") {
          for (const key of extraKeys) {
            pairs.push({
              key: { status: "valid", value: key },
              value: { status: "valid", value: ctx.data[key] }
            });
          }
        } else if (unknownKeys === "strict") {
          if (extraKeys.length > 0) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.unrecognized_keys,
              keys: extraKeys
            });
            status.dirty();
          }
        } else if (unknownKeys === "strip") {
        } else {
          throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
        }
      } else {
        const catchall = this._def.catchall;
        for (const key of extraKeys) {
          const value = ctx.data[key];
          pairs.push({
            key: { status: "valid", value: key },
            value: catchall._parse(
              new ParseInputLazyPath(ctx, value, ctx.path, key)
            ),
            alwaysSet: key in ctx.data
          });
        }
      }
      if (ctx.common.async) {
        return Promise.resolve().then(async () => {
          const syncPairs = [];
          for (const pair of pairs) {
            const key = await pair.key;
            syncPairs.push({
              key,
              value: await pair.value,
              alwaysSet: pair.alwaysSet
            });
          }
          return syncPairs;
        }).then((syncPairs) => {
          return ParseStatus.mergeObjectSync(status, syncPairs);
        });
      } else {
        return ParseStatus.mergeObjectSync(status, pairs);
      }
    }
    get shape() {
      return this._def.shape();
    }
    strict(message) {
      errorUtil.errToObj;
      return new _ZodObject({
        ...this._def,
        unknownKeys: "strict",
        ...message !== void 0 ? {
          errorMap: (issue, ctx) => {
            const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
            if (issue.code === "unrecognized_keys")
              return {
                message: errorUtil.errToObj(message).message ?? defaultError
              };
            return {
              message: defaultError
            };
          }
        } : {}
      });
    }
    strip() {
      return new _ZodObject({
        ...this._def,
        unknownKeys: "strip"
      });
    }
    passthrough() {
      return new _ZodObject({
        ...this._def,
        unknownKeys: "passthrough"
      });
    }
    setKey(key, schema) {
      return this.augment({ [key]: schema });
    }
    merge(merging) {
      const merged = new _ZodObject({
        unknownKeys: merging._def.unknownKeys,
        catchall: merging._def.catchall,
        shape: () => objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
        typeName: ZodFirstPartyTypeKind.ZodObject
      });
      return merged;
    }
    catchall(index) {
      return new _ZodObject({
        ...this._def,
        catchall: index
      });
    }
    pick(mask) {
      const shape = {};
      util.objectKeys(mask).map((key) => {
        shape[key] = this.shape[key];
      });
      return new _ZodObject({
        ...this._def,
        shape: () => shape
      });
    }
    omit(mask) {
      const shape = {};
      util.objectKeys(this.shape).map((key) => {
        if (util.objectKeys(mask).indexOf(key) === -1) {
          shape[key] = this.shape[key];
        }
      });
      return new _ZodObject({
        ...this._def,
        shape: () => shape
      });
    }
    deepPartial() {
      return deepPartialify(this);
    }
    partial(mask) {
      const newShape = {};
      if (mask) {
        util.objectKeys(this.shape).map((key) => {
          if (util.objectKeys(mask).indexOf(key) === -1) {
            newShape[key] = this.shape[key];
          } else {
            newShape[key] = this.shape[key].optional();
          }
        });
        return new _ZodObject({
          ...this._def,
          shape: () => newShape
        });
      } else {
        for (const key in this.shape) {
          const fieldSchema = this.shape[key];
          newShape[key] = fieldSchema.optional();
        }
      }
      return new _ZodObject({
        ...this._def,
        shape: () => newShape
      });
    }
    required() {
      const newShape = {};
      for (const key in this.shape) {
        const fieldSchema = this.shape[key];
        let newField = fieldSchema;
        while (newField instanceof ZodOptional) {
          newField = newField._def.innerType;
        }
        newShape[key] = newField;
      }
      return new _ZodObject({
        ...this._def,
        shape: () => newShape
      });
    }
  };
  var ZodObject = _ZodObject;
  ZodObject.create = (shape, params) => {
    return new _ZodObject({
      shape: () => shape,
      unknownKeys: "strip",
      catchall: ZodNever.create(),
      typeName: ZodFirstPartyTypeKind.ZodObject,
      ...processCreateParams(params)
    });
  };
  ZodObject.strictCreate = (shape, params) => {
    return new _ZodObject({
      shape: () => shape,
      unknownKeys: "strict",
      catchall: ZodNever.create(),
      typeName: ZodFirstPartyTypeKind.ZodObject,
      ...processCreateParams(params)
    });
  };
  ZodObject.lazycreate = (shape, params) => {
    return new _ZodObject({
      shape,
      unknownKeys: "strip",
      catchall: ZodNever.create(),
      typeName: ZodFirstPartyTypeKind.ZodObject,
      ...processCreateParams(params)
    });
  };
  var _ZodUnion = class extends ZodType {
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      const options = this._def.options;
      function handleResults(results) {
        for (const result of results) {
          if (result.result.status === "valid") {
            return result.result;
          }
        }
        for (const result of results) {
          if (result.result.status === "dirty") {
            ctx.common.issues.push(...result.ctx.common.issues);
            return result.result;
          }
        }
        const unionErrors = results.map(
          (result) => new ZodError(result.ctx.common.issues)
        );
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_union,
          unionErrors
        });
        return INVALID;
      }
      if (ctx.common.async) {
        return Promise.all(
          options.map(async (option) => {
            const childCtx = {
              ...ctx,
              common: {
                ...ctx.common,
                issues: []
              },
              parent: null
            };
            return {
              result: await option._parseAsync({
                data: ctx.data,
                path: ctx.path,
                parent: childCtx
              }),
              ctx: childCtx
            };
          })
        ).then(handleResults);
      } else {
        let dirty = void 0;
        const issues = [];
        for (const option of options) {
          const childCtx = {
            ...ctx,
            common: {
              ...ctx.common,
              issues: []
            },
            parent: null
          };
          const result = option._parseSync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          });
          if (result.status === "valid") {
            return result;
          } else if (result.status === "dirty" && !dirty) {
            dirty = { result, ctx: childCtx };
          }
          if (childCtx.common.issues.length) {
            issues.push(childCtx.common.issues);
          }
        }
        if (dirty) {
          ctx.common.issues.push(...dirty.ctx.common.issues);
          return dirty.result;
        }
        const unionErrors = issues.map((issues2) => new ZodError(issues2));
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_union,
          unionErrors
        });
        return INVALID;
      }
    }
    get options() {
      return this._def.options;
    }
  };
  var ZodUnion = _ZodUnion;
  ZodUnion.create = (types, params) => {
    return new _ZodUnion({
      options: types,
      typeName: ZodFirstPartyTypeKind.ZodUnion,
      ...processCreateParams(params)
    });
  };
  var ZodDiscriminatedUnion = class extends ZodType {
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.object) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.object,
          received: ctx.parsedType
        });
        return INVALID;
      }
      const discriminator = this.discriminator;
      const discriminatorValue = ctx.data[discriminator];
      const option = this.options.get(discriminatorValue);
      if (!option) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_union_discriminator,
          options: this.validDiscriminatorValues,
          path: [discriminator]
        });
        return INVALID;
      }
      if (ctx.common.async) {
        return option._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
      } else {
        return option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
      }
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
    static create(discriminator, types, params) {
      const options = /* @__PURE__ */ new Map();
      try {
        types.forEach((type) => {
          const discriminatorValue = type.shape[discriminator].value;
          options.set(discriminatorValue, type);
        });
      } catch (e) {
        throw new Error(
          "The discriminator value could not be extracted from all the provided schemas"
        );
      }
      if (options.size !== types.length) {
        throw new Error("Some of the discriminator values are not unique");
      }
      return new ZodDiscriminatedUnion({
        typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
        discriminator,
        options,
        ...processCreateParams(params)
      });
    }
  };
  function mergeValues(a2, b3) {
    const aType = getParsedType(a2);
    const bType = getParsedType(b3);
    if (a2 === b3) {
      return { valid: true, data: a2 };
    } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
      const bKeys = util.objectKeys(b3);
      const sharedKeys = util.objectKeys(a2).filter((key) => bKeys.indexOf(key) !== -1);
      const newObj = { ...a2, ...b3 };
      for (const key of sharedKeys) {
        const sharedValue = mergeValues(a2[key], b3[key]);
        if (!sharedValue.valid) {
          return { valid: false };
        }
        newObj[key] = sharedValue.data;
      }
      return { valid: true, data: newObj };
    } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
      if (a2.length !== b3.length) {
        return { valid: false };
      }
      const newArray = [];
      for (let index = 0; index < a2.length; index++) {
        const itemA = a2[index];
        const itemB = b3[index];
        const sharedValue = mergeValues(itemA, itemB);
        if (!sharedValue.valid) {
          return { valid: false };
        }
        newArray.push(sharedValue.data);
      }
      return { valid: true, data: newArray };
    } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a2 === +b3) {
      return { valid: true, data: a2 };
    } else {
      return { valid: false };
    }
  }
  var _ZodIntersection = class extends ZodType {
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      const handleParsed = (parsedLeft, parsedRight) => {
        if (isAborted(parsedLeft) || isAborted(parsedRight)) {
          return INVALID;
        }
        const merged = mergeValues(parsedLeft.value, parsedRight.value);
        if (!merged.valid) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_intersection_types
          });
          return INVALID;
        }
        if (isDirty(parsedLeft) || isDirty(parsedRight)) {
          status.dirty();
        }
        return { status: status.value, value: merged.data };
      };
      if (ctx.common.async) {
        return Promise.all([
          this._def.left._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          }),
          this._def.right._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          })
        ]).then(([left, right]) => handleParsed(left, right));
      } else {
        return handleParsed(
          this._def.left._parseSync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          }),
          this._def.right._parseSync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          })
        );
      }
    }
  };
  var ZodIntersection = _ZodIntersection;
  ZodIntersection.create = (left, right, params) => {
    return new _ZodIntersection({
      left,
      right,
      typeName: ZodFirstPartyTypeKind.ZodIntersection,
      ...processCreateParams(params)
    });
  };
  var _ZodTuple = class extends ZodType {
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.array) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.array,
          received: ctx.parsedType
        });
        return INVALID;
      }
      if (ctx.data.length < this._def.items.length) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: this._def.items.length,
          inclusive: true,
          type: "array"
        });
        return INVALID;
      }
      const rest = this._def.rest;
      if (!rest && ctx.data.length > this._def.items.length) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: this._def.items.length,
          inclusive: true,
          type: "array"
        });
        status.dirty();
      }
      const items = ctx.data.map((item, itemIndex) => {
        const schema = this._def.items[itemIndex] || this._def.rest;
        if (!schema)
          return null;
        return schema._parse(
          new ParseInputLazyPath(ctx, item, ctx.path, itemIndex)
        );
      }).filter((x2) => !!x2);
      if (ctx.common.async) {
        return Promise.all(items).then((results) => {
          return ParseStatus.mergeArray(status, results);
        });
      } else {
        return ParseStatus.mergeArray(status, items);
      }
    }
    get items() {
      return this._def.items;
    }
    rest(rest) {
      return new _ZodTuple({
        ...this._def,
        rest
      });
    }
  };
  var ZodTuple = _ZodTuple;
  ZodTuple.create = (schemas, params) => {
    return new _ZodTuple({
      items: schemas,
      typeName: ZodFirstPartyTypeKind.ZodTuple,
      rest: null,
      ...processCreateParams(params)
    });
  };
  var ZodRecord = class extends ZodType {
    get keySchema() {
      return this._def.keyType;
    }
    get valueSchema() {
      return this._def.valueType;
    }
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.object) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.object,
          received: ctx.parsedType
        });
        return INVALID;
      }
      const pairs = [];
      const keyType = this._def.keyType;
      const valueType = this._def.valueType;
      for (const key in ctx.data) {
        pairs.push({
          key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
          value: valueType._parse(
            new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)
          )
        });
      }
      if (ctx.common.async) {
        return ParseStatus.mergeObjectAsync(status, pairs);
      } else {
        return ParseStatus.mergeObjectSync(status, pairs);
      }
    }
    get element() {
      return this._def.valueType;
    }
    static create(first, second, third) {
      if (second instanceof ZodType) {
        return new ZodRecord({
          keyType: first,
          valueType: second,
          typeName: ZodFirstPartyTypeKind.ZodRecord,
          ...processCreateParams(third)
        });
      }
      return new ZodRecord({
        keyType: ZodString.create(),
        valueType: first,
        typeName: ZodFirstPartyTypeKind.ZodRecord,
        ...processCreateParams(second)
      });
    }
  };
  var _ZodMap = class extends ZodType {
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.map) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.map,
          received: ctx.parsedType
        });
        return INVALID;
      }
      const keyType = this._def.keyType;
      const valueType = this._def.valueType;
      const pairs = [...ctx.data.entries()].map(
        ([key, value], index) => {
          return {
            key: keyType._parse(
              new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])
            ),
            value: valueType._parse(
              new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"])
            )
          };
        }
      );
      if (ctx.common.async) {
        const finalMap = /* @__PURE__ */ new Map();
        return Promise.resolve().then(async () => {
          for (const pair of pairs) {
            const key = await pair.key;
            const value = await pair.value;
            if (key.status === "aborted" || value.status === "aborted") {
              return INVALID;
            }
            if (key.status === "dirty" || value.status === "dirty") {
              status.dirty();
            }
            finalMap.set(key.value, value.value);
          }
          return { status: status.value, value: finalMap };
        });
      } else {
        const finalMap = /* @__PURE__ */ new Map();
        for (const pair of pairs) {
          const key = pair.key;
          const value = pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      }
    }
  };
  var ZodMap = _ZodMap;
  ZodMap.create = (keyType, valueType, params) => {
    return new _ZodMap({
      valueType,
      keyType,
      typeName: ZodFirstPartyTypeKind.ZodMap,
      ...processCreateParams(params)
    });
  };
  var _ZodSet = class extends ZodType {
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.set) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.set,
          received: ctx.parsedType
        });
        return INVALID;
      }
      const def = this._def;
      if (def.minSize !== null) {
        if (ctx.data.size < def.minSize.value) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: def.minSize.value,
            type: "set",
            inclusive: true,
            message: def.minSize.message
          });
          status.dirty();
        }
      }
      if (def.maxSize !== null) {
        if (ctx.data.size > def.maxSize.value) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: def.maxSize.value,
            type: "set",
            inclusive: true,
            message: def.maxSize.message
          });
          status.dirty();
        }
      }
      const valueType = this._def.valueType;
      function finalizeSet(elements2) {
        const parsedSet = /* @__PURE__ */ new Set();
        for (const element of elements2) {
          if (element.status === "aborted")
            return INVALID;
          if (element.status === "dirty")
            status.dirty();
          parsedSet.add(element.value);
        }
        return { status: status.value, value: parsedSet };
      }
      const elements = [...ctx.data.values()].map(
        (item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i))
      );
      if (ctx.common.async) {
        return Promise.all(elements).then((elements2) => finalizeSet(elements2));
      } else {
        return finalizeSet(elements);
      }
    }
    min(minSize, message) {
      return new _ZodSet({
        ...this._def,
        minSize: { value: minSize, message: errorUtil.toString(message) }
      });
    }
    max(maxSize, message) {
      return new _ZodSet({
        ...this._def,
        maxSize: { value: maxSize, message: errorUtil.toString(message) }
      });
    }
    size(size, message) {
      return this.min(size, message).max(size, message);
    }
    nonempty(message) {
      return this.min(1, message);
    }
  };
  var ZodSet = _ZodSet;
  ZodSet.create = (valueType, params) => {
    return new _ZodSet({
      valueType,
      minSize: null,
      maxSize: null,
      typeName: ZodFirstPartyTypeKind.ZodSet,
      ...processCreateParams(params)
    });
  };
  var _ZodFunction = class extends ZodType {
    constructor() {
      super(...arguments);
      this.validate = this.implement;
    }
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.function) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.function,
          received: ctx.parsedType
        });
        return INVALID;
      }
      function makeArgsIssue(args, error) {
        return makeIssue({
          data: args,
          path: ctx.path,
          errorMaps: [
            ctx.common.contextualErrorMap,
            ctx.schemaErrorMap,
            overrideErrorMap,
            defaultErrorMap
          ].filter((x2) => !!x2),
          issueData: {
            code: ZodIssueCode.invalid_arguments,
            argumentsError: error
          }
        });
      }
      function makeReturnsIssue(returns, error) {
        return makeIssue({
          data: returns,
          path: ctx.path,
          errorMaps: [
            ctx.common.contextualErrorMap,
            ctx.schemaErrorMap,
            overrideErrorMap,
            defaultErrorMap
          ].filter((x2) => !!x2),
          issueData: {
            code: ZodIssueCode.invalid_return_type,
            returnTypeError: error
          }
        });
      }
      const params = { errorMap: ctx.common.contextualErrorMap };
      const fn = ctx.data;
      if (this._def.returns instanceof ZodPromise) {
        return OK(async (...args) => {
          const error = new ZodError([]);
          const parsedArgs = await this._def.args.parseAsync(args, params).catch((e) => {
            error.addIssue(makeArgsIssue(args, e));
            throw error;
          });
          const result = await fn(...parsedArgs);
          const parsedReturns = await this._def.returns._def.type.parseAsync(result, params).catch((e) => {
            error.addIssue(makeReturnsIssue(result, e));
            throw error;
          });
          return parsedReturns;
        });
      } else {
        return OK((...args) => {
          const parsedArgs = this._def.args.safeParse(args, params);
          if (!parsedArgs.success) {
            throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
          }
          const result = fn(...parsedArgs.data);
          const parsedReturns = this._def.returns.safeParse(result, params);
          if (!parsedReturns.success) {
            throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
          }
          return parsedReturns.data;
        });
      }
    }
    parameters() {
      return this._def.args;
    }
    returnType() {
      return this._def.returns;
    }
    args(...items) {
      return new _ZodFunction({
        ...this._def,
        args: ZodTuple.create(items).rest(ZodUnknown.create())
      });
    }
    returns(returnType) {
      return new _ZodFunction({
        ...this._def,
        returns: returnType
      });
    }
    implement(func) {
      const validatedFunc = this.parse(func);
      return validatedFunc;
    }
    strictImplement(func) {
      const validatedFunc = this.parse(func);
      return validatedFunc;
    }
  };
  var ZodFunction = _ZodFunction;
  ZodFunction.create = (args, returns, params) => {
    return new _ZodFunction({
      args: args ? args.rest(ZodUnknown.create()) : ZodTuple.create([]).rest(ZodUnknown.create()),
      returns: returns || ZodUnknown.create(),
      typeName: ZodFirstPartyTypeKind.ZodFunction,
      ...processCreateParams(params)
    });
  };
  var _ZodLazy = class extends ZodType {
    get schema() {
      return this._def.getter();
    }
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      const lazySchema = this._def.getter();
      return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
    }
  };
  var ZodLazy = _ZodLazy;
  ZodLazy.create = (getter, params) => {
    return new _ZodLazy({
      getter,
      typeName: ZodFirstPartyTypeKind.ZodLazy,
      ...processCreateParams(params)
    });
  };
  var _ZodLiteral = class extends ZodType {
    _parse(input) {
      if (input.data !== this._def.value) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_literal,
          expected: this._def.value
        });
        return INVALID;
      }
      return { status: "valid", value: input.data };
    }
    get value() {
      return this._def.value;
    }
  };
  var ZodLiteral = _ZodLiteral;
  ZodLiteral.create = (value, params) => {
    return new _ZodLiteral({
      value,
      typeName: ZodFirstPartyTypeKind.ZodLiteral,
      ...processCreateParams(params)
    });
  };
  function createZodEnum(values, params) {
    return new ZodEnum({
      values,
      typeName: ZodFirstPartyTypeKind.ZodEnum,
      ...processCreateParams(params)
    });
  }
  var ZodEnum = class extends ZodType {
    _parse(input) {
      if (typeof input.data !== "string") {
        const ctx = this._getOrReturnCtx(input);
        const expectedValues = this._def.values;
        addIssueToContext(ctx, {
          expected: util.joinValues(expectedValues),
          received: ctx.parsedType,
          code: ZodIssueCode.invalid_type
        });
        return INVALID;
      }
      if (this._def.values.indexOf(input.data) === -1) {
        const ctx = this._getOrReturnCtx(input);
        const expectedValues = this._def.values;
        addIssueToContext(ctx, {
          received: ctx.data,
          code: ZodIssueCode.invalid_enum_value,
          options: expectedValues
        });
        return INVALID;
      }
      return OK(input.data);
    }
    get options() {
      return this._def.values;
    }
    get enum() {
      const enumValues = {};
      for (const val of this._def.values) {
        enumValues[val] = val;
      }
      return enumValues;
    }
    get Values() {
      const enumValues = {};
      for (const val of this._def.values) {
        enumValues[val] = val;
      }
      return enumValues;
    }
    get Enum() {
      const enumValues = {};
      for (const val of this._def.values) {
        enumValues[val] = val;
      }
      return enumValues;
    }
  };
  ZodEnum.create = createZodEnum;
  var _ZodNativeEnum = class extends ZodType {
    _parse(input) {
      const nativeEnumValues = util.getValidEnumValues(this._def.values);
      const ctx = this._getOrReturnCtx(input);
      if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
        const expectedValues = util.objectValues(nativeEnumValues);
        addIssueToContext(ctx, {
          expected: util.joinValues(expectedValues),
          received: ctx.parsedType,
          code: ZodIssueCode.invalid_type
        });
        return INVALID;
      }
      if (nativeEnumValues.indexOf(input.data) === -1) {
        const expectedValues = util.objectValues(nativeEnumValues);
        addIssueToContext(ctx, {
          received: ctx.data,
          code: ZodIssueCode.invalid_enum_value,
          options: expectedValues
        });
        return INVALID;
      }
      return OK(input.data);
    }
    get enum() {
      return this._def.values;
    }
  };
  var ZodNativeEnum = _ZodNativeEnum;
  ZodNativeEnum.create = (values, params) => {
    return new _ZodNativeEnum({
      values,
      typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
      ...processCreateParams(params)
    });
  };
  var _ZodPromise = class extends ZodType {
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.promise,
          received: ctx.parsedType
        });
        return INVALID;
      }
      const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
      return OK(
        promisified.then((data) => {
          return this._def.type.parseAsync(data, {
            path: ctx.path,
            errorMap: ctx.common.contextualErrorMap
          });
        })
      );
    }
  };
  var ZodPromise = _ZodPromise;
  ZodPromise.create = (schema, params) => {
    return new _ZodPromise({
      type: schema,
      typeName: ZodFirstPartyTypeKind.ZodPromise,
      ...processCreateParams(params)
    });
  };
  var _ZodEffects = class extends ZodType {
    innerType() {
      return this._def.schema;
    }
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      const effect = this._def.effect || null;
      if (effect.type === "preprocess") {
        const processed = effect.transform(ctx.data);
        if (ctx.common.async) {
          return Promise.resolve(processed).then((processed2) => {
            return this._def.schema._parseAsync({
              data: processed2,
              path: ctx.path,
              parent: ctx
            });
          });
        } else {
          return this._def.schema._parseSync({
            data: processed,
            path: ctx.path,
            parent: ctx
          });
        }
      }
      const checkCtx = {
        addIssue: (arg) => {
          addIssueToContext(ctx, arg);
          if (arg.fatal) {
            status.abort();
          } else {
            status.dirty();
          }
        },
        get path() {
          return ctx.path;
        }
      };
      checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
      if (effect.type === "refinement") {
        const executeRefinement = (acc) => {
          const result = effect.refinement(acc, checkCtx);
          if (ctx.common.async) {
            return Promise.resolve(result);
          }
          if (result instanceof Promise) {
            throw new Error(
              "Async refinement encountered during synchronous parse operation. Use .parseAsync instead."
            );
          }
          return acc;
        };
        if (ctx.common.async === false) {
          const inner = this._def.schema._parseSync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          });
          if (inner.status === "aborted")
            return INVALID;
          if (inner.status === "dirty")
            status.dirty();
          executeRefinement(inner.value);
          return { status: status.value, value: inner.value };
        } else {
          return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
            if (inner.status === "aborted")
              return INVALID;
            if (inner.status === "dirty")
              status.dirty();
            return executeRefinement(inner.value).then(() => {
              return { status: status.value, value: inner.value };
            });
          });
        }
      }
      if (effect.type === "transform") {
        if (ctx.common.async === false) {
          const base = this._def.schema._parseSync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          });
          if (!isValid(base))
            return base;
          const result = effect.transform(base.value, checkCtx);
          if (result instanceof Promise) {
            throw new Error(
              `Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`
            );
          }
          return { status: status.value, value: result };
        } else {
          return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
            if (!isValid(base))
              return base;
            return Promise.resolve(effect.transform(base.value, checkCtx)).then(
              (result) => ({ status: status.value, value: result })
            );
          });
        }
      }
      util.assertNever(effect);
    }
  };
  var ZodEffects = _ZodEffects;
  ZodEffects.create = (schema, effect, params) => {
    return new _ZodEffects({
      schema,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect,
      ...processCreateParams(params)
    });
  };
  ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
    return new _ZodEffects({
      schema,
      effect: { type: "preprocess", transform: preprocess },
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      ...processCreateParams(params)
    });
  };
  var _ZodOptional = class extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType === ZodParsedType.undefined) {
        return OK(void 0);
      }
      return this._def.innerType._parse(input);
    }
    unwrap() {
      return this._def.innerType;
    }
  };
  var ZodOptional = _ZodOptional;
  ZodOptional.create = (type, params) => {
    return new _ZodOptional({
      innerType: type,
      typeName: ZodFirstPartyTypeKind.ZodOptional,
      ...processCreateParams(params)
    });
  };
  var _ZodNullable = class extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType === ZodParsedType.null) {
        return OK(null);
      }
      return this._def.innerType._parse(input);
    }
    unwrap() {
      return this._def.innerType;
    }
  };
  var ZodNullable = _ZodNullable;
  ZodNullable.create = (type, params) => {
    return new _ZodNullable({
      innerType: type,
      typeName: ZodFirstPartyTypeKind.ZodNullable,
      ...processCreateParams(params)
    });
  };
  var ZodDefault = class extends ZodType {
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      let data = ctx.data;
      if (ctx.parsedType === ZodParsedType.undefined) {
        data = this._def.defaultValue();
      }
      return this._def.innerType._parse({
        data,
        path: ctx.path,
        parent: ctx
      });
    }
    removeDefault() {
      return this._def.innerType;
    }
  };
  ZodDefault.create = (type, params) => {
    return new ZodOptional({
      innerType: type,
      typeName: ZodFirstPartyTypeKind.ZodOptional,
      ...processCreateParams(params)
    });
  };
  var _ZodNaN = class extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.nan) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.nan,
          received: ctx.parsedType
        });
        return INVALID;
      }
      return { status: "valid", value: input.data };
    }
  };
  var ZodNaN = _ZodNaN;
  ZodNaN.create = (params) => {
    return new _ZodNaN({
      typeName: ZodFirstPartyTypeKind.ZodNaN,
      ...processCreateParams(params)
    });
  };
  var custom = (check, params = {}, fatal) => {
    if (check)
      return ZodAny.create().superRefine((data, ctx) => {
        if (!check(data)) {
          const p3 = typeof params === "function" ? params(data) : params;
          const p22 = typeof p3 === "string" ? { message: p3 } : p3;
          ctx.addIssue({ code: "custom", ...p22, fatal });
        }
      });
    return ZodAny.create();
  };
  var late = {
    object: ZodObject.lazycreate
  };
  var ZodFirstPartyTypeKind = /* @__PURE__ */ ((ZodFirstPartyTypeKind2) => {
    ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
    ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
    ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
    ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
    ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
    ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
    ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
    ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
    ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
    ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
    ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
    ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
    ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
    ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
    ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
    ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
    ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
    ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
    ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
    ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
    ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
    ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
    ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
    ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
    ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
    ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
    ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
    ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
    ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
    ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
    ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
    return ZodFirstPartyTypeKind2;
  })(ZodFirstPartyTypeKind || {});
  var instanceOfType = (cls, params = {
    message: `Input not instance of ${cls.name}`
  }) => custom((data) => data instanceof cls, params, true);
  var stringType = ZodString.create;
  var numberType = ZodNumber.create;
  var nanType = ZodNaN.create;
  var bigIntType = ZodBigInt.create;
  var booleanType = ZodBoolean.create;
  var dateType = ZodDate.create;
  var undefinedType = ZodUndefined.create;
  var nullType = ZodNull.create;
  var anyType = ZodAny.create;
  var unknownType = ZodUnknown.create;
  var neverType = ZodNever.create;
  var voidType = ZodVoid.create;
  var arrayType = ZodArray.create;
  var objectType = ZodObject.create;
  var strictObjectType = ZodObject.strictCreate;
  var unionType = ZodUnion.create;
  var discriminatedUnionType = ZodDiscriminatedUnion.create;
  var intersectionType = ZodIntersection.create;
  var tupleType = ZodTuple.create;
  var recordType = ZodRecord.create;
  var mapType = ZodMap.create;
  var setType = ZodSet.create;
  var functionType = ZodFunction.create;
  var lazyType = ZodLazy.create;
  var literalType = ZodLiteral.create;
  var enumType = ZodEnum.create;
  var nativeEnumType = ZodNativeEnum.create;
  var promiseType = ZodPromise.create;
  var effectsType = ZodEffects.create;
  var optionalType = ZodOptional.create;
  var nullableType = ZodNullable.create;
  var preprocessType = ZodEffects.createWithPreprocess;
  var ostring = () => stringType().optional();
  var onumber = () => numberType().optional();
  var oboolean = () => booleanType().optional();

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
    ZodBigInt: () => K2,
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
    var a2 = (d3) => {
      try {
        o2(t.next(d3));
      } catch (l2) {
        n(l2);
      }
    }, i = (d3) => {
      try {
        o2(t.throw(d3));
      } catch (l2) {
        n(l2);
      }
    }, o2 = (d3) => d3.done ? s2(d3.value) : Promise.resolve(d3.value).then(a2, i);
    o2((t = t.apply(r, e)).next());
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
      let a2 = {};
      for (let i of n)
        a2[i] = i;
      return a2;
    }, r.getValidEnumValues = (n) => {
      let a2 = r.objectKeys(n).filter((o2) => typeof n[n[o2]] != "number"), i = {};
      for (let o2 of a2)
        i[o2] = n[o2];
      return r.objectValues(i);
    }, r.objectValues = (n) => r.objectKeys(n).map(function(a2) {
      return n[a2];
    }), r.objectKeys = typeof Object.keys == "function" ? (n) => Object.keys(n) : (n) => {
      let a2 = [];
      for (let i in n)
        Object.prototype.hasOwnProperty.call(n, i) && a2.push(i);
      return a2;
    }, r.find = (n, a2) => {
      for (let i of n)
        if (a2(i))
          return i;
    }, r.isInteger = typeof Number.isInteger == "function" ? (n) => Number.isInteger(n) : (n) => typeof n == "number" && isFinite(n) && Math.floor(n) === n;
    function s2(n, a2 = " | ") {
      return n.map((i) => typeof i == "string" ? `'${i}'` : i).join(a2);
    }
    r.joinValues = s2, r.jsonStringifyReplacer = (n, a2) => typeof a2 == "bigint" ? a2.toString() : a2;
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
      let t = e || function(a2) {
        return a2.message;
      }, s2 = { _errors: [] }, n = (a2) => {
        for (let i of a2.issues)
          if (i.code === "invalid_union")
            i.unionErrors.map(n);
          else if (i.code === "invalid_return_type")
            n(i.returnTypeError);
          else if (i.code === "invalid_arguments")
            n(i.argumentsError);
          else if (i.path.length === 0)
            s2._errors.push(t(i));
          else {
            let o2 = s2, d3 = 0;
            for (; d3 < i.path.length; ) {
              let l2 = i.path[d3];
              d3 === i.path.length - 1 ? (o2[l2] = o2[l2] || { _errors: [] }, o2[l2]._errors.push(t(i))) : o2[l2] = o2[l2] || { _errors: [] }, o2 = o2[l2], d3++;
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
    let { data: e, path: t, errorMaps: s2, issueData: n } = r, a2 = [...t, ...n.path || []], i = g(c({}, n), { path: a2 }), o2 = "", d3 = s2.filter((l2) => !!l2).slice().reverse();
    for (let l2 of d3)
      o2 = l2(i, { data: e, defaultError: o2 }).message;
    return g(c({}, n), { path: a2, message: n.message || o2 });
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
        let { key: a2, value: i } = n;
        if (a2.status === "aborted" || i.status === "aborted")
          return m;
        a2.status === "dirty" && e.dirty(), i.status === "dirty" && e.dirty(), (typeof i.value != "undefined" || n.alwaysSet) && (s2[a2.value] = i.value);
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
    return e ? { errorMap: e, description: n } : { errorMap: (i, o2) => i.code !== "invalid_type" ? { message: o2.defaultError } : typeof o2.data == "undefined" ? { message: s2 != null ? s2 : o2.defaultError } : { message: t != null ? t : o2.defaultError }, description: n };
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
      let n = { common: { issues: [], async: (s2 = t == null ? void 0 : t.async) !== null && s2 !== void 0 ? s2 : false, contextualErrorMap: t == null ? void 0 : t.errorMap }, path: (t == null ? void 0 : t.path) || [], schemaErrorMap: this._def.errorMap, parent: null, data: e, parsedType: z(e) }, a2 = this._parseSync({ data: e, path: n.path, parent: n });
      return xe(n, a2);
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
        let s2 = { common: { issues: [], contextualErrorMap: t == null ? void 0 : t.errorMap, async: true }, path: (t == null ? void 0 : t.path) || [], schemaErrorMap: this._def.errorMap, parent: null, data: e, parsedType: z(e) }, n = this._parse({ data: e, path: [], parent: s2 }), a2 = yield ye(n) ? n : Promise.resolve(n);
        return xe(s2, a2);
      });
    }
    refine(e, t) {
      let s2 = (n) => typeof t == "string" || typeof t == "undefined" ? { message: t } : typeof t == "function" ? t(n) : t;
      return this._refinement((n, a2) => {
        let i = e(n), o2 = () => a2.addIssue(c({ code: u.custom }, s2(n)));
        return typeof Promise != "undefined" && i instanceof Promise ? i.then((d3) => d3 ? true : (o2(), false)) : i ? true : (o2(), false);
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
        let a2 = this._getOrReturnCtx(e);
        return h(a2, { code: u.invalid_type, expected: p.string, received: a2.parsedType }), m;
      }
      let s2 = new k(), n;
      for (let a2 of this._def.checks)
        if (a2.kind === "min")
          e.data.length < a2.value && (n = this._getOrReturnCtx(e, n), h(n, { code: u.too_small, minimum: a2.value, type: "string", inclusive: true, message: a2.message }), s2.dirty());
        else if (a2.kind === "max")
          e.data.length > a2.value && (n = this._getOrReturnCtx(e, n), h(n, { code: u.too_big, maximum: a2.value, type: "string", inclusive: true, message: a2.message }), s2.dirty());
        else if (a2.kind === "email")
          $e.test(e.data) || (n = this._getOrReturnCtx(e, n), h(n, { validation: "email", code: u.invalid_string, message: a2.message }), s2.dirty());
        else if (a2.kind === "uuid")
          De.test(e.data) || (n = this._getOrReturnCtx(e, n), h(n, { validation: "uuid", code: u.invalid_string, message: a2.message }), s2.dirty());
        else if (a2.kind === "cuid")
          ze.test(e.data) || (n = this._getOrReturnCtx(e, n), h(n, { validation: "cuid", code: u.invalid_string, message: a2.message }), s2.dirty());
        else if (a2.kind === "url")
          try {
            new URL(e.data);
          } catch (i) {
            n = this._getOrReturnCtx(e, n), h(n, { validation: "url", code: u.invalid_string, message: a2.message }), s2.dirty();
          }
        else
          a2.kind === "regex" ? (a2.regex.lastIndex = 0, a2.regex.test(e.data) || (n = this._getOrReturnCtx(e, n), h(n, { validation: "regex", code: u.invalid_string, message: a2.message }), s2.dirty())) : a2.kind === "trim" ? e.data = e.data.trim() : a2.kind === "startsWith" ? e.data.startsWith(a2.value) || (n = this._getOrReturnCtx(e, n), h(n, { code: u.invalid_string, validation: { startsWith: a2.value }, message: a2.message }), s2.dirty()) : a2.kind === "endsWith" ? e.data.endsWith(a2.value) || (n = this._getOrReturnCtx(e, n), h(n, { code: u.invalid_string, validation: { endsWith: a2.value }, message: a2.message }), s2.dirty()) : b.assertNever(a2);
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
    let t = (r.toString().split(".")[1] || "").length, s2 = (e.toString().split(".")[1] || "").length, n = t > s2 ? t : s2, a2 = parseInt(r.toFixed(n).replace(".", "")), i = parseInt(e.toFixed(n).replace(".", ""));
    return a2 % i / Math.pow(10, n);
  }
  var A = class extends v {
    constructor() {
      super(...arguments), this.min = this.gte, this.max = this.lte, this.step = this.multipleOf;
    }
    _parse(e) {
      if (this._getType(e) !== p.number) {
        let a2 = this._getOrReturnCtx(e);
        return h(a2, { code: u.invalid_type, expected: p.number, received: a2.parsedType }), m;
      }
      let s2, n = new k();
      for (let a2 of this._def.checks)
        a2.kind === "int" ? b.isInteger(e.data) || (s2 = this._getOrReturnCtx(e, s2), h(s2, { code: u.invalid_type, expected: "integer", received: "float", message: a2.message }), n.dirty()) : a2.kind === "min" ? (a2.inclusive ? e.data < a2.value : e.data <= a2.value) && (s2 = this._getOrReturnCtx(e, s2), h(s2, { code: u.too_small, minimum: a2.value, type: "number", inclusive: a2.inclusive, message: a2.message }), n.dirty()) : a2.kind === "max" ? (a2.inclusive ? e.data > a2.value : e.data >= a2.value) && (s2 = this._getOrReturnCtx(e, s2), h(s2, { code: u.too_big, maximum: a2.value, type: "number", inclusive: a2.inclusive, message: a2.message }), n.dirty()) : a2.kind === "multipleOf" ? Le(e.data, a2.value) !== 0 && (s2 = this._getOrReturnCtx(e, s2), h(s2, { code: u.not_multiple_of, multipleOf: a2.value, message: a2.message }), n.dirty()) : b.assertNever(a2);
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
  var K2 = class extends v {
    _parse(e) {
      if (this._getType(e) !== p.bigint) {
        let s2 = this._getOrReturnCtx(e);
        return h(s2, { code: u.invalid_type, expected: p.bigint, received: s2.parsedType }), m;
      }
      return T(e.data);
    }
  };
  K2.create = (r) => new K2(c({ typeName: f.ZodBigInt }, _(r)));
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
        let a2 = this._getOrReturnCtx(e);
        return h(a2, { code: u.invalid_type, expected: p.date, received: a2.parsedType }), m;
      }
      if (isNaN(e.data.getTime())) {
        let a2 = this._getOrReturnCtx(e);
        return h(a2, { code: u.invalid_date }), m;
      }
      let s2 = new k(), n;
      for (let a2 of this._def.checks)
        a2.kind === "min" ? e.data.getTime() < a2.value && (n = this._getOrReturnCtx(e, n), h(n, { code: u.too_small, message: a2.message, inclusive: true, minimum: a2.value, type: "date" }), s2.dirty()) : a2.kind === "max" ? e.data.getTime() > a2.value && (n = this._getOrReturnCtx(e, n), h(n, { code: u.too_big, message: a2.message, inclusive: true, maximum: a2.value, type: "date" }), s2.dirty()) : b.assertNever(a2);
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
        return Promise.all(t.data.map((i, o2) => n.type._parseAsync(new E(t, i, t.path, o2)))).then((i) => k.mergeArray(s2, i));
      let a2 = t.data.map((i, o2) => n.type._parseSync(new E(t, i, t.path, o2)));
      return k.mergeArray(s2, a2);
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
        let l2 = this._getOrReturnCtx(e);
        return h(l2, { code: u.invalid_type, expected: p.object, received: l2.parsedType }), m;
      }
      let { status: s2, ctx: n } = this._processInputParams(e), { shape: a2, keys: i } = this._getCached(), o2 = [];
      if (!(this._def.catchall instanceof C && this._def.unknownKeys === "strip"))
        for (let l2 in n.data)
          i.includes(l2) || o2.push(l2);
      let d3 = [];
      for (let l2 of i) {
        let y2 = a2[l2], J = n.data[l2];
        d3.push({ key: { status: "valid", value: l2 }, value: y2._parse(new E(n, J, n.path, l2)), alwaysSet: l2 in n.data });
      }
      if (this._def.catchall instanceof C) {
        let l2 = this._def.unknownKeys;
        if (l2 === "passthrough")
          for (let y2 of o2)
            d3.push({ key: { status: "valid", value: y2 }, value: { status: "valid", value: n.data[y2] } });
        else if (l2 === "strict")
          o2.length > 0 && (h(n, { code: u.unrecognized_keys, keys: o2 }), s2.dirty());
        else if (l2 !== "strip")
          throw new Error("Internal ZodObject error: invalid unknownKeys value.");
      } else {
        let l2 = this._def.catchall;
        for (let y2 of o2) {
          let J = n.data[y2];
          d3.push({ key: { status: "valid", value: y2 }, value: l2._parse(new E(n, J, n.path, y2)), alwaysSet: y2 in n.data });
        }
      }
      return n.common.async ? Promise.resolve().then(() => P(this, null, function* () {
        let l2 = [];
        for (let y2 of d3) {
          let J = yield y2.key;
          l2.push({ key: J, value: yield y2.value, alwaysSet: y2.alwaysSet });
        }
        return l2;
      })).then((l2) => k.mergeObjectSync(s2, l2)) : k.mergeObjectSync(s2, d3);
    }
    get shape() {
      return this._def.shape();
    }
    strict(e) {
      return x.errToObj, new w(c(g(c({}, this._def), { unknownKeys: "strict" }), e !== void 0 ? { errorMap: (t, s2) => {
        var n, a2, i, o2;
        let d3 = (i = (a2 = (n = this._def).errorMap) === null || a2 === void 0 ? void 0 : a2.call(n, t, s2).message) !== null && i !== void 0 ? i : s2.defaultError;
        return t.code === "unrecognized_keys" ? { message: (o2 = x.errToObj(e).message) !== null && o2 !== void 0 ? o2 : d3 } : { message: d3 };
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
      function n(a2) {
        for (let o2 of a2)
          if (o2.result.status === "valid")
            return o2.result;
        for (let o2 of a2)
          if (o2.result.status === "dirty")
            return t.common.issues.push(...o2.ctx.common.issues), o2.result;
        let i = a2.map((o2) => new j(o2.ctx.common.issues));
        return h(t, { code: u.invalid_union, unionErrors: i }), m;
      }
      if (t.common.async)
        return Promise.all(s2.map((a2) => P(this, null, function* () {
          let i = g(c({}, t), { common: g(c({}, t.common), { issues: [] }), parent: null });
          return { result: yield a2._parseAsync({ data: t.data, path: t.path, parent: i }), ctx: i };
        }))).then(n);
      {
        let a2, i = [];
        for (let d3 of s2) {
          let l2 = g(c({}, t), { common: g(c({}, t.common), { issues: [] }), parent: null }), y2 = d3._parseSync({ data: t.data, path: t.path, parent: l2 });
          if (y2.status === "valid")
            return y2;
          y2.status === "dirty" && !a2 && (a2 = { result: y2, ctx: l2 }), l2.common.issues.length && i.push(l2.common.issues);
        }
        if (a2)
          return t.common.issues.push(...a2.ctx.common.issues), a2.result;
        let o2 = i.map((d3) => new j(d3));
        return h(t, { code: u.invalid_union, unionErrors: o2 }), m;
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
      let s2 = this.discriminator, n = t.data[s2], a2 = this.options.get(n);
      return a2 ? t.common.async ? a2._parseAsync({ data: t.data, path: t.path, parent: t }) : a2._parseSync({ data: t.data, path: t.path, parent: t }) : (h(t, { code: u.invalid_union_discriminator, options: this.validDiscriminatorValues, path: [s2] }), m);
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
        t.forEach((a2) => {
          let i = a2.shape[e].value;
          n.set(i, a2);
        });
      } catch (a2) {
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
      let n = b.objectKeys(e), a2 = b.objectKeys(r).filter((o2) => n.indexOf(o2) !== -1), i = c(c({}, r), e);
      for (let o2 of a2) {
        let d3 = ve(r[o2], e[o2]);
        if (!d3.valid)
          return { valid: false };
        i[o2] = d3.data;
      }
      return { valid: true, data: i };
    } else if (t === p.array && s2 === p.array) {
      if (r.length !== e.length)
        return { valid: false };
      let n = [];
      for (let a2 = 0; a2 < r.length; a2++) {
        let i = r[a2], o2 = e[a2], d3 = ve(i, o2);
        if (!d3.valid)
          return { valid: false };
        n.push(d3.data);
      }
      return { valid: true, data: n };
    } else
      return t === p.date && s2 === p.date && +r == +e ? { valid: true, data: r } : { valid: false };
  }
  var B = class extends v {
    _parse(e) {
      let { status: t, ctx: s2 } = this._processInputParams(e), n = (a2, i) => {
        if (fe(a2) || fe(i))
          return m;
        let o2 = ve(a2.value, i.value);
        return o2.valid ? ((me(a2) || me(i)) && t.dirty(), { status: t.value, value: o2.data }) : (h(s2, { code: u.invalid_intersection_types }), m);
      };
      return s2.common.async ? Promise.all([this._def.left._parseAsync({ data: s2.data, path: s2.path, parent: s2 }), this._def.right._parseAsync({ data: s2.data, path: s2.path, parent: s2 })]).then(([a2, i]) => n(a2, i)) : n(this._def.left._parseSync({ data: s2.data, path: s2.path, parent: s2 }), this._def.right._parseSync({ data: s2.data, path: s2.path, parent: s2 }));
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
      let a2 = s2.data.map((i, o2) => {
        let d3 = this._def.items[o2] || this._def.rest;
        return d3 ? d3._parse(new E(s2, i, s2.path, o2)) : null;
      }).filter((i) => !!i);
      return s2.common.async ? Promise.all(a2).then((i) => k.mergeArray(t, i)) : k.mergeArray(t, a2);
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
      let n = [], a2 = this._def.keyType, i = this._def.valueType;
      for (let o2 in s2.data)
        n.push({ key: a2._parse(new E(s2, o2, s2.path, o2)), value: i._parse(new E(s2, s2.data[o2], s2.path, o2)) });
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
      let n = this._def.keyType, a2 = this._def.valueType, i = [...s2.data.entries()].map(([o2, d3], l2) => ({ key: n._parse(new E(s2, o2, s2.path, [l2, "key"])), value: a2._parse(new E(s2, d3, s2.path, [l2, "value"])) }));
      if (s2.common.async) {
        let o2 = /* @__PURE__ */ new Map();
        return Promise.resolve().then(() => P(this, null, function* () {
          for (let d3 of i) {
            let l2 = yield d3.key, y2 = yield d3.value;
            if (l2.status === "aborted" || y2.status === "aborted")
              return m;
            (l2.status === "dirty" || y2.status === "dirty") && t.dirty(), o2.set(l2.value, y2.value);
          }
          return { status: t.value, value: o2 };
        }));
      } else {
        let o2 = /* @__PURE__ */ new Map();
        for (let d3 of i) {
          let l2 = d3.key, y2 = d3.value;
          if (l2.status === "aborted" || y2.status === "aborted")
            return m;
          (l2.status === "dirty" || y2.status === "dirty") && t.dirty(), o2.set(l2.value, y2.value);
        }
        return { status: t.value, value: o2 };
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
      let a2 = this._def.valueType;
      function i(d3) {
        let l2 = /* @__PURE__ */ new Set();
        for (let y2 of d3) {
          if (y2.status === "aborted")
            return m;
          y2.status === "dirty" && t.dirty(), l2.add(y2.value);
        }
        return { status: t.value, value: l2 };
      }
      let o2 = [...s2.data.values()].map((d3, l2) => a2._parse(new E(s2, d3, s2.path, l2)));
      return s2.common.async ? Promise.all(o2).then((d3) => i(d3)) : i(o2);
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
      function s2(o2, d3) {
        return ue({ data: o2, path: t.path, errorMaps: [t.common.contextualErrorMap, t.schemaErrorMap, ce(), ie].filter((l2) => !!l2), issueData: { code: u.invalid_arguments, argumentsError: d3 } });
      }
      function n(o2, d3) {
        return ue({ data: o2, path: t.path, errorMaps: [t.common.contextualErrorMap, t.schemaErrorMap, ce(), ie].filter((l2) => !!l2), issueData: { code: u.invalid_return_type, returnTypeError: d3 } });
      }
      let a2 = { errorMap: t.common.contextualErrorMap }, i = t.data;
      return this._def.returns instanceof U ? T((...o2) => P(this, null, function* () {
        let d3 = new j([]), l2 = yield this._def.args.parseAsync(o2, a2).catch((he) => {
          throw d3.addIssue(s2(o2, he)), d3;
        }), y2 = yield i(...l2);
        return yield this._def.returns._def.type.parseAsync(y2, a2).catch((he) => {
          throw d3.addIssue(n(y2, he)), d3;
        });
      })) : T((...o2) => {
        let d3 = this._def.args.safeParse(o2, a2);
        if (!d3.success)
          throw new j([s2(o2, d3.error)]);
        let l2 = i(...d3.data), y2 = this._def.returns.safeParse(l2, a2);
        if (!y2.success)
          throw new j([n(l2, y2.error)]);
        return y2.data;
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
        return s2.common.async ? Promise.resolve(i).then((o2) => this._def.schema._parseAsync({ data: o2, path: s2.path, parent: s2 })) : this._def.schema._parseSync({ data: i, path: s2.path, parent: s2 });
      }
      let a2 = { addIssue: (i) => {
        h(s2, i), i.fatal ? t.abort() : t.dirty();
      }, get path() {
        return s2.path;
      } };
      if (a2.addIssue = a2.addIssue.bind(a2), n.type === "refinement") {
        let i = (o2) => {
          let d3 = n.refinement(o2, a2);
          if (s2.common.async)
            return Promise.resolve(d3);
          if (d3 instanceof Promise)
            throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
          return o2;
        };
        if (s2.common.async === false) {
          let o2 = this._def.schema._parseSync({ data: s2.data, path: s2.path, parent: s2 });
          return o2.status === "aborted" ? m : (o2.status === "dirty" && t.dirty(), i(o2.value), { status: t.value, value: o2.value });
        } else
          return this._def.schema._parseAsync({ data: s2.data, path: s2.path, parent: s2 }).then((o2) => o2.status === "aborted" ? m : (o2.status === "dirty" && t.dirty(), i(o2.value).then(() => ({ status: t.value, value: o2.value }))));
      }
      if (n.type === "transform")
        if (s2.common.async === false) {
          let i = this._def.schema._parseSync({ data: s2.data, path: s2.path, parent: s2 });
          if (!de(i))
            return i;
          let o2 = n.transform(i.value, a2);
          if (o2 instanceof Promise)
            throw new Error("Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.");
          return { status: t.value, value: o2 };
        } else
          return this._def.schema._parseAsync({ data: s2.data, path: s2.path, parent: s2 }).then((i) => de(i) ? Promise.resolve(n.transform(i.value, a2)).then((o2) => ({ status: t.value, value: o2 })) : i);
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
      let a2 = typeof e == "function" ? e(s2) : e, i = typeof a2 == "string" ? { message: a2 } : a2;
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
  var Je = K2.create;
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
  var Tt = Object.freeze({ __proto__: null, getParsedType: z, ZodParsedType: p, defaultErrorMap: ie, setErrorMap: Me, getErrorMap: ce, makeIssue: ue, EMPTY_PATH: Ve, addIssueToContext: h, ParseStatus: k, INVALID: m, DIRTY: Pe, OK: T, isAborted: fe, isDirty: me, isValid: de, isAsync: ye, ZodType: v, ZodString: R, ZodNumber: A, ZodBigInt: K2, ZodBoolean: H, ZodDate: $, ZodUndefined: G, ZodNull: Q, ZodAny: L, ZodUnknown: Z, ZodNever: C, ZodVoid: X, ZodArray: O, get objectUtil() {
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
  var le2 = s((g3) => {
    "use strict";
    Object.defineProperty(g3, "__esModule", { value: true });
    g3.parseAnyDef = void 0;
    function nt2() {
      return {};
    }
    g3.parseAnyDef = nt2;
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
  var ye2 = s((b3) => {
    "use strict";
    Object.defineProperty(b3, "__esModule", { value: true });
    b3.parseBigintDef = void 0;
    function ut2() {
      return { type: "integer", format: "int64" };
    }
    b3.parseBigintDef = ut2;
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
  var De2 = s((O3) => {
    "use strict";
    Object.defineProperty(O3, "__esModule", { value: true });
    O3.parseEffectsDef = void 0;
    var lt2 = d();
    function ft2(e, t) {
      return t.effectStrategy === "input" ? (0, lt2.parseDef)(e.schema._def, t) : {};
    }
    O3.parseEffectsDef = ft2;
  });
  var ge2 = s((j3) => {
    "use strict";
    Object.defineProperty(j3, "__esModule", { value: true });
    j3.parseEnumDef = void 0;
    function yt2(e) {
      return { type: "string", enum: e.values };
    }
    j3.parseEnumDef = yt2;
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
  var re2 = s((p3) => {
    "use strict";
    Object.defineProperty(p3, "__esModule", { value: true });
    p3.parseUnionDef = p3.primitiveMappings = void 0;
    var bt2 = d();
    p3.primitiveMappings = { ZodString: "string", ZodNumber: "number", ZodBigInt: "integer", ZodBoolean: "boolean", ZodNull: "null" };
    function Pt(e, t) {
      if (t.target === "openApi3")
        return qe2(e, t);
      let r = e.options instanceof Map ? Array.from(e.options.values()) : e.options;
      if (r.every((n) => n._def.typeName in p3.primitiveMappings && (!n._def.checks || !n._def.checks.length))) {
        let n = r.reduce((i, u3) => {
          let o2 = p3.primitiveMappings[u3._def.typeName];
          return o2 && !i.includes(o2) ? [...i, o2] : i;
        }, []);
        return { type: n.length > 1 ? n : n[0] };
      } else if (r.every((n) => n._def.typeName === "ZodLiteral")) {
        let n = r.reduce((i, u3) => {
          let o2 = typeof u3._def.value;
          switch (o2) {
            case "string":
            case "number":
            case "boolean":
              return [...i, o2];
            case "bigint":
              return [...i, "integer"];
            case "object":
              if (u3._def.value === null)
                return [...i, "null"];
            case "symbol":
            case "undefined":
            case "function":
            default:
              return i;
          }
        }, []);
        if (n.length === r.length) {
          let i = n.filter((u3, o2, c3) => c3.indexOf(u3) === o2);
          return { type: i.length > 1 ? i : i[0], enum: r.reduce((u3, o2) => u3.includes(o2._def.value) ? u3 : [...u3, o2._def.value], []) };
        }
      } else if (r.every((n) => n._def.typeName === "ZodEnum"))
        return { type: "string", enum: r.reduce((n, i) => [...n, ...i._def.values.filter((u3) => !n.includes(u3))], []) };
      return qe2(e, t);
    }
    p3.parseUnionDef = Pt;
    var qe2 = (e, t) => {
      let r = (e.options instanceof Map ? Array.from(e.options.values()) : e.options).map((n, i) => (0, bt2.parseDef)(n._def, t.addToPath("anyOf", i.toString()))).filter((n) => !!n);
      return r.length ? { anyOf: r } : void 0;
    };
  });
  var Ne2 = s((K3) => {
    "use strict";
    Object.defineProperty(K3, "__esModule", { value: true });
    K3.parseNullableDef = void 0;
    var Tt2 = d(), Me2 = re2();
    function Zt(e, t) {
      if (["ZodString", "ZodNumber", "ZodBigInt", "ZodBoolean", "ZodNull"].includes(e.innerType._def.typeName) && (!e.innerType._def.checks || !e.innerType._def.checks.length))
        return t.target === "openApi3" ? { type: Me2.primitiveMappings[e.innerType._def.typeName], nullable: true } : { type: [Me2.primitiveMappings[e.innerType._def.typeName], "null"] };
      let r = (0, Tt2.parseDef)(e.innerType._def, t.addToPath("anyOf", "0"));
      return r ? t.target === "openApi3" ? Object.assign(Object.assign({}, r), { nullable: true }) : { anyOf: [r, { type: "null" }] } : void 0;
    }
    K3.parseNullableDef = Zt;
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
  var Ke2 = s((A3) => {
    "use strict";
    Object.defineProperty(A3, "__esModule", { value: true });
    A3.parseObjectDef = void 0;
    var Fe2 = d();
    function jt(e, t) {
      var r;
      let n = Object.assign(Object.assign({ type: "object" }, Object.entries(e.shape()).reduce((i, [u3, o2]) => {
        if (o2 === void 0 || o2._def === void 0)
          return i;
        let c3 = (0, Fe2.parseDef)(o2._def, t.addToPathAsProperty("properties", u3));
        return c3 === void 0 ? i : { properties: Object.assign(Object.assign({}, i.properties), { [u3]: c3 }), required: o2.isOptional() ? i.required : [...i.required, u3] };
      }, { properties: {}, required: [] })), { additionalProperties: e.catchall._def.typeName === "ZodNever" ? e.unknownKeys === "passthrough" : (r = (0, Fe2.parseDef)(e.catchall._def, t.addToPath("additionalProperties"))) !== null && r !== void 0 ? r : true });
      return n.required.length || delete n.required, n;
    }
    A3.parseObjectDef = jt;
  });
  var $e2 = s((w3) => {
    "use strict";
    Object.defineProperty(w3, "__esModule", { value: true });
    w3.parsePromiseDef = void 0;
    var St = d();
    function qt(e, t) {
      return (0, St.parseDef)(e.type._def, t);
    }
    w3.parsePromiseDef = qt;
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
      let u3 = { type: "object", additionalProperties: (0, Nt.parseDef)(e.valueType._def, t.addToPath("additionalProperties")) || {} };
      if (((r = e.keyType) === null || r === void 0 ? void 0 : r._def.typeName) === Ae2.ZodFirstPartyTypeKind.ZodString && ((n = e.keyType._def.checks) === null || n === void 0 ? void 0 : n.length)) {
        let o2 = Object.entries((0, kt.parseStringDef)(e.keyType._def)).reduce((c3, [l2, _2]) => l2 === "type" ? c3 : Object.assign(Object.assign({}, c3), { [l2]: _2 }), {});
        return Object.assign(Object.assign({}, u3), { propertyNames: o2 });
      } else if (((i = e.keyType) === null || i === void 0 ? void 0 : i._def.typeName) === Ae2.ZodFirstPartyTypeKind.ZodEnum)
        return Object.assign(Object.assign({}, u3), { propertyNames: { enum: e.keyType._def.values } });
      return u3;
    }
    x2.parseRecordDef = Ft;
  });
  var Ie2 = s((E3) => {
    "use strict";
    Object.defineProperty(E3, "__esModule", { value: true });
    E3.parseSetDef = void 0;
    var Kt = d();
    function $t(e, t) {
      let r = (0, Kt.parseDef)(e.valueType._def, t.addToPath("items")), n = { type: "array", items: r };
      return e.minSize && (n.minItems = e.minSize.value), e.maxSize && (n.maxItems = e.maxSize.value), n;
    }
    E3.parseSetDef = $t;
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
    var a2 = __zod$, xt2 = pe2(), Et = le2(), zt = fe2(), Ut = ye2(), Lt = me2(), Rt = _e2(), Bt = ve2(), Jt = De2(), Vt = ge2(), Ct = be2(), Gt = Pe2(), Ht = Ze2(), Qt = Oe2(), Wt = je2(), Xt = Se2(), Yt = Ne2(), er = ke2(), tr = Ke2(), rr = $e2(), nr = we2(), ir = Ie2(), ar = ne2(), sr = xe2(), ur = Ee2(), or = re2(), dr = ze2();
    function Ue2(e, t) {
      let r = t.items.find((u3) => Object.is(u3.def, e));
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
        case a2.ZodFirstPartyTypeKind.ZodString:
          return (0, ar.parseStringDef)(e);
        case a2.ZodFirstPartyTypeKind.ZodNumber:
          return (0, er.parseNumberDef)(e, r);
        case a2.ZodFirstPartyTypeKind.ZodObject:
          return (0, tr.parseObjectDef)(e, r);
        case a2.ZodFirstPartyTypeKind.ZodBigInt:
          return (0, Ut.parseBigintDef)();
        case a2.ZodFirstPartyTypeKind.ZodBoolean:
          return (0, Lt.parseBooleanDef)();
        case a2.ZodFirstPartyTypeKind.ZodDate:
          return (0, Rt.parseDateDef)();
        case a2.ZodFirstPartyTypeKind.ZodUndefined:
          return (0, ur.parseUndefinedDef)();
        case a2.ZodFirstPartyTypeKind.ZodNull:
          return (0, Xt.parseNullDef)(r);
        case a2.ZodFirstPartyTypeKind.ZodArray:
          return (0, zt.parseArrayDef)(e, r);
        case a2.ZodFirstPartyTypeKind.ZodUnion:
        case a2.ZodFirstPartyTypeKind.ZodDiscriminatedUnion:
          return (0, or.parseUnionDef)(e, r);
        case a2.ZodFirstPartyTypeKind.ZodIntersection:
          return (0, Ct.parseIntersectionDef)(e, r);
        case a2.ZodFirstPartyTypeKind.ZodTuple:
          return (0, sr.parseTupleDef)(e, r);
        case a2.ZodFirstPartyTypeKind.ZodRecord:
          return (0, nr.parseRecordDef)(e, r);
        case a2.ZodFirstPartyTypeKind.ZodLiteral:
          return (0, Gt.parseLiteralDef)(e, r);
        case a2.ZodFirstPartyTypeKind.ZodEnum:
          return (0, Vt.parseEnumDef)(e);
        case a2.ZodFirstPartyTypeKind.ZodNativeEnum:
          return (0, Qt.parseNativeEnumDef)(e);
        case a2.ZodFirstPartyTypeKind.ZodNullable:
          return (0, Yt.parseNullableDef)(e, r);
        case a2.ZodFirstPartyTypeKind.ZodOptional:
          return (0, xt2.parseOptionalDef)(e, r);
        case a2.ZodFirstPartyTypeKind.ZodMap:
          return (0, Ht.parseMapDef)(e, r);
        case a2.ZodFirstPartyTypeKind.ZodSet:
          return (0, ir.parseSetDef)(e, r);
        case a2.ZodFirstPartyTypeKind.ZodLazy:
          return Ue2(e.getter()._def, r);
        case a2.ZodFirstPartyTypeKind.ZodPromise:
          return (0, rr.parsePromiseDef)(e, r);
        case a2.ZodFirstPartyTypeKind.ZodNaN:
        case a2.ZodFirstPartyTypeKind.ZodNever:
          return (0, Wt.parseNeverDef)();
        case a2.ZodFirstPartyTypeKind.ZodEffects:
          return (0, Jt.parseEffectsDef)(e, r);
        case a2.ZodFirstPartyTypeKind.ZodAny:
          return (0, Et.parseAnyDef)();
        case a2.ZodFirstPartyTypeKind.ZodUnknown:
          return (0, dr.parseUnknownDef)();
        case a2.ZodFirstPartyTypeKind.ZodDefault:
          return (0, Bt.parseDefaultDef)(e, r);
        case a2.ZodFirstPartyTypeKind.ZodFunction:
        case a2.ZodFirstPartyTypeKind.ZodVoid:
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
    var f3 = class {
      constructor(t = ["#"], r = [], n = "root", i = "input", u3 = "jsonSchema7", o2 = []) {
        this.currentPath = t, this.items = r, this.$refStrategy = n, this.effectStrategy = i, this.target = u3, this.propertyPath = o2;
      }
      addToPath(...t) {
        return new f3([...this.currentPath, ...t], this.items, this.$refStrategy, this.effectStrategy, this.target, this.propertyPath);
      }
      addToPathAsProperty(...t) {
        return new f3([...this.currentPath, ...t], this.items, this.$refStrategy, this.effectStrategy, this.target, [...this.currentPath, ...t]);
      }
    };
    B2.References = f3;
  });
  var Re2 = s((V2) => {
    "use strict";
    Object.defineProperty(V2, "__esModule", { value: true });
    V2.zodToJsonSchema = void 0;
    var y2 = d(), m3 = Le2(), J = "http://json-schema.org/draft-07/schema#";
    function yr(e, t) {
      var r, n, i, u3, o2, c3, l2, _2, C2, G2, H3, Q2, W2, X2, Y2, ee2;
      if (typeof t == "object")
        return t.name === void 0 ? t.target === "openApi3" ? (0, y2.parseDef)(e._def, new m3.References((r = t.basePath) !== null && r !== void 0 ? r : ["#"], [], (n = t.$refStrategy) !== null && n !== void 0 ? n : "root", t.effectStrategy, t.target)) : Object.assign({ $schema: J }, (0, y2.parseDef)(e._def, new m3.References((i = t.basePath) !== null && i !== void 0 ? i : ["#"], [], (u3 = t.$refStrategy) !== null && u3 !== void 0 ? u3 : "root", t.effectStrategy, t.target))) : t.target === "openApi3" ? { $ref: t.$refStrategy === "relative" ? `0/${(o2 = t.definitionPath) !== null && o2 !== void 0 ? o2 : "definitions"}/${t.name}` : `#/${(c3 = t.definitionPath) !== null && c3 !== void 0 ? c3 : "definitions"}/${t.name}`, [(l2 = t.definitionPath) !== null && l2 !== void 0 ? l2 : "definitions"]: { [t.name]: (0, y2.parseDef)(e._def, new m3.References([...(_2 = t.basePath) !== null && _2 !== void 0 ? _2 : ["#"], (C2 = t.definitionPath) !== null && C2 !== void 0 ? C2 : "definitions", t.name], [], (G2 = t.$refStrategy) !== null && G2 !== void 0 ? G2 : "root", t.effectStrategy, t.target)) || {} } } : { $schema: J, $ref: t.$refStrategy === "relative" ? `0/${(H3 = t.definitionPath) !== null && H3 !== void 0 ? H3 : "definitions"}/${t.name}` : `#/${(Q2 = t.definitionPath) !== null && Q2 !== void 0 ? Q2 : "definitions"}/${t.name}`, [(W2 = t.definitionPath) !== null && W2 !== void 0 ? W2 : "definitions"]: { [t.name]: (0, y2.parseDef)(e._def, new m3.References([...(X2 = t.basePath) !== null && X2 !== void 0 ? X2 : ["#"], (Y2 = t.definitionPath) !== null && Y2 !== void 0 ? Y2 : "definitions", t.name], [], (ee2 = t.$refStrategy) !== null && ee2 !== void 0 ? ee2 : "root", t.effectStrategy, t.target)) || {} } };
      if (typeof t == "string") {
        let ae2 = t;
        return { $schema: J, $ref: `#/definitions/${ae2}`, definitions: { [ae2]: (0, y2.parseDef)(e._def, new m3.References()) || {} } };
      } else
        return Object.assign({ $schema: J }, (0, y2.parseDef)(e._def, new m3.References()));
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

  // context.ts
  function isGenerator(fn) {
    return fn?.constructor?.name === "GeneratorFunction";
  }
  var InternalPristineContext = class {
    constructor(_pid) {
      this._pid = _pid;
      this._counter = 0;
      this._lastSuspension = void 0;
      this._frame = void 0;
      this.msgToSupply = void 0;
      this.promises = [];
      console.log("new context " + _pid);
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
    async run(fn) {
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
    call(fn, ...args) {
      console.log("Attempting to call fn " + typeof fn);
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
      console.log("in GetFunction " + JSON.stringify([namespace, fn]) + " my pid is " + this._pid);
      const ctx = this;
      if (namespace == "$.io" && fn === "number") {
        return external_exports.number;
      }
      if (namespace == "$.io" && fn === "string") {
        return external_exports.string;
      }
      if (namespace == "$.io" && fn === "boolean") {
        return (desc) => {
          return external_exports.boolean().describe(desc);
        };
      }
      if (fn === "io") {
        const obj = {
          ...external_exports,
          number(...args) {
            return {
              ...external_exports.number(...args),
              $from_apeiro_ctx: ["$.io", "number"]
            };
          },
          boolean({ desc }) {
            return {
              ...external_exports.boolean().describe(desc),
              $from_apeiro_ctx: ["$.io", "boolean"]
            };
          },
          string(...args) {
            return {
              ...external_exports.string(...args),
              $from_apeiro_ctx: ["$.io", "string"]
            };
          },
          input(arg) {
            return ctx.useUIInput(Hr(
              external_exports.object(arg),
              "$"
            ));
          },
          $from_apeiro_ctx: ["$", "io"]
        };
        return obj;
      }
      return function(...args) {
        if (fn === "inputUI" || fn === "inputRest") {
          return ctx.useUIInput(args[0]);
        } else if (fn == "recvEmail") {
          return ctx.useUIInput(args[0]).mail;
        } else if (fn === "recv") {
          return ctx.useUIInput(args[0]);
        } else if (fn == "sendEmail") {
          console.log("enqueueing email from " + ctx._pid);
          ctx.promises.push(sendEmail(ctx._pid, args[0], args[1], args[2]));
          return { $ext: "sendEmail" };
        } else {
          throw new Error("unknown function " + fn);
        }
      };
    }
  };
  async function step(pid, fn, serializedPreviousFrame, newMsg) {
    console.log("stepping " + pid);
    console.log(fn.toString());
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
    const encoder2 = new Encoder();
    return [
      encoder2.encode(nextFrame.serialize()),
      nextFrame.res,
      nextFrame.aw
    ];
  }
  async function sendEmail(pid, to, subject, body) {
    const ses = new ApiFactory2({
      region: "us-east-1",
      credentials: {
        awsAccessKeyId: "***REMOVED***",
        awsSecretKey: "***REMOVED***"
      }
    }).makeNew(SESV2);
    console.log(JSON.stringify({
      func: "send_email",
      pid,
      subject
    }));
    const res = await ses.sendEmail({
      FromEmailAddress: pid + "@test.apeiromont.com",
      Content: {
        Simple: {
          Body: {
            Text: {
              Data: body
            }
          },
          Subject: {
            Data: subject
          }
        }
      },
      Destination: {
        ToAddresses: [to]
      }
    });
    return res;
  }
  function importFunction(namespace, fn) {
    return [namespace, fn];
  }

  // headers.ts
  var p2 = /[^a-z0-9\-#$%&'*+.^_`|~]/i;
  function a(e) {
    if (typeof e != "string" && (e = String(e)), p2.test(e) || e.trim() === "")
      throw new TypeError("Invalid character in header field name");
    return e.toLowerCase();
  }
  function y(e) {
    return typeof e != "string" && (e = String(e)), e;
  }
  var o = Symbol("normalizedHeaders");
  var c2 = Symbol("rawHeaderNames");
  var u2;
  var d2;
  var l = class {
    constructor(e) {
      this[u2] = {}, this[d2] = /* @__PURE__ */ new Map(), [
        "Headers",
        "HeadersPolyfill"
      ].includes(e?.constructor.name) || e instanceof l ? e.forEach((t, s2) => {
        this.append(s2, t);
      }, this) : Array.isArray(e) ? e.forEach(([r, t]) => {
        this.append(r, Array.isArray(t) ? t.join(", ") : t);
      }) : e && Object.getOwnPropertyNames(e).forEach((r) => {
        let t = e[r];
        this.append(r, Array.isArray(t) ? t.join(", ") : t);
      });
    }
    [(u2 = o, d2 = c2, Symbol.iterator)]() {
      return this.entries();
    }
    *keys() {
      for (let e of Object.keys(this[o]))
        yield e;
    }
    *values() {
      for (let e of Object.values(this[o]))
        yield e;
    }
    *entries() {
      for (let e of Object.keys(this[o]))
        yield [
          e,
          this.get(e)
        ];
    }
    get(e) {
      return this[o][a(e)] || null;
    }
    set(e, r) {
      let t = a(e);
      this[o][t] = y(r), this[c2].set(t, e);
    }
    append(e, r) {
      let t = a(e), s2 = this.has(t) ? `${this.get(t)}, ${r}` : r;
      this.set(e, s2);
    }
    delete(e) {
      if (!this.has(e))
        return;
      let r = a(e);
      delete this[o][r], this[c2].delete(r);
    }
    all() {
      return this[o];
    }
    raw() {
      let e = {};
      for (let [r, t] of this.entries())
        e[this[c2].get(r)] = t;
      return e;
    }
    has(e) {
      return this[o].hasOwnProperty(a(e));
    }
    forEach(e, r) {
      for (let t in this[o])
        this[o].hasOwnProperty(t) && e.call(r, this[o][t], t, this);
    }
  };
  function H2(e) {
    let r = [];
    return e.forEach((t, s2) => {
      let n = t.includes(",") ? t.split(",").map((i) => i.trim()) : t;
      r.push([
        s2,
        n
      ]);
    }), r;
  }
  function E2(e) {
    return H2(e).map(([s2, n]) => {
      let i = [].concat(n);
      return `${s2}: ${i.join(", ")}`;
    }).join(`\r
`);
  }
  var m2 = [
    "user-agent"
  ];
  function j2(e) {
    let r = {};
    return e.forEach((t, s2) => {
      let n = !m2.includes(s2.toLowerCase()) && t.includes(",");
      r[s2] = n ? t.split(",").map((i) => i.trim()) : t;
    }), r;
  }
  function A2(e) {
    return e.trim().split(/[\r\n]+/).reduce((t, s2) => {
      if (s2.trim() === "")
        return t;
      let n = s2.split(": "), i = n.shift(), h2 = n.join(": ");
      return t.append(i, h2), t;
    }, new l());
  }
  function b2(e) {
    let r = new l();
    return e.forEach(([t, s2]) => {
      [].concat(s2).forEach((i) => {
        r.append(t, i);
      });
    }), r;
  }
  function f2(e, r, t) {
    return Object.keys(e).reduce((s2, n) => r(s2, n, e[n]), t);
  }
  function w2(e) {
    return f2(e, (r, t, s2) => ([].concat(s2).filter(Boolean).forEach((i) => {
      r.append(t, i);
    }), r), new l());
  }
  function g2(e) {
    return e.map(([r, t]) => [
      r,
      [].concat(t).join(", ")
    ]);
  }
  function O2(e) {
    return f2(e, (r, t, s2) => (r[t] = [].concat(s2).join(", "), r), {});
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
  var support = {
    searchParams: false,
    iterable: true,
    blob: false,
    formData: false,
    arrayBuffer: true
  };
  function isDataView(obj) {
    return obj && DataView.prototype.isPrototypeOf(obj);
  }
  if (support.arrayBuffer) {
    viewClasses = [
      "[object Int8Array]",
      "[object Uint8Array]",
      "[object Uint8ClampedArray]",
      "[object Int16Array]",
      "[object Uint16Array]",
      "[object Int32Array]",
      "[object Uint32Array]",
      "[object Float32Array]",
      "[object Float64Array]"
    ];
    isArrayBufferView = ArrayBuffer.isView || function(obj) {
      return obj && viewClasses.indexOf(Object.prototype.toString.call(obj)) > -1;
    };
  }
  var viewClasses;
  var isArrayBufferView;
  function normalizeName(name) {
    if (typeof name !== "string") {
      name = String(name);
    }
    if (/[^a-z0-9\-#$%&'*+.^_`|~!]/i.test(name) || name === "") {
      throw new TypeError('Invalid character in header field name: "' + name + '"');
    }
    return name.toLowerCase();
  }
  function normalizeValue(value) {
    if (typeof value !== "string") {
      value = String(value);
    }
    return value;
  }
  function iteratorFor(items) {
    var iterator = {
      next: function() {
        var value = items.shift();
        return { done: value === void 0, value };
      }
    };
    if (support.iterable) {
      iterator[Symbol.iterator] = function() {
        return iterator;
      };
    }
    return iterator;
  }
  function Headers2(headers) {
    this.map = {};
    if (headers instanceof Headers2) {
      headers.forEach(function(value, name) {
        this.append(name, value);
      }, this);
    } else if (Array.isArray(headers)) {
      headers.forEach(function(header) {
        this.append(header[0], header[1]);
      }, this);
    } else if (headers) {
      Object.getOwnPropertyNames(headers).forEach(function(name) {
        this.append(name, headers[name]);
      }, this);
    }
  }
  Headers2.prototype.append = function(name, value) {
    name = normalizeName(name);
    value = normalizeValue(value);
    var oldValue = this.map[name];
    this.map[name] = oldValue ? oldValue + ", " + value : value;
  };
  Headers2.prototype["delete"] = function(name) {
    delete this.map[normalizeName(name)];
  };
  Headers2.prototype.get = function(name) {
    name = normalizeName(name);
    return this.has(name) ? this.map[name] : null;
  };
  Headers2.prototype.has = function(name) {
    return this.map.hasOwnProperty(normalizeName(name));
  };
  Headers2.prototype.set = function(name, value) {
    this.map[normalizeName(name)] = normalizeValue(value);
  };
  Headers2.prototype.forEach = function(callback, thisArg) {
    for (var name in this.map) {
      if (this.map.hasOwnProperty(name)) {
        callback.call(thisArg, this.map[name], name, this);
      }
    }
  };
  Headers2.prototype.keys = function() {
    var items = [];
    this.forEach(function(value, name) {
      items.push(name);
    });
    return iteratorFor(items);
  };
  Headers2.prototype.values = function() {
    var items = [];
    this.forEach(function(value) {
      items.push(value);
    });
    return iteratorFor(items);
  };
  Headers2.prototype.entries = function() {
    var items = [];
    this.forEach(function(value, name) {
      items.push([name, value]);
    });
    return iteratorFor(items);
  };
  if (support.iterable) {
    Headers2.prototype[Symbol.iterator] = Headers2.prototype.entries;
  }
  function consumed(body) {
    if (body.bodyUsed) {
      return Promise.reject(new TypeError("Already read"));
    }
    body.bodyUsed = true;
  }
  function fileReaderReady(reader) {
    return new Promise(function(resolve, reject) {
      reader.onload = function() {
        resolve(reader.result);
      };
      reader.onerror = function() {
        reject(reader.error);
      };
    });
  }
  function readBlobAsArrayBuffer(blob) {
    var reader = new FileReader();
    var promise = fileReaderReady(reader);
    reader.readAsArrayBuffer(blob);
    return promise;
  }
  function readBlobAsText(blob) {
    var reader = new FileReader();
    var promise = fileReaderReady(reader);
    reader.readAsText(blob);
    return promise;
  }
  function readArrayBufferAsText(buf) {
    var view = new Uint8Array(buf);
    var chars = new Array(view.length);
    for (var i = 0; i < view.length; i++) {
      chars[i] = String.fromCharCode(view[i]);
    }
    return chars.join("");
  }
  function bufferClone(buf) {
    if (buf.slice) {
      return buf.slice(0);
    } else {
      var view = new Uint8Array(buf.byteLength);
      view.set(new Uint8Array(buf));
      return view.buffer;
    }
  }
  function Body() {
    this.bodyUsed = false;
    this._initBody = function(body) {
      this.bodyUsed = this.bodyUsed;
      this._bodyInit = body;
      if (!body) {
        this._bodyText = "";
      } else if (typeof body === "string") {
        this._bodyText = body;
      } else if (support.blob && Blob.prototype.isPrototypeOf(body)) {
        this._bodyBlob = body;
      } else if (support.formData && FormData.prototype.isPrototypeOf(body)) {
        this._bodyFormData = body;
      } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
        this._bodyText = body.toString();
      } else if (support.arrayBuffer && support.blob && isDataView(body)) {
        this._bodyArrayBuffer = bufferClone(body.buffer);
        this._bodyInit = new Blob([this._bodyArrayBuffer]);
      } else if (support.arrayBuffer && (ArrayBuffer.prototype.isPrototypeOf(body) || isArrayBufferView(body))) {
        this._bodyArrayBuffer = bufferClone(body);
      } else {
        this._bodyText = body = Object.prototype.toString.call(body);
      }
      if (!this.headers.get("content-type")) {
        if (typeof body === "string") {
          this.headers.set("content-type", "text/plain;charset=UTF-8");
        } else if (this._bodyBlob && this._bodyBlob.type) {
          this.headers.set("content-type", this._bodyBlob.type);
        } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
          this.headers.set("content-type", "application/x-www-form-urlencoded;charset=UTF-8");
        }
      }
    };
    if (support.blob) {
      this.blob = function() {
        var rejected = consumed(this);
        if (rejected) {
          return rejected;
        }
        if (this._bodyBlob) {
          return Promise.resolve(this._bodyBlob);
        } else if (this._bodyArrayBuffer) {
          return Promise.resolve(new Blob([this._bodyArrayBuffer]));
        } else if (this._bodyFormData) {
          throw new Error("could not read FormData body as blob");
        } else {
          return Promise.resolve(new Blob([this._bodyText]));
        }
      };
    }
    this.arrayBuffer = function() {
      if (this._bodyArrayBuffer) {
        var isConsumed = consumed(this);
        if (isConsumed) {
          return isConsumed;
        }
        if (ArrayBuffer.isView(this._bodyArrayBuffer)) {
          return Promise.resolve(
            this._bodyArrayBuffer.buffer.slice(
              this._bodyArrayBuffer.byteOffset,
              this._bodyArrayBuffer.byteOffset + this._bodyArrayBuffer.byteLength
            )
          );
        } else {
          return Promise.resolve(this._bodyArrayBuffer);
        }
      } else {
        return this.blob().then(readBlobAsArrayBuffer);
      }
    };
    this.text = function() {
      var rejected = consumed(this);
      if (rejected) {
        return rejected;
      }
      if (this._bodyBlob) {
        return readBlobAsText(this._bodyBlob);
      } else if (this._bodyArrayBuffer) {
        return Promise.resolve(readArrayBufferAsText(this._bodyArrayBuffer));
      } else if (this._bodyFormData) {
        throw new Error("could not read FormData body as text");
      } else {
        return Promise.resolve(this._bodyText);
      }
    };
    if (support.formData) {
      this.formData = function() {
        return this.text().then(decode2);
      };
    }
    this.json = function() {
      return this.text().then(JSON.parse);
    };
    return this;
  }
  var methods = ["DELETE", "GET", "HEAD", "OPTIONS", "POST", "PUT"];
  function normalizeMethod(method) {
    var upcased = method.toUpperCase();
    return methods.indexOf(upcased) > -1 ? upcased : method;
  }
  function Request2(input, options) {
    if (!(this instanceof Request2)) {
      throw new TypeError('Please use the "new" operator, this DOM object constructor cannot be called as a function.');
    }
    options = options || {};
    var body = options.body;
    if (input instanceof Request2) {
      if (input.bodyUsed) {
        throw new TypeError("Already read");
      }
      this.url = input.url;
      this.credentials = input.credentials;
      if (!options.headers) {
        this.headers = new Headers2(input.headers);
      }
      this.method = input.method;
      this.mode = input.mode;
      this.signal = input.signal;
      if (!body && input._bodyInit != null) {
        body = input._bodyInit;
        input.bodyUsed = true;
      }
    } else {
      this.url = String(input);
    }
    this.credentials = options.credentials || this.credentials || "same-origin";
    if (options.headers || !this.headers) {
      this.headers = new Headers2(options.headers);
    }
    this.method = normalizeMethod(options.method || this.method || "GET");
    this.mode = options.mode || this.mode || null;
    this.signal = options.signal || this.signal || function() {
    }();
    this.referrer = null;
    if ((this.method === "GET" || this.method === "HEAD") && body) {
      throw new TypeError("Body not allowed for GET or HEAD requests");
    }
    this._initBody(body);
    if (this.method === "GET" || this.method === "HEAD") {
      if (options.cache === "no-store" || options.cache === "no-cache") {
        var reParamSearch = /([?&])_=[^&]*/;
        if (reParamSearch.test(this.url)) {
          this.url = this.url.replace(reParamSearch, "$1_=" + new Date().getTime());
        } else {
          var reQueryString = /\?/;
          this.url += (reQueryString.test(this.url) ? "&" : "?") + "_=" + new Date().getTime();
        }
      }
    }
    this.headers = this.headers.map;
    if (options._bodyInit) {
      this.body = readArrayBufferAsText(options._bodyInit);
      this._bodyArrayBuffer = options._bodyInit;
    }
    if (this._bodyInit && !this.body) {
      this.body = readArrayBufferAsText(options._bodyInit);
    }
  }
  Request2.prototype.clone = function() {
    return new Request2(this, { body: this._bodyInit });
  };
  function decode2(body) {
    var form = new FormData();
    body.trim().split("&").forEach(function(bytes) {
      if (bytes) {
        var split = bytes.split("=");
        var name = split.shift().replace(/\+/g, " ");
        var value = split.join("=").replace(/\+/g, " ");
        form.append(decodeURIComponent(name), decodeURIComponent(value));
      }
    });
    return form;
  }
  Body.call(Request2.prototype);
  function Response(bodyInit, options) {
    if (!(this instanceof Response)) {
      throw new TypeError('Please use the "new" operator, this DOM object constructor cannot be called as a function.');
    }
    if (!options) {
      options = {};
    }
    this.type = "default";
    this.status = options.status === void 0 ? 200 : options.status;
    this.ok = this.status >= 200 && this.status < 300;
    this.statusText = options.statusText === void 0 ? "" : "" + options.statusText;
    this.headers = new Headers2(options.headers);
    this.url = options.url || "";
    this._initBody(bodyInit);
  }
  Body.call(Response.prototype);
  Response.prototype.clone = function() {
    return new Response(this._bodyInit, {
      status: this.status,
      statusText: this.statusText,
      headers: new Headers2(this.headers),
      url: this.url
    });
  };
  Response.error = function() {
    var response = new Response(null, { status: 0, statusText: "" });
    response.type = "error";
    return response;
  };
  var redirectStatuses = [301, 302, 303, 307, 308];
  Response.redirect = function(url, status) {
    if (redirectStatuses.indexOf(status) === -1) {
      throw new RangeError("Invalid status code");
    }
    return new Response(null, { status, headers: { location: url } });
  };
  return __toCommonJS(ecmatime_exports);
})();
/*
 * Adapted to deno from:
 *
 * [js-sha256]{@link https://github.com/emn178/js-sha256}
 *
 * @version 0.9.0
 * @author Chen, Yi-Cyuan [emn178@gmail.com]
 * @copyright Chen, Yi-Cyuan 2014-2017
 * @license MIT
 */

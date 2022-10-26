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
    flattenHeadersList: () => g,
    flattenHeadersObject: () => O,
    headersToList: () => H,
    headersToObject: () => j,
    headersToString: () => E,
    importFunction: () => importFunction,
    listToHeaders: () => b,
    objectToHeaders: () => w,
    reduceHeadersObject: () => f,
    sendEmail: () => sendEmail,
    step: () => step,
    stringToHeaders: () => A
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
      return {
        s: this.s,
        pc: this.pc,
        ch: this.ch.map((f2) => f2.serialize()),
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
        EmailTags: params["EmailTags"]?.map((x) => fromMessageTag(x)),
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
      let b2 = this.#h1;
      let c2 = this.#h2;
      let d2 = this.#h3;
      let e = this.#h4;
      let f2 = this.#h5;
      let g2 = this.#h6;
      let h = this.#h7;
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
      for (let j2 = 16; j2 < 64; ++j2) {
        t1 = blocks2[j2 - 15];
        s0 = (t1 >>> 7 | t1 << 25) ^ (t1 >>> 18 | t1 << 14) ^ t1 >>> 3;
        t1 = blocks2[j2 - 2];
        s1 = (t1 >>> 17 | t1 << 15) ^ (t1 >>> 19 | t1 << 13) ^ t1 >>> 10;
        blocks2[j2] = blocks2[j2 - 16] + s0 + blocks2[j2 - 7] + s1 << 0;
      }
      bc = b2 & c2;
      for (let j2 = 0; j2 < 64; j2 += 4) {
        if (this.#first) {
          if (this.#is224) {
            ab = 300032;
            t1 = blocks2[0] - 1413257819;
            h = t1 - 150054599 << 0;
            d2 = t1 + 24177077 << 0;
          } else {
            ab = 704751109;
            t1 = blocks2[0] - 210244248;
            h = t1 - 1521486534 << 0;
            d2 = t1 + 143694565 << 0;
          }
          this.#first = false;
        } else {
          s0 = (a2 >>> 2 | a2 << 30) ^ (a2 >>> 13 | a2 << 19) ^ (a2 >>> 22 | a2 << 10);
          s1 = (e >>> 6 | e << 26) ^ (e >>> 11 | e << 21) ^ (e >>> 25 | e << 7);
          ab = a2 & b2;
          maj = ab ^ a2 & c2 ^ bc;
          ch = e & f2 ^ ~e & g2;
          t1 = h + s1 + ch + K[j2] + blocks2[j2];
          t2 = s0 + maj;
          h = d2 + t1 << 0;
          d2 = t1 + t2 << 0;
        }
        s0 = (d2 >>> 2 | d2 << 30) ^ (d2 >>> 13 | d2 << 19) ^ (d2 >>> 22 | d2 << 10);
        s1 = (h >>> 6 | h << 26) ^ (h >>> 11 | h << 21) ^ (h >>> 25 | h << 7);
        da = d2 & a2;
        maj = da ^ d2 & b2 ^ ab;
        ch = h & e ^ ~h & f2;
        t1 = g2 + s1 + ch + K[j2 + 1] + blocks2[j2 + 1];
        t2 = s0 + maj;
        g2 = c2 + t1 << 0;
        c2 = t1 + t2 << 0;
        s0 = (c2 >>> 2 | c2 << 30) ^ (c2 >>> 13 | c2 << 19) ^ (c2 >>> 22 | c2 << 10);
        s1 = (g2 >>> 6 | g2 << 26) ^ (g2 >>> 11 | g2 << 21) ^ (g2 >>> 25 | g2 << 7);
        cd = c2 & d2;
        maj = cd ^ c2 & a2 ^ da;
        ch = g2 & h ^ ~g2 & e;
        t1 = f2 + s1 + ch + K[j2 + 2] + blocks2[j2 + 2];
        t2 = s0 + maj;
        f2 = b2 + t1 << 0;
        b2 = t1 + t2 << 0;
        s0 = (b2 >>> 2 | b2 << 30) ^ (b2 >>> 13 | b2 << 19) ^ (b2 >>> 22 | b2 << 10);
        s1 = (f2 >>> 6 | f2 << 26) ^ (f2 >>> 11 | f2 << 21) ^ (f2 >>> 25 | f2 << 7);
        bc = b2 & c2;
        maj = bc ^ b2 & d2 ^ cd;
        ch = f2 & g2 ^ ~f2 & h;
        t1 = e + s1 + ch + K[j2 + 3] + blocks2[j2 + 3];
        t2 = s0 + maj;
        e = a2 + t1 << 0;
        a2 = t1 + t2 << 0;
      }
      this.#h0 = this.#h0 + a2 << 0;
      this.#h1 = this.#h1 + b2 << 0;
      this.#h2 = this.#h2 + c2 << 0;
      this.#h3 = this.#h3 + d2 << 0;
      this.#h4 = this.#h4 + e << 0;
      this.#h5 = this.#h5 + f2 << 0;
      this.#h6 = this.#h6 + g2 << 0;
      this.#h7 = this.#h7 + h << 0;
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
        const b2 = key[i] || 0;
        oKeyPad[i] = 92 ^ b2;
        iKeyPad[i] = 54 ^ b2;
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
        throw new Error(`Result Wrapper ${JSON.stringify(resultWrapper)} is missing. Present keys: ${doc.root.children.map((x) => x.name).join(", ")}`);
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
      const node = this.children.find((x) => x.name === name);
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
      return listParent?.children.filter((x) => x.name === names[0]) ?? [];
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
      throw new Error(`BUG: XmlNode ${JSON.stringify(this.name)} missing required keys ${JSON.stringify(Array.from(missingKeys))} - had keys ${JSON.stringify(Array.from(new Set(this.children.map((x) => x.name))))}`);
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
      var m2 = match(/^<\?xml\s*/);
      if (!m2)
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
      var m2 = match(/^<([\w-:.]+)\s*/);
      if (!m2)
        return null;
      var node = new XmlNode(m2[1]);
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
      var m2 = match(/^([^<]*)/);
      if (m2)
        return decodeXmlEntities(m2[1]);
      return "";
    }
    function attribute() {
      var m2 = match(/([\w:-]+)\s*=\s*("[^"]*"|'[^']*'|\w+)\s*/);
      if (!m2)
        return;
      return { name: m2[1], value: strip(m2[2]) };
    }
    function strip(val) {
      return val.replace(/^['"]|['"]$/g, "");
    }
    function match(re) {
      var m2 = xml.match(re);
      if (!m2)
        return;
      xml = xml.slice(m2[0].length);
      return m2;
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
    return str.replace(/<|>|"|'|&/g, function(s) {
      return CHAR_S_INDEX[s];
    });
  }
  function decodeXmlEntities(str) {
    return str.replace(/&#?[0-9a-zA-Z]+;?/g, function(s) {
      if (s.charAt(1) === "#") {
        const code = s.charAt(2).toLowerCase() === "x" ? parseInt(s.substr(3), 16) : parseInt(s.substr(2));
        if (isNaN(code) || code < -32768 || code > 65535) {
          return "";
        }
        return String.fromCharCode(code);
      }
      return ALPHA_INDEX[s] || s;
    });
  }
  function stringify(root) {
    const attrs = root.attributes ? Object.entries(root.attributes).filter((x) => x[1] !== void 0).map((x) => ` ${x[0]}="${encodeXmlEntities(x[1])}"`).join("") : "";
    if (root.children && !root.content) {
      const contents = root.children.map((x) => stringify(x)).filter((x) => x);
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
          this.#region = await this.#credentials.getCredentials().then((x) => x.region, () => null);
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
        for (const [k, v] of config.body) {
          params.append(k, v);
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
      const requestId = xml.first("RequestId", false, (x) => x.content) || xml.first("RequestID", false, (x) => x.content) || getRequestId(response.headers);
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
    let p2 = out[DEFAULT_SECTION];
    const re = /^\[([^\]]*)\]$|^([^=]+)(=(.*))?$/i;
    const lines = str.split(/[\r\n]+/g);
    for (const line of lines) {
      if (!line || line.match(/^\s*[;#]/))
        continue;
      const match = line.match(re);
      if (!match)
        continue;
      if (match[1] !== void 0) {
        let section = unsafe(match[1]);
        p2 = out[section] = out[section] || {};
        continue;
      }
      let key = unsafe(match[2]);
      let value = match[3] ? unsafe(match[4]) : "";
      p2[key] = value;
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
        const c2 = val.charAt(i);
        if (esc) {
          if ("\\;#".indexOf(c2) !== -1) {
            unesc += c2;
          } else {
            unesc += "\\" + c2;
          }
          esc = false;
        } else if (";#".indexOf(c2) !== -1) {
          break;
        } else if (c2 === "\\") {
          esc = true;
        } else {
          unesc += c2;
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
        this.#promise = promise.then((x) => {
          if (x.expiresAt && x.expiresAt > new Date()) {
            this.#expireAfter = new Date(x.expiresAt.valueOf() - 60 * 1e3);
          }
          return x;
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
        this.#promise = promise.then((x) => {
          if (x.expiresAt && x.expiresAt > new Date()) {
            this.#expireAfter = new Date(x.expiresAt.valueOf() - 60 * 1e3);
          }
          return x;
        }, (err) => {
          this.#expireAfter = new Date(Date.now() + 30 * 1e3);
          return Promise.reject(err);
        });
      }
      return this.#promise;
    }
    async load() {
      const roleListReq = this.#service.performRequest("GET", "meta-data/iam/security-credentials/").then((x) => x ? x.split("\n") : []).catch((err) => {
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
      Expiration: node.first("Expiration", true, (x) => parseXmlTimestamp(x.content))
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
    const ctx = new InternalPristineContext(pid);
    if (serializedPreviousFrame && serializedPreviousFrame != "") {
      const decoder = new Decoder();
      const previousFrame = decoder.decode(serializedPreviousFrame, fn);
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
  var p = /[^a-z0-9\-#$%&'*+.^_`|~]/i;
  function a(e) {
    if (typeof e != "string" && (e = String(e)), p.test(e) || e.trim() === "")
      throw new TypeError("Invalid character in header field name");
    return e.toLowerCase();
  }
  function y(e) {
    return typeof e != "string" && (e = String(e)), e;
  }
  var o = Symbol("normalizedHeaders");
  var c = Symbol("rawHeaderNames");
  var u;
  var d;
  var l = class {
    constructor(e) {
      this[u] = {}, this[d] = /* @__PURE__ */ new Map(), [
        "Headers",
        "HeadersPolyfill"
      ].includes(e?.constructor.name) || e instanceof l ? e.forEach((t, s) => {
        this.append(s, t);
      }, this) : Array.isArray(e) ? e.forEach(([r, t]) => {
        this.append(r, Array.isArray(t) ? t.join(", ") : t);
      }) : e && Object.getOwnPropertyNames(e).forEach((r) => {
        let t = e[r];
        this.append(r, Array.isArray(t) ? t.join(", ") : t);
      });
    }
    [(u = o, d = c, Symbol.iterator)]() {
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
      this[o][t] = y(r), this[c].set(t, e);
    }
    append(e, r) {
      let t = a(e), s = this.has(t) ? `${this.get(t)}, ${r}` : r;
      this.set(e, s);
    }
    delete(e) {
      if (!this.has(e))
        return;
      let r = a(e);
      delete this[o][r], this[c].delete(r);
    }
    all() {
      return this[o];
    }
    raw() {
      let e = {};
      for (let [r, t] of this.entries())
        e[this[c].get(r)] = t;
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
  function H(e) {
    let r = [];
    return e.forEach((t, s) => {
      let n = t.includes(",") ? t.split(",").map((i) => i.trim()) : t;
      r.push([
        s,
        n
      ]);
    }), r;
  }
  function E(e) {
    return H(e).map(([s, n]) => {
      let i = [].concat(n);
      return `${s}: ${i.join(", ")}`;
    }).join(`\r
`);
  }
  var m = [
    "user-agent"
  ];
  function j(e) {
    let r = {};
    return e.forEach((t, s) => {
      let n = !m.includes(s.toLowerCase()) && t.includes(",");
      r[s] = n ? t.split(",").map((i) => i.trim()) : t;
    }), r;
  }
  function A(e) {
    return e.trim().split(/[\r\n]+/).reduce((t, s) => {
      if (s.trim() === "")
        return t;
      let n = s.split(": "), i = n.shift(), h = n.join(": ");
      return t.append(i, h), t;
    }, new l());
  }
  function b(e) {
    let r = new l();
    return e.forEach(([t, s]) => {
      [].concat(s).forEach((i) => {
        r.append(t, i);
      });
    }), r;
  }
  function f(e, r, t) {
    return Object.keys(e).reduce((s, n) => r(s, n, e[n]), t);
  }
  function w(e) {
    return f(e, (r, t, s) => ([].concat(s).filter(Boolean).forEach((i) => {
      r.append(t, i);
    }), r), new l());
  }
  function g(e) {
    return e.map(([r, t]) => [
      r,
      [].concat(t).join(", ")
    ]);
  }
  function O(e) {
    return f(e, (r, t, s) => (r[t] = [].concat(s).join(", "), r), {});
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

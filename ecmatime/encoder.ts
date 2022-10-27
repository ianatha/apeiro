const TAG = Symbol("APEIRO_TAG");

export class Encoder {
  id = 0;

  private encodeClassDefinition(v: any) {
    this.assignTag(v);

    // TODO: encode parent
    return {
      type: "class_definition",
      src: v.toString(),
      tag: v[TAG],
    };
  }

  private encodeFunction(v: any, debug: string) {
    this.assignTag(v);

    if (v.toString().indexOf(" [native code]") >= 0) {
        console.log("encountered native function at " + debug);
      }

    let res = {
      type: "function",
      tag: v[TAG],
      src: v.toString(),
    };

    if (Object.keys(v).length > 0) {
      res.props = this.encodeObject(v, debug+".props", false);
    }

    if (v?.$bound) {
      delete res.src;
      res.type = "function_bound";
    }

    return res;
  }

  private assignTag(v: any): boolean {
    if (v[TAG] === undefined) {
      try {
        v[TAG] = this.id;
        this.id++;
      } catch (e) {
        console.log("failed tagging ", JSON.stringify(v));
      }
      return true;
    } else {
      return false;
    }
  }

  private encodeObject(v: Record<string | symbol, any>, debug: string) {
    if (v.$from_apeiro_ctx) {
      return {
        type: "object_from_ctx",
        value: v.$from_apeiro_ctx,
      }
    }

    this.assignTag(v);

    const value: Record<string, any> = {};
    Object.keys(v).forEach((k) => {
      value[k] = this.encodeValue(v[k], debug + "." + k);
    });

    return {
      type: "object",
      value,
      tag: v[TAG],
    };
  }

  private encodeNumber(v: number) {
    return { type: "number", value: v };
  }

  private encodeString(v: string) {
    return { type: "string", value: v };
  }

  private encodeBoolean(v: boolean) {
    return { type: "boolean", value: v };
  }

  private encodeClassInstance(v: any, debug: string) {
    this.assignTag(v);

    const value: Record<string, any> = {};
    Object.keys(v).forEach((k) => {
      value[k] = this.encodeValue(v[k], debug + "." + k);
    });

    return {
      type: "class_instance",
      constructor: this.encodeClassDefinition(v.constructor),
      value,
      tag: v[TAG],
    };
  }

  private encodeArray(v: any, debug: string) {
    this.assignTag(v)

    let value: any[] = []
    Object.keys(v).forEach((k) => {
      value.push(this.encodeValue(v[k], debug + "." + k));
    });

    return {
      type: "array",
      value,
      tag: v[TAG],
    };
  }

  private encodeValue(v: any, debug: string) {
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

  private cleanValue(v: any) {
    if (
      v !== null && v !== undefined &&
      (typeof v === "object" || typeof v === "function")
    ) {
      delete v[TAG];
      Object.keys(v).forEach((k) => {
        this.cleanValue(v[k]);
      });
    }
  }

  public encode(v: any): string {
    this.id = 0;
    if (typeof v !== "object") {
      throw new Error("root must be an object");
    }
    const result = this.encodeValue(v, "");
    // TODO: this.cleanValue(v);
    return JSON.stringify(result);
  }
}

function isObject(v: any): boolean {
  return typeof v === "object" && v !== null && v.constructor === Object;
}

function isArray(v: any): boolean {
  return typeof v === "object" && v.constructor === Array;
}

function isClassInstance(v: any): boolean {
  return typeof v === "object" && !(v.constructor === Object) && !(v.constructor === Array);
}

function isFunction(v: any): boolean {
  return typeof v === "function" && !(v.toString().substring(0, 5) === "class");
}

function isClassDefinition(v: any): boolean {
  return typeof v === "function" && v.toString().substring(0, 5) === "class";
}

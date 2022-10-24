export class Decoder {
  ctx: any = null;
  BY_TAG: Record<number, any> = {};

  private evalInContext(src: string): any {
    if (src.indexOf(" [native code] ") >= 0) {
      return function() {
        throw new Error("cannot deserialize native function");
      }
    }

    const evalFunction = () => {
      return eval(src);
    };
    return evalFunction.call(this.ctx);
  }

  private decodeObject(v: any) {
    let decoded = {};
    Object.keys(v.value).forEach((k) => {
      decoded[k] = this.decodeValue(v.value[k]);
    });
    if (v.tag) {
      this.BY_TAG[v.tag] = decoded;
    }
    return decoded;
  }

  private decodeArray(v: any) {
    const decoded = [];
    Object.keys(v.value).forEach((k) => {
      decoded.push(this.decodeValue(v.value[k]));
    });
    this.BY_TAG[v.tag] = decoded;
    return decoded;
  }

  private decodeFunction(v: any) {
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

  private decodeFunctionBound(v: any) {
    let propsDecoded = this.decodeObject(v.props);
    let decoded = propsDecoded.target.bind(propsDecoded.thisArg, ...propsDecoded.boundedArgs);
    this.BY_TAG[v.tag] = decoded;
    return decoded;
  }

  private decodeClassDefinition(v: any) {
    let classDef = this.evalInContext(`let fn = ${v.src}; fn`);
    this.BY_TAG[v.tag] = classDef;
    return classDef;
  }

  private decodeClassInstance(v: any) {
    const decoded = {};
    Object.keys(v.value).forEach((k) => {
      decoded[k] = this.decodeValue(v.value[k]);
    });
    let classDef = this.decodeValue(v.constructor);
    if (classDef === undefined) {
      throw new Error("failed to deserialize " + JSON.stringify(v));
    }
    Object.setPrototypeOf(decoded, classDef.prototype);
    return decoded;
  }

  private decodeValue(v: any) {
    if (v === undefined || v === null || v.type === undefined) {
      throw new Error("attempting to decode undefined");
    }
    if (v.type === "undefined") {
      return undefined;
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

  public decode(input: string, ctx: any) {
    this.ctx = ctx;
    this.BY_TAG = {};
    const v = JSON.parse(input);
    if (v.type !== "object") {
      throw new Error("root must be an object");
    }
    return this.decodeValue(v);
  }
}

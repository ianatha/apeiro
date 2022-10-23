import { decode as msgpackDecode } from "https://deno.land/x/msgpack@v1.4/mod.ts";

export class Decoder {
  ctx: any = null;
  BY_TAG: Record<number, any> = {};

  private evalInContext(src: string): any {
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
    this.BY_TAG[v.tag] = decoded;
    return decoded;
  }

  private decodeFunction(v: any) {
    let decoded = this.evalInContext(`const fn = ${v.src}; fn`);
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
      throw new Error("failed to deserialize " + JSON.stringify(v))
    }
    Object.setPrototypeOf(decoded, classDef.prototype);
    return decoded;
  }

  private decodeValue(v: any) {
    if (v === undefined) {
      throw new Error("attempting to decode undefined");
    }
    if (v.type === "number") {
      return v.value;
    } else if (v.type === "string") {
      return v.value;
    } else if (v.type === "boolean") {
      return v.value;
    } else if (v.type === "object") {
      return this.decodeObject(v);
    } else if (v.type === "object_ref") {
      return this.BY_TAG[v.tag];
    } else if (v.type === "function") {
      return this.decodeFunction(v);
    } else if (v.type === "function_ref") {
      return this.BY_TAG[v.tag];
    } else if (v.type === "class_definition") {
      return this.decodeClassDefinition(v);
    } else if (v.type === "class_instance") {
      return this.decodeClassInstance(v);
    } else if (v.type === "class_definition_ref") {
      return this.BY_TAG[v.tag];
    } else {
      throw new Error("cannot decode " + v);
    }
  }

  public decode(input: any, ctx: any) {
    this.ctx = ctx;
    this.BY_TAG = {};
    const v = msgpackDecode(input);
    if (v.type !== "object") {
      throw new Error("root must be an object");
    }
    return this.decodeValue(v);
  }
}

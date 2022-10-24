export * from "./decoder.ts";
export * from "./encoder.ts";
export * from "./context.ts";

Function.prototype.$bind = Function.prototype.bind;
Function.prototype.bind = function (thisArg: any, ...boundedArgs: any[]) {
  const fn = this;
  const BoundFunction = (...args) => {
    return fn.apply(thisArg, [...boundedArgs, ...args]);
  }

  BoundFunction.thisArg = thisArg;
  BoundFunction.boundedArgs = boundedArgs;
  BoundFunction.target = fn;
  BoundFunction.$bound = true;

  return BoundFunction;
}
import { input } from "pristine://$";
function number() {
  return 100;
}

function square(x) {
  return x * x;
}

export default function simple(a, b) {
  let c = number() + b;
  let d = a * square(b) * input(10);
  let e = number();
  return c + d;
}
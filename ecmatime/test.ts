class Summer {
  constructor(private readonly a: number, private readonly b: number) {}

  sum() {
    console.log(this);
    return this.a + this.b;
  }
}

const s = new Summer(10, 1);
console.log(s.sum());
console.log(s.constructor.toString());

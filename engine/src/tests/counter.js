let counter = function counter() {
  let x = 0;
  return {
    g: function() { return {
      status: "SUSPEND",
      val: x,
    }; },
    i: function() { x++; }
  }
}();

export default counter;
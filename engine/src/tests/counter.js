let $module = function (){
    let a = function a() {
      let x = 0;
      return {
        g: function() { return {
          status: "SUSPEND",
          val: x,
        }; },
        i: function() { x++; }
      }
    }; 
    return {
      default: a
    }
}();

var counter = $module.default();
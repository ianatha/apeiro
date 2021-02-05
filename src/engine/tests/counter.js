var $module = function (){
    var a = function a() {
      var counter = 0;
      return {
        g: function() { return counter; },
        i: function() { counter++; }
      }
    }; 
    return {
      default: a
    }
}();

var counter = $module.default();
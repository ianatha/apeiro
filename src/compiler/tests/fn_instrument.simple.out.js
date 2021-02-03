function accumulator(init) {
    "use strict";
    var $f1 = $new_frame();
    switch($f1.$pc){
        case 0:
            $f1.sum = {
                value: init
            };
            $f1.$pc = 1;
        case 1:
            $f1.product = {
                value: init
            };
            $f1.$pc = 2;
        case 2:
            return {
                acc: function acc(x) {
                    var $f2 = $new_subframe($f1);
                    switch($f2.$pc){
                        case 0:
                            $f1.sum.value = $f1.sum.value + x;
                            $f2.$pc = 1;
                        case 1:
                            $f1.product.value = $f1.product.value * x;
                            $f2.$pc = 2;
                    }
                },
                get: function get() {
                    var $f2 = $new_subframe($f1);
                    switch($f2.$pc){
                        case 0:
                            return [
                                $f1.sum.value,
                                $f1.product.value
                            ];
                    }
                }
            };
    }
}
export { accumulator as default };

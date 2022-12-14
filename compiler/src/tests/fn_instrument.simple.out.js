let addTo = $fn(function addTo(x) {
    let $f1 = $new_frame("10856017672132017993", null);
    let $sc1 = $scope(undefined, $f1);
    switch($f1.$pc){
        case 0:
            let __return_val = x + $recv();
            $frame_end($f1);
            return __return_val;
    }
}, "10856017672132017993", null);
let multiplyBy = $fn(function multiplyBy(x) {
    let $f1 = $new_frame("2491222873117537989", null);
    let $sc1 = $scope(undefined, $f1);
    switch($f1.$pc){
        case 0:
            let __return_val = x * $recv();
            $frame_end($f1);
            return __return_val;
    }
}, "2491222873117537989", null);
let calculator = $fn(function calculator(init) {
    "use strict";
    let $f1 = $new_frame("1213940369952355128", null);
    let $sc1 = $scope(undefined, $f1);
    switch($f1.$pc){
        case 0:
            $sc1.acc = {
                value: init
            };
            $f1.$pc = 1;
        case 1:
            let __return_val = {
                incTwice: $fn(function() {
                    let $f2 = $new_frame("2593969740372095558", "1213940369952355128");
                    let $sc2 = $scope($sc1, $f2);
                    switch($f2.$pc){
                        case 0:
                            $sc1.acc.value = $sc1.acc.value + $recv();
                            $f2.$pc = 1;
                        case 1:
                            $sc1.acc.value = addTo($sc1.acc.value);
                            $frame_end($f2);
                    }
                }, "2593969740372095558", $sc1),
                inc: $fn(function() {
                    let $f2 = $new_frame("13967836557437580580", "1213940369952355128");
                    let $sc2 = $scope($sc1, $f2);
                    switch($f2.$pc){
                        case 0:
                            $sc1.acc.value = addTo($sc1.acc.value);
                            $frame_end($f2);
                    }
                }, "13967836557437580580", $sc1),
                mul: $fn(function() {
                    let $f2 = $new_frame("12128029339119825360", "1213940369952355128");
                    let $sc2 = $scope($sc1, $f2);
                    switch($f2.$pc){
                        case 0:
                            $sc1.acc.value = multiplyBy($sc1.acc.value);
                            $frame_end($f2);
                    }
                }, "12128029339119825360", $sc1),
                get: $fn(function() {
                    let $f2 = $new_frame("6740743506379155912", "1213940369952355128");
                    let $sc2 = $scope($sc1, $f2);
                    switch($f2.$pc){
                        case 0:
                            let __return_val = $sc1.acc.value;
                            $frame_end($f2);
                            return __return_val;
                    }
                }, "6740743506379155912", $sc1)
            };
            $frame_end($f1);
            return __return_val;
    }
}, "1213940369952355128", null);
let secondary = $fn(function secondary(a) {
    let $f1 = $new_frame("7050005800309523199", null);
    let $sc1 = $scope(undefined, $f1);
    switch($f1.$pc){
        case 0:
            try {
                let $f2 = $new_frame("7050005800309523199", null);
                let $sc2 = $scope($sc1, $f2);
                switch($f2.$pc){
                    case 0:
                        a.inc();
                        $f2.$pc = 1;
                    case 1:
                        a.inc();
                        $frame_end($f2);
                }
            } catch (e) {
                if ($isSuspendSignal(e)) throw e;
                let $f2 = $new_frame("7050005800309523199", null);
                let $sc2 = $scope($sc1, $f2);
                switch($f2.$pc){
                }
            }
            $frame_end($f1);
    }
}, "7050005800309523199", null);
let main = $fn(function main() {
    let $f1 = $new_frame("1472709023444480610", null);
    let $sc1 = $scope(undefined, $f1);
    switch($f1.$pc){
        case 0:
            $sc1.a = {
                value: calculator(1)
            };
            $f1.$pc = 1;
        case 1:
            secondary($sc1.a.value);
            $f1.$pc = 2;
        case 2:
            let __return_val = $sc1.a.value.get();
            $frame_end($f1);
            return __return_val;
    }
}, "1472709023444480610", null);

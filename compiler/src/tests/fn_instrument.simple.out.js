let addTo = $fn(function addTo(x) {
    let $f1 = $new_frame("2527463507779145736", null);
    let $sc1 = $scope(undefined, $f1);
    switch($f1.$pc){
        case 0:
            $sc1._temp$1 = {
                value: $recv()
            };
            $f1.$pc = 1;
        case 1:
            let __return_val = x + $sc1._temp$1.value;
            $frame_end($f1);
            return __return_val;
    }
}, "2527463507779145736", null);
let multiplyBy = $fn(function multiplyBy(x) {
    let $f1 = $new_frame("2516380371585939663", null);
    let $sc1 = $scope(undefined, $f1);
    switch($f1.$pc){
        case 0:
            $sc1._temp$1 = {
                value: $recv()
            };
            $f1.$pc = 1;
        case 1:
            let __return_val = x * $sc1._temp$1.value;
            $frame_end($f1);
            return __return_val;
    }
}, "2516380371585939663", null);
let calculator = $fn(function calculator(init) {
    "use strict";
    let $f1 = $new_frame("9490135889594306438", null);
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
                    let $f2 = $new_frame("119017385495003622", "9490135889594306438");
                    let $sc2 = $scope($sc1, $f2);
                    switch($f2.$pc){
                        case 0:
                            $sc2._temp$1 = {
                                value: $recv()
                            };
                            $f2.$pc = 1;
                        case 1:
                            $sc1.acc.value = $sc1.acc.value + $sc2._temp$1.value;
                            $f2.$pc = 2;
                        case 2:
                            $sc2._temp$1 = {
                                value: addTo($sc1.acc.value)
                            };
                            $f2.$pc = 3;
                        case 3:
                            $sc1.acc.value = $sc2._temp$1.value;
                            $frame_end($f2);
                    }
                }, "119017385495003622", $sc1),
                inc: $fn(function() {
                    let $f2 = $new_frame("9726494793982772212", "9490135889594306438");
                    let $sc2 = $scope($sc1, $f2);
                    switch($f2.$pc){
                        case 0:
                            $sc2._temp$1 = {
                                value: addTo($sc1.acc.value)
                            };
                            $f2.$pc = 1;
                        case 1:
                            $sc1.acc.value = $sc2._temp$1.value;
                            $frame_end($f2);
                    }
                }, "9726494793982772212", $sc1),
                mul: $fn(function() {
                    let $f2 = $new_frame("11121099805636486102", "9490135889594306438");
                    let $sc2 = $scope($sc1, $f2);
                    switch($f2.$pc){
                        case 0:
                            $sc2._temp$1 = {
                                value: multiplyBy($sc1.acc.value)
                            };
                            $f2.$pc = 1;
                        case 1:
                            $sc1.acc.value = $sc2._temp$1.value;
                            $frame_end($f2);
                    }
                }, "11121099805636486102", $sc1),
                get: $fn(function() {
                    let $f2 = $new_frame("6740743506379155912", "9490135889594306438");
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
}, "9490135889594306438", null);
let secondary = $fn(function secondary(a) {
    let $f1 = $new_frame("9436203357420762408", null);
    let $sc1 = $scope(undefined, $f1);
    switch($f1.$pc){
        case 0:
            $sc1._temp$1 = {
                value: a.inc()
            };
            $f1.$pc = 1;
        case 1:
            $sc1._temp$2 = {
                value: a.inc()
            };
            $f1.$pc = 2;
        case 2:
            try {
                let $f2 = $new_frame("9436203357420762408", null);
                let $sc2 = $scope($sc1, $f2);
                switch($f2.$pc){
                    case 0:
                        $sc2._temp$1.value;
                        $f2.$pc = 1;
                    case 1:
                        $sc2._temp$2.value;
                        $frame_end($f2);
                }
            } catch (e) {
                if ($isSuspendSignal(e)) throw e;
                let $f2 = $new_frame("9436203357420762408", null);
                let $sc2 = $scope($sc1, $f2);
                switch($f2.$pc){
                }
            }
            $frame_end($f1);
    }
}, "9436203357420762408", null);
let main = $fn(function main() {
    let $f1 = $new_frame("1682079802035773217", null);
    let $sc1 = $scope(undefined, $f1);
    switch($f1.$pc){
        case 0:
            $sc1._temp$1 = {
                value: calculator(1)
            };
            $f1.$pc = 1;
        case 1:
            $sc1.a = {
                value: $sc1._temp$1.value
            };
            $f1.$pc = 2;
        case 2:
            $sc1._temp$1 = {
                value: secondary($sc1.a.value)
            };
            $f1.$pc = 3;
        case 3:
            $sc1._temp$1.value;
            $f1.$pc = 4;
        case 4:
            $sc1._temp$1 = {
                value: $sc1.a.value.get()
            };
            $f1.$pc = 5;
        case 5:
            let __return_val = $sc1._temp$1.value;
            $frame_end($f1);
            return __return_val;
    }
}, "1682079802035773217", null);

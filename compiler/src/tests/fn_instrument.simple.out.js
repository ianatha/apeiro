let addTo = $fn(function addTo(x) {
    let $f1 = $new_frame("1", null);
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
        case 2:
            delete $sc1._temp$1.value;
            $frame_end($f1);
    }
}, "1", null);
let multiplyBy = $fn(function multiplyBy(x) {
    let $f1 = $new_frame("1", null);
    let $sc1 = $scope(undefined, $f1);
    switch($f1.$pc){
        case 0:
            $sc1._temp$2 = {
                value: $recv()
            };
            $f1.$pc = 1;
        case 1:
            let __return_val = x * $sc1._temp$2.value;
            $frame_end($f1);
            return __return_val;
        case 2:
            delete $sc1._temp$2.value;
            $frame_end($f1);
    }
}, "1", null);
let calculator = $fn(function calculator(init) {
    "use strict";
    let $f1 = $new_frame("1", null);
    let $sc1 = $scope(undefined, $f1);
    switch($f1.$pc){
        case 0:
            $sc1.acc = {
                value: init
            };
            $f1.$pc = 1;
        case 1:
            let __return_val = {
                incTwice: $fn(function incTwice() {
                    let $f2 = $new_frame("1", "1");
                    let $sc2 = $scope($sc1, $f2);
                    switch($f2.$pc){
                        case 0:
                            $sc2._temp$3 = {
                                value: $recv()
                            };
                            $f2.$pc = 1;
                        case 1:
                            $sc1.acc.value = $sc1.acc.value + $sc2._temp$3.value;
                            $f2.$pc = 2;
                        case 2:
                            delete $sc2._temp$3.value;
                            $f2.$pc = 3;
                        case 3:
                            $sc2._temp$4 = {
                                value: addTo($sc1.acc.value)
                            };
                            $f2.$pc = 4;
                        case 4:
                            $sc1.acc.value = $sc2._temp$4.value;
                            $f2.$pc = 5;
                        case 5:
                            delete $sc2._temp$4.value;
                            $frame_end($f2);
                    }
                }, "1", $sc1),
                inc: $fn(function inc() {
                    let $f2 = $new_frame("1", "1");
                    let $sc2 = $scope($sc1, $f2);
                    switch($f2.$pc){
                        case 0:
                            $sc2._temp$5 = {
                                value: addTo($sc1.acc.value)
                            };
                            $f2.$pc = 1;
                        case 1:
                            $sc1.acc.value = $sc2._temp$5.value;
                            $f2.$pc = 2;
                        case 2:
                            delete $sc2._temp$5.value;
                            $frame_end($f2);
                    }
                }, "1", $sc1),
                mul: $fn(function mul() {
                    let $f2 = $new_frame("1", "1");
                    let $sc2 = $scope($sc1, $f2);
                    switch($f2.$pc){
                        case 0:
                            $sc2._temp$6 = {
                                value: multiplyBy($sc1.acc.value)
                            };
                            $f2.$pc = 1;
                        case 1:
                            $sc1.acc.value = $sc2._temp$6.value;
                            $f2.$pc = 2;
                        case 2:
                            delete $sc2._temp$6.value;
                            $frame_end($f2);
                    }
                }, "1", $sc1),
                get: $fn(function get() {
                    let $f2 = $new_frame("1", "1");
                    let $sc2 = $scope($sc1, $f2);
                    switch($f2.$pc){
                        case 0:
                            let __return_val = $sc1.acc.value;
                            $frame_end($f2);
                            return __return_val;
                    }
                }, "1", $sc1)
            };
            $frame_end($f1);
            return __return_val;
    }
}, "1", null);
let secondary = $fn(function secondary(a) {
    let $f1 = $new_frame("1", null);
    let $sc1 = $scope(undefined, $f1);
    switch($f1.$pc){
        case 0:
            $sc1._temp$7 = {
                value: a.inc()
            };
            $f1.$pc = 1;
        case 1:
            $sc1._temp$8 = {
                value: a.inc()
            };
            $f1.$pc = 2;
        case 2:
            try {
                let $f2 = $new_frame("1", null);
                let $sc2 = $scope($sc1, $f2);
                switch($f2.$pc){
                    case 0:
                        $sc2._temp$7.value;
                        $f2.$pc = 1;
                    case 1:
                        $sc2._temp$8.value;
                        $frame_end($f2);
                }
            } catch (e) {
                if ($isSuspendSignal(e)) throw e;
                let $f2 = $new_frame("1", null);
                let $sc2 = $scope($sc1, $f2);
                switch($f2.$pc){
                }
            }
            $f1.$pc = 3;
        case 3:
            delete $sc1._temp$7.value;
            $f1.$pc = 4;
        case 4:
            delete $sc1._temp$8.value;
            $frame_end($f1);
    }
}, "1", null);
let main = $fn(function() {
    let $f1 = $new_frame("1", null);
    let $sc1 = $scope(undefined, $f1);
    switch($f1.$pc){
        case 0:
            $sc1._temp$9 = {
                value: calculator(1)
            };
            $f1.$pc = 1;
        case 1:
            $sc1.a = {
                value: $sc1._temp$9.value
            };
            $f1.$pc = 2;
        case 2:
            delete $sc1._temp$9.value;
            $f1.$pc = 3;
        case 3:
            $sc1._temp$10 = {
                value: secondary($sc1.a.value)
            };
            $f1.$pc = 4;
        case 4:
            $sc1._temp$10.value;
            $f1.$pc = 5;
        case 5:
            delete $sc1._temp$10.value;
            $f1.$pc = 6;
        case 6:
            $sc1._temp$11 = {
                value: $sc1.a.value.get()
            };
            $f1.$pc = 7;
        case 7:
            let __return_val = $sc1._temp$11.value;
            $frame_end($f1);
            return __return_val;
        case 8:
            delete $sc1._temp$11.value;
            $frame_end($f1);
    }
}, "1", null);
export default main;
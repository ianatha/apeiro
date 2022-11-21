/**
 * Go Interpreter for Blockly
 *
 * Copyright 2015 Mark T. Tomczak
 * https://github.com/fixermark/blockly
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Evaluators for number blocks

package blockly

import (
	"math"
	"math/rand"
	"sort"
	"strconv"
)

func NumberArithmeticEvaluator(i *Interpreter, b *Block) Value {
	aBlock := b.SingleBlockValueWithName(i, "A")
	bBlock := b.SingleBlockValueWithName(i, "B")
	opField := b.FieldWithName("OP")
	if opField == nil {
		i.Fail("Missing operator in arithmetic block.")
		return nilValue
	}
	aValue := i.Evaluate(aBlock).AsNumber(i)
	bValue := i.Evaluate(bBlock).AsNumber(i)

	var result float64

	switch opField.Value {
	case "ADD":
		result = aValue + bValue
	case "MINUS":
		result = aValue - bValue
	case "MULTIPLY":
		result = aValue * bValue
	case "DIVIDE":
		result = aValue / bValue
	case "POWER":
		result = math.Pow(aValue, bValue)
	default:
		i.Fail("Unknown operator: " + opField.Value)
		return nilValue
	}
	return NumberValue(result)
}

func NumberEvaluator(i *Interpreter, b *Block) Value {
	f := b.FieldWithName("NUM")
	if f == nil {
		i.Fail("Number block has no NUM field")
		return nilValue
	}

	val, err := strconv.ParseFloat(f.Value, 64)
	if err != nil {
		i.Fail(err.Error())
		return nilValue
	}
	return NumberValue(val)
}

// NumberConstantEvaluator evaluates to a fixed mathematical constant.
func NumberConstantEvaluator(i *Interpreter, b *Block) Value {
	name := b.SingleFieldWithName(i, "CONSTANT")
	switch name {
	case "PI":
		return NumberValue(math.Pi)
	case "E":
		return NumberValue(math.E)
	case "GOLDEN_RATIO":
		return NumberValue(math.Phi)
	case "SQRT2":
		return NumberValue(math.Sqrt2)
	case "SQRT1_2":
		return NumberValue(math.Sqrt(0.5))
	case "INFINITY":
		return NumberValue(math.Inf(1))
	default:
		i.Fail("Unknown constant " + name)
		return nilValue
	}
}

// NumberRandomIntEvaluator picks a random integer between two constraints.
func NumberRandomIntEvaluator(i *Interpreter, b *Block) Value {
	from := int(i.Evaluate(b.SingleBlockValueWithName(i, "FROM")).AsNumber(i))
	to := int(i.Evaluate(b.SingleBlockValueWithName(i, "TO")).AsNumber(i))

	if to < from {
		to, from = from, to

	}

	return NumberValue(float64(rand.Intn(to-from+1) + from))
}

// NumberRandomFloatEvaluator picks a random floating-point number in range
// [0.0, 1.0)
func NumberRandomFloatEvaluator(i *Interpreter, b *Block) Value {
	return NumberValue(rand.Float64())
}

// NumberModuloEvaluator interprets the input as modulo some other number.
func NumberModuloEvaluator(i *Interpreter, b *Block) Value {
	divisor := i.Evaluate(b.SingleBlockValueWithName(i, "DIVISOR")).AsNumber(i)
	if divisor == 0 {
		i.Fail("Cannot take modulo with 0 divisor.")
		return nilValue
	}
	dividend := i.Evaluate(b.SingleBlockValueWithName(i, "DIVIDEND")).AsNumber(i)
	return NumberValue(math.Mod(dividend, divisor))
}

// isWhole returns true if the number is a whole number.
func isWholeNumber(n float64) bool {
	_, frac := math.Modf(n)
	return frac == 0
}

// isDivisibleBy returns true if the number is evenly divisible by another number
func isDivisibleBy(n float64, divisor float64) bool {

	return isWholeNumber(n) && math.Mod(n, divisor) == 0
}

// NumberPropertyEvaluator returns boolean indicating whether a number satisfies
// a particular property (even, odd, prime, whole, positive, negative, divisible
// by another number)
func NumberPropertyEvaluator(i *Interpreter, b *Block) Value {
	numberToCheck := i.Evaluate(b.SingleBlockValueWithName(i, "NUMBER_TO_CHECK")).AsNumber(i)
	whichProperty := b.SingleFieldWithName(i, "PROPERTY")

	switch whichProperty {
	case "EVEN":
		return BoolValue(isDivisibleBy(numberToCheck, 2))
	case "ODD":
		return BoolValue(isDivisibleBy(numberToCheck-1, 2))
	case "PRIME":
		if numberToCheck <= 1 || !isWholeNumber(numberToCheck) {
			return BoolValue(false)
		}
		// We use a relatively naive test here (from
		// en.wikipedia.org/wiki/Primality_test), but it should be a
		// reasonable start.
		//
		// TODO(mtomczak): Should benchmark runtime on
		// this relative to using math/big's ProbablyPrime test with n |
		// odds of number not prime < (atoms on planet Earth); there are
		// about 200 quadrillion primes that can fit in 2^64, so large
		// numbers can certainly choke this method.
		if numberToCheck <= 3 {
			return BoolValue(true)
		}
		if math.Mod(numberToCheck, 2) == 0 || math.Mod(numberToCheck, 3) == 0 {
			return BoolValue(false)
		}
		for divisor := 5.0; divisor*divisor <= numberToCheck; divisor += 6 {
			if math.Mod(numberToCheck, divisor) == 0 ||
				math.Mod(numberToCheck, divisor+2) == 0 {
				return BoolValue(false)
			}
		}
		return BoolValue(true)
	case "WHOLE":
		return BoolValue(isWholeNumber(numberToCheck))
	case "POSITIVE":
		return BoolValue(numberToCheck >= 0)
	case "NEGATIVE":
		return BoolValue(numberToCheck < 0)
	case "DIVISIBLE_BY":
		divisor := i.Evaluate(b.SingleBlockValueWithName(i, "DIVISOR")).AsNumber(i)
		return BoolValue(isDivisibleBy(numberToCheck, divisor))
	default:
		i.Fail("math_number_property doesn't know how to " + whichProperty)
		return nilValue
	}
}

// degreesToRadians converts degrees to radians (Blockly operates in degrees)
func degreesToRadians(x float64) float64 {
	return x * math.Pi / 180.0
}

// radiansToDegrees converts radians to degrees (Blockly operates in degrees)
func radiansToDegrees(x float64) float64 {
	return x * 180.0 / math.Pi
}

// NumberSingleEvaluator runs one of several unary functions on an input number.
func NumberSingleEvaluator(i *Interpreter, b *Block) Value {
	fn := b.SingleFieldWithName(i, "OP")
	input := i.Evaluate(b.SingleBlockValueWithName(i, "NUM")).AsNumber(i)

	switch fn {
	case "ROOT":
		return NumberValue(math.Sqrt(input))
	case "ABS":
		return NumberValue(math.Abs(input))
	case "NEG":
		return NumberValue(-input)
	case "LN":
		return NumberValue(math.Log(input))
	case "LOG10":
		return NumberValue(math.Log10(input))
	case "EXP":
		return NumberValue(math.Exp(input))
	case "POW10":
		return NumberValue(math.Pow(10, input))

	case "SIN":
		return NumberValue(math.Sin(degreesToRadians(input)))
	case "COS":
		return NumberValue(math.Cos(degreesToRadians(input)))
	case "TAN":
		return NumberValue(math.Tan(degreesToRadians(input)))
	case "ASIN":
		return NumberValue(radiansToDegrees(math.Asin(input)))
	case "ACOS":
		return NumberValue(radiansToDegrees(math.Acos(input)))
	case "ATAN":
		return NumberValue(radiansToDegrees(math.Atan(input)))

	case "ROUND":
		return NumberValue(math.Floor(input + 0.5))
	case "ROUNDUP":
		return NumberValue(math.Ceil(input))
	case "ROUNDDOWN":
		return NumberValue(math.Floor(input))
	default:
		i.Fail("Math function doesn't know how to " + fn)
		return nilValue
	}
}

// average computes the mean of the input list of number values.
func average(i *Interpreter, values []Value) float64 {
	var result float64
	for _, elem := range values {
		result += elem.AsNumber(i)
	}
	return result / float64(len(values))

}

// NumberOnListEvaluator evaluates functions that can be applied to a list of numbers or strings.
func NumberOnListEvaluator(i *Interpreter, b *Block) Value {
	fn := b.SingleFieldWithName(i, "OP")
	inputList := i.Evaluate(b.SingleBlockValueWithName(i, "LIST")).AsList(i)

	if len(*inputList.Values) == 0 {
		i.Fail("Cannot determine " + fn + " of an empty list.")
		return nilValue
	}

	switch fn {
	case "SUM":
		var result float64
		for _, elem := range *inputList.Values {
			result += elem.AsNumber(i)
		}
		return NumberValue(result)
	case "MIN":
		result := math.MaxFloat64
		for _, elem := range *inputList.Values {
			result = math.Min(result, elem.AsNumber(i))
		}
		return NumberValue(result)
	case "MAX":
		result := -math.MaxFloat64
		for _, elem := range *inputList.Values {
			result = math.Max(result, elem.AsNumber(i))
		}
		return NumberValue(result)

	case "AVERAGE":
		return NumberValue(average(i, *inputList.Values))
	case "MEDIAN":
		vals := make([]float64, len(*inputList.Values))
		for idx, elem := range *inputList.Values {
			vals[idx] = elem.AsNumber(i)
		}
		sort.Float64s(vals)
		if isDivisibleBy(float64(len(vals)), 2) {
			a := vals[len(vals)/2-1]
			b := vals[len(vals)/2]
			return NumberValue((a + b) / 2)
		} else {
			return NumberValue(vals[(len(vals)-1)/2])
		}
	case "MODE":
		counts := make(map[float64]int)
		for _, val := range *inputList.Values {
			counts[val.AsNumber(i)] += 1
		}
		maxCount := 0
		var modes []float64

		for k, v := range counts {
			if v > maxCount {
				maxCount = v
				modes = []float64{k}
			} else if v == maxCount {
				modes = append(modes, k)
			}
		}
		// Mode returns a list because multiple elements could be the same count.
		output := make([]Value, 0, len(modes))
		for _, mode := range modes {
			output = append(output, NumberValue(mode))
		}
		return List{Values: &output}
	case "STD_DEV":
		avg := average(i, *inputList.Values)
		// INVARIANT: If we've gotten this far, this is a list of NumberValues.
		var deviationSum float64
		for _, val := range *inputList.Values {
			v := float64(val.(NumberValue))
			deviationSum += (v - avg) * (v - avg)
		}
		variance := deviationSum / float64(len(*inputList.Values))
		return NumberValue(math.Sqrt(variance))
	case "RANDOM":
		return (*inputList.Values)[rand.Intn(len(*inputList.Values))]
	default:
		i.Fail("math_on_list doesn't know how to " + fn)
		return nilValue
	}
}

// NumberConstrainEvaluator clamps a number between two thresholds (low and high)
func NumberConstrainEvaluator(i *Interpreter, b *Block) Value {
	candidate := i.Evaluate(b.SingleBlockValueWithName(i, "VALUE")).AsNumber(i)
	low := i.Evaluate(b.SingleBlockValueWithName(i, "LOW")).AsNumber(i)
	high := i.Evaluate(b.SingleBlockValueWithName(i, "HIGH")).AsNumber(i)

	return NumberValue(math.Min(high, math.Max(low, candidate)))
}

// NumberChangeEvaluator adds a number to a value in an array (i.e. operator++).
func NumberChangeEvaluator(i *Interpreter, b *Block) Value {
	varName := b.SingleFieldWithName(i, "VAR")
	change := i.Evaluate(b.SingleBlockValueWithName(i, "DELTA")).AsNumber(i)

	val, ok := i.Context[varName]

	if ok {
		i.Context[varName] = NumberValue(val.AsNumber(i) + change)
	} else {
		i.Context[varName] = NumberValue(change)
	}
	return nilValue
}

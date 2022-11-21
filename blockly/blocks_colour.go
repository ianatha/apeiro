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

package blockly

import (
	"math"
	"math/rand"
	"strings"
)

// ColourPickerEvaluator evaluates the colour picker by transforming its
// hex-coded colour string into a Colour value.
func ColourPickerEvaluator(i *Interpreter, b *Block) Value {
	var c Colour

	f := b.FieldWithName("COLOUR")
	if f == nil {
		i.Fail("Malformed colour_picker block: no 'COLOUR' field.")
		return nilValue
	}
	c.FromHex(i, strings.TrimPrefix(f.Value, "#"))
	return c
}

// ColourRandomEvaluator chooses a random colour. Note: The shared source is
// assumed to have been initialized by the program.
func ColourRandomEvaluator(i *Interpreter, b *Block) Value {
	var c Colour

	num := rand.Uint32()

	c.Red = uint8(num & 0xFF)
	num >>= 8
	c.Green = uint8(num & 0xFF)
	num >>= 8
	c.Blue = uint8(num & 0xFF)
	return c
}

// ColourRgbEvaluator creates a colour from three values for red, green, and
// blue, scaled between 0 and 100.
func ColourRgbEvaluator(i *Interpreter, b *Block) Value {
	redBlock := b.SingleBlockValueWithName(i, "RED")
	greenBlock := b.SingleBlockValueWithName(i, "GREEN")
	blueBlock := b.SingleBlockValueWithName(i, "BLUE")

	redRaw := math.Min(100.0, math.Max(0.0, i.Evaluate(redBlock).AsNumber(i)))
	greenRaw := math.Min(100.0, math.Max(0.0, i.Evaluate(greenBlock).AsNumber(i)))
	blueRaw := math.Min(100.0, math.Max(0.0, i.Evaluate(blueBlock).AsNumber(i)))

	return Colour{uint8(redRaw * 255.0 / 100.0),
		uint8(greenRaw * 255.0 / 100.0),
		uint8(blueRaw * 255.0 / 100.0),
	}
}

// helper function to compute blends.
func blend(c1, c2 uint8, ratio float64) uint8 {
	return uint8(math.Floor((float64(c1)*(1.0-ratio) + float64(c2)*ratio) + 0.5))
}

// ColourBlendEvaluator creates a colour by blending two input colours with a
// ratio between 0 (all the first colour) and 1 (all the second colour).
func ColourBlendEvaluator(i *Interpreter, b *Block) Value {
	colour1 := i.Evaluate(b.SingleBlockValueWithName(i, "COLOUR1")).AsColour(i)
	colour2 := i.Evaluate(b.SingleBlockValueWithName(i, "COLOUR2")).AsColour(i)
	ratio := i.Evaluate(b.SingleBlockValueWithName(i, "RATIO")).AsNumber(i)

	ratio = math.Min(1.0, math.Max(0.0, ratio))
	return Colour{
		blend(colour1.Red, colour2.Red, ratio),
		blend(colour1.Green, colour2.Green, ratio),
		blend(colour1.Blue, colour2.Blue, ratio),
	}
}

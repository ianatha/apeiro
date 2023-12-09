import {
  RangeSlider,
  RangeSliderFilledTrack,
  RangeSliderProps,
  RangeSliderThumb,
  RangeSliderTrack,
} from "@chakra-ui/react";
import React from "react";

export const PriceRangePicker = (props: RangeSliderProps) => {
  const value = props.defaultValue || props.value;
  return (
    <RangeSlider
      colorScheme="blue"
      step={10}
      aria-label={["minimum price", "maximux price"]}
      {...props}
    >
      <RangeSliderTrack>
        <RangeSliderFilledTrack />
      </RangeSliderTrack>
      {value?.map((_, index) => (
        <RangeSliderThumb
          w="5"
          h="5"
          borderWidth="1px"
          borderColor="gray.200"
          key={index}
          index={index}
        />
      ))}
    </RangeSlider>
  );
};

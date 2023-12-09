import { Box, Popover } from "@chakra-ui/react";
import React from "react";
import { CheckboxFilter } from "./CheckboxFilter";
import { ColorPicker } from "./ColorPicker";
import { PriceRangePicker } from "./PriceRangePicker";
import { formatPrice } from "./PriceTag";
import { QuickstartPicker } from "./SizePicker";
import { FilterPopoverButton, FilterPopoverContent } from "./FilterPopover";
import { useFilterState } from "./useFilterState";
import { blueFilters, colorFilter, priceFilter, sizeFilter } from "./_data";

export const QuickstartPopover = ({
  onSubmit,
  options,
}: { onSubmit: any; options: any[] }) => {
  return (
    <Popover placement="bottom-start">
      <FilterPopoverButton label="Quickstart" />
      <FilterPopoverContent
        // onClickCancel={state.onReset}
      >
        <QuickstartPicker
          // value={state.value}
          onSubmit={onSubmit}
          options={options}
        />
      </FilterPopoverContent>
    </Popover>
  );
};

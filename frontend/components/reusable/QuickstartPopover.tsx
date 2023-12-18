import { Popover } from "@chakra-ui/react";
import React from "react";
import { QuickstartPicker } from "./QuickstartPicker";
import { FilterPopoverButton, FilterPopoverContent } from "./FilterPopover";

export const QuickstartPopover = ({
  onSubmit,
  options,
}: { onSubmit: any; options: any[] }) => {
  return (
    <Popover placement="bottom-start">
      <FilterPopoverButton label="Quickstart" />
      <FilterPopoverContent>
        <QuickstartPicker
          onSubmit={onSubmit}
          options={options}
        />
      </FilterPopoverContent>
    </Popover>
  );
};

import { Button, HStack } from "@chakra-ui/react";
import React from "react";

export type FilterActionButtonsProps = {
  onClickCancel?: VoidFunction;
  onClickApply?: VoidFunction;
  isCancelDisabled?: boolean;
};

export const FilterActionButtons = (props: FilterActionButtonsProps) => {
  const { onClickCancel, isCancelDisabled } = props;
  return (
    <HStack spacing="2" justify="space-between">
      <Button
        size="sm"
        variant="ghost"
        onClick={onClickCancel}
        isDisabled={isCancelDisabled}
      >
        Cancel
      </Button>
    </HStack>
  );
};

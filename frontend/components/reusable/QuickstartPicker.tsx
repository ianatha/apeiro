import {
  FormControl,
  FormControlProps,
  Stack,
  usePopoverContext,
  useRadioGroup,
  UseRadioGroupProps,
} from "@chakra-ui/react";
import * as React from "react";
import { SizePickerButton } from "./SizePickerButton";

interface Option {
  label: string;
  value: string;
}

interface SizePickerProps extends UseRadioGroupProps {
  options: Option[];
  rootProps?: FormControlProps;
  label?: string;
  onSubmit: any;
}

export const QuickstartPicker = (props: SizePickerProps) => {
  const { options, rootProps, label, ...rest } = props;
  const { getRadioProps, getRootProps, value } = useRadioGroup(rest);
  const selectedOption = options.find((option) => option.value == value);
  const { onClose } = usePopoverContext();

  return (
    <FormControl {...rootProps}>
      <Stack {...getRootProps()}>
        {options.map((option) => (
          <SizePickerButton
            key={option.value}
            label={option.label}
            {...getRadioProps({ value: option.value })}
            onChange={(e) => {
              props?.onSubmit(option.value);
              onClose();
            }}
          />
        ))}
      </Stack>
    </FormControl>
  );
};

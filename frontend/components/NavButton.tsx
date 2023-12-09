import { As, Button, ButtonProps, HStack, Icon, Text } from "@chakra-ui/react";
import React from "react";

interface NavButtonProps extends ButtonProps {
  icon: As;
  label: string;
}

export const NavButton = React.forwardRef((props: NavButtonProps, ref) => {
  const { icon, label, ...buttonProps } = props;
  return (
    <Button variant="ghost-white" justifyContent="start" {...buttonProps}>
      <HStack spacing="3">
        <Icon as={icon} boxSize="6" />
        <Text>{label}</Text>
      </HStack>
    </Button>
  );
});

NavButton.displayName = "NavButton";

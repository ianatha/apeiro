import {
  Button,
  CloseButton,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerProps,
  Flex,
  HStack,
  Link,
  Text,
} from "@chakra-ui/react";
import React from "react";

type AddFilterDrawerProps =
  & Pick<DrawerProps, "isOpen" | "onClose" | "children">
  & {
    onClickCancel?: VoidFunction;
    isCancelDisabled?: boolean;
    onClickApply?: VoidFunction;
    onClearAll?: VoidFunction;
  };

export const FilterDrawer = (props: AddFilterDrawerProps) => {
  const { onClose, onClearAll, isOpen, children, onClickApply } = props;

  return (
    <Drawer
      placement="bottom"
      isFullHeight
      isOpen={isOpen}
      onClose={onClose}
      /*`trapFocus` and `blockScrollOnMount` are only switched off so that the preview works properly. */
      blockScrollOnMount={false}
      trapFocus={false}
    >
      <DrawerContent>
        <DrawerHeader px="4" borderBottomWidth="1px">
          <Flex justify="space-between" align="center">
            <CloseButton onClick={onClose} />
            <Text fontWeight="semibold" fontSize="md">
              Filter by
            </Text>
            <HStack spacing="4">
              <Link
                textDecor="underline"
                fontSize="sm"
                onClick={() => {
                  onClearAll?.();
                }}
              >
                Clear
              </Link>
            </HStack>
          </Flex>
        </DrawerHeader>
        <DrawerBody padding="6">{children}</DrawerBody>
        <DrawerFooter px="4" borderTopWidth="1px">
          <Button
            width="full"
            size="lg"
            fontSize="md"
            colorScheme="blue"
            onClick={() => {
              onClickApply?.();
              onClose();
            }}
          >
            Show results
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

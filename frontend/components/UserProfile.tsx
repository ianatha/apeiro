import { Avatar, Box, HStack, Text } from "@chakra-ui/react";
import * as React from "react";

interface UserProfileProps {
  name: string;
  image: string;
  email: string;
}

export const UserProfile = (props: UserProfileProps) => {
  const { name, image, email } = props;
  return (
    <HStack spacing="3" ps="2">
      <Avatar name={name} src={image} boxSize="10" />
      <Box>
        <Text color="white" fontWeight="medium" fontSize="sm">
          {name}
        </Text>
        <Text color="white-muted" fontSize="sm">
          {email}
        </Text>
      </Box>
    </HStack>
  );
};

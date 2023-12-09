import {
  Avatar,
  AvatarBadge,
  Box,
  Center,
  HStack,
  Stack,
  StackDivider,
  Text,
} from "@chakra-ui/react";
import * as React from "react";

export const members = [
  {
    id: "1",
    name: "Christian Nwamba",
    handle: "@christian",
    avatarUrl: "https://bit.ly/code-beast",
    status: "active",
    message: "Some message",
    lastSeen: "just now",
  },
  {
    id: "2",
    name: "Kent C. Dodds",
    handle: "@kent",
    avatarUrl: "https://bit.ly/kent-c-dodds",
    status: "active",
    message: "Some message",
    lastSeen: "2hr ago",
  },
  {
    id: "3",
    name: "Prosper Otemuyiwa",
    handle: "@prosper",
    avatarUrl: "https://bit.ly/prosper-baba",
    status: "active",
    message: "Some message",
    lastSeen: "3hr ago",
  },
  {
    id: "4",
    name: "Ryan Florence",
    handle: "@ryan",
    avatarUrl: "https://bit.ly/ryan-florence",
    status: "active",
    message: "Some message",
    lastSeen: "4hr ago",
  },
  {
    id: "5",
    name: "Segun Adebayo",
    handle: "@segun",
    avatarUrl: "https://bit.ly/sage-adebayo",
    status: "inactive",
    message: "Some message",
    lastSeen: "5hr ago",
  },
];

export const CodeList = () => (
  <Center maxW="sm" mx="auto" py={{ base: "4", md: "8" }}>
    <Box bg="bg-surface" py="4">
      <Stack divider={<StackDivider />} spacing="4">
        {members.map((member) => (
          <Stack key={member.id} fontSize="sm" px="4" spacing="4">
            <Stack direction="row" justify="space-between" spacing="4">
              <HStack spacing="3">
                <Avatar src={member.avatarUrl} boxSize="10">
                  <AvatarBadge
                    boxSize="4"
                    bg={member.status === "active" ? "success" : "subtle"}
                  />
                </Avatar>
                <Box>
                  <Text fontWeight="medium" color="emphasized">
                    {member.name}
                  </Text>
                  <Text color="muted">{member.handle}</Text>
                </Box>
              </HStack>
              <Text color="muted">{member.lastSeen}</Text>
            </Stack>
            <Text
              color="muted"
              sx={{
                "-webkit-box-orient": "vertical",
                "-webkit-line-clamp": "2",
                overflow: "hidden",
                display: "-webkit-box",
              }}
            >
              Candy donut tart pudding macaroon. Soufflé carrot cake choc late
              cake biscuit jelly beans chupa chups dragée. Cupcake toffee
              gummies lemon drops halvah. Cookie fruitcake jelly beans
              gingerbread soufflé marshmallow.
            </Text>
          </Stack>
        ))}
      </Stack>
    </Box>
  </Center>
);

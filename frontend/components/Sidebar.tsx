import { Icon } from "@chakra-ui/icons";
import {
  Divider,
  Flex,
  Input,
  InputGroup,
  InputLeftElement,
  Stack,
} from "@chakra-ui/react";
import Link from "next/link";
import * as React from "react";
import {
  FiBarChart2,
  FiBookmark,
  FiCheckSquare,
  FiHelpCircle,
  FiHome,
  FiSearch,
  FiSettings,
  FiUsers,
} from "react-icons/fi";
import { NavButtons, user } from "./App";
import { Logo } from "./Logo";
import { NavButton } from "./reusable/NavButton";
import { UserProfile } from "./UserProfile";

export const Sidebar = () => (
  <Flex as="section" minH="100vh" bg="bg-canvas">
    <Flex
      flex="1"
      bg="blue.500"
      color="white"
      maxW={{ base: "full", sm: "xs" }}
      py={{ base: "6", sm: "8" }}
      px={{ base: "4", sm: "6" }}
    >
      <Stack justify="space-between" spacing="1">
        <Stack spacing={{ base: "5", sm: "6" }} shouldWrapChildren>
          <Logo />
          <InputGroup>
            <InputLeftElement pointerEvents="none">
              <Icon as={FiSearch} color="white" boxSize="5" />
            </InputLeftElement>
            <Input placeholder="Search" variant="" colorScheme="blue" />
          </InputGroup>
          <Stack spacing="1">
            {NavButtons.map(([href, label, icon]) => (
              <Link key={href} href={href}>
                <NavButton label={label} icon={icon} />
              </Link>
            ))}
          </Stack>
        </Stack>
        <Stack spacing={{ base: "5", sm: "6" }}>
          <Stack spacing="1">
            <NavButton label="Help" icon={FiHelpCircle} />
            <NavButton label="Settings" icon={FiSettings} />
          </Stack>
          <Divider />
          <UserProfile
            name={user.name}
            image={user.avatar}
            email={user.email}
          />
        </Stack>
      </Stack>
    </Flex>
  </Flex>
);

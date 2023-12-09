import { Box, Container, Divider, Flex } from "@chakra-ui/react";
import * as React from "react";
import { IconType } from "react-icons";
import { FiActivity, FiCode, FiHome, FiLink, FiPackage } from "react-icons/fi";
import { Navbar } from "./Navbar";

export const title = "Apeiro";

export const user = {
  name: "You",
  email: "you@example.com",
  avatar: "",
};

export const NavButtons: [string, string, IconType][] = [
  ["/", "Workspace", FiHome],
  ["/procs/", "Processes", FiPackage],
  ["/modules/", "Modules", FiCode],
  ["/modules/new", "New Module", FiCode],
  // ["/bindings", "Bindings", FiLink],
];

export const App = ({ children }: React.PropsWithChildren) => (
  <Box as="section" height="100vh" overflowY="auto">
    <Navbar />
    <Container pt={{ base: "4", lg: "4" }} minH="calc(100vh - 8rem)">
      {/* // pb={{ base: "12", lg: "24" }} */}

      {children}
    </Container>
    <Divider></Divider>
    <Flex
      pb={4}
      pt={4}
      color="muted"
      fontSize="xs"
      direction={"column"}
      align={"center"}
    >
      Version 0.0.1401 &middot; &copy; MMXXII Apeiromont, Inc. All rights
      reserved.
    </Flex>
  </Box>
);

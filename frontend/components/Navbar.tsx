import {
  Avatar,
  Box,
  ButtonGroup,
  Container,
  Drawer,
  DrawerContent,
  DrawerOverlay,
  Flex,
  HStack,
  IconButton,
  useBreakpointValue,
  useDisclosure,
} from "@chakra-ui/react";
import { Button } from "./Button";
import Link from "next/link";
import { Router, useRouter } from "next/router";
import * as React from "react";
import { FiHelpCircle, FiSearch, FiSettings } from "react-icons/fi";
import useWorkspace from "../lib/useWorkspace";
import { NavButtons, user } from "./App";
import { Logo } from "./Logo";
import { NavButton } from "./NavButton";
import { Sidebar } from "./Sidebar";
import { ToggleButton } from "./ToggleButton";

const LogoutButton = () => {
  const workspace = useWorkspace();
  return <a href="#" onClick={async (e) => {
    e.preventDefault();
    await workspace.logout();
    window.location.href = '/api/auth/logout';
    return false;
  }}>Logout</a>;
};

export const Navbar = () => {
  const isDesktop = useBreakpointValue({ base: false, lg: true });
  const { isOpen, onToggle, onClose } = useDisclosure();
  const user = {
    name: undefined,
    picture: undefined,
  }

  return (
    <Box as="nav" bg="bg-accent" color="on-accent">
      <Container py={{ base: "3", lg: "4" }}>
        <Flex justify="space-between">
          <HStack spacing="4">
            
            {/* <Profile /> */}
            {/* <pre>{JSON.stringify({ isUserLoading, user})}</pre> */}
            <Logo />
            {isDesktop && (
              <ButtonGroup variant="ghost-on-accent" spacing="1">
                {NavButtons.map(([href, label, icon]) => (
                  <Link key={href} href={href}>
                    <NavButton
                      label={label}
                      icon={icon}
                      aria-current={window.location.pathname === href
                        ? "page"
                        : false}
                    >
                      {label}
                    </NavButton>
                  </Link>
                ))}
              </ButtonGroup>
            )}
          </HStack>
          {isDesktop
            ? (
              <HStack spacing="4">
                <ButtonGroup variant="ghost-on-accent" spacing="1">
                  <IconButton
                    icon={<FiSearch fontSize="1.25rem" />}
                    aria-label="Search"
                  />
                  <IconButton
                    icon={<FiSettings fontSize="1.25rem" />}
                    aria-label="Settings"
                  />
                  <IconButton
                    icon={<FiHelpCircle fontSize="1.25rem" />}
                    aria-label="Help Center"
                  />
                </ButtonGroup>
                {user && (
                  <>
                    <Avatar
                      boxSize="10"
                      ignoreFallback={true}
                      name={user?.name ?? "You"}
                      src={user?.picture ?? ""}
                    />
                    <LogoutButton />
                  </>
                )}
              </HStack>
            )
            : (
              <>
                <ToggleButton
                  isOpen={isOpen}
                  aria-label="Open Menu"
                  onClick={onToggle}
                />
                <Drawer
                  isOpen={isOpen}
                  placement="left"
                  onClose={onClose}
                  isFullHeight
                  preserveScrollBarGap
                  // Only disabled for showcase
                  trapFocus={false}
                >
                  <DrawerOverlay />
                  <DrawerContent>
                    <Sidebar />
                  </DrawerContent>
                </Drawer>
              </>
            )}
        </Flex>
      </Container>
    </Box>
  );
};

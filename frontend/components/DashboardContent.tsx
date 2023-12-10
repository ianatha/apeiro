import {
  Box,
  BoxProps,
  Heading,
  HStack,
  Icon,
  SimpleGrid,
  SkeletonText,
  Stack,
  Text,
  useBreakpointValue,
  useColorModeValue,
} from "@chakra-ui/react";
import { Button } from "./Button";
import Link from "next/link";
import * as React from "react";
import { FiBell, FiCode, FiPackage, FiPlusSquare } from "react-icons/fi";
import useSWR from "swr";
import useWorkspace from "../lib/useWorkspace";

export function DashboardContent() {
  const workspace = useWorkspace();
  const { data } = useSWR("_dashboard", workspace.fetch);

  return (
    <Stack spacing={{ base: "8", lg: "6" }}>
      <Stack
        spacing="4"
        direction={{ base: "column", md: "row" }}
        justify="space-between"
      >
        <Stack spacing="1">
          <Heading
            size={useBreakpointValue({ base: "xs", lg: "sm" })}
            fontWeight="medium"
          >
            Dashboard
          </Heading>
          <Text color="muted">
            Information gladly given, but safety requires avoiding unnecessary
            conversation.
          </Text>
        </Stack>
        <Stack direction="row" spacing="3">
          {
            /* <Button
            variant="secondary"
            leftIcon={<FiDownloadCloud fontSize="1.25rem" />}
          >
            Download
          </Button> */
          }
          <Link href="/modules/new">
            <Button
              variant="primary"
              leftIcon={<FiPlusSquare fontSize="1.25rem" />}
            >
              New Module
            </Button>
          </Link>
        </Stack>
      </Stack>
      <Stack spacing={{ base: "5", lg: "6" }}>
        <SimpleGrid columns={{ base: 1, md: 3 }} gap="6">
          <Card px={4} py={4}>
            <HStack fontSize={"lg"} mb={4}>
              <Icon as={FiPackage} boxSize="10" />
              <Heading size={useBreakpointValue({ base: "xs", lg: "sm" })}>
                Processes
              </Heading>
            </HStack>
            {data?.NumInstances}
            <SkeletonText
              isLoaded={data !== undefined}
              noOfLines={3}
              spacing="4"
            />

            <ul>
              {
                /* {currencies?.data.map((currency: any) => (
                <li key={currency.id}>{currency.Name}</li>
              ))} */
              }
            </ul>
          </Card>
          <Card px={4} py={4}>
            <HStack fontSize={"lg"} mb={4}>
              <Icon as={FiCode} boxSize="10" />
              <Heading size={useBreakpointValue({ base: "xs", lg: "sm" })}>
                Modules
              </Heading>
            </HStack>
            {data?.NumModules}
            <SkeletonText
              isLoaded={data !== undefined}
              noOfLines={3}
              spacing="4"
            />
            <ul>
              {
                /* {currencies?.data.map((currency: any) => (
                <li key={currency.id}>{currency.Name}</li>
              ))} */
              }
            </ul>
          </Card>
          <Card px={4} py={4}>
            <HStack fontSize={"lg"} mb={4}>
              <Icon as={FiBell} boxSize="10" />
              <Heading size={useBreakpointValue({ base: "xs", lg: "sm" })}>
                Alerts
              </Heading>
            </HStack>
            <SkeletonText
              isLoaded={data !== undefined}
              noOfLines={3}
              spacing="4"
            />
            {data && (
              <>
                {data?.NumAlerts == 0
                  ? <Text>All is good.</Text>
                  : <Text>You have {data?.NumAlerts} alerts.</Text>}
              </>
            )}
            <ul>
              {
                /* {currencies?.data.map((currency: any) => (
                <li key={currency.id}>{currency.Name}</li>
              ))} */
              }
            </ul>
          </Card>
        </SimpleGrid>
      </Stack>
      {
        /* <Card minH="xs" px={4} py={4}>
        <HStack fontSize={"lg"} mb={4}>
          <Icon as={FiActivity} boxSize="10" />
          <Heading size={useBreakpointValue({ base: "xs", lg: "sm" })}>
            Recent Updates
          </Heading>
        </HStack>
        <SkeletonText noOfLines={10} spacing='4' />
      </Card> */
      }
    </Stack>
  );
}

export const Card = (props: BoxProps) => (
  <Box
    minH={36}
    bg="bg-surface"
    boxShadow={useColorModeValue("sm", "sm-dark")}
    borderRadius="lg"
    {...props}
  />
);

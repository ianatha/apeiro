import {
  Box,
  Button,
  Center,
  CloseButton, Flex, HStack,
  Icon, Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  useColorModeValue as colorModeValue
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import React, { useEffect } from "react";
import { Card } from "./DashboardContent";
import { useProcess, useProcessDebug } from "../lib/Workspace";
import { FiInfo } from "react-icons/fi";
import { AiOutlineBug } from "react-icons/ai";
import useWorkspace from "../lib/useWorkspace";
import { Source } from "./Source";
import { FunctionSummary } from "./FunctionSummary";

export function ProcessOverview({ pid }: {
  pid: string;
}) {
  const router = useRouter();
  const { data: process, mutate } = useProcess(pid);
  const { data: processDebug, mutate: mutateDebug } = useProcessDebug(pid);
  const [displayAlert, setDisplayAlert] = React.useState(false);
  const workspace = useWorkspace();

  useEffect(() => {
    if (pid === undefined) {
      return;
    }

    const eventSource = workspace.watch(pid, () => {
      setDisplayAlert(true);
      mutate();
      mutateDebug();
    });

    return () => {
      eventSource.close();
    };
  }, [pid, mutate, mutateDebug]);

  if (process === undefined) {
    return <></>;
  }

  return (
    <>
      {displayAlert &&
        (
          <Box
            as="section"
            pt={{ base: "4", md: "8" }}
            pb={{ base: "12", md: "24" }}
            px={{ base: "4", md: "8" }}
            position="absolute"
            right="4"
            bottom="2"
          >
            <Flex direction="row-reverse">
              <Flex
                direction={{ base: "column", sm: "row" }}
                width={{ base: "full", sm: "md" }}
                boxShadow={colorModeValue("md", "md-dark")}
                bg="bg-surface"
                borderRadius="lg"
                overflow="hidden"
              >
                <Center
                  display={{ base: "none", sm: "flex" }}
                  bg="blue.500"
                  px="5"
                >
                  <Icon as={FiInfo} boxSize="10" color="white" />
                </Center>
                <Stack direction="row" p="4" spacing="3" flex="1">
                  <Stack spacing="2.5" flex="1">
                    <Text fontSize="sm" fontWeight="medium">
                      Process Status Updated
                    </Text>
                  </Stack>
                  <CloseButton
                    transform="translateY(-6px)"
                    onClick={(e) => setDisplayAlert(false)} />
                </Stack>
              </Flex>
            </Flex>
          </Box>
        )}
      <Card p={8}>
        <Tabs size="lg" variant="with-line">
          <TabList mb="1em">
            <Tab>Overview</Tab>
            <Tab>Source</Tab>
            <Tab>Debug</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
              <FunctionSummary process={process} />
              <HStack pt={12}>
                <Button
                  leftIcon={<Icon as={AiOutlineBug} />}
                  onClick={(e) => {
                    router.push(
                      `/modules/${process.mid.replace("mid_", "")}?fix=true`
                    );
                  }}
                >
                  There&apos;s a bug
                </Button>
              </HStack>
            </TabPanel>
            <TabPanel>
              <Source mid={process.module_id} debug={processDebug} />
            </TabPanel>
            <TabPanel>
              <pre>
                {JSON.stringify(process, null, 2)}
              </pre>
              <pre>
                {JSON.stringify(processDebug, null, 2)}
              </pre>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </Card>
    </>
  );
}

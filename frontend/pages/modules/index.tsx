import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Text,
  Icon,
  IconProps,
  Stack,
  Tag,
} from "@chakra-ui/react";
import type { NextPage } from "next";
import Head from "next/head";
import { App, title } from "../../components/App";
import { useModule, useModules, useProcess } from "../../lib/Workspace";
import { Card } from "../../components/pages/DashboardContent";
import Link from "next/link";
import { FiPlusSquare } from "react-icons/fi";
import { Router, useRouter } from "next/router";
import { trimPrefix } from "../../components/pages/FunctionDisplay";
import useWorkspace from "../../lib/useWorkspace";
import { ProtectedPage } from "../../lib/auth";

const log = (type: any) => console.log.bind(console, type);

const schema = {
  "type": "object",
  "title": "Number fields & widgets",
  "properties": {
    "number": {
      "title": "Number",
      "type": "number",
    },
    "integer": {
      "title": "Integer",
      "type": "integer",
    },
    "numberEnum": {
      "type": "number",
      "title": "Number enum",
      "enum": [
        1,
        2,
        3,
      ],
    },
    "numberEnumRadio": {
      "type": "number",
      "title": "Number enum",
      "enum": [
        1,
        2,
        3,
      ],
    },
    "integerRange": {
      "title": "Integer range",
      "type": "integer",
      "minimum": 42,
      "maximum": 100,
    },
    "integerRangeSteps": {
      "title": "Integer range (by 10)",
      "type": "integer",
      "minimum": 50,
      "maximum": 100,
      "multipleOf": 10,
    },
  },
};

function ProcessSummary({pid}: {
  pid: any;
}) {
  const { data: p } = useProcess(pid);

  return <li>
    <b>name: {p?.name}</b><br/>
    <b>pid: {pid}</b><br/>
    <b>val: {JSON.stringify(p?.val)}</b><br/>
    <b>status: {p?.status}</b><br/>
    <b>suspension: {JSON.stringify(p?.suspension)}</b><br/>
  </li>;
}

function ModuleInstances({ mid }: {
  mid: string;
}) {
  const workspace = useWorkspace();
  const { data: module } = useModule(mid);

  return (
    <>
    <h1>ModuleInstances for {mid}</h1>
    <ul>
    {module?.procs.map((proc: string) =>
      <li key={proc}><ProcessSummary pid={proc} /></li>)}
    </ul>
    </>
  );
}

interface ModuleDescription {
  name: string;
  id: string;
  singleton?: boolean;
}

export const CircleIcon = (props: IconProps) => (
  <Icon {...props} viewBox="0 0 200 200">
    <path
      fill="currentColor"
      d="M 100, 100 m -75, 0 a 75,75 0 1,0 150,0 a 75,75 0 1,0 -150,0"
    />
  </Icon>
);
const Home: NextPage = () => {
  const router = useRouter();
  const { data: modules } = useModules();
  const workspace = useWorkspace();

  return (
    <ProtectedPage>
      <Head>
        <title>{title}</title>
        <meta name="description" content="Apeiro" />
        <link rel="icon" href="/favicon.svg" />
      </Head>

      <App>
        <HStack justify={"space-between"}>
          <Heading pb={4} size="md">Code</Heading>
          <HStack>
            <Link href="/modules/new">
              <Button
                variant="secondary"
                leftIcon={<FiPlusSquare fontSize="1.25rem" />}
              >
                New Module
              </Button>
            </Link>
          </HStack>
        </HStack>

        <Stack spacing={4}>
          {modules?.map((module: ModuleDescription) => (
            <Card key={module.id} minH={0} p={4} bgColor="bg-surface">
              <HStack justify="space-between">
                <Heading size="xs">
                  <CircleIcon mr={2} color="green.500" />
                  {module.name} &nbsp;
                </Heading>
                <HStack>
                  {module.singleton && (<Tag>Singleton</Tag>)}
                  <Text fontSize="sm" as="span" color="muted">{module.id} &middot;</Text>
                  <Link href={`/modules/${module.id}`}>
                    <Button>Edit</Button>
                  </Link>
                  {!module.singleton && <Button
                    variant="primary"
                    onClick={async (e) => {
                      const newProcess = await workspace.spawn(module.id);
                      router.push(
                        `/procs/${newProcess.id}`,
                      );
                    }}
                  >
                    Start New Instance
                  </Button>}
                </HStack>
              </HStack>
              <HStack pt={4} width="100%">
                <Accordion
                  width="100%"
                  allowToggle={true}
                >
                  <AccordionItem>
                    {({ isExpanded }) => {
                      if (!isExpanded) {
                        return (
                          <>
                            <h2>
                              <AccordionButton>
                                <Box flex="1" textAlign="left">
                                  Instances
                                </Box>
                                <AccordionIcon />
                              </AccordionButton>
                            </h2>
                          </>
                        );
                      }
                      return (
                        <>
                          <h2>
                            <AccordionButton>
                              <Box flex="1" textAlign="left">
                                Instances
                              </Box>
                              <AccordionIcon />
                            </AccordionButton>
                          </h2>
                          <AccordionPanel pb={4}>
                            <ModuleInstances mid={module.id} />
                          </AccordionPanel>
                        </>
                      );
                    }}
                  </AccordionItem>
                </Accordion>
              </HStack>
            </Card>
          ))}
        </Stack>
      </App>
    </ProtectedPage>
  );
};

export default Home;

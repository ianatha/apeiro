import {
  Box,
  Button,
  Center,
  CloseButton,
  Code,
  Divider,
  Flex,
  Heading,
  HStack,
  Icon,
  Spinner,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  useColorModeValue as colorModeValue,
} from "@chakra-ui/react";
import Form from "@rjsf/chakra-ui";
import { IChangeEvent } from "@rjsf/core";
import validator from "@rjsf/validator-ajv6";
import type { NextPage } from "next";
import Head from "next/head";
import Router, { useRouter } from "next/router";
import React, { useEffect, useRef, useState } from "react";
import { App, title } from "../../components/App";
import { Card } from "../../components/DashboardContent";
import { useMount, useProcess, useProcessDebug } from "../../lib/Workspace";
import { FiInfo, FiSave } from "react-icons/fi";
import { AiOutlineBug } from "react-icons/ai";
import useWorkspace from "../../lib/useWorkspace";
import { ProtectedPage } from "../../lib/auth";

const log = (type: any) => console.log.bind(console, type);

function transformSchemaDescriptionToTitle(schema?: Record<string, any>) {
  Object.entries(schema?.properties as Record<string, any>[])
    .forEach(([key, prop]) => {
      if (prop.description) {
        prop.title = prop.description;
        delete prop.description;
      }
    });
  return schema;
}

interface ProcessState {
  pid: string;
  mid: string;
  suspension: Record<string, any> | undefined;
}

type PCToSrcMapping = {
  fnhash: number;
  pc: number;
  start_loc: number;
  end_loc: number;
}

function extract_pc_to_src_map(src: string): PCToSrcMapping[] {
  if (src == undefined) {
    return [];
  }
  let identifier = "//# programCounterMapping=";
  let pc_map_start = src.indexOf(identifier);
  if (pc_map_start >= 0) {
    let pc_map_end = src.indexOf("\n", pc_map_start);
    let pc_map_str = src.slice(pc_map_start + identifier.length, (pc_map_end == -1 ? undefined : pc_map_end));
    console.log(pc_map_str);
    let pc_map = JSON.parse(pc_map_str);
    return pc_map;
  }
  
  return [];
}

function insert_mark(last_frame: any, mapping: PCToSrcMapping[], src: string): string {
  if (last_frame == undefined || mapping == undefined) {
    return src;
  }
  last_frame.fnhash = parseInt(last_frame.fnhash);

  for (const map_entry of mapping) {
    if (map_entry.fnhash == last_frame.fnhash && map_entry.pc == last_frame["$pc"]) {
      let start = map_entry.start_loc - 1;
      let end = map_entry.end_loc;
      src = src.slice(0, start) + ">>>>> BLOCKING HERE <<<<< " + src.slice(start);
      break;
    }
  }

  return src;
}

function FunctionSummary({ process } : {
  process: any;
}) {
  const workspace = useWorkspace();

  const [readonly, setReadonly] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [formdata, setFormdata] = React.useState({});

  const submit = async (form: IChangeEvent) => {
    setReadonly(true);
    setSubmitting(true);
    try {
      const user = await workspace.supply(process.proc_id, formdata);
      setFormdata({});
    } catch (e) {
      alert(e);
    } finally {
      setReadonly(false);
      setSubmitting(false);
    }
  };

  const change = (form: IChangeEvent) => {
    setFormdata(form.formData);
  };

  return <Stack>
                <Heading size="lg">{process.name}</Heading>
                <Heading size="sm" variant="monospace">{process.proc_id}</Heading>
                <>
                  <a href={`/modules/${process.mount_id}`}>Edit</a>
                </>
                <Divider />
                {process?.val?.qr && <>
                <br/>
                <br/>
                <br/>
                <QRCodeSVG value={process?.val?.qr}></QRCodeSVG>
                <br/>
                <br/>
                <br/>
                </>
                }
                {process?.val?.jsonschema &&
                  <>
                    <Divider />
                    <Heading size="sm">Awaiting UI Input</Heading>
                    <Box>
                      <Form
                        readonly={submitting}
                        formData={formdata}
                        schema={transformSchemaDescriptionToTitle(process.val.jsonschema)}
                        validator={validator}
                        onChange={change}
                        onSubmit={submit}
                        onError={log("errors")}
                      >
                        <Button variant="primary" type="submit" minW="3xs">
                          {submitting ? <Spinner /> : "Submit"}
                        </Button>
                      </Form>
                    </Box>
                  </>
                  }
                                  {process.val && (
                  <>
                    <Divider />
                    <Heading size="sm">Result</Heading>
                    <pre>{JSON.stringify(process.val, null ,2)}</pre>
                  </>
                )}
                {process?.suspension &&
                  !process?.suspension?.definitions?.until_input && (
                  <>
                    <Divider />
                    <Heading size="sm">Awaiting non-UI input</Heading>
                    <NonUIInput pid={process.proc_id} schema={process?.suspension} />
                  </>
                )}
              </Stack>
}
export function Source({ mid, debug }: {
  mid: string;
  debug: any;
}) {
  const { data } = useMount(mid);
  let lastFrame = undefined;
  if (debug?.frames) {
    lastFrame = debug.frames[debug.frames.length - 1];
  }
  let mapping = extract_pc_to_src_map(data?.compiled_src)
  return (
    <>
      {data && (
        <Tabs size="lg" variant="with-line">
          <TabList mb="1em">
            <Tab>Original</Tab>
            <Tab>Instrumented</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
              <Code>
              <Code><pre>{insert_mark(lastFrame, mapping, data.src)}</pre></Code>
              </Code>
            </TabPanel>
            <TabPanel>
              <Code><pre>{data.compiled_src}</pre></Code>
            </TabPanel>
          </TabPanels>
        </Tabs>
      )}
    </>
  );
}

import monaco from 'monaco-editor';
import Editor, { Monaco } from "@monaco-editor/react";
import { QRCodeSVG } from "qrcode.react";

function NonUIInput({ pid, schema }: {
  pid: string;
  schema: any;
}) {
  const workspace = useWorkspace();
  const monacoRef = useRef<Monaco | null>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [submitting, setSubmitting] = useState<boolean | string>(false);
  
  function handleEditorDidMount(editor: monaco.editor.IStandaloneCodeEditor, monaco: Monaco) {
    monacoRef.current = monaco;
    editorRef.current = editor;
  }

  function handleEditorWillMount(monaco: Monaco) {
        // validation settings
      //   monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      //     noSemanticValidation: false,
      //     noSyntaxValidation: false
      // });

      // // compiler options
      // monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      //     target: monaco.languages.typescript.ScriptTarget.ES5,
      //     allowNonTsExtensions: true
      // });

      

      // for (const fileName in files) {
      //     const fakePath = `file:///node_modules/@types/${fileName}`;
      //     console.log(fileName, files[fileName]);
      //     monaco.languages.typescript.typescriptDefaults.addExtraLib(
      //         files[fileName],
      //         fakePath
      //     );
      // }
  }

  const save = async () => {
    editorRef.current?.updateOptions({
      readOnly: true,
    });
    setSubmitting("Sending");
    try {
      const msg = editorRef.current?.getValue() ?? "";
      const msgJSON = JSON.parse(msg);
        const resp = await workspace.supply(pid, msgJSON);
        editorRef.current?.updateOptions({
          readOnly: false,
        });
        setSubmitting(false);
    } catch (e) {
      alert(e);
      editorRef.current?.updateOptions({
        readOnly: false,
      });
      setSubmitting(false);
    }
  };

  return <Box>
    <pre style={{background: "azure"}}>Schema: {JSON.stringify(schema, null, 2)}</pre>
    <Editor
          height="5vh"
          defaultLanguage="json"
          beforeMount={handleEditorWillMount}
          onMount={handleEditorDidMount}
          defaultValue={"{\n}"}
          options={{
            minimap: {
              enabled: false,
            },
          }}
        />
                  <Button
            variant="secondary"
            leftIcon={<Icon as={FiSave} />}
            onClick={save}
          >
            {submitting ? <Spinner /> : "Send"}
          </Button>
  </Box>
}

function ProcessOverview({ pid }: {
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
                  bg="bg-accent"
                  px="5"
                >
                  <Icon as={FiInfo} boxSize="10" color="on-accent" />
                </Center>
                <Stack direction="row" p="4" spacing="3" flex="1">
                  <Stack spacing="2.5" flex="1">
                    <Text fontSize="sm" fontWeight="medium">
                      Process Status Updated
                    </Text>
                  </Stack>
                  <CloseButton
                    transform="translateY(-6px)"
                    onClick={(e) => setDisplayAlert(false)}
                  />
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
                      `/modules/${process.mid.replace("mid_", "")}?fix=true`,
                    );
                  }}
                >
                  There&apos;s a bug
                </Button>
              </HStack>
            </TabPanel>
            <TabPanel>
              <Source mid={process.mount_id} debug={processDebug} />
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

const Home: NextPage = () => {
  const router = useRouter();
  const { pid } = router.query;

  return (
    <ProtectedPage>
      <Head>
        <title>{title}</title>
        <meta name="description" content="Apeiro" />
        <link rel="icon" href="/favicon.svg" />
      </Head>

      <App>
        <ProcessOverview pid={pid as string} />
      </App>
      </ProtectedPage>
  );
};

export default Home;

// var jsCode = [
// 	'"use strict";',
// 	'function Person(age) {',
// 	'	if (age) {',
// 	'		this.age = age;',
// 	'	}',
// 	'}',
// 	'Person.prototype.getAge = function () {',
// 	'	return this.age;',
// 	'};'
// ].join('\n');

// var editor = monaco.editor.create(document.getElementById('container'), {
// 	value: jsCode,
// 	language: 'javascript'
// });

// var decorations = editor.deltaDecorations(
// 	[],
// 	[
// 		{
// 			range: new monaco.Range(3, 1, 5, 1),
// 			options: {
// 				isWholeLine: true,
// 				linesDecorationsClassName: 'myLineDecoration'
// 			}
// 		},
// 		{
// 			range: new monaco.Range(7, 1, 7, 24),
// 			options: {
//                 beforeContentClassName: 'myInlineDecoration' }
// 		}
// 	]
// );

// .myInlineDecoration::before {
//   content: "<SUSPENDED> ";
// }

// .myInlineDecoration {
// font-weight: bold;
// font-style: oblique;
//   color: red;
// }

// .myLineDecoration {
// background: lightblue;
// width: 5px !important;
// margin-left: 3px;
// }




import monaco from 'monaco-editor';
import Editor, { Monaco } from "@monaco-editor/react";
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Button,
  Code,
  Flex,
  Heading,
  HStack,
  Icon,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Spinner,
  Stack,
  Textarea,
  useDisclosure,
} from "@chakra-ui/react";
import { QuickstartPopover } from "../Quickstart/Filter";
import { useEffect, useRef, useState } from "react";
import { FiCpu, FiSave } from "react-icons/fi";
import { useModule } from "../../lib/Workspace";
import { quickstarts } from "./quickstarts";
import { useRouter } from "next/router";
import { MdOutlineSyncAlt } from "react-icons/md";
import Hotkeys from "react-hot-keys";
import useWorkspace from "../../lib/useWorkspace";

const snakeCase = (string: string) => {
  return string.replace(/\W+/g, " ")
    .split(/ |\B(?=[A-Z])/)
    .map((word) => word.toLowerCase())
    .join("_");
};

export const quickstartOptions = Object.entries(quickstarts).map((
  [key, value],
) => ({
  value: key,
  label: value.name,
}));

export const trimPrefix = (str: string, prefix: string) => {
  if (str.startsWith(prefix)) {
    return str.slice(prefix.length);
  }
};

const files: Record<string, string> = {
  "models/index.d.ts": "declare function $recv(schema: any): any; declare function $pid(): Pid; declare interface Pid { __pid: string }; declare function $send(recipient: Pid, msg: any); declare function $spawn(fn: () => any): Pid;",
};

function get_src_map(src: string|undefined): any|undefined {
  if (src === undefined) {
    return undefined;
  }
  const identifier = "//# sourceMappingURL=data:application/json;base64,";
  let loc = src.indexOf(identifier);
  if (loc >= 0) {
    let srcmap_end = src.indexOf("\n", loc);
    const srcmap_base64 = src.slice(loc + identifier.length, srcmap_end);
    const srcmap = JSON.parse(atob(srcmap_base64));
    return srcmap;
  }
  return undefined;
}

export function FunctionDisplay({
  mid,
}: {
  mid?: string;
}) {
  const newFunction = mid === undefined;
  const router = useRouter();
  const monacoRef = useRef<Monaco | null>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [submitting, setSubmitting] = useState<boolean | string>(false);
  const { data: module, error, mutate } = useModule(mid as string);
  const [name, setName] = useState(newFunction ? "untitled" : undefined);
  const [fix, setFix] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const dialogPromise = useRef<any>();
  const [showAssistant, setShowAssistant] = useState(false);
  const [fromAIA, setFromAIA] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [fixPrompt, setFixPrompt] = useState("");
  const workspace = useWorkspace();

  function handleEditorDidMount(editor: monaco.editor.IStandaloneCodeEditor, monaco: Monaco) {
    monacoRef.current = monaco;
    editorRef.current = editor;
  }

  function handleEditorChange(value: string | undefined, ev: monaco.editor.IModelContentChangedEvent) {
    if (value) {
      workspace.helper_extract_export_name(value).then((result) => {
        if (result.name) {
          setName(result.name);
        }
      });
    }
  }

  function handleEditorWillMount(monaco: Monaco) {
        // validation settings
        monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
          noSemanticValidation: false,
          noSyntaxValidation: false
      });

      // compiler options
      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
          target: monaco.languages.typescript.ScriptTarget.ES5,
          allowNonTsExtensions: true
      });

      

      for (const fileName in files) {
          const fakePath = `file:///node_modules/@types/${fileName}`;
          console.log(fileName, files[fileName]);
          monaco.languages.typescript.typescriptDefaults.addExtraLib(
              files[fileName],
              fakePath
          );
      }
  }

  useEffect(() => {
    if (module) {
      editorRef.current?.setValue(module.src);
      setName(module.name);
    }
  }, [module]);

  useEffect(() => {
    if (router.query["fix"] === "true") {
      setFix(true);
    }
  }, [router]);

  const save = async () => {
    editorRef.current?.updateOptions({
      readOnly: true,
    });
    setSubmitting("Compiling");
    try {
      const src = editorRef.current?.getValue() ?? "";
      if (mid === undefined) {
        const resp = await workspace.module(src, name ?? "untitled");
        window.location.href = `/modules/${trimPrefix(resp.mid, "fn_")}`;
      } else {
        const resp = await workspace.moduleUpdate(mid, src, name ?? "untitled");
        editorRef.current?.updateOptions({
          readOnly: false,
        });
        setSubmitting(false);
        if (resp.id) {
          router.push(`/procs/${resp.id}`);
        } else {
          alert("Done");
        }
      }
    } catch (e) {
      alert(e);
      editorRef.current?.updateOptions({
        readOnly: false,
      });
      setSubmitting(false);
    }
  };

  const saveAndSpawnSingleton = async () => {
    return await internalSaveAndSpawn("singleton");
  };

  const saveAndSpawnVal = async () => {
    return await internalSaveAndSpawn("val");
  };

  const saveAndSpawn = async () => {
    return await internalSaveAndSpawn("apeiro");
  };

  const internalSaveAndSpawn = async (mode: 'apeiro'|'singleton'|'val') => {
    editorRef.current?.updateOptions({
      readOnly: true,
    });
    setSubmitting("Compiling and spawning");
    try {
      const src = editorRef.current?.getValue() ?? "";
      // if (src.indexOf("apeiro://$/emailbox") >= 0) {
      //   onOpen();

      //   const promise = new Promise((resolve, reject) => {
      //     dialogPromise.current = (result: any) => {
      //       resolve(result);
      //     };
      //   });

      //   const dialogResult = await promise;
      //   if (!dialogResult) {
      //     editorRef.current?.updateOptions({
      //       readOnly: false,
      //     });
      //     setSubmitting(false);
      //     return;
      //   }
      // }
      if (mid === undefined) {
        const resp = await workspace.module(src, name ?? "untitled", mode);
        const mid = resp.mid;
        const spawn_resp = await workspace.spawn(mid, fromAIA);
        if (spawn_resp.id) {
          router.push(`/procs/${spawn_resp.id}`);
        } else {
          if (spawn_resp?.Err?.frames) {
            let first_frame = spawn_resp.Err.frames[0];
            let monaco_ = monacoRef.current;
            let editor = editorRef.current;
            let model = editor?.getModel();
            if (monaco_ && editor && model) {
              monaco_.editor.setModelMarkers(model, "owner", [{
                severity: 8,
                message: "while running: " + spawn_resp?.Err?.msg,
                startLineNumber: first_frame.line_number,
                startColumn: first_frame.column_number,
                endLineNumber: first_frame.line_number,
                endColumn: first_frame.column_number + 1,
              }]);
              console.log(editor.getSupportedActions());
              editor?.getAction("editor.action.marker.next")?.run();
            }
          } else {
            alert(spawn_resp.Err.error);
          }
          editorRef.current?.updateOptions({
            readOnly: false,
          });
          setSubmitting(false);
          // router.push(`/modules/${mid}`);

          // alert(
          //   "Guesstimating that it failed because " +
          //     spawn_resp.last_fetch_req + " responded with " +
          //     spawn_resp.last_fetch_resp_json + ".\n Attempting to fix.",
          // );
          // setSubmitting("Fixing");
          // const edit_resp = await workspace.edit_code(
          //   resp.mid,
          //   spawn_resp.last_fetch_resp_json,
          // );
          // editorRef?.current?.setValue(edit_resp.edit);
          // setSubmitting(false);
          // editorRef?.current?.updateOptions({
          //   readOnly: false,
          // });
        }
      } else {
        throw new Error("Can not save and spawn an existing function");
      }
    } catch (e) {
      alert(e);
      editorRef.current?.updateOptions({
        readOnly: false,
      });
      setSubmitting(false);
    }
  };

  const onCloseWithPromise = (result: any) => {
    onClose();
    dialogPromise?.current(result);
  };

  const email = "{pid}@test.apeiromont.com";

  const onKeyDown = (e: any) => {
    setShowAssistant(true);
  };

  if (error) {
    return <Alert status='error'>
      <AlertIcon />
      <AlertTitle>Apeiro Backend didn&apos;t respond!</AlertTitle>
      <AlertDescription>{error.message}</AlertDescription>
    </Alert>;
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={() => onCloseWithPromise(false)}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <Icon as={MdOutlineSyncAlt} /> Binding required
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            You must bind this instance&apos;s{" "}
            <Code>apeiro://$/emailbox</Code> to something!
            <Select>
              <option value="option1">{email}</option>
            </Select>
          </ModalBody>

          <ModalFooter>
            <Button
              variant="ghost"
              mr={3}
              onClick={(e) => onCloseWithPromise(false)}
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={(e) => onCloseWithPromise(true)}>
              Bind
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      <Stack
        spacing="4"
        direction={{ base: "column", md: "row" }}
        justify="space-between"
        pb={4}
      >
        <HStack justify={"space-between"}>
          <Heading size="md">
            {newFunction ? "New Function" : "mid_" + mid}
          </Heading>
          {/* <Button
            leftIcon={<Icon as={FiCpu} />}
            onClick={(e) => {
              setShowAssistant(true);
            }}
          >
            AIA
          </Button> */}
        </HStack>
        <HStack>
          {newFunction && (
            <QuickstartPopover
              onSubmit={(value: string) => {
                setName(snakeCase(quickstarts[value].name));
                editorRef.current?.setValue(quickstarts[value].code);
              }}
              options={quickstartOptions}
            />
          )}
          <Button
            variant="secondary"
            leftIcon={<Icon as={FiSave} />}
            onClick={save}
          >
            {submitting ? <Spinner /> : "Save"}
          </Button>
          {newFunction &&
            (
              <>
                <Button
                  variant="primary"
                  leftIcon={<Icon as={FiSave} />}
                  onClick={saveAndSpawn}
                >
                  {submitting ? <Spinner /> : "Save and Spawn"}
                </Button>
                <Button
                  variant="primary"
                  leftIcon={<Icon as={FiSave} />}
                  onClick={saveAndSpawnSingleton}
                >
                  {submitting ? <Spinner /> : "Save and Spawn Singleton"}
                </Button>
                <Button
                  variant="primary"
                  leftIcon={<Icon as={FiSave} />}
                  onClick={saveAndSpawnVal}
                >
                  {submitting ? <Spinner /> : "Save and Spawn Val"}
                </Button>
              </>
            )}
          {
            /* <Checkbox isChecked={fromAIA} onChange={(e) => {
            setFromAIA(e.target.checked);
          }}>From AIA</Checkbox> */
          }
        </HStack>
      </Stack>

      <Box>
        {submitting && (
          <Flex
            zIndex={3}
            position={"absolute"}
            left={0}
            width="100%"
            height="70vh"
            bgColor={"blackAlpha.200"}
            alignContent={"justify"}
            justifyContent={"center"}
            alignItems={"center"}
          >
            <Stack align="center">
              <Heading size="xs" color="accent">{submitting}...</Heading>
              <Spinner size="xl" color="accent" />
            </Stack>
          </Flex>
        )}
        <Input
          value={name || module?.name}
          onChange={(e) => setName(e.target.value)}
        />
        <Editor
          height="40vh"
          defaultLanguage="typescript"
          beforeMount={handleEditorWillMount}
          onMount={handleEditorDidMount}
          onChange={handleEditorChange}
          defaultValue={newFunction ? quickstarts.empty.code : module?.src}
          options={{
            minimap: {
              enabled: false,
            },
          }}
        />
        {/* <pre>
          {module?.compiled_src}
        </pre>
        <pre>
          {JSON.stringify(get_src_map(module?.compiled_src), null, 2)}
        </pre> */}
      </Box>
      {fix &&
        (
          <Modal
            size="xl"
            isOpen={fix}
            onClose={() => {
              setFix(false);
            }}
          >
            <ModalOverlay />
            <ModalContent>
              <ModalHeader>AI Fix Bug</ModalHeader>
              <ModalCloseButton />
              <ModalBody>
                <Heading size="2xs">
                  What&apos;s wrong with your process?
                </Heading>
                <Textarea
                  autoFocus={true}
                  placeholder="it [...], but it should [...]"
                  value={fixPrompt}
                  onChange={(e) => {
                    setFixPrompt(e.target.value);
                  }}
                />
              </ModalBody>

              <ModalFooter>
                <Button
                  colorScheme="blue"
                  mr={3}
                  onClick={(e) => {
                    setFix(false);
                    setFromAIA(true);
                    router.query["fix"] = undefined;
                    workspace.fixCode(
                      mid ?? "",
                      fixPrompt,
                      function (newCode: string) {
                        editorRef.current?.setValue(newCode);
                      },
                    );
                  }}
                >
                  Submit
                </Button>
              </ModalFooter>
            </ModalContent>
          </Modal>
        )}
      <Hotkeys
        keyName="ctrl+a"
        onKeyDown={onKeyDown}
      >
        {showAssistant &&
          (
            <Modal
              size="xl"
              isOpen={showAssistant}
              onClose={() => {
                setShowAssistant(false);
              }}
            >
              <ModalOverlay />
              <ModalContent>
                <ModalHeader>AI Assistant</ModalHeader>
                <ModalCloseButton />
                <ModalBody>
                  <Heading size="2xs">
                    What do you want your process to do?
                  </Heading>
                  <Textarea
                    autoFocus={true}
                    placeholder="gimme instructions"
                    value={prompt}
                    onChange={(e) => {
                      setPrompt(e.target.value);
                    }}
                  />
                </ModalBody>

                <ModalFooter>
                  <Button
                    colorScheme="blue"
                    mr={3}
                    onClick={(e) => {
                      setShowAssistant(false);
                      editorRef.current?.setValue(
                        "// " + prompt + "\nimport ",
                      );
                      console.log("setting fromaia = true;");
                      setFromAIA(true);
                      workspace.generateCode(
                        prompt,
                        function (new_word: string) {
                          console.log({ new_word });
                          editorRef.current?.setValue(
                            editorRef.current?.getValue() + new_word,
                          );
                        },
                      );
                    }}
                  >
                    Submit
                  </Button>
                </ModalFooter>
              </ModalContent>
            </Modal>
          )}
      </Hotkeys>
    </>
  );
}

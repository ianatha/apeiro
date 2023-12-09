import {
  Box,
  Button, Icon,
  Spinner
} from "@chakra-ui/react";
import React, { useRef, useState } from "react";
import { FiSave } from "react-icons/fi";
import useWorkspace from "../lib/useWorkspace";
import monaco from 'monaco-editor';
import Editor, { Monaco } from "@monaco-editor/react";


export function NonUIInput({ pid, schema }: {
  pid: string;
  schema: any;
}) {
  const workspace = useWorkspace();
  const monacoRef = useRef<Monaco | null>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [submitting, setSubmitting] = useState<boolean | string>(false);

  function handleEditorDidModule(editor: monaco.editor.IStandaloneCodeEditor, monaco: Monaco) {
    monacoRef.current = monaco;
    editorRef.current = editor;
  }

  function handleEditorWillModule(monaco: Monaco) {
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
    <pre style={{ background: "azure" }}>Schema: {JSON.stringify(schema, null, 2)}</pre>
    <Editor
      height="5vh"
      defaultLanguage="json"
      beforeMount={handleEditorWillModule}
      onMount={handleEditorDidModule}
      defaultValue={"{\n}"}
      options={{
        minimap: {
          enabled: false,
        },
      }} />
    <Button
      variant="secondary"
      leftIcon={<Icon as={FiSave} />}
      onClick={save}
    >
      {submitting ? <Spinner /> : "Send"}
    </Button>
  </Box>;
}

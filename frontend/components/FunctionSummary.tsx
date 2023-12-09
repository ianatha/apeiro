import {
  Box,
  Button,
  Divider,
  Heading,
  Spinner,
  Stack
} from "@chakra-ui/react";
import Form from "@rjsf/chakra-ui";
import { IChangeEvent } from "@rjsf/core";
import validator from "@rjsf/validator-ajv6";
import React from "react";
import useWorkspace from "../lib/useWorkspace";
import { QRCodeSVG } from "qrcode.react";
import { NonUIInput } from "./NonUIInput";
import { transformSchemaDescriptionToTitle, log } from "../pages/procs/[pid]";


export function FunctionSummary({ process }: {
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
      <a href={`/modules/${process.module_id}`}>Edit</a>
    </>
    <Divider />
    {process?.val?.qr && <>
      <br />
      <br />
      <br />
      <QRCodeSVG value={process?.val?.qr}></QRCodeSVG>
      <br />
      <br />
      <br />
    </>}
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
      </>}
    {process.val && (
      <>
        <Divider />
        <Heading size="sm">Result</Heading>
        <pre>{JSON.stringify(process.val, null, 2)}</pre>
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
  </Stack>;
}

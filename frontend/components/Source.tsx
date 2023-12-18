import {
  Code, Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs
} from "@chakra-ui/react";
import React from "react";
import { useModule } from "../lib/Workspace";
import { extract_pc_to_src_map } from "../lib/extract_pc_to_src_map";
import { insert_mark } from "../lib/insert_mark";

export function Source({ mid, debug }: {
  mid: string;
  debug?: any;
}) {
  const { data } = useModule(mid);
  let lastFrame = undefined;
  if (debug?.frames) {
    lastFrame = debug.frames[debug.frames.length - 1];
  }
  let mapping = extract_pc_to_src_map(data?.compiled_src);
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

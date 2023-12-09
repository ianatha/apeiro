import type { NextPage } from "next";
import Head from "next/head";
import { useRouter } from "next/router";
import React from "react";
import { App, title } from "../../components/App";
import { ProtectedPage } from "../../lib/auth";
import { ProcessOverview } from "../../components/ProcessOverview";

export const log = (type: any) => console.log.bind(console, type);

export function transformSchemaDescriptionToTitle(schema?: Record<string, any>) {
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

export type PCToSrcMapping = {
  fnhash: number;
  pc: number;
  start_loc: number;
  end_loc: number;
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

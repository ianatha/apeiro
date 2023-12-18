import type { NextPage } from "next";
import Head from "next/head";
import { useRouter } from "next/router";
import React from "react";
import { App, title } from "../../components/App";
import { ProtectedPage } from "../../lib/auth";
import { ProcessOverview } from "../../components/pages/ProcessOverview";

export const log = (type: any) => console.log.bind(console, type);

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

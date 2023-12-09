import { ProtectedPage } from "../../lib/auth";
import type { NextPage } from "next";
import Head from "next/head";
import { App, title } from "../../components/App";
import { FunctionDisplay } from "../../components/Mounts/FunctionDisplay";

const Home: NextPage = () => {
  return (
    <ProtectedPage>
      <Head>
        <title>{title}</title>
        <meta name="description" content="Apeiro" />
        <link rel="icon" href="/favicon.svg" />
      </Head>

      <App>
        <FunctionDisplay mid={undefined} />
      </App>
    </ProtectedPage>
  );
};

export default Home;

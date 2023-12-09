import type { NextPage } from "next";
import Head from "next/head";
import { App, title } from "../../components/App";
import { useRouter } from "next/router";
import { FunctionDisplay } from "../../components/Mounts/FunctionDisplay";
import { ProtectedPage } from "../../lib/auth";
import { Source } from "../procs/[pid].tsx";

const Home: NextPage = () => {
  const router = useRouter();
  const { mid } = router.query;

  return (
    <ProtectedPage>
      <Head>
        <title>{title}</title>
        <meta name="description" content="Apeiro" />
        <link rel="icon" href="/favicon.svg" />
      </Head>

      <App>
        {mid && <FunctionDisplay mid={mid as string} />}
        <Source mid={mid} />
      </App>
    </ProtectedPage>
  );
};

export default Home;

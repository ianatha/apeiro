import type { NextPage } from "next";
import Head from "next/head";
import { App, title } from "../../components/App";
import { useRouter } from "next/router";
import { ProtectedPage } from "../../lib/auth";
import { Source } from "../../components/Source";
import { FunctionDisplay } from "../../components/Modules/FunctionDisplay";

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
        <Source mid={mid as string} />
      </App>
    </ProtectedPage>
  );
};

export default Home;

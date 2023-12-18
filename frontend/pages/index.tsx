import type { NextPage } from "next";
import Head from "next/head";
import { App, title } from "../components/App";
import { DashboardContent } from "../components/pages/DashboardContent";
import { ProtectedPage } from "../lib/auth";

const Home: NextPage = () => {
  return (
    <ProtectedPage>
      <>
        <Head>
          <title>{title}</title>
          <meta name="description" content="Apeiro" />
          <link rel="icon" href="/favicon.svg" />
        </Head>

        <App>
          <DashboardContent />
        </App>
      </>
    </ProtectedPage>
  );
};

export default Home;

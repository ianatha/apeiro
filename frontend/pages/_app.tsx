import type { AppProps } from "next/app";
import { ChakraProvider } from "@chakra-ui/react";
import { theme } from "../components/theme";
// import { UserProvider } from "@auth0/nextjs-auth0";
import { useEffect, useState } from "react";
import useLocalStorage from "../lib/useLocalStorage";
import { WorkspaceProvider } from "../lib/useWorkspace";
import { BASE_URL, Workspace } from "../lib/Workspace";

import SuperTokensReact, { SuperTokensWrapper } from 'supertokens-auth-react';

import { frontendConfig } from '../config/frontendConfig'

if (typeof window !== 'undefined') {
  // we only want to call this init function on the frontend, so we check typeof window !== 'undefined'
  SuperTokensReact.init(frontendConfig())
}

function MyApp({ Component, pageProps }: AppProps) {
  const [accessToken, setAccessToken] = useLocalStorage<string | undefined>(
    "token",
    undefined,
  );

  useEffect(() => {
    if (accessToken === undefined) {
      // fetch("/api/session").then((resp) => resp.json()).then((json) => {
      //   setAccessToken(json.accessToken);
      // });
    }  
  }, [accessToken, setAccessToken]);


  return (
    <SuperTokensWrapper>
      {/* <UserProvider> */}
        <WorkspaceProvider value={new Workspace(BASE_URL, accessToken, setAccessToken)}>
          <ChakraProvider theme={theme}>
            <Component {...pageProps} />
          </ChakraProvider>
        </WorkspaceProvider>
      {/* </UserProvider> */}
    </SuperTokensWrapper>
  );
}

export default MyApp;

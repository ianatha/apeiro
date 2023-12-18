import type { AppProps } from "next/app";
import { ChakraProvider } from "@chakra-ui/react";
import { apeiroTheme } from "../components/theme";
import { useEffect } from "react";
import useLocalStorage from "../lib/useLocalStorage";
import { WorkspaceProvider } from "../lib/useWorkspace";
import { BASE_URL, Workspace } from "../lib/Workspace";

import { appConfig } from "../lib/backendConfig";

function MyApp({ Component, pageProps }: AppProps) {
  const [accessToken, setAccessToken] = useLocalStorage<string | undefined>(
    "token",
    undefined,
  );

  useEffect(() => {
    if (appConfig.auth && accessToken === undefined) {
      fetch("/api/session").then((resp) => resp.json()).then((json) => {
        setAccessToken(json.accessToken);
      });
    }  
  }, [accessToken, setAccessToken]);

  return (
    <WorkspaceProvider value={new Workspace(BASE_URL, accessToken, setAccessToken)}>
      <ChakraProvider theme={apeiroTheme}>
        <Component {...pageProps} />
      </ChakraProvider>
    </WorkspaceProvider>
  );
}

export default MyApp;

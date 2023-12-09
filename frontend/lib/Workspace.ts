import useSWR from "swr";
import useWorkspace from "./useWorkspace";

export interface ProcState {
  id: string;
  name: string;
}

export function useMounts() {
  const workspace = useWorkspace();
  return useSWR("mount/", workspace.fetch);
}

export function useMount(mid: string) {
  const workspace = useWorkspace();
  return useSWR(mid ? `mount/${mid}` : false, workspace.fetch);
}

export function useProcesses() {
  const workspace = useWorkspace();
  return useSWR("proc/", workspace.fetch);
}

export function useProcess(id: string) {
  const workspace = useWorkspace();
  return useSWR(id ? `proc/${id}` : false, workspace.fetch);
}

export function useProcessDebug(id: string) {
  const workspace = useWorkspace();
  return useSWR(id ? `proc/${id}/debug` : false, workspace.fetch);
}

export class Workspace {
  fetch: (url: string, init?: RequestInit) => Promise<Record<string, any>>;

  async helper_extract_export_name(input: string): Promise<Record<string, any>> {
      try {
      return this.fetch(`helper_extract_export_name`, {
        method: "POST",
        // headers: {
        //   "Content-Type": "application/json",
        // },
        body: input,
      });
    } catch {
      return {}
    }
  }

  async logout() {
    this.accessToken = undefined;
    if (this.setAccessToken) {
      this.setAccessToken(undefined);
    }
  }

  constructor(
    private readonly base_url: string,
    private accessToken: string|undefined,
    private readonly setAccessToken: ((s: string|undefined) => void)|undefined,
  ) {
    this.fetch = async (url, init) => {
      // if (this.accessToken === undefined) {
      //   return new Promise(() => {
      //     // never resolving promise
      //   });
      // }
      return fetch(`${this.base_url}/${url}`, {
        ...init,
        headers: {
          ...init?.headers,
          // "Authorization": `Bearer ${this.accessToken}`,
        },
      }).then((res) => {
        if (res.status === 401) {
          fetch("/api/session").then((resp) => resp.json()).then((json) => {
            if (this.setAccessToken) {
              this.setAccessToken(json.accessToken);
            }
          });
          
          return null;
          // return this.fetch(url, init);
        } else
        return res.json();
      });
    }
  }

  async mount(src: string, name: string, singleton = ""): Promise<Record<string, any>> {
    return this.fetch(`mount/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        src,
        name,
        singleton: singleton == "singleton",
      }),
    });
  }

  watch(pid: string, handler: () => any) {
    const eventSource = new EventSource(
      `${this.base_url}/proc/${pid}/watch`,
    );
    eventSource.onmessage = handler;
    return eventSource;
  }

  fixCode(mid: string, fixPrompt: string, handler: (s: string) => any) {
    if (mid == "") {
      return;
    }
    this.fetch(`aia/fix_bug`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mid,
        fixPrompt,
      }),
    }).then((json) => {
      handler(json.code);
    });
    return;
  }

  generateCode(prompt: string, handler: (s: string) => any) {
    const eventSource = new EventSource(
      `${this.base_url}/aia?prompt=${encodeURIComponent(prompt)}`,
    );
    eventSource.onmessage = function (
      this: EventSource,
      msg: MessageEvent<string>,
    ) {
      const m = JSON.parse(msg.data);
      handler(m.w);
    };
    eventSource.onerror = () => {
      eventSource.close();
    };
    return eventSource;
  }

  async mountUpdate(
    mid: string,
    src: string,
    name: string,
  ): Promise<Record<string, any>> {
    return this.fetch(`mount/${mid}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        src,
        name,
      }),
    });
  }

  async supply(
    pid: string,
    args: Record<string, any>,
  ): Promise<Record<string, any>> {
    const res = await this.fetch(`proc/${pid}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Apeiro-Wait": "true",
      },
      body: JSON.stringify({
         msg: args,
      }),
    });

    if (res?.val?.redirect) {
      window.open(process.env.NEXT_PUBLIC_APEIRO_UI + "/procs/" + res.val.redirect);
    }

    return res;
  }

  async spawn(
    mid: string,
    fromAIA: boolean = false,
  ): Promise<Record<string, any>> {
    return this.fetch('proc/', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Apeiro-Wait": "true",
      },
      body: JSON.stringify({
        mount_id: mid,
        fromAIA,
      }),
    });
  }

  // async edit_code(mid: string, last_fetch_resp_json: string): Promise<Record<string, any>> {
  //   return this.fetch(`aia/fix`, {
  //     method: "POST",
  //     headers: {
  //       "Content-Type": "application/json",
  //     },
  //     body: JSON.stringify({
  //       mid,
  //       last_fetch_resp_json,
  //     }),
  //   });
  // }
}

export const BASE_URL = process.env.NEXT_PUBLIC_APEIRO_API ?? "http://localhost:5151";

import { chakra, HTMLChakraProps } from "@chakra-ui/react";
import { ReactElement, useEffect, useState } from "react";

export const Logo = (props: HTMLChakraProps<"svg">) => {
  const [logo, setLogo] = useState<undefined|ReactElement<any, any>>(undefined);

  useEffect(() => {
      setLogo(
        <chakra.svg
          color="on-accent"
          width="auto"
          height="8"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 2703.214 1272.608"
        >
          <g>
            <g>
              <path
                fill="currentColor"
                d="M72.373,651.52C62.109,212.429,541.276-95.972,961.842,145.033c138.551,79.397,256.167,196.988,382.632,325.418
        c5.749,5.839,8.404,5.236,13.785-0.188c197.808-199.402,484.222-503.454,885.399-385.157
        c168.833,49.784,286.15,159.321,346.255,324.377c201.16,552.413-375.869,1009.769-870.693,706.588
        c-124.801-76.466-232.581-181.978-359.98-311.726c-6.801-6.927-9.868-5.946-16.086,0.324
        c-144.739,145.956-300.538,304.607-492.977,371.024C458.575,1310.846,83.17,1077.492,72.373,651.52z M317.418,643.008
        c12.485,253.639,207.59,371.88,415.468,326.918c179.653-38.857,330.36-196.86,458.721-328.811c4.325-4.446,1.9-6.251-1.072-9.025
        c-111.488-104.066-220.365-231.184-357.581-296.6C567.01,208.705,316.523,394.639,317.418,643.008z M2385.265,632.288
        c-7.903-245.124-201.289-378.703-424.132-326.433c-175.334,41.126-325.161,198.381-449.641,326.279
        c-4.318,4.437-2.66,6.509,0.879,9.811c155.637,145.245,339.3,374.567,587.443,332.772
        C2265.103,946.877,2385.634,802.91,2385.265,632.288z"
              />
            </g>
          </g>
        </chakra.svg>);
  }, []);
  return <>{logo}</>;
};
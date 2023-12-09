import { theme as proTheme } from "@chakra-ui/pro-theme";
import { extendTheme } from "@chakra-ui/react";

export const theme = extendTheme(
  {
    colors: {
      ...proTheme.blue,
      brand: proTheme.colors.blue,
    },
  },
  proTheme,
);

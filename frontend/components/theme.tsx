import { theme as proTheme } from "@chakra-ui/pro-theme";
import { extendTheme, theme as baseTheme } from "@chakra-ui/react";

export const apeiroTheme = extendTheme({
  colors: {
    ...baseTheme.colors,
    brand: baseTheme.colors.blue,
  },
}, proTheme, baseTheme)
import React from "react";
import { EmojiType } from "./types";
import { Flex } from "@chakra-ui/react";

type Props = { emoji: EmojiType; onClick?: (emoji: EmojiType) => void };

const Emoji = ({ emoji, onClick }: Props) => {
  return (
    <Flex
      as={onClick !== null ? "button" : "div"}
      textAlign="center"
      onClick={() => {
        if (onClick) onClick(emoji);
      }}
    >
      {emoji.unicodeString}
    </Flex>
  );
};

export default Emoji;

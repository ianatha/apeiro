import React from "react";
import { Flex, Heading, SimpleGrid } from "@chakra-ui/react";
import { categories, categoriesList, unicodeEmojis } from "./constants";
import { EmojiType } from "./types";
import Emoji from "./Emoji";

type Props = {
  onSelectEmoji: (emoji: EmojiType) => void;
};

const EmojiCategory = ({
  category,
  onSelectEmoji,
  emojis,
}: {
  category: string;
  emojis: Array<EmojiType>;
  onSelectEmoji: (emoji: EmojiType) => void;
}) => {
  return (
    <Flex direction="column">
      <Heading>{category}</Heading>
      <SimpleGrid minChildWidth="20px" spacing="4px" alignContent="center">
        {emojis.map((emoji) => (
          <Emoji
            key={emoji.unicodeString}
            onClick={onSelectEmoji}
            emoji={emoji}
          />
        ))}
      </SimpleGrid>
    </Flex>
  );
};

const EmojiPicker = ({ onSelectEmoji }: Props) => {
  return (
    <Flex direction="column">
      {categoriesList.map((category, i) => (
        <EmojiCategory
          key={i}
          onSelectEmoji={onSelectEmoji}
          category={category}
          emojis={unicodeEmojis[category]}
        />
      ))}
    </Flex>
  );
};

export default EmojiPicker;

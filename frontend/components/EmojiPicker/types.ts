type UnicodeEmoji = {
  type: "unicode";
  name: string;
  unicodeString: string;
};

export type EmojiType = UnicodeEmoji;

// export const SELECT_EMOJI = "SELECT_EMOJI";

// interface SelectEmojiAction extends Action {
//   type: typeof SELECT_EMOJI;
//   emoji: EmojiType;
// }

// export type SelectedEmojiActionTypes = SelectEmojiAction;

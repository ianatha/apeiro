import { PCToSrcMapping } from "./PCToSrcMapping";


export function insert_mark(last_frame: any, mapping: PCToSrcMapping[], src: string): string {
  if (last_frame == undefined || mapping == undefined) {
    return src;
  }
  last_frame.fnhash = parseInt(last_frame.fnhash);

  for (const map_entry of mapping) {
    if (map_entry.fnhash == last_frame.fnhash && map_entry.pc == last_frame["$pc"]) {
      let start = map_entry.start_loc - 1;
      let end = map_entry.end_loc;
      src = src.slice(0, start) + ">>>>> BLOCKING HERE <<<<< " + src.slice(start);
      break;
    }
  }

  return src;
}

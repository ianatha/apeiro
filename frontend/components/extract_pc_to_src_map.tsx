import { PCToSrcMapping } from "../pages/procs/[pid]";


export function extract_pc_to_src_map(src: string): PCToSrcMapping[] {
  if (src == undefined) {
    return [];
  }
  let identifier = "//# programCounterMapping=";
  let pc_map_start = src.indexOf(identifier);
  if (pc_map_start >= 0) {
    let pc_map_end = src.indexOf("\n", pc_map_start);
    let pc_map_str = src.slice(pc_map_start + identifier.length, (pc_map_end == -1 ? undefined : pc_map_end));
    console.log(pc_map_str);
    let pc_map = JSON.parse(pc_map_str);
    return pc_map;
  }

  return [];
}

export * from "./math.js";
export * from "./string.js";

export default function defaultHelper(msg: string): string {
  return `[default] ${msg}`;
}

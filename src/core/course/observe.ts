import type { Exercise, Observe } from "../../schema/index.ts";
import { UserError } from "../errors.ts";

/** 観測点の別名。judge.on はこの名前を指す。 */
export function observeAliases(spec: Exercise): Map<string, Observe> {
  const aliases = new Map<string, Observe>();
  for (const observe of spec.observe) {
    const name = observe.as ?? defaultAlias(observe);
    if (aliases.has(name)) {
      throw new UserError(spec.id + ": observe の名前が重複しています: " + name);
    }
    aliases.set(name, observe);
  }
  return aliases;
}

export function defaultAlias(observe: Observe): string {
  switch (observe.kind) {
    case "exit":
      return "exit";
    case "stdout":
      return "stdout";
    case "stderr":
      return "stderr";
    case "file":
      return "file:" + observe.path;
    case "exists":
      return "exists:" + observe.path;
  }
}

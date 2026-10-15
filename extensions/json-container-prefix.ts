/** True if text is a complete JSON container or can become one by appending
 * input. Used to recognize provider bodies cut off mid-token, without guessing
 * missing content or accepting arbitrary prose. No payload text is emitted. */
export function isJsonContainerPrefix(text: string): boolean {
  type Frame =
    | { kind: "object"; phase: "keyOrEnd" | "key" | "colon" | "value" | "commaOrEnd" }
    | { kind: "array"; phase: "valueOrEnd" | "value" | "commaOrEnd" };
  type TokenResult = "complete" | "incomplete" | "invalid";
  let index = 0;
  const skipWhitespace = (): void => {
    while (index < text.length && /[ \t\r\n]/.test(text[index]!)) index++;
  };
  skipWhitespace();
  const first = text[index++];
  if (first !== "{" && first !== "[") return false;
  const frames: Frame[] = [first === "{"
    ? { kind: "object", phase: "keyOrEnd" }
    : { kind: "array", phase: "valueOrEnd" }];

  const readString = (): TokenResult => {
    index++; // opening quote
    while (index < text.length) {
      const char = text[index++]!;
      if (char === '"') return "complete";
      if (char.charCodeAt(0) < 0x20) return "invalid";
      if (char !== "\\") continue;
      if (index === text.length) return "incomplete";
      const escape = text[index++]!;
      if (escape === "u") {
        for (let digit = 0; digit < 4; digit++) {
          if (index === text.length) return "incomplete";
          if (!/[\da-f]/i.test(text[index++]!)) return "invalid";
        }
      } else if (!'"\\/bfnrt'.includes(escape)) {
        return "invalid";
      }
    }
    return "incomplete";
  };

  while (true) {
    skipWhitespace();
    if (index === text.length) return true;
    const frame = frames[frames.length - 1];
    if (!frame) return false; // trailing non-whitespace after a complete root
    const char = text[index]!;
    if (frame.kind === "object" && (frame.phase === "keyOrEnd" || frame.phase === "key")) {
      if (char === "}" && frame.phase === "keyOrEnd") {
        frames.pop();
        index++;
        continue;
      }
      if (char !== '"') return false;
      const result = readString();
      if (result !== "complete") return result === "incomplete";
      frame.phase = "colon";
      continue;
    }
    if (frame.kind === "object" && frame.phase === "colon") {
      if (char !== ":") return false;
      index++;
      frame.phase = "value";
      continue;
    }
    if (frame.phase === "commaOrEnd") {
      if (char === (frame.kind === "object" ? "}" : "]")) {
        frames.pop();
        index++;
        continue;
      }
      if (char !== ",") return false;
      index++;
      if (frame.kind === "object") frame.phase = "key";
      else frame.phase = "value";
      continue;
    }
    if (frame.kind === "array" && frame.phase === "valueOrEnd" && char === "]") {
      frames.pop();
      index++;
      continue;
    }

    // A value is required. Reserve its parent slot before descending, so a
    // nested container returns to the same comma/end state as a scalar.
    frame.phase = "commaOrEnd";
    if (char === "{" || char === "[") {
      frames.push(char === "{"
        ? { kind: "object", phase: "keyOrEnd" }
        : { kind: "array", phase: "valueOrEnd" });
      index++;
    } else if (char === '"') {
      const result = readString();
      if (result !== "complete") return result === "incomplete";
    } else if (char === "t" || char === "f" || char === "n") {
      const literal = char === "t" ? "true" : char === "f" ? "false" : "null";
      const remaining = text.slice(index);
      if (remaining.length < literal.length) return literal.startsWith(remaining);
      if (!remaining.startsWith(literal)) return false;
      index += literal.length;
    } else if (char === "-" || /\d/.test(char)) {
      const start = index++;
      while (index < text.length && /[\deE+.-]/.test(text[index]!)) index++;
      const number = text.slice(start, index);
      if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(number)) {
        return index === text.length && /^(?:-|-?(?:0|[1-9]\d*)(?:\.|(?:\.\d+)?[eE][+-]?))$/.test(number);
      }
    } else {
      return false;
    }
  }
}

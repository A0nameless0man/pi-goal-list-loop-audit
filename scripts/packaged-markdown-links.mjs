import path from "node:path";

/** Navigation links outside code, including reference-style destinations.
 * Anchor existence is a separate concern; this checks package file coverage. */
export function markdownLinkTargets(source) {
  const prose = source
    .replace(/^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\1[^\n]*$/gm, "")
    .replace(/(`+)[\s\S]*?\1/g, "");
  const targets = [...prose.matchAll(/\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+[^)]*)?\)/g)]
    .map(match => match[1] ?? match[2]);
  const references = new Map([...prose.matchAll(/^ {0,3}\[([^\]]+)\]:\s*(?:<([^>]+)>|(\S+))/gm)]
    .map(match => [match[1].trim().toLowerCase(), match[2] ?? match[3]]));
  for (const match of prose.matchAll(/\[([^\]]+)\](?:\[([^\]]*)\])?/g)) {
    const target = references.get((match[2] || match[1]).trim().toLowerCase());
    if (target) targets.push(target);
  }
  return [...new Set(targets)];
}

/** Validate all shipped Markdown pages, rather than a hand-picked subset. */
export function missingPackagedMarkdownLinks(files, read) {
  const shipped = new Set(files);
  const missing = [];
  for (const document of shipped) {
    if (!document.endsWith(".md")) continue;
    for (const target of markdownLinkTargets(read(document))) {
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(target)) continue;
      const pathname = target.split(/[?#]/)[0];
      if (!pathname) continue;
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(document), decodeURIComponent(pathname)));
      if (!shipped.has(resolved) && ![...shipped].some(file => file.startsWith(resolved.replace(/\/$/, "") + "/"))) {
        missing.push({ document, target, resolved });
      }
    }
  }
  return missing;
}

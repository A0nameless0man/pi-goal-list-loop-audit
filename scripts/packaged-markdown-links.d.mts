export function markdownLinkTargets(source: string): string[];
export function missingPackagedMarkdownLinks(files: Iterable<string>, read: (file: string) => string): Array<{ document: string; target: string; resolved: string }>;

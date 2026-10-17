export declare const GLOBAL_NAMES_MARKER: string;
export declare const GLOBAL_NAMES_TERMINATOR: string;
export declare const AUDIT_BASELINE_GLOBAL_NAMES: number;
export declare function extractGlobalNames(source: string, fileLabel?: string): string[];
export declare function baselineDrift(count: number): string | null;

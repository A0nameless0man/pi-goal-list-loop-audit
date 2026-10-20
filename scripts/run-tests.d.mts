export declare const SERIAL_FLAGS: string[];

export declare const DEFAULT_TEST_TIMEOUT_MS: number;
export declare const MAX_TEST_TIMEOUT_MS: number;
export declare function serialFlags(timeoutMs?: number): string[];

export declare const NODE_ONLY_TEST_FILES: string[];

export declare const DEFAULT_STALL_TIMEOUT_MS: number;
export declare const DEFAULT_HEARTBEAT_MS: number;
export declare function stallTimeoutMs(env?: Record<string, string | undefined>): number;
export declare function heartbeatMs(env?: Record<string, string | undefined>): number;
export declare function isStalled(input: { silentMs: number; limitMs: number }): boolean;

export declare function buildRunnerArgs(
  argv: string[],
  slowFiles: string[],
  nodeOnlyFiles?: string[],
  options?: { timeoutMs?: number },
): { mode: string; bunArgs: string[] };

export declare function runBlocking(args: string[]): number;

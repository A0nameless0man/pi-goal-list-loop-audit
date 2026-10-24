export const DEFAULT_PROBE_CPU_MS: number;
export const MIN_CONTENTION_FACTOR: number;
export const MAX_CONTENTION_FACTOR: number;
export const DEFAULT_FACTOR_MAX_AGE_MS: number;
export const MAX_LOAD_SCALE_FACTOR: number;
export const LOAD_FACTOR_MAX_AGE_MS: number;
export function measureContentionFactor(options?: {
  probeCpuMs?: number;
  min?: number;
  max?: number;
}): {
  factor: number;
  wallMs: number;
  cpuMs: number;
  spins: number;
  measurable: boolean;
};
export function contentionFactor(options?: {
  maxAgeMs?: number;
  force?: boolean;
  probeCpuMs?: number;
  min?: number;
  max?: number;
}): number;
export function scaledBudgetMs(baseMs: number, options?: {
  maxAgeMs?: number;
  force?: boolean;
  stable?: boolean;
  probeCpuMs?: number;
  min?: number;
  max?: number;
}): number;
export function stableContentionFactor(options?: {
  probeCpuMs?: number;
  min?: number;
  max?: number;
}): number;
export function hostLoadFactor(options?: {
  maxAgeMs?: number;
  force?: boolean;
}): number;
export function hangFactor(options?: {
  maxAgeMs?: number;
  force?: boolean;
  probeCpuMs?: number;
  min?: number;
  max?: number;
}): number;
export function resetContentionFactor(): void;

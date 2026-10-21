/** A drafting retry delay belongs to its lease, not to a detached timer.
 * Cancellation must settle it immediately and remove the timer so an old
 * interview cannot select a model or inject a prompt after it has ended. */
export function waitForDrafterRetry(delayMs: number, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false);
  return new Promise((resolve) => {
    const finish = (ready: boolean): void => {
      clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
      resolve(ready);
    };
    const cancel = (): void => finish(false);
    const timer = setTimeout(() => finish(true), Math.max(0, delayMs));
    signal.addEventListener("abort", cancel, { once: true });
  });
}

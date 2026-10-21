const THINKING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;

/** Resolve the auditor dial against each selected candidate, not just the primary.
 * Old settings keep their meaning: unset inherits the session dial. Unsupported
 * levels fall downwards; a non-reasoning model always gets off. */
export function resolveAuditorThinkingLevel(model: { reasoning?: boolean; thinkingLevelMap?: Record<string, string | null> } | undefined, requested: string): string {
  const levels = THINKING_LEVELS;
  if (!model?.reasoning) return 'off';
  const supported = levels.filter(level => {
    const mapped = model.thinkingLevelMap?.[level];
    return mapped !== null && !((level === 'xhigh' || level === 'max') && mapped === undefined);
  });
  return resolveSupportedThinkingLevel(supported, requested);
}

/** Shared by dispatch and capability-aware displays. Never raise an unsupported
 * request to a higher supported level, even when max exists without xhigh. */
export function resolveSupportedThinkingLevel(supported: readonly string[], requested: string): string {
  const levels: readonly string[] = THINKING_LEVELS;
  const ceiling = levels.indexOf(requested);
  for (let index = ceiling < 0 ? levels.indexOf('high') : ceiling; index >= 0; index--) {
    if (supported.includes(levels[index]!)) return levels[index]!;
  }
  return 'off';
}

/** The candidate shape the dial decision needs: how the candidate was
 * reached, and whether it IS the session's own model. */
export interface AuditorThinkingCandidate {
  via?: string;
  isSessionModel?: boolean;
  model?: { reasoning?: boolean; thinkingLevelMap?: Record<string, string | null> } | any;
}

/**
 * Is this candidate the SESSION's own model reached as the auditor's implicit
 * tail?
 *
 * The session model is the auditor's default (nothing configured) and its
 * final last resort (a configured chain has failed). Reaching it that way is
 * different from the user PINNING it as the auditor model: a pin is an
 * explicit choice and keeps the auditor's configured dial, while the implicit
 * tail is the session's own model and runs at the session's own dial.
 */
export function isSessionModelTail(candidate: AuditorThinkingCandidate | undefined): boolean {
  if (!candidate) return false;
  const via = candidate.via ?? '';
  return via === 'session' || via === 'session-fallback';
}

/**
 * The thinking level for ONE auditor candidate.
 *
 * The auditor's configured dial (`auditorThinkingLevel`) is a choice about
 * the CONFIGURED auditor models: an explicit override of the dial those run
 * at. The session model is not one of those — it is the session's own model,
 * reached as the auditor's default or its last resort — so it runs at the
 * session's own thinking level.
 *
 * Field report (2026-10-21): the operator's session was at `max` while the
 * auditor was configured at `xhigh`. When the configured auditor route
 * failed, the fallback to the session model ran at `xhigh` — the last resort
 * that has to carry the decision was the one route deliberately turned down
 * a notch, and `resolveAuditorThinkingLevel` would resolve it DOWN further if
 * the session's model did not advertise `xhigh`.
 *
 * With nothing configured the session dial already applied to every
 * candidate, and that is unchanged: an unset `auditorThinkingLevel` inherits
 * the live session thinking level for all of them.
 */
export function resolveCandidateThinkingLevel(
  candidate: AuditorThinkingCandidate | undefined,
  options: { auditorThinkingLevel?: string; sessionThinkingLevel?: string } = {},
): string {
  const sessionDial = options.sessionThinkingLevel ?? 'max';
  const requested = isSessionModelTail(candidate)
    ? sessionDial
    : (options.auditorThinkingLevel ?? sessionDial);
  return resolveAuditorThinkingLevel(candidate?.model, requested);
}

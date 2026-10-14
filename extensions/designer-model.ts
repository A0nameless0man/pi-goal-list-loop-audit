// Designer model resolution (selection-time).
//
// Unlike the drafter — a temporary in-process lease that can walk its
// fallback chain live on provider failure — the Designer is spawned by
// pi-subagents from a static Designer.md carrying ONE `model:` line. GLLA
// can therefore only pre-select the first eligible ref when the agent file
// is (re)written: primary → fallbacks → session last-fallback. The session
// model is always the automatic final entry (when present, not forbidden,
// and not already configured): an explicitly selected primary still wins,
// and only a fully ineligible configured chain falls through to the
// session pin. This module owns that selection so startup sync, settings
// edits, and goal dispatch all resolve identically.

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

import { resolveDrafterModelRef } from "./drafter-model.js";
import { resolveDesignerConfig, type Settings } from "./goal-settings.js";
import { appendLedger, isForbiddenModel } from "./goal-loop-core.js";
import { MAX_MAIN_MODEL_FALLBACKS, modelRef, normalizeMainModelFallbackRefs } from "./main-model-recovery.js";

export interface DesignerModelResolution {
  /** Ordered configured refs (primary first), bounded and deduped.
   * The automatic session last-fallback is NOT included here — it is only
   * appended at selection time (see below), so settings surfaces keep
   * showing exactly what the operator configured. */
  configuredRefs: string[];
  /** First eligible ref to write into Designer.md: the selected primary or
   * fallback when one is eligible, otherwise the session model as the
   * automatic last fallback. Undefined = inherit session dynamically (no
   * session model is known at resolve time). */
  selectedRef?: string;
  /** No eligible configured ref AND the session model itself is forbidden:
   * the caller must NOT register Designer (it would inherit a forbidden model). */
  blocked: boolean;
}

/** Resolve the Designer model for the next Designer.md write. Never makes a
 * provider request; eligibility is registry presence + configured auth.
 * `reportBlocked: false` suppresses the ledger entry — pure display paths
 * (settings menu rendering) must not ledger on every repaint. */
export function resolveDesignerModel(
  ctx: Pick<ExtensionContext, "modelRegistry" | "model" | "cwd">,
  settings: Pick<Settings, "designerModel" | "designerThinkingLevel" | "designerModelFallbacks" | "designerEnabled" | "subagentModelOverrides" | "subagentThinkingOverrides" | "subagentFallbacks" | "forbiddenModels">,
  opts?: { reportBlocked?: boolean },
): DesignerModelResolution {
  const config = resolveDesignerConfig(settings as Settings);
  const configuredRefs = normalizeMainModelFallbackRefs([
    ...(config.model ? [config.model] : []),
    ...config.fallbacks,
  ]).slice(0, MAX_MAIN_MODEL_FALLBACKS);
  const forbidden = (ref: string) => isForbiddenModel(ref, settings.forbiddenModels);
  const currentRef = modelRef(ctx.model as any);
  // Automatic last fallback: the live session model closes the chain unless
  // it is absent, forbidden, or already configured (dedupe, case-insensitive
  // like the normalizer). Configured refs always win; the session pin only
  // fires when the whole configured chain is ineligible.
  const chain = [...configuredRefs];
  if (currentRef && !forbidden(currentRef)
    && !chain.some((ref) => ref.toLowerCase() === currentRef.toLowerCase())) {
    chain.push(currentRef);
  }
  for (const ref of chain) {
    if (forbidden(ref)) continue;
    if (resolveDrafterModelRef(ctx, ref)) {
      return { configuredRefs, selectedRef: ref, blocked: false };
    }
  }
  const blocked = !!currentRef && forbidden(currentRef);
  if (blocked && opts?.reportBlocked !== false) {
    appendLedger(ctx.cwd, "forbidden_model_switch", { scope: "designer", ref: currentRef, via: "session-inherit", blocked: true });
  }
  return { configuredRefs, blocked };
}

// Designer model resolution (selection-time).
//
// Unlike the drafter — a temporary in-process lease that can walk its
// fallback chain live on provider failure — the Designer is spawned by
// pi-subagents from a static Designer.md carrying ONE `model:` line. GLLA
// can therefore only pre-select the first eligible ref when the agent file
// is (re)written: primary → fallbacks → session inherit. This module owns
// that selection so startup sync, settings edits, and goal dispatch all
// resolve identically.

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

import { resolveDrafterModelRef } from "./drafter-model.js";
import { resolveDesignerConfig, type Settings } from "./goal-settings.js";
import { appendLedger, isForbiddenModel } from "./goal-loop-core.js";
import { MAX_MAIN_MODEL_FALLBACKS, modelRef, normalizeMainModelFallbackRefs } from "./main-model-recovery.js";

export interface DesignerModelResolution {
  /** Ordered configured refs (primary first), bounded and deduped. */
  configuredRefs: string[];
  /** First eligible ref to write into Designer.md; undefined = inherit session. */
  selectedRef?: string;
  /** No eligible configured ref AND the session model itself is forbidden:
   * the caller must NOT register Designer (it would inherit a forbidden model). */
  blocked: boolean;
}

/** Resolve the Designer model for the next Designer.md write. Never makes a
 * provider request; eligibility is registry presence + configured auth. */
export function resolveDesignerModel(
  ctx: Pick<ExtensionContext, "modelRegistry" | "model" | "cwd">,
  settings: Pick<Settings, "designerModel" | "designerThinkingLevel" | "designerModelFallbacks" | "designerEnabled" | "subagentModelOverrides" | "subagentThinkingOverrides" | "subagentFallbacks" | "forbiddenModels">,
): DesignerModelResolution {
  const config = resolveDesignerConfig(settings as Settings);
  const configuredRefs = normalizeMainModelFallbackRefs([
    ...(config.model ? [config.model] : []),
    ...config.fallbacks,
  ]).slice(0, MAX_MAIN_MODEL_FALLBACKS);
  const forbidden = (ref: string) => isForbiddenModel(ref, settings.forbiddenModels);
  for (const ref of configuredRefs) {
    if (forbidden(ref)) continue;
    if (resolveDrafterModelRef(ctx, ref)) {
      return { configuredRefs, selectedRef: ref, blocked: false };
    }
  }
  const currentRef = modelRef(ctx.model as any);
  const blocked = !!currentRef && forbidden(currentRef);
  if (blocked) {
    appendLedger(ctx.cwd, "forbidden_model_switch", { scope: "designer", ref: currentRef, via: "session-inherit", blocked: true });
  }
  return { configuredRefs, blocked };
}

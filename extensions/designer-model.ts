// Designer model resolution (selection-time).
//
// Unlike the drafter — a temporary in-process lease that can walk its
// fallback chain live on provider failure — the Designer is spawned by
// pi-subagents from a static Designer.md carrying ONE `model:` line. GLLA
// can therefore only pre-select the first eligible ref when the agent file
// is (re)written. With no configured chain the DEFAULT is the session's
// model AND thinking. With configuration: primary → explicit fallbacks →
// session pair when the whole configured chain is ineligible. An explicit
// selection always wins; the session route never inherits a stale role dial.
// This module owns that selection so startup sync, settings
// edits, and goal dispatch all resolve identically.

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

import { resolveDrafterModelRef } from "./drafter-model.js";
import { resolveAuditorThinkingLevel } from "./auditor-thinking.js";
import { resolveDesignerConfig, type Settings } from "./goal-settings.js";
import { appendLedger, isForbiddenModel } from "./goal-loop-core.js";
import { MAX_MAIN_MODEL_FALLBACKS, modelRef, normalizeBoundedModelRefs, normalizeMainModelFallbackRefs } from "./main-model-recovery.js";

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
  /** Session inheritance is the default when no chain was configured, not
   * an exhausted fallback. Configured models retain their own dial. */
  via?: "configured" | "session" | "session-fallback";
  thinking?: string;
  /** No eligible configured ref AND the session model itself is forbidden:
   * the caller must NOT register Designer (it would inherit a forbidden model). */
  blocked: boolean;
}

/** Resolve the Designer model for the next Designer.md write. Never makes a
 * provider request; eligibility is registry presence + configured auth.
 * `reportBlocked: false` suppresses the ledger entry — pure display paths
 * (settings menu rendering) must not ledger on every repaint. */
export function resolveDesignerModel(
  ctx: Pick<ExtensionContext, "modelRegistry" | "model" | "cwd"> & { thinkingLevel?: string },
  settings: Pick<Settings, "designerModel" | "designerThinkingLevel" | "designerModelFallbacks" | "designerEnabled" | "subagentModelOverrides" | "subagentThinkingOverrides" | "subagentFallbacks" | "forbiddenModels">,
  opts?: { reportBlocked?: boolean },
): DesignerModelResolution {
  const config = resolveDesignerConfig(settings as Settings);
  // Ten fallback slots are independent of the optional primary. Only the
  // setting itself is capped; combining it with the primary must not drop #10.
  const configuredRefs = normalizeBoundedModelRefs([
    ...(config.model ? [config.model] : []),
    ...normalizeMainModelFallbackRefs(config.fallbacks),
  ], MAX_MAIN_MODEL_FALLBACKS + 1);
  const forbidden = (ref: string) => isForbiddenModel(ref, settings.forbiddenModels);
  const currentRef = modelRef(ctx.model as any);
  for (const ref of configuredRefs) {
    if (forbidden(ref)) continue;
    const model = resolveDrafterModelRef(ctx, ref);
    if (!model || forbidden(modelRef(model) ?? ref)) continue;
    const requested = config.thinking ?? ctx.thinkingLevel;
    return {
      configuredRefs, selectedRef: ref, via: "configured", blocked: false,
      ...(requested !== undefined ? { thinking: resolveAuditorThinkingLevel(model, requested) } : {}),
    };
  }
  // The session route inherits the PAIR: model and live thinking. Never
  // carry a configured Designer dial onto this route. The live session is
  // already resolved; requiring registry auth again can reject working
  // extension-provided session models.
  if (currentRef && !forbidden(currentRef)) {
    return {
      configuredRefs, selectedRef: currentRef, blocked: false,
      via: configuredRefs.length ? "session-fallback" : "session",
      ...(ctx.thinkingLevel !== undefined ? { thinking: ctx.thinkingLevel } : {}),
    };
  }
  const blocked = !!currentRef && forbidden(currentRef);
  if (blocked && opts?.reportBlocked !== false) {
    appendLedger(ctx.cwd, "forbidden_model_switch", { scope: "designer", ref: currentRef, via: "session-inherit", blocked: true });
  }
  return { configuredRefs, blocked };
}

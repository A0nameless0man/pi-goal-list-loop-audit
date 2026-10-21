// Drafting-only model resolution and fallback selection.
//
// Drafting runs in the main pi session, so the selected model is a temporary
// lease: the caller must restore the original session model when drafting
// ends. This module only resolves an ordered candidate list; lifecycle and
// retries remain in goal-list-queue.ts.

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

import { appendLedger, isForbiddenModel } from "./goal-loop-core.js";
import { MAX_MAIN_MODEL_FALLBACKS, modelRef, normalizeBoundedModelRefs, normalizeMainModelFallbackRefs } from "./main-model-recovery.js";
import { ModelSelector } from "./model-selector.js";
import type { Settings } from "./goal-settings.js";

export const MAX_DRAFTER_FALLBACKS = MAX_MAIN_MODEL_FALLBACKS;

export interface DrafterModelCandidate {
  ref: string;
  model: any;
  via: "configured" | "session" | "session-last-resort";
}

/** The implicit session route inherits its thinking as well as its model.
 * Role-specific thinking only applies to explicitly configured models. */
export function resolveDrafterThinkingLevel(candidate: DrafterModelCandidate, sessionThinking: string, configuredThinking?: string): string {
  return candidate.via === "configured" ? configuredThinking ?? sessionThinking : sessionThinking;
}

export interface DrafterModelResolution {
  configuredRefs: string[];
  candidates: DrafterModelCandidate[];
  selected?: DrafterModelCandidate;
}

/** Resolve a provider/model ref without making a provider request. */
export function resolveDrafterModelRef(ctx: Pick<ExtensionContext, "modelRegistry">, ref: string): any | undefined {
  const trimmed = ref.trim();
  if (!trimmed) return undefined;
  const slash = trimmed.indexOf("/");
  try {
    if (slash > 0) {
      const model = ctx.modelRegistry.find(trimmed.slice(0, slash), trimmed.slice(slash + 1));
      if (!model || !ctx.modelRegistry.hasConfiguredAuth(model)) return undefined;
      return model;
    }
    return ctx.modelRegistry
      .getAvailable()
      .filter((candidate: any) => candidate.id === trimmed || candidate.name === trimmed)
      .find((candidate: any) => ctx.modelRegistry.hasConfiguredAuth(candidate));
  } catch {
    return undefined;
  }
}

/**
 * Resolve the dedicated drafter chain. The current session model is always a
 * final in-process fallback, even when every configured candidate is missing
 * auth or forbidden. No error text, quota state, or retry hint is inspected.
 */
export function resolveDrafterModel(ctx: ExtensionContext, settings: Pick<Settings, "drafterModel" | "drafterModelFallbacks" | "forbiddenModels">): DrafterModelResolution {
  const primary = typeof settings.drafterModel === "string" ? settings.drafterModel.trim() : "";
  // Bound the fallback setting before prepending the independent primary.
  const configuredRefs = normalizeBoundedModelRefs([
    ...(primary ? [primary] : []),
    ...normalizeMainModelFallbackRefs(settings.drafterModelFallbacks),
  ], MAX_DRAFTER_FALLBACKS + 1);
  const currentRef = modelRef(ctx.model);
  const forbidden = (ref: string) => isForbiddenModel(ref, settings.forbiddenModels);
  const selector = new ModelSelector({
    getChain: () => configuredRefs,
    resolve: (ref) => {
      const model = resolveDrafterModelRef(ctx, ref);
      // Bare names/aliases must not bypass policy on the resolved identity.
      return model && !forbidden(modelRef(model) ?? ref) ? model : undefined;
    },
    isForbidden: forbidden,
    record: (event) => {
      appendLedger(ctx.cwd, "model_fallback_select", {
        scope: event.scope.kind,
        fromRef: event.fromRef,
        toRef: event.toRef,
        reason: event.reason,
      });
    },
  });
  const attempted: string[] = [];
  const candidates: DrafterModelCandidate[] = [];

  // KEEP: drafting intentionally leases the current model when pinned (unlike
  // Main which skips `current` via nextUntriedModelRef because it just failed).
  // Align ledger to Main but keep this lease gate — removing it would force a
  // needless setModel when the user pinned the drafter to the session model.
  const configuredPrimary = configuredRefs[0];
  if (
    configuredPrimary &&
    currentRef &&
    configuredPrimary.toLowerCase() === currentRef.toLowerCase() &&
    !forbidden(configuredPrimary) &&
    ctx.model
  ) {
    candidates.push({ ref: configuredPrimary, model: ctx.model, via: "configured" });
    attempted.push(configuredPrimary);
  }

  while (configuredRefs.length > 0) {
    const selected = selector.selectNextValid({ kind: "drafter" }, currentRef, attempted);
    if (!("model" in selected) || typeof selected.ref !== "string") break;
    attempted.push(selected.ref);
    const identity = modelRef(selected.model)?.toLowerCase() ?? selected.ref.toLowerCase();
    if (!candidates.some(candidate => (modelRef(candidate.model) ?? candidate.ref).toLowerCase() === identity)) {
      candidates.push({ ref: selected.ref, model: selected.model, via: "configured" });
    }
  }
  if (ctx.model && currentRef && !candidates.some((candidate) => (modelRef(candidate.model) ?? candidate.ref).toLowerCase() === currentRef.toLowerCase())) {
    // Audit 2026-09-06: the session last resort must not bypass the
    // forbiddenModels gate — a forbidden session model is refused (and
    // ledgered) instead of being leased silently.
    if (forbidden(currentRef)) {
      appendLedger(ctx.cwd, "forbidden_model_switch", { scope: "drafter", ref: currentRef, via: "session-last-resort", blocked: true });
    } else {
      candidates.push({ ref: currentRef, model: ctx.model, via: configuredRefs.length ? "session-last-resort" : "session" });
    }
  }
  return { configuredRefs, candidates, selected: candidates[0] };
}

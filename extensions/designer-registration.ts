// Designer.md is a launch-time projection, not a saved Designer model pick.
//
// pi-subagents resolves a child from the agent definition file when the child
// starts, so a session-inherited Designer must carry the CURRENT session model
// and thinking at that moment — never a snapshot taken at startup. GLLA owns
// the managed copy of that file, so GLLA refreshes the projection at the
// boundaries where a launch can happen: a model/thinking selection, a turn
// start, and the subagent tool call that names the Designer role.
//
// The refresh never turns session inheritance into a stored pin: settings are
// never written, explicitly selected Designer model/thinking stay independent,
// disabled and forbidden policy still win, and a user-owned definition file is
// left alone.
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { resolveDesignerModel } from "./designer-model.js";
import { resolveDesignerConfig, type Settings } from "./goal-settings.js";
import {
  defaultAgentDir, designerFileState, ensureRequestedDesigner, removeManagedDesigner,
} from "./goal-loop-subagents.js";

/** The parts of the extension context the Designer resolution needs. */
export interface DesignerSessionContext {
  cwd: string;
  model: ExtensionContext["model"];
  modelRegistry: ExtensionContext["modelRegistry"];
  thinkingLevel?: string;
}

/** Snapshot the live session dial without copying the whole context. */
export function designerSessionContext(
  ctx: ExtensionContext,
  overrides: { model?: ExtensionContext["model"]; thinkingLevel?: string } = {},
): DesignerSessionContext {
  return {
    cwd: ctx.cwd,
    model: overrides.model !== undefined ? overrides.model : ctx.model,
    modelRegistry: ctx.modelRegistry,
    thinkingLevel: overrides.thinkingLevel !== undefined ? overrides.thinkingLevel : ctx.thinkingLevel,
  };
}

/** A direct or declarative workflow request is explicit opt-in. Never infer
 * a role request from task prose, management actions, or executable scripts. */
export function requestsDesigner(input: unknown, depth = 0): boolean {
  if (depth > 8 || input === null || typeof input !== "object") return false;
  if (Array.isArray(input)) return input.some(value => requestsDesigner(value, depth + 1));
  const request = input as Record<string, unknown>;
  if (request.action !== undefined) return false;
  if (typeof request.agent === "string" && request.agent.toLowerCase() === "designer") return true;
  return ["tasks", "chain", "parallel"].some(key => requestsDesigner(request[key], depth + 1));
}

export type DesignerRegistrationOutcome =
  /** The managed definition now carries the current session pair. */
  | "registered"
  /** Nothing is registered and nothing should be. */
  | "absent"
  /** The operator disabled Designer; the managed copy was removed. */
  | "disabled"
  /** The session model is forbidden and no eligible Designer model exists. */
  | "blocked"
  /** A user-owned definition file is present and was left untouched. */
  | "user-owned";

/** Keep the managed Designer definition current without enabling it on an
 * unconfigured startup. An explicit request or explicit configuration can
 * create it; disabled or forbidden policy removes only our managed copy.
 * No settings are written, and a user-owned file stays independent. */
export function refreshDesignerRegistration(
  ctx: DesignerSessionContext,
  settings: Settings,
  requested = false,
): DesignerRegistrationOutcome {
  try {
    const agentDir = defaultAgentDir();
    const registered = designerFileState(agentDir);
    if (registered === "user-owned") return "user-owned";
    const config = resolveDesignerConfig(settings);
    if (config.enabled === false) {
      removeManagedDesigner(agentDir);
      return "disabled";
    }
    if (!requested && !config.configured && registered !== "managed") return "absent";
    // A lifecycle refresh is a projection refresh, not a policy decision
    // point: the forbidden-model report belongs to the startup/settings
    // surfaces. Reporting here would append one ledger entry per model,
    // thinking, turn and launch event.
    const resolution = resolveDesignerModel(ctx, settings, { reportBlocked: false });
    if (resolution.blocked) {
      removeManagedDesigner(agentDir);
      return "blocked";
    }
    if (!ensureRequestedDesigner({ agentDir, model: resolution.selectedRef, thinking: resolution.thinking })) {
      return "absent";
    }
    return "registered";
  } catch {
    // A failed refresh must never break the launch it was preparing.
    return "absent";
  }
}

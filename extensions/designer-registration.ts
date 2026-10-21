// Designer.md is a launch-time projection, not a saved Designer model pick.
// Refresh only this role: a full subagent sync would clear unrelated overrides.
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { resolveDesignerModel } from "./designer-model.js";
import { resolveDesignerConfig, type Settings } from "./goal-settings.js";
import {
  defaultAgentDir, designerFileState, ensureRequestedDesigner, removeManagedDesigner,
} from "./goal-loop-subagents.js";

/** A direct or declarative workflow request is explicit opt-in. Never infer
 * a role request from task prose, management actions, or executable scripts. */
export function requestsDesigner(input: unknown, depth = 0): boolean {
  if (depth > 8 || input === null || typeof input !== "object") return false;
  if (Array.isArray(input)) return input.some(value => requestsDesigner(value, depth + 1));
  const request = input as Record<string, unknown>;
  if (request.action !== undefined) return false;
  if (typeof request.agent === "string" && request.agent.toLowerCase() === "designer") return true;
  return ["args", "tasks", "chain", "parallel"].some(key => requestsDesigner(request[key], depth + 1));
}

/** Keep an already registered on-demand Designer fresh without enabling it on
 * an unconfigured startup. Explicit settings/request can create it; disabled
 * or forbidden resolution removes only our managed definition. No settings
 * are written, and user-owned definitions remain entirely independent. */
export function refreshDesignerRegistration(ctx: ExtensionContext, settings: Settings, requested = false): void {
  try {
    const agentDir = defaultAgentDir();
    const registered = designerFileState(agentDir);
    if (registered === "user-owned") return;
    const config = resolveDesignerConfig(settings);
    if (config.enabled === false) {
      removeManagedDesigner(agentDir);
      return;
    }
    if (!requested && !config.configured && registered !== "managed") return;
    const resolution = resolveDesignerModel(ctx, settings);
    if (resolution.blocked) {
      removeManagedDesigner(agentDir);
      if (requested) ctx.ui.notify("Designer not registered: the session model is forbidden and no eligible Designer model is configured.", "warning");
      return;
    }
    if (!ensureRequestedDesigner({ agentDir, model: resolution.selectedRef, thinking: resolution.thinking })) {
      ctx.ui.notify("Designer registration could not be refreshed for the current session.", "warning");
    }
  } catch (error) {
    ctx.ui.notify(`Designer registration refresh failed: ${error instanceof Error ? error.message : String(error)}`, "warning");
  }
}

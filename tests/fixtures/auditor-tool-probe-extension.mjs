// Isolated fixture for the auditor --tools/--extension boundary probe.
// The fixture ACTIVATION runs trusted code (writes code-ran + registers the
// probe tool, then writes tool-registered). Registration succeeding while the
// model can never reach the tool is exactly the boundary under test:
// code execution is trusted, tool availability is filtered.
import fs from "node:fs";
const dir = process.env.GLLA_PROBE_DIR;
export default function auditorToolProbeExtension(pi) {
  fs.writeFileSync(`${dir}/extension-code-ran`, "yes");
  pi.registerProvider("glla-probe-rig", {
    name: "GLLA Probe Rig",
    baseUrl: process.env.GLLA_PROBE_PROVIDER_URL,
    apiKey: "rig-key",
    api: "openai-completions",
    models: [{
      id: "rig-model",
      name: "Rig Model",
      reasoning: false,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 4096,
      maxTokens: 512,
    }],
  });
  pi.registerTool({
    name: "glla_probe_tool",
    description: "Isolated boundary probe tool (must stay model-unreachable under --tools).",
    parameters: { type: "object", properties: {} },
    execute: async () => {
      fs.writeFileSync(`${dir}/tool-executed`, "yes");
      return "probe-ok";
    },
  });
  fs.writeFileSync(`${dir}/tool-registered`, "yes");
}

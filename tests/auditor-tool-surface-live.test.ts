// pi-goal-list-loop-audit — v0.39.38
// tests/auditor-tool-surface-live.test.ts
//
// Live proof of the auditor --tools/--extension boundary against the
// installed pi binary (DECIDED 2026-10-17: verify against Pi core first).
// A fixture extension registers a disallowed tool plus a rigged provider
// whose stub answers the first 3 turns with a tool call for that tool,
// then a final text turn so pi exits promptly (unbounded stubs loop).
// Results: the extension's trusted code runs (load markers), the tool
// registers, but the model-visible surface never contains it and it never
// executes — even under forced tool-call pressure. The unfiltered control
// run proves the rig can expose and execute the tool, so the filtered
// absence is the boundary holding, not a broken fixture.
//
// Hermetic: ephemeral loopback stub, isolated PI_CODING_AGENT_DIR,
// PI_OFFLINE=1, tmp probe dir.
//
// Spawn discipline (learned 2026-10-18, keep): pi -p reads stdin
// (piped-prompt support). Under bun AND node, execFile maps stdio
// "ignore" to a never-EOF socketpair for fd 0, so pi blocks on stdin
// forever with zero output and zero provider traffic — while the same
// command via spawn (or shell </dev/null) dials in <1s. This file must
// use spawn with an explicit /dev/null fd for stdin, never execFile or
// stdio "ignore".

import { test } from "node:test";
import assert from "node:assert/strict";
import { execSync, spawn } from "node:child_process";
import * as fs from "node:fs";
import * as http from "node:http";
import * as os from "node:os";
import * as path from "node:path";

const PI = process.env.PI_BIN ?? "pi";
const FIXTURE = path.resolve(import.meta.dirname, "fixtures", "auditor-tool-probe-extension.mjs");

interface ProbeOutcome {
  declared: Set<string>;
  toolCallsServed: number;
  dir: string;
  exit: string;
}

async function runProbe(args: string[]): Promise<ProbeOutcome> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "glla-tool-surface-"));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "glla-tool-surface-home-"));
  const declared = new Set<string>();
  let toolCallsServed = 0;
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const d = JSON.parse(body) as { tools?: Array<{ function?: { name?: string }; name?: string }>; stream?: boolean };
        for (const t of d.tools ?? []) declared.add(t.function?.name ?? t.name ?? "?");
      } catch { /* non-JSON probe traffic is not the surface under test */ }
      const serveToolCall = toolCallsServed < 3;
      if (serveToolCall) toolCallsServed++;
      const toolCall = { id: "call_1", type: "function", function: { name: "glla_probe_tool", arguments: "{}" } };
      let stream = false;
      try { stream = (JSON.parse(body) as { stream?: boolean }).stream === true; } catch { /* default non-stream */ }
      if (stream) {
        res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
        if (serveToolCall) {
          res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { role: "assistant", tool_calls: [toolCall] }, finish_reason: null }] })}\n\n`);
          res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] })}\n\n`);
        } else {
          res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { role: "assistant", content: "probe complete" }, finish_reason: null }] })}\n\n`);
          res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\n`);
        }
        res.end("data: [DONE]\n\n");
      } else {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(serveToolCall
          ? { choices: [{ index: 0, message: { role: "assistant", content: null, tool_calls: [toolCall] }, finish_reason: "tool_calls" }] }
          : { choices: [{ index: 0, message: { role: "assistant", content: "probe complete" }, finish_reason: "stop" }] }));
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  // Explicit /dev/null fd: stdio "ignore" is a never-EOF socketpair under
  // execFile (and bun's spawn), which wedges pi's stdin read. See header.
  const nullFd = fs.openSync("/dev/null", "r");
  let exit = "unknown";
  try {
    await new Promise<void>((resolve) => {
      const child = spawn(
        PI,
        ["-p", "probe the boundary", "--no-session", "--model", "glla-probe-rig/rig-model", ...args],
        {
          timeout: 90_000,
          stdio: [nullFd, "pipe", "pipe"],
          env: {
            ...process.env,
            PI_CODING_AGENT_DIR: home,
            PI_OFFLINE: "1",
            GLLA_PROBE_DIR: dir,
            GLLA_PROBE_PROVIDER_URL: `http://127.0.0.1:${port}/v1`,
          },
        },
      );
      child.stdout.on("data", () => {});
      child.stderr.on("data", () => {});
      const timer = setTimeout(() => {
        exit = "timeout-kill";
        try { child.kill("SIGKILL"); } catch { /* already gone */ }
        // Reap grandchildren (systemd-inhibit, node) orphaned by the kill.
        try {
          const kids = execSync(`pgrep -P ${child.pid}`).toString().trim().split("\n").filter(Boolean);
          for (const k of kids) { try { process.kill(Number(k), "SIGKILL"); } catch { /* gone */ } }
        } catch { /* no children left or pgrep unavailable */ }
        resolve();
      }, 90_000);
      child.on("close", (code, signal) => {
        clearTimeout(timer);
        exit = signal ?? `exit(${code})`;
        resolve();
      });
      child.on("error", (err) => {
        clearTimeout(timer);
        exit = `spawn-error(${String(err).slice(0, 120)})`;
        resolve();
      });
    });
  } finally {
    fs.closeSync(nullFd);
    server.close();
  }
  return { declared, toolCallsServed, dir, exit };
}

function markers(dir: string): Set<string> {
  return new Set(fs.readdirSync(dir));
}

test("v0.39.38: allowed extension cannot expose a tool outside --tools (live pi)", { timeout: 150_000 }, async () => {
  const { declared, toolCallsServed, dir, exit } = await runProbe([
    "--no-extensions",
    "--extension", FIXTURE,
    "--tools", "read,grep,find,ls,bash",
  ]);
  const ran = markers(dir);
  try {
    assert.ok(ran.has("extension-code-ran"), `fixture trusted code executed at load (${exit}; saw: ${[...ran].sort().join(",")})`);
    assert.ok(ran.has("tool-registered"), `the probe tool registered with the extension host (${exit})`);
    assert.ok(toolCallsServed > 0, `the rigged model actually demanded the probe tool (${exit})`);
    assert.ok(!declared.has("glla_probe_tool"), `probe tool never on the model-visible surface (${exit}; saw: ${[...declared].sort().join(",")})`);
    for (const allowed of ["read", "grep", "find", "ls", "bash"]) {
      assert.ok(declared.has(allowed), `allowlisted tool still declared: ${allowed} (${exit}; saw: ${[...declared].sort().join(",")})`);
    }
    assert.ok(!ran.has("tool-executed"), `the disallowed tool never executed under forced demand (${exit})`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("v0.39.38: unfiltered control exposes and executes the probe tool (rig validity)", { timeout: 150_000 }, async () => {
  const { declared, dir, exit } = await runProbe(["--no-extensions", "--extension", FIXTURE]);
  const ran = markers(dir);
  try {
    assert.ok(declared.has("glla_probe_tool"), `without --tools the fixture tool is declared (${exit}; saw: ${[...declared].sort().join(",")})`);
    assert.ok(ran.has("tool-executed"), `without --tools the fixture tool executes on model demand (${exit}; saw: ${[...ran].sort().join(",")})`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

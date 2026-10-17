// pi-goal-list-loop-audit — cross-platform containment accounting tests.
//
// Finding: process-group containment was Linux-only, so the
// fork-bomb/recursive-helper fence never fired on macOS/Windows. The
// accounting lives in scripts/auditor-process-tree.mjs precisely so it can
// be pinned here — the worker itself cannot be imported (main() runs at
// load), so worker wiring is source-pinned while the module is exercised
// live (real child processes) plus pure (parser/math units).

import { test } from "node:test";
import * as assert from "node:assert/strict";
import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tree = await import(pathToFileURL(path.join(__dirname, "../scripts/auditor-process-tree.mjs")).href);
const { countDescendants, parsePowershell, parseWmicCsv, processGroupId, processGroupSize, processTreeSize } = tree;

const POSIX = process.platform === "linux" || process.platform === "darwin";

test("v0.39.38: pure descendant math counts fork shapes without double-counting", () => {
  const rows = [
    { pid: 2, ppid: 1 }, { pid: 3, ppid: 1 }, { pid: 4, ppid: 2 },
    { pid: 5, ppid: 2 }, { pid: 6, ppid: 4 }, { pid: 9, ppid: 8 },
  ];
  assert.equal(countDescendants(1, rows), 6, "self + 5 descendants, foreign subtree excluded");
  assert.equal(countDescendants(2, rows), 4, "nested subtree");
  assert.equal(countDescendants(9, rows), 1, "leaf counts itself");
  assert.equal(countDescendants(777, rows), 1, "unknown root counts itself, never throws");
});

test("v0.39.38: win32 row parsers extract pid/ppid pairs", () => {
  const csv = "Node,ParentProcessId,ProcessId\r\nMSEDGE,1234,5678\r\nNODE,5678,9012\r\njunk line\r\n";
  assert.deepEqual(parseWmicCsv(csv), [{ pid: 5678, ppid: 1234 }, { pid: 9012, ppid: 5678 }]);
  assert.deepEqual(parsePowershell("5678 1234\n9012 5678\nnot numbers\n"), [{ pid: 5678, ppid: 1234 }, { pid: 9012, ppid: 5678 }]);
  assert.equal(countDescendants(1234, parseWmicCsv(csv)), 3, "parsed rows feed the tree counter");
});

test("v0.39.38: live POSIX group accounting sees our own group", { skip: !POSIX }, () => {
  const gid = processGroupId(process.pid);
  assert.ok(Number.isInteger(gid) && gid > 1, `own group id is a real pgid (got ${gid})`);
  const size = processGroupSize(gid);
  assert.ok(typeof size === "number" && size >= 1, `own group is non-empty (got ${size})`);
  assert.equal(processGroupSize(undefined), undefined, "no group means disarmed, never zero");
});

test("v0.39.38: live detached child forms its own countable, killable group", { skip: !POSIX }, async () => {
  // A detached child is a group leader: its pgid equals its pid. This is
  // the exact identity the worker fence counts and the signal path kills.
  const child = spawn(process.execPath, ["-e", "setTimeout(() => {}, 60_000)"], { detached: true, stdio: "ignore" });
  assert.ok(child.pid, "child spawned with a pid");
  const childPid = child.pid as number;
  try {
    assert.equal(processGroupId(childPid), childPid, "detached child leads its own group");
    assert.ok((processGroupSize(childPid) ?? 0) >= 1, "leader's group is countable while alive");
    assert.ok((processTreeSize(childPid) ?? 0) >= 1, "leader's tree counts itself");
  } finally {
    try { process.kill(-childPid, "SIGKILL"); } catch {}
    await new Promise((resolve) => { child.on("exit", resolve); setTimeout(resolve, 5_000); });
  }
  assert.equal(processGroupSize(childPid) ?? 0, 0, "reaped group is empty, not undefined-confused");
});

test("v0.39.38: the worker fences groups on POSIX and trees on win32", () => {
  const worker = fs.readFileSync(path.join(__dirname, "../scripts/goal-auditor-worker.mjs"), "utf-8");
  assert.match(worker, /from "\.\/auditor-process-tree\.mjs"/, "worker imports the cross-platform accounting");
  assert.doesNotMatch(worker, /linuxProcessGroup/, "Linux-only helpers are gone");
  assert.doesNotMatch(worker, /process\.platform !== "linux"\) return (false|undefined)/, "no platform early-out disarms discovery");
  assert.match(worker, /treeRoots/, "win32 fences the RPC child tree");
  assert.match(worker, /process tree exceeded its/, "tree breach fails the round like a group breach");
});

// pi-goal-list-loop-audit — cross-platform process accounting for the
// auditor worker containment fence.
//
// The fork-bomb/recursive-helper fence counts the worker's process group and
// fails the round past MAX_PROCESS_GROUP_SIZE. That accounting was
// Linux-only (/proc), so on macOS/Windows the size lookup returned undefined
// and the fence never fired. This module keeps the Linux fast paths and adds
// real discovery elsewhere:
//
// - linux: /proc stat scan (unchanged semantics).
// - darwin: `ps -e -o pid=,pgid=` snapshot with a short TTL cache, so the
//   100ms fence poll does not spawn unbounded `ps` processes. Negative-pid
//   signalling already works on darwin (POSIX groups are real there).
// - win32: no POSIX groups — the containment identity is the RPC child's
//   process TREE via a ParentProcessId map (wmic, then powershell
//   fallback). Termination stays in scripts/contained-child.mjs
//   (taskkill /T /F).
//
// Every snapshot helper degrades to undefined on failure: the fence then
// stays disarmed exactly as before, never false-firing. Pure where possible
// (countDescendants) so tests can pin the math without spawning trees.

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";

const SNAPSHOT_TTL_MS = 500;
let darwinSnapshot = { at: 0, byPid: new Map() };
let windowsSnapshot = { at: 0, rows: [] };

function linuxGroupId(pid) {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
    const end = stat.lastIndexOf(")");
    if (end < 0) return undefined;
    const fields = stat.slice(end + 2).trim().split(/\s+/);
    const group = Number(fields[2]); // stat field 5, after pid/comm/state/ppid
    return Number.isInteger(group) && group > 1 ? group : undefined;
  } catch {
    return undefined;
  }
}

function snapshotDarwinGroups() {
  const now = Date.now();
  if (now - darwinSnapshot.at < SNAPSHOT_TTL_MS && darwinSnapshot.byPid.size > 0) return darwinSnapshot.byPid;
  const byPid = new Map();
  try {
    const out = execFileSync("ps", ["-e", "-o", "pid=,pgid="], { encoding: "utf8", timeout: 5_000 });
    for (const line of out.split("\n")) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 2) continue;
      const pid = Number(parts[0]);
      const pgid = Number(parts[1]);
      if (Number.isInteger(pid) && Number.isInteger(pgid) && pgid > 1) byPid.set(pid, pgid);
    }
    darwinSnapshot = { at: now, byPid };
  } catch {
    // Keep the last good snapshot; an empty map disarms the fence safely.
  }
  return darwinSnapshot.byPid.size > 0 ? darwinSnapshot.byPid : undefined;
}

/** Parse wmic /FORMAT:CSV rows (exported for tests). */
export function parseWmicCsv(out) {
  const rows = [];
  for (const line of out.split("\n")) {
    const cells = line.trim().split(",");
    if (cells.length < 3) continue;
    const pid = Number(cells[cells.length - 1]);
    const ppid = Number(cells[cells.length - 2]);
    if (Number.isInteger(pid) && pid > 0 && Number.isInteger(ppid) && ppid >= 0) rows.push({ pid, ppid });
  }
  return rows;
}

/** Parse "pid ppid" powershell rows (exported for tests). */
export function parsePowershell(out) {
  const rows = [];
  for (const line of out.split("\n")) {
    const m = line.trim().match(/^(\d+)\s+(\d+)$/);
    if (m) rows.push({ pid: Number(m[1]), ppid: Number(m[2]) });
  }
  return rows;
}

function snapshotWindowsParents() {
  const now = Date.now();
  if (now - windowsSnapshot.at < SNAPSHOT_TTL_MS && windowsSnapshot.rows.length > 0) return windowsSnapshot.rows;
  let rows = [];
  try {
    const out = execFileSync("wmic", ["process", "get", "ParentProcessId,ProcessId", "/FORMAT:CSV"], { encoding: "utf8", timeout: 5_000, windowsHide: true });
    rows = parseWmicCsv(out);
  } catch {
    try {
      const out = execFileSync("powershell", ["-NoProfile", "-Command", "Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId | ForEach-Object { \"$($_.ProcessId) $($_.ParentProcessId)\" }"], { encoding: "utf8", timeout: 10_000, windowsHide: true });
      rows = parsePowershell(out);
    } catch {
      return windowsSnapshot.rows.length > 0 ? windowsSnapshot.rows : undefined;
    }
  }
  if (rows.length > 0) windowsSnapshot = { at: now, rows };
  return rows.length > 0 ? rows : undefined;
}

/** POSIX process-group id of a pid, or undefined where groups don't exist. */
export function processGroupId(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return undefined;
  if (process.platform === "linux") return linuxGroupId(pid);
  if (process.platform === "darwin") return snapshotDarwinGroups()?.get(pid);
  return undefined;
}

/** Member pids of a POSIX process group (linux /proc walk, darwin snapshot). */
export function processGroupMembers(group) {
  if (group === undefined) return undefined;
  if (process.platform === "linux") {
    let entries;
    try { entries = readdirSync("/proc"); } catch { return undefined; }
    const members = [];
    for (const entry of entries) {
      if (!/^\d+$/.test(entry)) continue;
      const pid = Number(entry);
      if (pid <= 1 || linuxGroupId(pid) !== group) continue;
      members.push(pid);
    }
    return members;
  }
  if (process.platform === "darwin") {
    const byPid = snapshotDarwinGroups();
    if (!byPid) return undefined;
    const members = [];
    for (const [pid, pgid] of byPid) if (pgid === group) members.push(pid);
    return members;
  }
  return undefined;
}

/** Count group members; undefined when the platform exposes no groups. */
export function processGroupSize(group) {
  const members = processGroupMembers(group);
  return members === undefined ? undefined : members.length;
}

/** Pure descendant count (self + transitive children) from parent rows. */
export function countDescendants(rootPid, rows) {
  const children = new Map();
  for (const { pid, ppid } of rows) {
    if (!children.has(ppid)) children.set(ppid, []);
    children.get(ppid).push(pid);
  }
  let count = 0;
  const stack = [rootPid];
  const seen = new Set([rootPid]);
  while (stack.length > 0) {
    const pid = stack.pop();
    count++;
    for (const child of children.get(pid) ?? []) {
      if (!seen.has(child)) { seen.add(child); stack.push(child); }
    }
  }
  return count;
}

/** Size of the process tree rooted at rootPid (win32 containment identity;
 * also usable on POSIX via the ps/wmic-equivalent snapshot where needed). */
export function processTreeSize(rootPid) {
  if (!Number.isInteger(rootPid) || rootPid <= 0) return undefined;
  if (process.platform === "win32") {
    const rows = snapshotWindowsParents();
    return rows === undefined ? undefined : countDescendants(rootPid, rows);
  }
  // Linux: exact tree via /proc ppid walk. (darwin needs no tree walk —
  // the true group fence above is the primary brake there; /proc is
  // absent so the readdir below throws and degrades to undefined.)
  let entries;
  try { entries = readdirSync("/proc"); } catch { return undefined; }
  const ppidOf = new Map();
  for (const entry of entries) {
    if (!/^\d+$/.test(entry)) continue;
    try {
      const stat = readFileSync(`/proc/${entry}/stat`, "utf8");
      const fields = stat.slice(stat.lastIndexOf(")") + 2).trim().split(/\s+/);
      ppidOf.set(Number(entry), Number(fields[1]));
    } catch { /* raced exit — skip */ }
  }
  return countDescendants(rootPid, [...ppidOf].map(([pid, ppid]) => ({ pid, ppid })));
}

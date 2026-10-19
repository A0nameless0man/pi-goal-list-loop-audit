// Run from the repository: bun audit/project-review-2026-10-19/reproduce-update-check.ts
// Executes production code with fake children; no network or provider calls.
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { refreshUpdateCheck } from "../../extensions/glla-update-check.js";
import { setRuntimeSessionDir } from "../../extensions/glla-state-root.js";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "glla-review-refresh-"));
const previousSettings = process.env.GLLA_GLOBAL_SETTINGS_PATH;
const previousSession = process.env.PI_SESSION_FILE;
const settings = path.join(root, "settings.json");
process.env.GLLA_GLOBAL_SETTINGS_PATH = settings;
delete process.env.PI_SESSION_FILE;
const children: Array<EventEmitter & { stdout: EventEmitter; unref(): void }> = [];
const spawn = () => {
  const child = Object.assign(new EventEmitter(), { stdout: new EventEmitter(), unref() {} });
  children.push(child);
  return child;
};
try {
  fs.writeFileSync(settings, JSON.stringify({ stateRoot: "workingDir" }));
  const cwd = path.join(root, "project");
  for (let i = 0; i < 5; i++) refreshUpdateCheck(cwd, Date.now(), spawn as never);
  assert.equal(children.length, 5);
  console.log("R1: five immediate contacts spawned five concurrent refresh children.");
  for (const child of children) child.emit("close", 1);
  refreshUpdateCheck(cwd, Date.now(), spawn as never);
  assert.equal(children.length, 6);
  console.log("R1: next contact immediately spawned again after registry failures.");
  children.at(-1)!.emit("close", 1);

  fs.writeFileSync(settings, JSON.stringify({ stateRoot: "sessionDir" }));
  const session = path.join(root, "session");
  setRuntimeSessionDir(session);
  refreshUpdateCheck(cwd, Date.now(), spawn as never);
  const pending = children.at(-1)!;
  setRuntimeSessionDir(undefined);
  pending.stdout.emit("data", Buffer.from("99.0.0\n"));
  pending.emit("close", 0);
  const fallback = path.join(cwd, ".pi-glla", "update-check.json");
  assert.equal(fs.existsSync(fallback), true);
  assert.equal(fs.existsSync(path.join(session, "pi-glla", "update-check.json")), false);
  console.log("R2: successful late callback created cwd/.pi-glla/update-check.json while sessionDir was unresolved.");
} finally {
  setRuntimeSessionDir(undefined);
  if (previousSettings === undefined) delete process.env.GLLA_GLOBAL_SETTINGS_PATH;
  else process.env.GLLA_GLOBAL_SETTINGS_PATH = previousSettings;
  if (previousSession === undefined) delete process.env.PI_SESSION_FILE;
  else process.env.PI_SESSION_FILE = previousSession;
  fs.rmSync(root, { recursive: true, force: true });
}

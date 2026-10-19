import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createUpdateChecker, type SpawnFn } from "../extensions/glla-update-check.js";
import { setRuntimeSessionDir } from "../extensions/glla-state-root.js";

const settings = process.env.GLLA_GLOBAL_SETTINGS_PATH!;
const roots: string[] = [];
afterEach(() => {
  setRuntimeSessionDir(undefined);
  fs.writeFileSync(settings, JSON.stringify({ aggressiveMode: false }));
  for (const dir of roots.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});
function fixture(timeoutMs = 1000) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "glla-refresh-lifecycle-"));
  roots.push(cwd);
  const children: Array<EventEmitter & { stdout: EventEmitter; killed: boolean; kill(): void }> = [];
  const spawn: SpawnFn = () => {
    const child = Object.assign(new EventEmitter(), {
      stdout: new EventEmitter(), killed: false,
      kill() { this.killed = true; }, unref() {},
    });
    children.push(child);
    return child;
  };
  const refresh = createUpdateChecker({ timeoutMs, retryMs: 60_000 });
  const file = path.join(cwd, ".pi-glla", "update-check.json");
  const success = (child = children.at(-1)!) => {
    child.stdout.emit("data", Buffer.from("99.0.0\n"));
    child.emit("close", 0);
  };
  return { cwd, file, children, spawn, refresh, success };
}

test("contacts share one refresh per root, while independent roots can refresh", () => {
  const f = fixture();
  const other = fixture();
  for (let i = 0; i < 5; i++) f.refresh(f.cwd, Date.now(), f.spawn);
  f.refresh(other.cwd, Date.now(), f.spawn);
  assert.equal(f.children.length, 2);
  f.success(f.children[0]);
  f.success(f.children[1]);
  f.refresh(f.cwd, Date.now(), f.spawn);
  assert.equal(f.children.length, 2, "successful cache suppresses later contacts");
  assert.equal(JSON.parse(fs.readFileSync(f.file, "utf8")).latest, "99.0.0");
  assert.deepEqual(fs.readdirSync(path.dirname(f.file)), ["update-check.json"], "atomic publication leaves no temp file");
});

for (const failure of ["throw", "error", "nonzero", "timeout"] as const) {
  test(`refresh ${failure} preserves old cache and imposes retry backoff`, async () => {
    const f = fixture(failure === "timeout" ? 10 : 1000);
    fs.mkdirSync(path.dirname(f.file));
    const old = JSON.stringify({ latest: "0.1.0", checkedAt: 0 });
    fs.writeFileSync(f.file, old);
    let spawns = 0;
    const spawn: SpawnFn = (...args) => {
      spawns++;
      if (failure === "throw" && spawns === 1) throw new Error("no npm");
      return f.spawn(...args);
    };
    f.refresh(f.cwd, Date.now(), spawn);
    if (failure === "error") f.children[0]!.emit("error", new Error("ENOENT"));
    if (failure === "nonzero") f.children[0]!.emit("close", 1);
    if (failure === "timeout") {
      await new Promise(resolve => setTimeout(resolve, 30));
      assert.equal(f.children[0]!.killed, true);
    }
    f.refresh(f.cwd, Date.now(), spawn);
    assert.equal(spawns, 1);
    if (failure !== "throw") f.success(f.children[0]);
    assert.equal(fs.readFileSync(f.file, "utf8"), old, "late success after error/deadline cannot write");
    f.refresh(f.cwd, Date.now() + 61_000, spawn);
    assert.equal(spawns, 2);
    f.success();
    assert.equal(JSON.parse(fs.readFileSync(f.file, "utf8")).latest, "99.0.0");
  });
}

for (const transition of ["unresolved", "rebind", "same-directory-rebind", "selector", "unreadable"] as const) {
  test(`late cache write is refused after ${transition}`, () => {
    const f = fixture();
    const session = path.join(f.cwd, "session");
    fs.writeFileSync(settings, JSON.stringify({ stateRoot: "sessionDir" }));
    setRuntimeSessionDir(session);
    const oldSessionFile = process.env.PI_SESSION_FILE;
    delete process.env.PI_SESSION_FILE;
    try {
      f.refresh(f.cwd, Date.now(), f.spawn);
      assert.equal(f.children.length, 1);
      if (transition === "unresolved") setRuntimeSessionDir(undefined);
      if (transition === "rebind") setRuntimeSessionDir(path.join(f.cwd, "new-session"));
      if (transition === "same-directory-rebind") setRuntimeSessionDir(session);
      if (transition === "selector") fs.writeFileSync(settings, JSON.stringify({ stateRoot: "workingDir" }));
      if (transition === "unreadable") fs.writeFileSync(settings, "{");
      f.success();
      assert.equal(fs.existsSync(path.join(session, "pi-glla")), false);
      assert.equal(fs.existsSync(path.join(f.cwd, "new-session", "pi-glla")), false);
      assert.equal(fs.existsSync(path.join(f.cwd, ".pi-glla")), false);
    } finally {
      if (oldSessionFile !== undefined) process.env.PI_SESSION_FILE = oldSessionFile;
    }
  });
}

test("a stable session root receives its cache beside session state", () => {
  const f = fixture();
  fs.writeFileSync(settings, JSON.stringify({ stateRoot: "sessionDir" }));
  setRuntimeSessionDir(path.join(f.cwd, "session"));
  f.refresh(f.cwd, Date.now(), f.spawn);
  f.success();
  assert.equal(fs.existsSync(path.join(f.cwd, "session", "pi-glla", "update-check.json")), true);
  assert.equal(fs.existsSync(f.file), false);
});

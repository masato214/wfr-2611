// K-326 の試験：口の登録を hooks のファイルの register と作り手の一覧（all.generated.ts）から差す。閉じる道は disabled-paths.d から足す。
//   行 ID は K326-BIND-NNN（チケット 11_tickets/K-326.md の表の行と 1 対 1）。DB なし：束ねは偽の module、一覧は本物を読む
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { HookDeps, HookModule } from "../src/hooks/registry.js";
import { DISABLED_PATHS } from "@kaname/auth";
import { PASSKEY_DISABLED_PATHS } from "../../../packages/auth/src/passkey.js";
import { PASSKEY_STEP_UP_PATH } from "../../../packages/auth/src/passkeys.js";

const HERE = dirname(fileURLToPath(import.meta.url));
// 束ねる口と一覧は K-326 の実装で生まれる。読み込みの失敗を試験の準備の赤にしないよう、試験の本体の中で読む
const registry = () => import("../src/hooks/registry.js");
const modules = async (): Promise<readonly HookModule[]> =>
  (await import("../src/hooks/all.generated.js")).HOOK_MODULES;
const deps = {} as unknown as HookDeps;
const fn = (tag: string) => Object.assign(async () => tag, { tag });

function mod(
  name: string,
  ops: Record<string, unknown>,
  fuzz: HookModule["fuzz"] = "same",
  replaces?: readonly string[],
): HookModule & { calls: number } {
  const m = {
    name,
    calls: 0,
    ...(replaces ? { replaces } : {}),
    make: () => {
      m.calls += 1;
      return ops as never;
    },
    fuzz,
  };
  return m;
}

describe("K-326 束ね", () => {
  it("K326-BIND-001 2 つの module の口を 1 つに束ねる", async () => {
    const { buildHooks } = await registry();
    const a1 = fn("a");
    const b1 = fn("b");
    const out = buildHooks([mod("aHooks", { opA: a1 }), mod("bHooks", { opB: b1 })], deps, "server");
    expect(Object.keys(out).sort()).toEqual(["opA", "opB"]);
    expect(out["opA"]).toBe(a1);
    expect(out["opB"]).toBe(b1);
  });

  it("K326-BIND-002 同じ口を 2 つが持てば止める", async () => {
    const { buildHooks } = await registry();
    expect(() =>
      buildHooks([mod("aHooks", { opA: fn("a") }), mod("bHooks", { opA: fn("b") })], deps, "server"),
    ).toThrow(/opA[\s\S]*(aHooks[\s\S]*bHooks|bHooks[\s\S]*aHooks)/);
  });

  it("K326-BIND-003 fuzz は skip を外し、関数があればそれを使う", async () => {
    const { buildHooks } = await registry();
    const a = mod("aHooks", { opA: fn("a") }, { skip: "訳" });
    const b1 = fn("b");
    const b = mod("bHooks", { opB: b1 });
    const c2 = fn("c2");
    const c = mod("cHooks", { opC: fn("c") }, () => ({ opC2: c2 }) as never);
    const out = buildHooks([a, b, c], deps, "fuzz");
    expect(Object.keys(out).sort()).toEqual(["opB", "opC2"]);
    expect(out["opB"]).toBe(b1);
    expect(out["opC2"]).toBe(c2);
    expect(a.calls).toBe(0);
    expect(c.calls).toBe(0);
  });
});

describe("K-326 差し替え", () => {
  it("K326-BIND-010 replaces に書いた側が、並びに関わらず同じ口を持つ", async () => {
    const { buildHooks } = await registry();
    const mine = fn("delegate");
    const a = mod("aHooks", { getX: mine }, "same", ["getX"]);
    const b = mod("bHooks", { getX: fn("tickets"), listX: fn("list") });
    for (const order of [
      [a, b],
      [b, a],
    ]) {
      const out = buildHooks(order, deps, "server");
      expect(out["getX"]).toBe(mine);
      expect(Object.keys(out).sort()).toEqual(["getX", "listX"]);
    }
  });

  it("K326-BIND-011 差し替える相手の無い replaces は止める", async () => {
    const { buildHooks } = await registry();
    expect(() => buildHooks([mod("aHooks", { getY: fn("a") }, "same", ["getY"])], deps, "server")).toThrow(
      /getY[\s\S]*aHooks/,
    );
  });
});

describe("K-326 本物の差し替え", () => {
  it("K326-BIND-012 getTicket は今と同じく delegateHooks が差し替える", async () => {
    const HOOK_MODULES = await modules();
    const by = new Map(HOOK_MODULES.map((m) => [m.name, m]));
    expect(by.get("delegateHooks")?.replaces ?? []).toContain("getTicket");
    expect(by.get("ticketHooks")?.replaces ?? []).not.toContain("getTicket");
    const withReplaces = HOOK_MODULES.filter((m) => (m.replaces ?? []).length > 0).map((m) => m.name);
    expect([...withReplaces].sort()).toEqual(["delegateHooks", "stoppedHooks"]); // stoppedHooks（K-485）は getActionRun・listTicketRuns に reason_kind を足す
  });
});

describe("K-326 本物の一覧", () => {
  it("K326-BIND-004 どの module も name・make・fuzz を持ち、name は重ならない", async () => {
    const HOOK_MODULES = await modules();
    expect(HOOK_MODULES.length).toBeGreaterThan(0);
    for (const m of HOOK_MODULES) {
      expect(m.name, JSON.stringify(m)).toMatch(/^\w+Hooks$/);
      expect(typeof m.make).toBe("function");
      const ok =
        m.fuzz === "same" ||
        typeof m.fuzz === "function" ||
        (typeof m.fuzz === "object" && typeof m.fuzz.skip === "string" && m.fuzz.skip.trim() !== "");
      expect(ok, m.name).toBe(true);
    }
    const names = HOOK_MODULES.map((m) => m.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("K326-BIND-005 hooks のファイルの register が全部一覧に入っている", async () => {
    const HOOK_MODULES = await modules();
    const files = import.meta.glob("../src/hooks/*.ts", { eager: true }) as Record<string, { register?: HookModule }>;
    const own = Object.entries(files).filter(([p]) => !/\/(registry|[^/]*\.generated)\.ts$/.test(p));
    const regs = own.map(([p, m]) => {
      expect(m.register, `${p} に register が無い`).toBeDefined();
      return m.register as HookModule;
    });
    expect(HOOK_MODULES.length).toBe(regs.length);
    for (const r of regs) expect(HOOK_MODULES).toContain(r);
  });

  it("K326-BIND-006 本物のサーバーと fuzz の的は一覧から差す", () => {
    const server = readFileSync(join(HERE, "../src/server.ts"), "utf8");
    const fuzz = readFileSync(join(HERE, "fuzz/server.ts"), "utf8");
    const call = /(?<![\w.])(?!build|define)[a-z]\w*Hooks\s*\(/;
    expect(server.match(call)?.[0] ?? null).toBeNull();
    expect(fuzz.match(call)?.[0] ?? null).toBeNull();
    expect(server).toContain("buildHooks(HOOK_MODULES,");
    expect(server).toMatch(/"server"/);
    expect(fuzz).toContain("buildHooks(HOOK_MODULES,");
    expect(fuzz).toMatch(/"fuzz"/);
  });

  it("K326-BIND-007 fuzz で外すのは今の 4 つだけで、理由は今のまま", async () => {
    const HOOK_MODULES = await modules();
    const skipped = HOOK_MODULES.filter((m) => typeof m.fuzz === "object" && "skip" in m.fuzz);
    expect(skipped.map((m) => m.name).sort()).toEqual(
      ["authHooks", "consentTermsHooks", "signupHooks", "verifyEmailHooks"].sort(),
    );
    for (const m of skipped) expect((m.fuzz as { skip: string }).skip, m.name).toContain("偽のセッション");
  });
});

describe("K-326 閉じる道", () => {
  it("K326-BIND-008 今閉じている道を全部持ち、同じ道が 2 つない", () => {
    const want = [
      "/sign-in/email",
      "/sign-out",
      "/list-sessions",
      "/unlink-account",
      "/request-password-reset",
      "/reset-password",
      PASSKEY_STEP_UP_PATH,
      ...PASSKEY_DISABLED_PATHS,
    ];
    for (const p of want) expect(DISABLED_PATHS as readonly string[], p).toContain(p);
    expect(new Set(DISABLED_PATHS).size).toBe(DISABLED_PATHS.length);
  });

  it("K326-BIND-009 断片の道は全部 DISABLED_PATHS に入る", () => {
    const parts = import.meta.glob("../../../packages/auth/src/disabled-paths.d/K-*.ts", { eager: true }) as Record<
      string,
      { PATHS: readonly string[] }
    >;
    for (const [p, m] of Object.entries(parts)) {
      expect(Array.isArray(m.PATHS), p).toBe(true);
      for (const path of m.PATHS) expect(DISABLED_PATHS as readonly string[], `${p} ${path}`).toContain(path);
    }
  });
});

// K-725：web の前の記憶の画面と呼び出しを外す（K-69 の葉）。ファイルと字を読んで確かめる（ブラウザで動く確かめは tests/k/k725-memory-ui-retire.spec.ts）。
// 行 ID は md の行の表（K725-API-001〜010）。消した名前が「0」だけを見ると探す先が空でも緑になるので、残す名前が「在る」ことも必ず見る（TP-TOOL-02）
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const read = (rel: string): string => readFileSync(join(ROOT, rel), "utf8");
const has = (rel: string): boolean => existsSync(join(ROOT, rel));
const OLD_PAGE = "apps/web/app/(dev)/dev/memory/page.tsx";
const NEW_PAGE = "apps/web/app/(dev)/dev/ai-settings/page.tsx";
const OLD_PART = "apps/web/components/ai/memory.tsx";
const SPEC = "apps/web/tests/screens/clone-chat.spec.ts";
/** 消した呼び出し・部品・道の名前（ext.ts の記憶の関数 7 つ・型 4 つ・部品 2 つ・旧い道・見本の頁の道） */
const GONE =
  "agent/memory|MemoryDigest|MemoryReviews|memoryDigest|memoryReviews|memoryEdit|memoryDelete|dev/memory|proposalSend|proposalDecide|DigestStatus|DigestResult|DigestItem";
/** 日本語のファイル名も読めるよう -z で区切る（TP-TOOL-01） */
function grepFiles(pattern: string, extra: string[] = []): string[] {
  try {
    const out = execFileSync(
      "git",
      ["grep", "-l", "-z", "-E", pattern, "--", "apps/web", ...extra.map((e) => `:!${e}`)],
      { cwd: ROOT, encoding: "utf8" },
    );
    return out.split("\0").filter(Boolean);
  } catch (e) {
    if ((e as { status?: number }).status === 1) return [];
    throw e;
  }
}
const SELF = ["apps/web/test/k725-memory-ui-retire.test.ts", "apps/web/tests/k/k725-memory-ui-retire.spec.ts"];
/** 「もう無い行」の節より前（今の行）と後（もう無い行）に分ける */
function rowsOf(rel: string): { now: string; gone: string } {
  const t = read(rel);
  const i = t.indexOf("\n## もう無い行");
  expect(i, `${rel} に「もう無い行」の節が在る`).toBeGreaterThan(0);
  return { now: t.slice(0, i), gone: t.slice(i) };
}

describe("K-725 web の前の記憶の画面と呼び出しを外す", () => {
  it("K725-API-001 守り：記憶の頁と部品のファイルが消え、設定の見本の頁が新しい道に在る", () => {
    expect(has(OLD_PAGE)).toBe(false);
    expect(has(OLD_PART)).toBe(false);
    expect(has(NEW_PAGE)).toBe(true);
    const page = read(NEW_PAGE);
    for (const part of ["AlwaysAllowList", "UsagePanel", "NotifyToggles"]) expect(page).toContain(`<${part} />`);
    expect(page).not.toMatch(/Memory/);
    expect(page, "任意値の大きさは台帳に載るのでトークンの外の値を書かない").not.toMatch(/-\[\d/);
  });

  it("K725-API-002 守り：apps/web に消した名前が 0 件（この葉の試験 2 本を除く）", () => {
    expect(grepFiles(GONE, SELF)).toEqual([]);
  });

  it("K725-API-003 守り：ext.ts に記憶の関数と型が無く、隣の関数は残る", () => {
    const ext = read("apps/web/lib/auth/ext.ts");
    expect(ext).not.toMatch(/export (const|interface) (memory\w+|proposal\w+|Digest\w+|Review)\b/);
    for (const keep of ["agentMessagesBefore", "export interface AgentMsg"]) expect(ext).toContain(keep);
    expect(ext.match(/\/agent\//g)?.length ?? 0, "会話・成果物などの道は残る").toBeGreaterThan(5);
  });

  it("K725-API-004 守り：components/ai/index.ts は記憶の 2 部品を出さず、設定の 3 部品は出す", () => {
    const idx = read("apps/web/components/ai/index.ts");
    expect(idx).not.toMatch(/MemoryDigest|MemoryReviews|\.\/memory/);
    expect(idx).toContain('export { AlwaysAllowList, UsagePanel, NotifyToggles } from "./settings";');
    expect(idx).toContain('export { Conversation } from "./conversation";');
  });

  it("K725-API-005 守り：会話の画面の「覚えました」は残り、記憶の画面へのリンクは無い", () => {
    const c = read("apps/web/components/ai/conversation.tsx");
    expect(c).not.toContain("/ai/memory");
    expect(c).toContain('data-who="memo"');
    expect(c).toContain("覚えました：{m.text}");
    expect(c, "直すへのリンクの字").not.toMatch(/<span className="muted">直す<\/span>/);
  });

  it("K725-API-006 守り：過去の返事の kaname://memory は「準備中」のまま読める（種類を残す）", () => {
    expect(read("apps/web/components/ai/markdown.tsx")).toMatch(/memory: \{ route: \(id\) => `\/ai\/memory\?id=/);
  });

  it("K725-API-007 守り：作った道の一覧（生成物）から /dev/memory が消え、/dev/ai-settings が入る", () => {
    const b = read("apps/web/lib/built-routes.ts");
    expect(b).not.toContain('"/dev/memory"');
    expect(b).toContain('"/dev/ai-settings"');
    expect(b, "ほかの道は巻き込まない（本線に前から在る下絵の道）").toContain('"/dev/mock/f8"');
  });

  it("K725-API-008 守り：生の長さの台帳と会話の部品の検査の許す一覧から、消した 2 ファイルが消える", () => {
    const led = JSON.parse(read("scripts/ci/raw_length_ledger.json")) as { entries: { file: string }[] };
    const files = led.entries.map((e) => e.file);
    expect(files).not.toContain(OLD_PART);
    expect(files).not.toContain(OLD_PAGE);
    expect(files, "台帳そのものは空にならない（ほかのファイルの行は残る）").toContain(
      "apps/web/app/(dev)/dev/mail/page.tsx",
    );
    const one = read("scripts/ci/chat_one.mjs");
    expect(one).not.toContain("components/ai/memory.tsx");
    expect(one).toContain("components/ai/composer.tsx");
  });

  it("K725-API-009 守り：前からの試験 clone-chat.spec.ts は消した頁を開かず、記憶の 3 つの試験が無く、隣の試験は残る", () => {
    const s = read(SPEC);
    expect(s).not.toContain("/dev/memory");
    expect((s.match(/page\.goto\("\/dev\/ai-settings"\)/g) ?? []).length).toBe(3);
    for (const id of ["CHT-21-001", "CHT-21-006", "CHT-22-001"]) expect(s).not.toContain(`test("${id}`);
    for (const id of ["CHT-21-005", "CHT-19-005", "CHT-20-002", "USH-08-012"]) expect(s).toContain(id);
  });

  it("K725-API-010 守り：試験の仕様書の記憶の 12 行は「もう無い行」へ移り、「覚えて」の行は今の行に残る", () => {
    const moved: Record<string, string[]> = {
      "07_qa/test-specs/screens/today.md": ["CHT-21-001", "CHT-21-002", "CHT-21-003", "CHT-21-004", "CHT-21-006"],
      "07_qa/test-specs/screens/clone-memory.md": [
        "CHT-22-001",
        "CHT-22-002",
        "CHT-22-003",
        "CHT-22-004",
        "CHT-22-005",
        "CHT-22-006",
      ],
      "07_qa/test-specs/screens/clone-chat.md": ["CHT-15-005"],
    };
    for (const [file, ids] of Object.entries(moved)) {
      const { now, gone } = rowsOf(file);
      for (const id of ids) {
        expect(now, `${file} の今の行に ${id} が無い`).not.toContain(`| ${id} |`);
        expect(gone, `${file} の「もう無い行」に ${id} が在る（ID と当時の結果を残す）`).toContain(`| ${id} |`);
      }
    }
    expect(rowsOf("07_qa/test-specs/screens/today.md").now).toContain("| CHT-21-005 |");
  });
});

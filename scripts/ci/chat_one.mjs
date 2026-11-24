// 自分のAIとの会話は、どこで開いても同じ 1 本・同じ部品（D-103）。別の作りを赤にする。
//   コード（apps/web）：
//     C1 useAgent／agentSay を呼んでよいのは lib/agent.ts と components/ai/ だけ（画面は useAgentChat と AgentChat を使う）
//     C2 <Conversation> を直接置いてよいのは components/ai/ だけ（画面は AgentChat を置く）
//     C3 components/ai/ で会話の入力欄（<textarea>）を持ってよいのは composer.tsx だけ（例外は artifact.tsx の成果物の中身を直す欄 className="aedit" だけ・D-106.3。会話の入力欄ではない）。
//        1 行の欄（<input>）は composer.tsx・asks.tsx（その他・一言）・list.tsx（探す・名前）・memory.tsx（記憶を直す）・settings.tsx（知らせの切り替え）・artifact.tsx（成果物の名前）だけ
//     C4 @assistant-ui／@ag-ui を使わない（D-103.4）
//     C5 AppShell の panel に渡してよいのは false（会話モード）と、見本の画面の AssistantPanelView だけ（右パネルは共通の枠が出す）
//     C6 会話の見た目（components/ai/chat.css）はモックから生成したまま（06_mockup/export_web_css.py --check）
//   モック（06_mockup）：
//     M1 会話の入力欄（class="composer"）を組み立ててよいのは _composer.py だけ
//     M2 生成した画面の会話の入力欄は全部 data-part="composer"（_composer.chat_composer の印）を持つ
// 使い方: node scripts/ci/chat_one.mjs [--root <dir>]   （--root は検査の検査で使う）
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

function* walk(dir, re) {
  if (!existsSync(dir)) return;
  for (const f of readdirSync(dir)) {
    if (["node_modules", ".next", ".next-prod", "dist", "test-results", "playwright-report", "pw-reports", "__pycache__"].includes(f)) continue;
    const p = join(dir, f);
    if (statSync(p).isDirectory()) yield* walk(p, re);
    else if (re.test(f)) yield p;
  }
}

export function check(root) {
  const bad = [];
  const web = join(root, "apps/web");
  for (const p of walk(web, /\.(ts|tsx)$/)) {
    const rel = relative(web, p).replaceAll("\\", "/");
    if (rel.startsWith("tests/")) continue;
    const s = readFileSync(p, "utf8");
    const inAi = rel.startsWith("components/ai/");
    if (!inAi && rel !== "lib/agent.ts" && rel !== "lib/auth/ext.ts" && /\b(useAgent|agentSay)\s*\(/.test(s))
      bad.push(`C1 ${rel}: useAgent／agentSay を直接呼んでいる（useAgentChat と AgentChat を使う）`);
    if (!inAi && /<Conversation[\s>]/.test(s)) bad.push(`C2 ${rel}: <Conversation> を直接置いている（AgentChat を置く）`);
    const onlyEditor = rel === "components/ai/artifact.tsx" && [...s.matchAll(/<textarea[\s>][^>]*/g)].every((m) => /className="aedit"/.test(m[0]));
    if (inAi && rel !== "components/ai/composer.tsx" && !onlyEditor && /<textarea[\s>]/.test(s))
      bad.push(`C3 ${rel}: 会話の部品の中で入力欄を別に作っている（会話の入力欄は composer.tsx の 1 つだけ）`);
    if (inAi && !["components/ai/composer.tsx", "components/ai/asks.tsx", "components/ai/list.tsx", "components/ai/memory.tsx", "components/ai/settings.tsx", "components/ai/artifact.tsx"].includes(rel) && /<input[\s>]/.test(s))
      bad.push(`C3 ${rel}: 会話の部品の中で 1 行の欄を作っている（composer.tsx・asks.tsx・list.tsx・memory.tsx・settings.tsx・artifact.tsx だけ）`);
    if (/from\s+["']@(assistant-ui|ag-ui)\//.test(s)) bad.push(`C4 ${rel}: assistant-ui／AG-UI を使っている（D-103.4）`);
    for (const m of s.matchAll(/<AppShell[^>]*\bpanel=\{([^}]*)\}/g)) {
      const v = m[1].trim();
      if (v !== "false" && !(rel.startsWith("app/(dev)/") && v.includes("AssistantPanelView")))
        bad.push(`C5 ${rel}: AppShell の panel に「${v.slice(0, 40)}」を渡している（右パネルは共通の枠が出す。出さないなら false）`);
    }
  }
  const mock = join(root, "06_mockup");
  for (const p of walk(mock, /\.py$/)) {
    const rel = relative(mock, p);
    if (rel === "_composer.py") continue;
    if (/class="composer/.test(readFileSync(p, "utf8"))) bad.push(`M1 06_mockup/${rel}: 会話の入力欄を _composer.py の外で組み立てている`);
  }
  for (const d of ["v1", "v2"]) {
    for (const p of walk(join(mock, d), /\.html$/)) {
      const s = readFileSync(p, "utf8");
      const all = (s.match(/class="composer/g) ?? []).length;
      const marked = (s.match(/data-part="composer"/g) ?? []).length;
      if (all !== marked) bad.push(`M2 06_mockup/${d}/${relative(join(mock, d), p)}: 会話の入力欄 ${all} のうち ${all - marked} が共通の部品でない`);
    }
  }
  // C6 会話の見た目はモックから生成したまま（手で直すと、モックと実装が別々に育つ・L-017）
  const gen = join(root, "06_mockup/export_web_css.py");
  if (existsSync(gen)) {
    const py = process.env["PYTHON"] ?? (existsSync("/opt/homebrew/bin/python3") ? "/opt/homebrew/bin/python3" : "python3");
    const r = spawnSync(py, [gen, "--check"], { encoding: "utf8" });
    if (r.status !== 0) bad.push(`C6 apps/web/components/ai/chat.css: ${(r.stdout || r.stderr || "検査が動かない").trim()}`);
  }
  return bad;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const i = process.argv.indexOf("--root");
  const root = i > 0 ? process.argv[i + 1] : process.cwd();
  const bad = check(root);
  if (bad.length) {
    console.log(`[chat_one] FAIL — 自分のAIとの会話の別の作り ${bad.length} 件（D-103）`);
    for (const b of bad) console.log("  - " + b);
    process.exit(1);
  }
  console.log("[chat_one] PASS — 自分のAIとの会話は、コードもモックも 1 つの部品（D-103）");
}

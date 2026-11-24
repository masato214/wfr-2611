// 公式 CLI の stream-json（1 行 1 イベント）を読む・書く、副作用の無い部品（D-093）。
// 実測（2026-09-25・claude 2.1.280）：
//   {"type":"system","subtype":"init","session_id":"…","tools":[…]}          ← 開始。ここで会話の id が取れる
//   {"type":"assistant","message":{"content":[{"type":"text"|"tool_use",…}]}} ← 何をしているか
//   {"type":"result","subtype":"success","is_error":true,"terminal_reason":"api_error","result":"Failed to authenticate…"}
//   ★ subtype が "success" でも is_error が true のことがある。subtype を信じない。
// 確認（--permission-prompt-tool stdio）は Agent SDK の control_request／control_response の形。
//   {"type":"control_request","request_id":"…","request":{"subtype":"can_use_tool","tool_name":"Bash","input":{…}}}
//   → {"type":"control_response","response":{"subtype":"success","request_id":"…","response":{"behavior":"allow"|"deny"}}}
//   {"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"…","is_error":false,…}]}} ← 道具が終わった
//   result には num_turns・duration_ms・duration_api_ms・total_cost_usd・usage{input_tokens,output_tokens,…} が付く（D-100.1）
/** 使った量（D-100.1）。数だけ。届かない欄は null */
export interface Usage {
  turns: number | null;
  duration_ms: number | null;
  api_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cache_read_tokens: number | null;
  cache_write_tokens: number | null;
  cost_usd: number | null;
}
/** 手順のチェックリスト（D-104.8）。TodoWrite の中身を「何をするか・済んだか」だけにしたもの */
export interface Todo {
  content: string;
  status: "pending" | "in_progress" | "completed";
}
/** 使用量の枠（D-104.16）。rate_limit_event の unifiedWindows（2026-09-27 実測：five_hour／seven_day の utilization と resetsAt） */
export interface LimitWindow {
  window: "five_hour" | "week";
  utilization: number;
  resets_at: number;
}
export type Ev =
  /** 開始。chrome は Claude in Chrome、dedicated は Bridge 専用のブラウザとのつながり（mcp_servers の status：connected／failed 等・D-119）。渡していなければ null */
  | { type: "init"; session: string; chrome: string | null; dedicated: string | null; model: string | null }
  | {
      type: "progress";
      text: string;
      tools: { id: string; name: string; target: string }[];
      todos?: Todo[];
      entry?: Entry;
    }
  | { type: "delta"; text: string }
  | { type: "message_start" }
  /** いま何をしているかの切り替わり（考えている・道具を準備している・返事を書き始めた）。考えている中身は CLI から来ない（2026-09-28 実測） */
  | { type: "phase"; phase: "thinking" | "tool" | "writing"; tool?: string }
  | { type: "limit"; windows: LimitWindow[] }
  /** 道具が終わった。browser は ブラウザの道具が「拡張機能とつながっていない」で失敗したとき（D-119・黙って終わらない） */
  | { type: "tool_end"; results: { id: string; ok: boolean }[]; browser?: "disconnected" }
  | { type: "ask"; requestId: string; tool: string; input: unknown; summary: string }
  | {
      type: "result";
      ok: boolean;
      text: string;
      session: string | null;
      reason: string | null;
      usage: Usage | null;
      raw: Record<string, unknown>;
    }
  | { type: "other"; raw: Record<string, unknown> };

/** 自分のAI の文 1 つ。id は本人の PC の Claude Code の記録と同じ（D-112・2026-09-28 実測） */
export interface Entry {
  uuid: string;
  text: string;
  at?: string;
  /** どの返答の文か（Claude の返答の id）。同じ返答の文は 1 つの吹き出しにまとめる（D-115） */
  group?: string;
}
type J = Record<string, unknown>;
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const cut = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n)}…` : s);

/** ブラウザの道具か（Claude in Chrome・Bridge 専用のブラウザ＝Playwright MCP・D-119） */
export const isBrowserTool = (tool: string): boolean =>
  tool.startsWith("mcp__claude-in-chrome__") || tool.startsWith("mcp__playwright__");
const BROWSER_LABEL: Record<string, string> = {
  navigate: "ブラウザで開いています",
  browser_navigate: "ブラウザで開いています",
  tabs_create_mcp: "ブラウザのタブを開いています",
  browser_tabs: "ブラウザのタブを用意しています",
  tabs_context_mcp: "ブラウザを用意しています",
  tabs_close_mcp: "ブラウザのタブを閉じています",
  browser_close: "ブラウザを閉じています",
  read_page: "ページを読んでいます",
  get_page_text: "ページを読んでいます",
  browser_snapshot: "ページを読んでいます",
  find: "ページの中を探しています",
  form_input: "ブラウザで入力しています",
  browser_type: "ブラウザで入力しています",
  browser_fill_form: "ブラウザで入力しています",
  browser_click: "ブラウザで押しています",
  file_upload: "ファイルを付けています",
  browser_file_upload: "ファイルを付けています",
  gif_creator: "操作を記録しています",
  javascript_tool: "ページを調べています",
  browser_evaluate: "ページを調べています",
};
/** 「拡張機能とつながっていない」の印（公式の説明の文言・2026-09-30） */
const BROWSER_OFF =
  /Browser extension is not connected|Receiving end does not exist|extension (?:is )?not (?:connected|detected)/i;
const resultText = (v: unknown): string =>
  typeof v === "string"
    ? v
    : Array.isArray(v)
      ? (v as J[]).map((x) => (typeof x === "string" ? x : str(x?.["text"]))).join("\n")
      : "";

/** 道具の入力を、人が読める 1 行にする（Bash はコマンド、ファイル系はパス、他は JSON の先頭） */
export function brief(tool: string, input: unknown): string {
  const i = (input ?? {}) as J;
  if (/^bash$/i.test(tool)) return cut(str(i["command"]), 120);
  // 問い合わせは問いそのもの（生の JSON を人に見せない）
  if (tool === "AskUserQuestion") {
    const qs = Array.isArray(i["questions"]) ? (i["questions"] as J[]) : [];
    return cut(
      qs
        .map((q) => str(q["question"]))
        .filter(Boolean)
        .join(" ／ "),
      120,
    );
  }
  // 道具を探す・手順を立てるの中身（select:mcp__… 等）は人に見せない
  if (tool === "ToolSearch" || tool === "TodoWrite") return "";
  // ブラウザは開く先のホスト名だけ（URL の後ろ（鍵・検索の語）は出さない）。それ以外の欄（座標・操作の中身）は出さない
  if (isBrowserTool(tool)) {
    const u = str(i["url"]);
    try {
      return u ? new URL(u).host : "";
    } catch {
      return "";
    }
  }
  const path = str(i["file_path"] ?? i["path"] ?? i["notebook_path"]);
  if (path) return cut(path, 120);
  const url = str(i["url"]);
  if (url) return cut(url, 120);
  // それ以外も生の JSON は出さない。人が読める欄（探す語・説明 等）があればそれだけ
  for (const k of ["query", "description", "prompt", "pattern", "q", "name", "title"])
    if (str(i[k])) return cut(str(i[k]), 120);
  return "";
}

/** 切り替わりを、人が読む作業中の 1 行にする。道具は「〇〇の準備をしています」（入力を書いている間） */
export function phaseText(phase: "thinking" | "tool" | "writing", tool?: string): string {
  if (phase === "thinking") return "考えています";
  if (phase === "writing") return "返事を書いています";
  if (tool === "AskUserQuestion") return "あなたへの問い合わせを書いています";
  if (tool === "TodoWrite") return "手順を立てています";
  if (tool === "ToolSearch") return "使う道具を探しています";
  return label(tool ?? "");
}

/** 道具の名前を、人が読む「〇〇しています」にする（D-104.8：作業中の 1 行） */
export function label(tool: string): string {
  const t = tool.toLowerCase();
  if (t === "read") return "読んでいます";
  if (t === "write" || t === "edit" || t === "multiedit" || t === "notebookedit") return "書いています";
  if (t === "bash") return "コマンドを動かしています";
  if (t === "grep" || t === "glob") return "探しています";
  if (t === "websearch") return "Web で調べています";
  if (t === "webfetch") return "ページを読んでいます";
  if (t === "task" || t === "agent") return "手分けしています";
  if (tool === "AskUserQuestion") return "あなたに聞いています";
  if (tool === "ToolSearch") return "使う道具を探しています";
  if (tool === "TodoWrite") return "手順を立てています";
  // Kaname の道具（D-110）。たたき台に置いている・直している
  const KANAME: Record<string, string> = {
    ticket_read: "チケットを読んでいます",
    knowledge_open: "ナレッジを開いています",
    draft_read: "たたき台を読んでいます",
    goal_set: "たたき台に目標を置いています",
    goal_remove: "目標を外しています",
    ledger_set: "たたき台に台帳を置いています",
    ledger_remove: "台帳を外しています",
    duty_set: "たたき台に担当業務を置いています",
    duty_remove: "担当業務を外しています",
    remember: "覚えています",
    artifact_put: "成果物を渡しています",
  };
  if (tool.startsWith("mcp__kaname__")) return KANAME[tool.slice("mcp__kaname__".length)] ?? "Kaname に書いています";
  // ブラウザの道具（Claude in Chrome・Bridge 専用のブラウザ・D-119）。内部の名前は出さない
  if (isBrowserTool(tool)) return BROWSER_LABEL[tool.split("__").at(-1) ?? ""] ?? "ブラウザを操作しています";
  // MCP の道具は「mcp__サーバー__道具」。人には道具の名前だけ
  const short = tool.startsWith("mcp__") ? (tool.split("__").at(-1) ?? tool) : tool;
  return `「${short}」を使っています`;
}

/** 1 行を 1 イベントに。JSON でない行（フックの標準出力 等）は null */
export function parseLine(line: string): Ev | null {
  const t = line.trim();
  if (!t.startsWith("{")) return null;
  let j: J;
  try {
    j = JSON.parse(t) as J;
  } catch {
    return null;
  }
  const type = str(j["type"]);
  if (type === "system") {
    if (str(j["subtype"]) === "init" && str(j["session_id"])) {
      const servers = Array.isArray(j["mcp_servers"]) ? (j["mcp_servers"] as J[]) : [];
      const status = (name: string): string | null => {
        const s = servers.find((x) => str(x["name"]) === name);
        return s ? str(s["status"]) || null : null;
      };
      // model：いまこの Claude Code が使うモデル（例 claude-opus-4-8）。何も選んでいないときに画面へ実際のモデル名を出す（2026-09-30）
      return {
        type: "init",
        session: str(j["session_id"]),
        chrome: status("claude-in-chrome"),
        dedicated: status("playwright"),
        model: str(j["model"]) || null,
      };
    }
    return { type: "other", raw: j };
  }
  if (type === "stream_event") {
    // 書きながら出る返事（--include-partial-messages・D-104.8）：文の切れ端だけ拾う
    const ev = (j["event"] ?? {}) as J;
    const et = str(ev["type"]);
    if (et === "message_start") return { type: "message_start" };
    if (et === "content_block_start") {
      const cb = (ev["content_block"] ?? {}) as J;
      const bt = str(cb["type"]);
      if (bt === "thinking" || bt === "redacted_thinking") return { type: "phase", phase: "thinking" };
      if (bt === "tool_use" && str(cb["name"])) return { type: "phase", phase: "tool", tool: str(cb["name"]) };
      if (bt === "text") return { type: "phase", phase: "writing" };
    }
    if (et === "content_block_delta") {
      const dl = (ev["delta"] ?? {}) as J;
      if (str(dl["type"]) === "text_delta" && str(dl["text"])) return { type: "delta", text: str(dl["text"]) };
    }
    return { type: "other", raw: j };
  }
  if (type === "rate_limit_event") {
    // 使用量（D-104.16）。割合（0〜1）と戻る時刻（秒）
    const info = (j["rate_limit_info"] ?? {}) as J;
    const w = (info["unifiedWindows"] ?? {}) as J;
    const windows: LimitWindow[] = [];
    for (const [k, name] of [
      ["five_hour", "five_hour"],
      ["seven_day", "week"],
    ] as const) {
      const x = (w[k] ?? {}) as J;
      const u = Number(x["utilization"]);
      const r = Number(x["resetsAt"]);
      if (Number.isFinite(u) && Number.isFinite(r)) windows.push({ window: name, utilization: u, resets_at: r });
    }
    return windows.length ? { type: "limit", windows } : { type: "other", raw: j };
  }
  if (type === "assistant") {
    const m = (j["message"] ?? {}) as J;
    const content = Array.isArray(m["content"]) ? (m["content"] as J[]) : [];
    const parts: string[] = [];
    const tools: { id: string; name: string; target: string }[] = [];
    let todos: Todo[] | undefined;
    for (const c of content) {
      if (str(c["type"]) === "text" && str(c["text"]).trim()) parts.push(cut(str(c["text"]).trim(), 160));
      if (str(c["type"]) === "tool_use") {
        const name = str(c["name"]);
        if (name === "TodoWrite") {
          // 手順（D-104.8）：中身と済んだかだけ
          const list = ((c["input"] ?? {}) as J)["todos"];
          todos = (Array.isArray(list) ? (list as J[]) : []).map((x) => {
            const s = str(x["status"]);
            return {
              content: cut(str(x["content"]) || str(x["activeForm"]), 200),
              status: (["pending", "in_progress", "completed"].includes(s) ? s : "pending") as Todo["status"],
            };
          });
          continue;
        }
        const target = brief(name, c["input"]);
        parts.push(`${label(name)}：${target}`);
        tools.push({ id: str(c["id"]), name, target });
      }
    }
    // 文そのもの（切らずに）と記録の id。写す（D-112）。脇道（サブエージェント）の文は写さない
    const full = content
      .filter((c) => str(c["type"]) === "text")
      .map((c) => str(c["text"]))
      .join("\n\n")
      .trim();
    const synthetic = str(m["model"]) === "<synthetic>" || j["isApiErrorMessage"] === true; // Claude Code が自分で足した文は写さない
    const entry: Entry | undefined =
      full && str(j["uuid"]) && !j["parent_tool_use_id"] && !synthetic
        ? { uuid: str(j["uuid"]), text: full, ...(str(m["id"]) ? { group: str(m["id"]) } : {}) }
        : undefined;
    if (todos && !parts.length) return { type: "progress", text: "", tools, todos };
    return parts.length
      ? { type: "progress", text: parts.join(" ／ "), tools, ...(todos ? { todos } : {}), ...(entry ? { entry } : {}) }
      : { type: "other", raw: j };
  }
  if (type === "user") {
    // 道具が終わった（返り値の中身は読まない・送らない：D-100.3）。成功したかだけ
    const m = (j["message"] ?? {}) as J;
    const content = Array.isArray(m["content"]) ? (m["content"] as J[]) : [];
    const results = content
      .filter((c) => str(c["type"]) === "tool_result" && str(c["tool_use_id"]))
      .map((c) => ({ id: str(c["tool_use_id"]), ok: c["is_error"] !== true }));
    // 中身は読まない・送らない（D-100.3）。見るのは「拡張機能とつながっていない」の失敗の印だけ
    const off = content.some((c) => str(c["type"]) === "tool_result" && BROWSER_OFF.test(resultText(c["content"])));
    return results.length
      ? { type: "tool_end", results, ...(off ? { browser: "disconnected" as const } : {}) }
      : { type: "other", raw: j };
  }
  if (type === "control_request") {
    const r = (j["request"] ?? {}) as J;
    if (str(r["subtype"]) === "can_use_tool") {
      const tool = str(r["tool_name"]) || "道具";
      // 問い合わせ（AskUserQuestion・D-104.5）は問いそのものを見出しにする。道具の確認は「何に・何を」
      const qs = tool === "AskUserQuestion" ? (((r["input"] ?? {}) as J)["questions"] as J[] | undefined) : undefined;
      const summary =
        Array.isArray(qs) && qs.length
          ? cut(
              qs
                .map((q) => str(q["question"]))
                .filter(Boolean)
                .join(" ／ "),
              300,
            )
          : `${tool}: ${brief(tool, r["input"])}`;
      return { type: "ask", requestId: str(j["request_id"]), tool, input: r["input"], summary };
    }
    return { type: "other", raw: j };
  }
  if (type === "result") {
    const isError = j["is_error"] === true;
    const text = str(j["result"]).trim();
    const reason = [j["terminal_reason"], j["subtype"], j["error"]].map(str).filter(Boolean).join(" ") || null;
    // 完了イベントが来ても、本文が空なら「終わった」と言わない（G-15）
    return {
      type: "result",
      ok: !isError && !!text,
      text,
      session: str(j["session_id"]) || null,
      reason: isError ? reason : text ? null : "empty",
      usage: usageOf(j),
      raw: j,
    };
  }
  return { type: "other", raw: j };
}

/** result から使った量を取り出す（D-100.1）。1 つも無ければ null */
export function usageOf(j: J): Usage | null {
  const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const u = (j["usage"] ?? {}) as J;
  const out: Usage = {
    turns: num(j["num_turns"]),
    duration_ms: num(j["duration_ms"]),
    api_ms: num(j["duration_api_ms"]),
    input_tokens: num(u["input_tokens"]),
    output_tokens: num(u["output_tokens"]),
    cache_read_tokens: num(u["cache_read_input_tokens"]),
    cache_write_tokens: num(u["cache_creation_input_tokens"]),
    cost_usd: num(j["total_cost_usd"]),
  };
  return Object.values(out).some((v) => v !== null) ? out : null;
}

/** 人が言ったことを CLI に渡す 1 行 */
export const userMessage = (text: string): string =>
  `${JSON.stringify({ type: "user", message: { role: "user", content: [{ type: "text", text }] } })}\n`;

/** 確認への答えを CLI に返す 1 行。許可しないときは理由も添える（CLI はそれを本人の言葉として扱う）。
 *  問い合わせ（AskUserQuestion）の答えは updatedInput.answers に「問い → 選んだ答え」で入れる（2026-09-27 実測） */
export const controlResponse = (
  requestId: string,
  allow: boolean,
  input?: unknown,
  note?: string | null,
  answers?: Record<string, string> | null,
  denyMessage?: string | null,
): string =>
  `${JSON.stringify({
    type: "control_response",
    response: {
      subtype: "success",
      request_id: requestId,
      response: allow
        ? {
            behavior: "allow",
            ...(input !== undefined ? { updatedInput: answers ? { ...(input as J), answers } : input } : {}),
          }
        : {
            behavior: "deny",
            // 本人に聞いていない断り（チケットの仕事・D-129.44）は、その文をそのまま渡す（「本人が」と書かない）
            message: denyMessage
              ? denyMessage
              : note
                ? `本人が許可しませんでした：${note}`
                : "本人が許可しませんでした",
          },
    },
  })}\n`;

/** 出力の切れ端を行に分ける。最後の途中までの行は残す */
export function splitLines(buf: string): { lines: string[]; rest: string } {
  const parts = buf.split("\n");
  const rest = parts.pop() ?? "";
  return { lines: parts, rest };
}

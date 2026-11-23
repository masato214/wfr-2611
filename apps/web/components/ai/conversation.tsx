"use client";
// 会話そのもの（D-062・D-090・D-104）。会話を出す画面はどれもこれを使う（部品は 1 組・D-066.1・L-008）。
//   両方とも吹き出し（自分は淡い灰、AI は白い面＋罫線）。AI の表・図・コード・カードは会話の幅いっぱい（D-104.2）
//   作業中は吹き出しを出さず枠なしの行、本文が書き始められたら吹き出しになり書きながら出る（D-104.8）
//   止まったら理由だけ・入力欄は開いたまま（D-104.15）／送れなかった文は消さずに「もう一度送る」
//   返事への操作：自分＝直して送り直す・コピー／AI＝コピー・タスクにする・手元に落とす。一部を選ぶと「引用して続ける」（D-104.17）
//   読んでいる途中で勝手に下へ飛ばない（上を読んでいる間は「いちばん下へ」と新しい返事の数・D-104.18）
//   会話は読み上げソフトが順に読める記録（role=log）、作業中は aria-busy（D-104.20）
import {
  ArrowDown,
  Bot,
  Brain,
  Copy,
  Download,
  FileText,
  Globe,
  ListChecks,
  MessageSquareQuote,
  Paperclip,
  Pencil,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import { BrowserFix, isBrowserOffNotice } from "./browser-fix";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { isBuilt } from "@/lib/built-routes";
import type { Agent, AgentContext } from "@/lib/agent";
import { artifactCreate, artifactDownload, artifactList, type AgentMsg, type ArtifactItem } from "@/lib/auth/ext";
import { cn } from "@/lib/cn";
import { PermCard, QCard, questionsOf } from "./asks";
import { Composer } from "./composer";
import { copyText } from "./copy";
import { ArtifactPanel } from "./artifact";
import { ExportContext, Markdown, type ExportFn } from "./markdown";
import { StopLine, UsageLine, WorkDone, WorkLive } from "./work";

export function Conversation({
  agent,
  opening,
  placeholder = "聞く・頼む・相談する",
  children,
  onSaid,
  context,
  compact = false,
  aiName = "自分のAI",
  meInitial = "私",
  askOnly = false,
  openingAsMessage = false,
  openingOptions,
  onOpeningPick,
  offlineSec = null,
}: {
  agent: Agent;
  /** PC の Bridge が応答していないとき、最後の知らせから何秒か（作業中の行でそう言う） */
  offlineSec?: number | null;
  /** 会話が 1 件も無いときの、自分のAIのあいさつ（画面ごとに違う） */
  opening?: string;
  /** あいさつを自分のAI の最初の吹き出しとして出す（はじめの設定の聞き取り等・モックの cmsg）。無ければ 1 行のあいさつ（.greet） */
  openingAsMessage?: boolean;
  /** 最初の吹き出しの中の短い選択肢（押すとその文で答える）。最後に「その他（自分で書く）」が付き、押すと入力欄へ */
  openingOptions?: string[];
  onOpeningPick?: (v: string) => void;
  placeholder?: string;
  /** 会話の下（よく頼むこと 等）に足すもの */
  children?: ReactNode;
  onSaid?: () => void;
  /** どこで話しかけているか（D-103）。入力欄の上のチップで見せ、外せる */
  context?: AgentContext;
  /** 右パネルの幅で詰めて出す（中身と動きは同じ） */
  compact?: boolean;
  /** 名前の横はアイコンと名前（自分のAI は「高本AI」等・D-104.2） */
  aiName?: string;
  meInitial?: string;
  askOnly?: boolean;
}) {
  const s = agent.state;
  const queuedIds = useMemo(
    () => new Set((s?.queued ?? []).filter((q) => q.kind === "job").map((q) => q.job_id)),
    [s?.queued],
  );
  // 順番待ちの文は入力欄の上に出す（会話の流れにはまだ入れない）
  const msgs = useMemo(
    () => (s?.messages ?? []).filter((m) => !(m.who === "me" && m.job_id && queuedIds.has(m.job_id))),
    [s?.messages, queuedIds],
  );
  const work = s?.work ?? null;
  const asking = s?.asking ?? null;
  const questions = asking ? questionsOf(asking) : null;
  const [quote, setQuote] = useState<{ text: string; message_id: string | null } | null>(null);

  // ---- 成果物（D-106）：返事から書き出すと横に開く。閉じても会話の中のカードから開き直せる
  const qc = useQueryClient();
  const convId = agent.conversationId;
  const arts = useQuery({
    queryKey: ["agent-artifacts", convId],
    queryFn: () => artifactList(convId),
    enabled: !!convId,
  });
  // 自分のAI が仕事の中で道具で渡した成果物（D-121）は、返事が届いた時点で読み直してカードに出す（返事に結ばれるのは結末のとき）
  // 返事の文は書きながら先に出る（D-112）ので、返事が出た時だけでなく、仕事が終わった時（結末で返事に結ばれる）にも読み直す
  const aiCount = (s?.messages ?? []).filter((m) => m.who === "ai").length;
  const workJob = s?.work?.job_id ?? null;
  useEffect(() => {
    if (convId) void qc.invalidateQueries({ queryKey: ["agent-artifacts", convId] });
  }, [aiCount, workJob, convId, qc]);
  const [openArt, setOpenArt] = useState<string | null>(null);
  useEffect(() => setOpenArt(null), [convId]);
  const exportFrom = useCallback(
    (messageId: string): ExportFn =>
      (text, format) =>
        void artifactCreate({ message_id: messageId, text, format })
          .then((a) => {
            void qc.invalidateQueries({ queryKey: ["agent-artifacts"] });
            setOpenArt(a.id);
          })
          .catch((e: unknown) => toast(e instanceof Error ? e.message : "書き出せませんでした")),
    [qc],
  );
  const [edit, setEdit] = useState<{ text: string; message_id: string } | null>(null);

  const chat = useRef<HTMLDivElement | null>(null);
  // ---- 勝手に下へ飛ばない：自分で上へ戻った間だけ追わない（2026-10-01 QA）
  // 前は「いちばん下が見えているか」だけで追っていた。返事を書き終わった後に図などが描かれて中身が伸びると、下にいた人が下から外れ、
  // 「いちばん下へ」が出て「もう一度送る」に重なり、押してもまた外れた。追うかどうかは、本人が上へ戻ったか（スクロールの向き）で決め、
  // 追っている間は中身の高さが変わるたびに下へ送る
  const end = useRef<HTMLDivElement | null>(null);
  const followRef = useRef(true);
  const [following, setFollowingState] = useState(true);
  const setFollowing = useCallback((v: boolean) => {
    followRef.current = v;
    setFollowingState(v);
  }, []);
  const [unseen, setUnseen] = useState(0);
  const toEnd = useCallback(() => end.current?.scrollIntoView({ block: "end" }), []);
  useEffect(() => {
    const el = end.current;
    const box = chat.current;
    if (!el || !box) return;
    // 一番下が見えたら、また追う
    const io =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([e]) => {
            if (e?.isIntersecting) {
              setFollowing(true);
              setUnseen(0);
            }
          });
    io?.observe(el);
    // 上へ戻る向きに動いたら追わない（こちらから送るのは下向きだけなので、上向きは本人の操作）。
    // スクロールする箱は開いた時点ではまだ決まらない（会話が短いと箱がスクロールしない）ので、どこで起きたスクロールも拾い、
    // 会話の箱か、それを含む箱（ページ全体を含む）のものだけ数える
    // 数えるのは「一番下からの距離が開いたか」。位置が上がったかでは数えない：中身が縮む（書きかけが仕上がりに替わる）・
    // 見える高さが広がる（入力欄の上の候補が消える）と、ブラウザが位置を上へ詰めるが、一番下からの距離は 0 のまま（2026-10-01 実測）
    // さらに、中身が伸びただけ（位置は同じで距離だけ開く）も本人の操作ではない。本人が上へ戻ったときは「位置が上がり、かつ距離が開く」
    const last = new WeakMap<object, { top: number; dist: number }>();
    const onScroll = (e: Event) => {
      const tg = e.target;
      const isDoc = tg === document || tg === document.documentElement || tg === document.scrollingElement;
      if (!isDoc && !(tg instanceof Element && tg.contains(box))) return;
      const el = isDoc ? document.documentElement : (tg as Element);
      const key: object = isDoc ? document : el;
      const top = isDoc ? window.scrollY : el.scrollTop;
      const view = isDoc ? window.innerHeight : el.clientHeight;
      const dist = el.scrollHeight - top - view;
      const before = last.get(key);
      if (before && top < before.top - 2 && dist > before.dist + 2) setFollowing(false);
      last.set(key, { top, dist });
    };
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    // 追っている間は、中身が伸びたときだけ下へ（図・表・画像が後から伸びても置いていかない）。高さが変わらない変化（印が付く等）では動かさない
    let lastH = box.scrollHeight;
    const ro =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            const h = box.scrollHeight;
            if (h > lastH + 1 && followRef.current) toEnd();
            lastH = h;
          });
    ro?.observe(box);
    return () => {
      io?.disconnect();
      ro?.disconnect();
      document.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, [setFollowing, toEnd]);
  // 数えるのは「いちばん下に足された返事」だけ（上に読み込んだ古い分は新しい返事ではない）
  const lastId = msgs[msgs.length - 1]?.id;
  const prevLast = useRef<string | undefined>(lastId);
  const tick = `${lastId ?? ""}|${work?.partial?.length ?? 0}|${work?.status ?? ""}|${asking?.request_id ?? ""}|${agent.failed.length}`;
  useEffect(() => {
    if (followRef.current) toEnd();
    else if (prevLast.current && lastId !== prevLast.current) {
      const from = msgs.findIndex((m) => m.id === prevLast.current);
      const added = from < 0 ? 0 : msgs.slice(from + 1).filter((m) => m.who === "ai").length;
      if (added) setUnseen((n) => n + added);
    }
    prevLast.current = lastId;
    // 中身が変わったときだけ動かす
  }, [tick]);

  // ---- 上へ戻ると古い分を読み込む（D-104.18）。読み込んでも読んでいる位置は動かさない
  // 読んでいた返事が画面のどこにあったかを覚え、足した後に同じ所へ戻す（ブラウザが自分で位置を保つ場合は差が 0 になる）
  const top = useRef<HTMLDivElement | null>(null);
  const keep = useRef<{ node: Element; y: number } | null>(null);
  useEffect(() => {
    const el = top.current;
    if (!el || typeof IntersectionObserver === "undefined" || !agent.hasOlder) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e?.isIntersecting || agent.loadingOlder) return;
      const node = el.parentElement?.querySelector(".msg");
      keep.current = node ? { node, y: node.getBoundingClientRect().top } : null;
      void agent.loadOlder();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [agent.hasOlder, agent.loadingOlder, agent.loadOlder]);
  const firstId = msgs[0]?.id;
  useLayoutEffect(() => {
    const k = keep.current;
    if (!k || !k.node.isConnected) return;
    const delta = k.node.getBoundingClientRect().top - k.y;
    const sc = scrollParent(k.node);
    if (delta) {
      if (sc === document.scrollingElement || sc === document.documentElement) window.scrollBy(0, delta);
      else sc.scrollTop += delta;
    }
    keep.current = null;
  }, [firstId]);

  // ---- 一部を選んで「引用して続ける」（AI の返事の中だけ）
  const [sel, setSel] = useState<{ text: string; id: string | null; x: number; y: number } | null>(null);
  const onSelect = useCallback(() => {
    const g = window.getSelection();
    const t = g?.toString().trim() ?? "";
    if (!g || !t || g.rangeCount === 0) return setSel(null);
    const node = g.getRangeAt(0).commonAncestorContainer;
    const host = (node instanceof Element ? node : node.parentElement)?.closest<HTMLElement>("[data-who='ai']");
    if (!host || !chat.current?.contains(host)) return setSel(null);
    const r = g.getRangeAt(0).getBoundingClientRect();
    setSel({ text: t.slice(0, 2000), id: host.dataset["id"] ?? null, x: r.left + r.width / 2, y: r.top });
  }, []);

  return (
    <div
      className="kc"
      data-part="conversation"
      data-compact={compact ? "" : undefined}
      data-art={openArt && !compact ? "" : undefined}
    >
      <div
        ref={chat}
        className="chat"
        role="log"
        aria-label="会話"
        aria-busy={!!work}
        onMouseUp={onSelect}
        onKeyUp={onSelect}
      >
        {agent.hasOlder ? (
          <div ref={top} className="muted" style={{ textAlign: "center", fontSize: 12 }} data-older>
            {agent.olderFailed ? (
              <>
                前のやりとりを読み込めませんでした。{" "}
                <button type="button" className="underline" onClick={agent.retryOlder} data-older-retry>
                  もう一度読む
                </button>
              </>
            ) : agent.loadingOlder ? (
              "前のやりとりを読み込んでいます…"
            ) : (
              "上へ戻ると前のやりとりを読み込みます"
            )}
          </div>
        ) : null}
        {!msgs.length && !work ? (
          openingAsMessage && opening ? (
            <div className="msg c" data-opening>
              <div className="av">
                <Bot />
              </div>
              <div className="mcol">
                <div className="who">{aiName}</div>
                <div className="bub">
                  <Markdown text={opening} />
                  {openingOptions?.length ? (
                    <div className="opts" role="group" aria-label="答えの候補">
                      {openingOptions.map((o) => (
                        <button type="button" key={o} onClick={() => onOpeningPick?.(o)}>
                          {o}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="alt"
                        onClick={(e) =>
                          e.currentTarget
                            .closest(".kc")
                            ?.querySelector<HTMLTextAreaElement>(".composer textarea")
                            ?.focus()
                        }
                      >
                        その他（自分で書く）
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="greet" data-greet>
              <div className="av">
                <Bot />
              </div>
              <div>{opening ?? "何から始めますか？"}</div>
            </div>
          )
        ) : null}
        {msgs.map((m) =>
          m.who === "stopped" ? (
            <StopLine key={m.id} reason={m.text} />
          ) : m.who === "note" && isBrowserOffNotice(m.text) ? (
            // AI がブラウザを使えなかった（D-119.4）。理由と、その場でやる一手（D-120）
            <div key={m.id} className="stopline" role="status" data-who="note" data-notice="browser-off">
              <Globe />
              <div>
                {m.text}
                <BrowserFix />
              </div>
            </div>
          ) : m.who === "note" ? (
            // 許可した／しなかった の記録（D-093.8）。会話の流れの中に残す
            <p key={m.id} className="steer muted" data-who="note">
              {m.text}
            </p>
          ) : m.who === "memo" ? (
            // 覚えました（D-105.1）。字だけの行（記憶の画面は無い）
            <p key={m.id} className="memline" data-who="memo">
              <Brain />
              <span>覚えました：{m.text}</span>
            </p>
          ) : m.who === "me" ? (
            <Mine
              key={m.id}
              m={m}
              initial={meInitial}
              onEdit={askOnly ? null : () => setEdit({ text: m.text, message_id: m.id })}
            />
          ) : (
            <Theirs
              key={m.id}
              m={m}
              name={aiName}
              onExport={exportFrom(m.id)}
              arts={(arts.data ?? []).filter((x) => x.message_id === m.id)}
              onOpen={setOpenArt}
            />
          ),
        )}
        {agent.failed.map((f) => (
          <div className="msg u failed" key={f.key} data-failed>
            <div className="av">{meInitial}</div>
            <div className="mcol">
              <div className="bub">{f.text}</div>
              <div className="sendfail" role="status">
                <TriangleAlert />
                送れませんでした（{f.reason}）。書いた文は残っています
                <Button
                  size="sm"
                  variant="outline"
                  icon={<RefreshCw />}
                  onClick={() => void agent.retry(f.key)}
                  data-retry
                >
                  もう一度送る
                </Button>
                <Button size="sm" variant="ghost" onClick={() => agent.dismissFailed(f.key)}>
                  消す
                </Button>
              </div>
            </div>
          </div>
        ))}
        {work ? (
          <WorkLive
            work={work}
            waiting={asking ? (questions ? "answer" : "permission") : null}
            offlineSec={offlineSec}
          />
        ) : null}
        {work?.partial ? (
          <div className="msg c" data-who="ai" data-streaming>
            <div className="av">
              <Bot />
            </div>
            <div className="mcol">
              <div className="who">{aiName}</div>
              <div className="bub">
                <Markdown text={work.partial} streaming />
              </div>
            </div>
          </div>
        ) : null}
        {asking ? (
          questions ? (
            <QCard
              who={asking.by ?? aiName}
              questions={questions}
              busy={agent.sending}
              onSend={(answers) => void agent.answer({ allow: true, answers })}
            />
          ) : (
            <PermCard asking={asking} busy={agent.sending} onAnswer={(a) => void agent.answer(a)} />
          )
        ) : null}
        <UsageLine usage={s?.usage} />
        {/* 下に固定の入力欄の高さぶん余白を取って止める（追いかけたときに最後の行が入力欄に隠れない） */}
        <div ref={end} aria-hidden="true" style={{ scrollMarginBottom: compact ? 24 : 176 }} />
      </div>
      {sel ? (
        <span
          className="selpop"
          style={{ position: "fixed", left: sel.x, top: sel.y - 36, transform: "translateX(-50%)", zIndex: 30 }}
          data-quote-pop
        >
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setQuote({ text: sel.text, message_id: sel.id });
              setSel(null);
              window.getSelection()?.removeAllRanges();
            }}
          >
            <MessageSquareQuote />
            引用して続ける
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => (void copyText(sel.text), setSel(null))}
          >
            <Copy />
            コピー
          </button>
        </span>
      ) : null}
      {children}
      <Composer
        agent={agent}
        above={
          // 上を読んでいる間は常に出す。押すと最後のやりとりへ一気に戻る（2026-09-30 user）。新しい返事が来ていれば件数を添える
          !following ? (
            <button
              type="button"
              className="tobottom"
              aria-label={unseen > 0 ? `いちばん下へ（新しい返事 ${unseen}）` : "いちばん下へ"}
              title="いちばん下へ（最後のやりとり）"
              onClick={() => {
                setFollowing(true);
                toEnd();
              }}
              data-to-bottom
            >
              <ArrowDown />
              {unseen > 0 ? <span className="nb">新しい返事 {unseen}</span> : null}
            </button>
          ) : null
        }
        placeholder={placeholder}
        compact={compact}
        {...(context ? { context } : {})}
        {...(onSaid ? { onSaid } : {})}
        quote={quote}
        onClearQuote={() => setQuote(null)}
        edit={edit}
        onClearEdit={() => setEdit(null)}
        askOnly={askOnly}
      />
      {agent.error ? (
        <p className="sendfail" role="status" data-say-error>
          {agent.error}
        </p>
      ) : null}
      {openArt ? (
        <div className="artdock">
          <ArtifactPanel id={openArt} onClose={() => setOpenArt(null)} />
        </div>
      ) : null}
    </div>
  );
}

function Mine({ m, initial, onEdit }: { m: AgentMsg; initial: string; onEdit: (() => void) | null }) {
  return (
    <>
      <div className="msg u" data-who="me" data-id={m.id}>
        <div className="av">{initial}</div>
        <div className="mcol">
          <div className="bub">
            {m.quote?.text ? (
              <div className="qt">
                <MessageSquareQuote />
                <span>{m.quote.text}</span>
              </div>
            ) : null}
            <span style={{ whiteSpace: "pre-wrap" }}>{m.text}</span>
            <Atts list={m.attachments} />
          </div>
          <div className="mact end">
            {onEdit ? (
              <button type="button" onClick={onEdit}>
                <Pencil />
                直して送り直す
              </button>
            ) : null}
            <button type="button" onClick={() => void copyText(m.text)}>
              <Copy />
              コピー
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function Atts({ list }: { list: AgentMsg["attachments"] }) {
  if (!list?.length) return null;
  return (
    <div className="cchips" style={{ paddingTop: 6 }}>
      {list.map((a) => (
        <span className="cchip att" key={a.id}>
          <Paperclip />
          {a.name}
        </span>
      ))}
    </div>
  );
}

/** 返事の 1 行目をタスクの名前にする（見出し・箇条書きの印は外す） */
const titleOf = (md: string) =>
  (
    md
      .split("\n")
      .map((l) =>
        l
          .replace(/^\s*(#{1,6}\s+|>\s*|[-*+]\s+(\[[ xX]\]\s+)?|\d+[.)]\s+)/, "")
          .replace(/[*_`~]/g, "")
          .trim(),
      )
      .find(Boolean) ?? "自分のAIの返事から"
  ).slice(0, 80);

function ArtifactCard({ a, onOpen }: { a: ArtifactItem; onOpen: (id: string) => void }) {
  const kind = a.format === "csv" ? "表" : a.format === "md" ? "文書" : a.format.toUpperCase();
  const download = async () => {
    try {
      const f = await artifactDownload(a.id);
      const url = URL.createObjectURL(f.blob);
      const el = document.createElement("a");
      el.href = url;
      el.download = f.name;
      el.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast(e instanceof Error ? e.message : "落とせませんでした");
    }
  };
  return (
    <div className="fcard" data-art-card={a.id}>
      <FileText />
      <div>
        <b>{a.title}</b>
        <span className="muted">
          {kind} · 版 {a.current_version} · 成果物
        </span>
      </div>
      <Button size="sm" variant="ghost" onClick={() => onOpen(a.id)} data-art-open>
        横で開く
      </Button>
      <Button size="sm" variant="ghost" icon={<Download />} onClick={() => void download()}>
        落とす
      </Button>
    </div>
  );
}

function Theirs({
  m,
  name,
  onExport,
  arts,
  onOpen,
}: {
  m: AgentMsg;
  name: string;
  onExport: ExportFn;
  arts: ArtifactItem[];
  onOpen: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const toTask = async () => {
    setBusy(true);
    try {
      await api.create("tasks", { title: titleOf(m.text), next_action: m.text.slice(0, 2000) }, "clone-chat");
      toast(
        "タスクにしました",
        isBuilt("/tasks") ? { action: { label: "開く", onClick: () => window.location.assign("/tasks") } } : {},
      );
    } catch (e) {
      toast(`タスクにできませんでした（${e instanceof Error ? e.message : "理由は分かりません"}）`);
    } finally {
      setBusy(false);
    }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([m.text], { type: "text/markdown;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${titleOf(m.text).replace(/[\\/:*?"<>|]/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="msg c" data-who="ai" data-id={m.id}>
      <div className="av">
        <Bot />
      </div>
      <div className="mcol">
        <div className="who">{name}</div>
        {m.work ? <WorkDone ops={m.work.ops} ms={m.work.ms} /> : null}
        <div className={cn("bub")}>
          <ExportContext.Provider value={onExport}>
            <Markdown text={m.text} />
          </ExportContext.Provider>
        </div>
        {arts.map((a) => (
          <ArtifactCard key={a.id} a={a} onOpen={onOpen} />
        ))}
        <div className="mact">
          <button type="button" onClick={() => void copyText(m.text)}>
            <Copy />
            コピー
          </button>
          <button type="button" onClick={() => void toTask()} disabled={busy} data-to-task>
            <ListChecks />
            タスクにする
          </button>
          <button type="button" onClick={() => onExport(m.text, "md")} data-export>
            <FileText />
            書き出す
          </button>
          <button type="button" onClick={download} data-download>
            <Download />
            手元に落とす
          </button>
        </div>
      </div>
    </div>
  );
}

/** いちばん近い、縦に動く入れ物（右パネルの中ならパネル、会話モードなら画面そのもの） */
function scrollParent(el: Element): Element {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if ((o === "auto" || o === "scroll") && p.scrollHeight > p.clientHeight) return p;
  }
  return document.scrollingElement ?? document.documentElement;
}

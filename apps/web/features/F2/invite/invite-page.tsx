"use client";
// 招待を受けて参加する（/invite/:token・A03・K-335・K-336）。見た目は段 3 の部品（views の InviteAccept）。ここは動きだけ。
//   口は契約の口だけ：下見 getInvitation（K-331）・参加 acceptInvitation（K-332・K-333）・送り直しを頼む requestInvitationResend（K-334）・ログアウト signOut（K-306）。
//   開くと下見を 1 回だけ呼び、答えで画面を選ぶ：404 → 見つからない／429 → 少し待って（口の秒）／そのほかの失敗 → 調子が悪い／
//   期限切れ・取り消し・使われた → それぞれの画面／使える → ログイン中（もう入っている・同じメール・別のメール宛て）・宛てにアカウントがある・新しく作って参加。
//   ログイン中かどうかは下見の答えの signed_in だけで決める（画面で別に「誰か」を聞かない。印が切れていればログインしていない形）。
//   新しく作って参加：201 → 口が返した印を置き、口が返した行き先（付けるまで進めない /mfa-setup）へ。422 → 欄の下に口の文。
//   今のアカウントで参加（体なし）：201 → 口が返した印を置き、口が返した行き先（招かれたワークスペースのはじめ「/」）へ。
//   410・404 → 下見と同じ画面。409 E-INV-006 → ログインして参加。409 E-INV-007 → もう入っています。403 E-INV-005 → 別のメール宛て。
//   そのほかの失敗 → 画面は移らず赤の知らせ（入れた値は残る）。
//   ログアウトして開き直す：ログアウトの口が通ったら、この PC の印を消して下見を読み直す（ログインしていない形）。失敗したら印は消さず赤の知らせ。
//   送り直し：sent → 頼みました／already → 今日はもう頼んである／failed → 期限切れのまま赤の知らせ（押し直せる）。
//   URL の next は読まない（行き先は口の答えだけ・同じ出どころの道だけ・K-259）
import { useCallback, useEffect, useRef, useState } from "react";
import type { Route } from "next";
import { useParams, useRouter } from "next/navigation";
import { CATALOG } from "@kaname/errors/catalog";
import { sameOriginPath } from "@/lib/after-login";
import { call, type CallErr } from "@/lib/api/call";
import { clearDraftCopies, setToken } from "@/lib/api/client";
import { refreshSession } from "@/lib/auth/client";
import { linksOf, useCurrentTerms } from "../../F1/consent-terms/current-terms";
import { AuthLoading } from "../../F1/sign-up/auth-loading";
import {
  INVITE_NOTICE,
  InviteAccept,
  ROLE_LABEL,
  type InviteJoin,
  type InvitePreview,
  type InviteRole,
  type InviteState,
} from "./views";

const SCREEN = "invite-accept";
/** 参加した直後の行き先（口の答えに行き先が無い・外を向いているとき）。付けるまで進めない */
const AFTER_JOIN = "/mfa-setup" as Route;
/** 今のアカウントで参加した後の行き先（口の答えに行き先が無い・外を向いているとき）。入口が今の時点を見て振り分ける */
const AFTER_SIGNED_JOIN = "/" as Route;
/** 口が秒を返さなかった送りすぎの待ち（口の上限の窓と同じ 1 分） */
const WAIT_SEC = 60;

type Errors = { name?: string; password?: string; email?: string };
/** 画面の様子：読んでいる間は null */
interface View {
  state: InviteState;
  preview?: InvitePreview;
  waitSec?: number;
  /** 確認のメールを送りました（sent）の伏せたメール（K-422・K-423） */
  sentEmail?: string;
}
type Raw = Record<string, unknown>;

const catalogText = (id: string): string => CATALOG[id as keyof typeof CATALOG]?.message ?? id;
const waitText = (sec: number): string => catalogText("E-LIM-005").replace("{秒}", String(sec));
const str = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);
const isRole = (v: unknown): v is InviteRole => typeof v === "string" && Object.hasOwn(ROLE_LABEL, v);

/** 期限の日（その人の時計で「M/D」）。読めない日付は空 */
function dayOf(iso: unknown): string {
  const d = new Date(typeof iso === "string" ? iso : Number.NaN);
  return Number.isNaN(d.getTime()) ? "" : `${d.getMonth() + 1}/${d.getDate()}`;
}

/** 下見の答えを画面の言葉にする */
function previewOf(d: Raw): InvitePreview {
  const signed = d["signed_in"] as Raw | null | undefined;
  return {
    workspaceName: str(d["workspace_name"]) ?? "",
    inviterName: str(d["inviter_name"]),
    groupName: str(d["group_name"]),
    role: isRole(d["role"]) ? d["role"] : "member",
    message: str(d["message"]),
    email: str(d["email"]) ?? "",
    expiresOn: dayOf(d["expires_at"]),
    signedInEmail: signed ? str(signed["email"]) : null,
  };
}

/** 使える招待の形：ログイン中（もう入っている → 同じメール → 別のメール）→ 宛てにアカウントがある → 新しく作って参加 */
function usableState(d: Raw): InviteState {
  const signed = d["signed_in"] as Raw | null | undefined;
  if (signed)
    return signed["already_member"] === true ? "member" : signed["email_matches"] === true ? "signed" : "other";
  return d["account_exists"] === true ? "account" : "new";
}

/** 下見の答え（200）→ 画面の様子。知らない状態は調子が悪い（形を決めつけない） */
function viewOfPreview(d: Raw): View {
  const preview = previewOf(d);
  const s = d["state"];
  if (s === "expired" || s === "revoked" || s === "used") return { state: s, preview };
  return s === "ok" ? { state: usableState(d), preview } : { state: "down" };
}

/** 下見の口を呼んで画面の様子にする：404 → 見つからない／429 → 少し待って（口の秒）／そのほかの失敗・網の切れ → 調子が悪い */
async function readPreview(token: string): Promise<View> {
  try {
    const r = await call("getInvitation", { params: { token }, keepOn401: true, screenId: SCREEN });
    if (r.ok) return viewOfPreview((r.data ?? {}) as Raw);
    if (r.status === 404) return { state: "notfound" };
    if (r.status === 429) return { state: "wait", waitSec: r.retryAfterSec ?? WAIT_SEC };
    return { state: "down" };
  } catch {
    return { state: "down" }; // 網が切れた（口が答えない）
  }
}

/** ログイン中の人の形（もう入っている・同じメール・別のメール宛て）か */
const isSignedState = (s: InviteState): boolean => s === "member" || s === "signed" || s === "other";

/** 口が断った答え → 下見と同じ画面（無い・取り消し・期限切れ・使われた）。当たらなければ null */
function deadOf(r: CallErr): InviteState | null {
  if (r.status === 404) return "notfound";
  if (r.status !== 410) return null;
  if (r.code === "E-INV-002") return "revoked";
  if (r.code === "E-INV-003") return "expired";
  return r.code === "E-INV-004" ? "used" : null;
}

/** 参加の口が、下見の後に変わった様子で断った答え → その様子の画面。当たらなければ null。
 *  E-INV-006：宛てのメールでアカウントができた／E-INV-007：もう入っている／E-INV-005：別のメール宛て（別のアカウントに入り直した） */
function changedOf(r: CallErr): InviteState | null {
  if (r.status === 409 && r.code === "E-INV-006") return "account";
  if (r.status === 409 && r.code === "E-INV-007") return "member";
  return r.status === 403 && r.code === "E-INV-005" ? "other" : null;
}

/** 画面は移らないときの赤の知らせ：送りすぎは待つ秒数の文・止められたワークスペースは口の文・ほかは調子が悪い */
function noticeOf(r: CallErr): string {
  if (r.status === 429) return waitText(r.retryAfterSec ?? WAIT_SEC);
  if (r.status === 403 && r.code === "E-AUTH-012") return r.message ?? catalogText(r.code);
  return INVITE_NOTICE.down;
}

/** 欄の誤りの答えか：422 と、招待のリンクでメールの鍵が無いときの 409 E-INV-016（K-422） */
const isFieldErr = (r: CallErr): boolean => r.status === 422 || (r.status === 409 && r.code === "E-INV-016");

/** 欄の誤りの文を欄に分ける（口はいまは誤りを 1 つずつ返す。2 つ返ってきたら 2 つとも出す）。欄が分からなければ null */
function errorsOf(r: CallErr): Errors | null {
  const text = r.message ?? catalogText(r.code);
  const name = r.fields["name"] ?? (r.code === "E-VAL-007" ? text : undefined);
  // 招待のリンク（K-422）：メールの鍵が無い参加は 409 E-INV-016（欄なし）・空白だけ／形違いを送ったら 422 E-INV-013（欄 email）
  const email = r.fields["email"] ?? (r.code === "E-INV-013" || r.code === "E-INV-016" ? text : undefined);
  const password = r.fields["password"] ?? (/^E-VAL-(005|011|026)$/.test(r.code) ? text : undefined);
  if (!name && !password && !email) return null;
  return { ...(name ? { name } : {}), ...(password ? { password } : {}), ...(email ? { email } : {}) };
}

export function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const links = linksOf(useCurrentTerms());
  const [view, setView] = useState<View | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false); // 二度押しで口を 2 回呼ばない
  const loaded = useRef<string | null>(null); // 下見は開いたときに 1 回だけ（作り直しでも 2 回呼ばない）

  /** 下見を呼んで画面を決める */
  const load = useCallback(async (t: string) => {
    const now = await readPreview(t);
    if (loaded.current === t) setView(now); // 別の招待を開き直した後に届いた答えは捨てる
  }, []);

  useEffect(() => {
    if (!token || loaded.current === token) return;
    loaded.current = token;
    setView(null);
    void load(token);
  }, [token, load]);

  /** 押した口を 1 回だけ呼ぶ。"leave"（ページを移る）なら待ちの形のまま。投げたら（網の切れ）赤の知らせ */
  const run = useCallback(async (send: () => Promise<"stay" | "leave">) => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setErrors({});
    setNotice(null);
    let leave = false;
    try {
      leave = (await send()) === "leave";
    } catch {
      setNotice(INVITE_NOTICE.down);
    } finally {
      if (!leave) {
        sending.current = false;
        setBusy(false);
      }
    }
  }, []);

  /** 押した口が断った：下見と同じ画面へ（下見の中身は残す）。当たらなければ false */
  const toDead = (r: CallErr): boolean => {
    const state = deadOf(r);
    if (!state) return false;
    setView((v) => (state === "notfound" ? { state } : { state, ...(v?.preview ? { preview: v.preview } : {}) }));
    return true;
  };

  /** 参加の口が、下見の後に変わった様子で断った → その様子の画面へ（下見の中身は残す）。当たらなければ false。
   *  別のメール宛て（下見の後に別のアカウントへ入り直した）だけは、出すログイン中のメールが下見の時の物と違うので、形を替える前に下見を読み直す：
   *  ログイン中のメールが読めたら「別のメール宛ての形＋読み直した中身」を 1 回で置く（形は口の断りのとおり）。
   *  読めなければ（口が答えない・ログインが切れていた・招待が使えなくなっていた）、読み直した下見の結果の画面を出す（下見の時のメールでうその文を出さない） */
  const toChanged = async (r: CallErr, typedEmail?: string): Promise<boolean> => {
    const state = changedOf(r);
    if (!state) return false;
    if (state !== "other") {
      // 招待のリンク（下見の宛てが空）で入れたメールにもうアカウントがある：文の宛ては入れたメール（K-423）
      setView((x) => {
        if (!x) return x;
        const pv = x.preview;
        const filled = state === "account" && pv && pv.email === "" && typedEmail ? { ...pv, email: typedEmail } : pv;
        return { ...x, state, ...(filled ? { preview: filled } : {}) };
      });
      return true;
    }
    const now = await readPreview(token);
    if (loaded.current !== token) return true;
    const signedNow = isSignedState(now.state) && now.preview?.signedInEmail;
    setView(signedNow ? { state: "other", preview: now.preview } : now);
    return true;
  };

  /** 参加する。v があれば新しく作って参加（名前とパスワード）、無ければ今のアカウントで参加（体なし・K-336） */
  const onJoin = (v?: InviteJoin) =>
    void run(async () => {
      const r = await call("acceptInvitation", {
        params: { token },
        body: v ? { name: v.name, password: v.password, ...(v.email ? { email: v.email } : {}) } : {},
        keepOn401: true,
        screenId: SCREEN,
      });
      if (r.ok) {
        const joined = (r.data ?? {}) as Raw;
        // 招待のリンクで新しく入る人：参加はすぐ決まらない。確認のメールのリンクを押すまで印は置かず移らない（D-148.51・K-422）
        if (joined["state"] === "sent") {
          const sentEmail = str(joined["email"]);
          setView((x) => (x ? { ...x, state: "sent", ...(sentEmail ? { sentEmail } : {}) } : x));
          return "stay";
        }
        if (joined["state"] === "failed") {
          setNotice(INVITE_NOTICE.confirmFailed);
          return "stay";
        }
        const session = str(joined["token"]);
        if (session) {
          setToken(session);
          refreshSession(); // ログインの部品の見え方（セッションの印）にも新しいログインを知らせる
        }
        const fallback = v ? AFTER_JOIN : AFTER_SIGNED_JOIN;
        router.push(session ? sameOriginPath(str(joined["next"]), fallback) : ("/login" as Route));
        return "leave";
      }
      if (toDead(r) || (await toChanged(r, v?.email))) return "stay";
      if (isFieldErr(r) && !v) {
        // 体なしの参加に欄の誤りが返った＝押す前にログインが切れて、口がログインしていない人として受けた。
        // この形には欄が無いので、下見を読み直して今の形（ログインして参加 など）を出す
        await load(token);
        return "stay";
      }
      const byField = isFieldErr(r) ? errorsOf(r) : null;
      if (byField) setErrors(byField);
      else setNotice(noticeOf(r));
      return "stay";
    });

  /** ログアウトして開き直す（別のメール宛て）。口が通ったら（もう切れていた 401 も）この PC の印を消し、同じ招待をログインしていない形で読み直す */
  const onSignOut = () =>
    void run(async () => {
      const r = await call("signOut", { body: {}, keepOn401: true, screenId: SCREEN });
      if (!r.ok && r.status !== 401) {
        setNotice(noticeOf(r)); // 失敗したら印は消さない（押し直せる）
        return "stay";
      }
      setToken(null);
      clearDraftCopies(); // ログアウトはどこからでも、この PC の書きかけの写しを消す（lib/auth の signOut と同じ・K-60）
      refreshSession();
      await load(token);
      return "stay";
    });

  const onResend = () =>
    void run(async () => {
      const r = await call("requestInvitationResend", {
        params: { token },
        body: {},
        keepOn401: true,
        screenId: SCREEN,
      });
      if (r.ok) {
        const result = (r.data as Raw | undefined)?.["result"];
        if (result === "sent" || result === "already")
          setView((x) => (x ? { ...x, state: result === "sent" ? "resent" : "resent-already" } : x));
        else setNotice(result === "failed" ? INVITE_NOTICE.resendFailed : INVITE_NOTICE.down);
        return "stay";
      }
      if (toDead(r)) return "stay";
      // まだ使える招待だった（409・E-INV-008：期限が延びた など）→ 下見を読み直して今の形を出す
      if (r.status === 409 && r.code === "E-INV-008") await load(token);
      else setNotice(noticeOf(r));
      return "stay";
    });

  if (!view) return <AuthLoading />;
  return (
    <InviteAccept
      state={view.state}
      {...(view.preview ? { preview: view.preview } : {})}
      {...(view.waitSec !== undefined ? { waitSec: view.waitSec } : {})}
      {...(view.sentEmail ? { sentEmail: view.sentEmail } : {})}
      errors={errors}
      notice={notice}
      busy={busy}
      links={links}
      onJoin={onJoin}
      onResend={onResend}
      onSignOut={onSignOut}
      loginHref={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
      openHref="/"
    />
  );
}

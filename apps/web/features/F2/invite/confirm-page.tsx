"use client";
// 招待のリンクで新しく入る人の、確認のメールのリンクを開いた画面（/invite/confirm/:token・K-423・D-148.51）。見た目は views の InviteConfirm。ここは動きだけ。
//   開いただけでは口を呼ばない（メールの下見や自動で開く道具に押されない）。「参加を決める」を押すと confirmInvitationJoin を 1 回（二度押しは押せない形で止める）。
//   201 → 口が返したログインの印を置き（今ログイン中でも確認したアカウントの印に替わる）、口が返した行き先（同じ出どころの道だけ・既定 /mfa-setup）へ。
//   印の形（43 字の英数と - _）が違えば口を呼ばず E-INV-001 の文。断り：404・410・409・403 E-AUTH-012 → 正本の文で「参加を決める」は消える
//   （E-INV-015 は「ログインして入る」つき）。そのほか（503 など）→ 赤の知らせ（E-PAGE-003）でボタンは残り押し直せる。
import { useCallback, useRef, useState } from "react";
import type { Route } from "next";
import { useParams, useRouter } from "next/navigation";
import { CATALOG } from "@kaname/errors/catalog";
import { sameOriginPath } from "@/lib/after-login";
import { call, type CallErr } from "@/lib/api/call";
import { setToken } from "@/lib/api/client";
import { refreshSession } from "@/lib/auth/client";
import { InviteConfirm } from "./views";

const SCREEN = "invite-accept";
const AFTER_CONFIRM = "/mfa-setup" as Route;
/** 確認のトークンの形（43 字の英数と - _・K-422） */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;
/** 口が断って、押し直しても通らないときの番号（文を出してボタンを消す） */
const CLOSED_CODES = new Set([
  "E-INV-001",
  "E-INV-002",
  "E-INV-003",
  "E-INV-004",
  "E-INV-006",
  "E-INV-014",
  "E-INV-015",
  "E-AUTH-012",
]);
const WAIT_SEC = 60;

type Raw = Record<string, unknown>;
interface Closed {
  message: string;
  login: boolean;
}

const catalogText = (id: string): string => CATALOG[id as keyof typeof CATALOG]?.message ?? id;
const str = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);
const closedOf = (code: string, message: string | null): Closed => ({
  message: message ?? catalogText(code),
  login: code === "E-INV-015",
});

/** 押し直せる失敗の赤の知らせ：送りすぎは待つ秒数・ほかは調子が悪い（正本 E-PAGE-003） */
function noticeOf(r: CallErr): string {
  if (r.status === 429) return catalogText("E-LIM-005").replace("{秒}", String(r.retryAfterSec ?? WAIT_SEC));
  return catalogText("E-PAGE-003");
}

export function InviteConfirmPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [closed, setClosed] = useState<Closed | null>(() =>
    TOKEN_SHAPE.test(token ?? "") ? null : closedOf("E-INV-001", null),
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false); // 二度押しで口を 2 回呼ばない

  const onConfirm = useCallback(async () => {
    if (sending.current || !TOKEN_SHAPE.test(token ?? "")) return;
    sending.current = true;
    setBusy(true);
    setNotice(null);
    let leave = false;
    try {
      const r = await call("confirmInvitationJoin", { body: { token }, keepOn401: true, screenId: SCREEN });
      if (r.ok) {
        const data = (r.data ?? {}) as Raw;
        const session = str(data["token"]);
        if (session) {
          setToken(session); // 確認したアカウントの印に替える
          refreshSession();
        }
        router.push(session ? sameOriginPath(str(data["next"]), AFTER_CONFIRM) : ("/login" as Route));
        leave = true;
      } else if (CLOSED_CODES.has(r.code)) {
        setClosed(closedOf(r.code, r.message));
      } else {
        setNotice(noticeOf(r));
      }
    } catch {
      setNotice(catalogText("E-PAGE-003")); // 網が切れた（押し直せる）
    } finally {
      if (!leave) {
        sending.current = false;
        setBusy(false);
      }
    }
  }, [token, router]);

  if (closed) return <InviteConfirm state="closed" message={closed.message} login={closed.login} />;
  return <InviteConfirm state="ready" notice={notice} busy={busy} onConfirm={() => void onConfirm()} />;
}

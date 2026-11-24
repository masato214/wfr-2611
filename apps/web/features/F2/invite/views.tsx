"use client";
// 招待を受けて参加する画面の見た目（段 3・K-55 の葉・枝 c/段3）。部品先行のモックと本番が同じこの部品を使う。動き（口を呼ぶ・押した後）は持たない。
//   キャンバス AuthInvite（04_design/canvas_gen/auth.py）：頭文字の印・「〈ワークスペース〉に招待されています」・招いた人とグループと役割・ひとこと・
//   メール（読むだけ）・名前。入り方は登録と同じ（名前とパスワード → 入った直後に「付けるまで進めない」・代表の答え answer=becc3d3aa526 ①）。
//   参加した後に見える物の一覧の区画は出さない（answer=7fe1f09fdab4 ⑥）。キャンバスに無い状態（ログイン中・別のメール・もう入っている・期限切れ など）は同じ部品で足した
//   招待のリンク（宛てのメールが空・K-421）で新しく入る人は、確認のメールを押すまで参加が決まらない（D-148.51・K-422）：書けるメールの欄・
//   「確認のメールを送りました」（sent）・確認の画面 InviteConfirm（/invite/confirm/:token）を同じ部品で足した（K-423・正の絵は /dev/mock/f2）。
//   宛てのメールが在る招待の見た目は変えない
import Link from "next/link";
import type { Route } from "next";
import type { FormEvent, ReactNode } from "react";
import { Button, PasswordField, TextField } from "@/components/k";
import { NoteBox, ResultBox } from "@/components/k/auth-parts";
import { AuthFrame, DEFAULT_TERMS_LINKS, type TermsLinks } from "../../F1/sign-up/frame";
import "../../F1/login/login.css";
import "../../F1/login/views.css";

/** 画面の状態（07_functional/段3-F2/機能分解.md の 2 章） */
export type InviteState =
  | "new"
  | "sent"
  | "account"
  | "signed"
  | "other"
  | "member"
  | "expired"
  | "resent"
  | "resent-already"
  | "revoked"
  | "used"
  | "notfound"
  | "wait"
  | "down";

/** ワークスペースでの役割（tenant_memberships.role・D-128.46） */
export type InviteRole = "admin" | "manager" | "member" | "viewer" | "requester";
export const ROLE_LABEL: Record<InviteRole, string> = {
  admin: "管理者",
  manager: "マネージャー",
  member: "メンバー",
  viewer: "閲覧のみ",
  requester: "依頼する側",
};

/** 赤の知らせの文（K-335）。口が失敗しても画面は移らず、押し直せる */
export const INVITE_NOTICE = {
  /** 参加の口・送り直しの口が答えない（503 など） */
  down: "いま Kaname の調子が悪くなっています。少し待ってから、もう一度押してください",
  /** 送り直しの口の答えが failed（メールが送れなかった） */
  resendFailed: "送れませんでした。もう一度押してください",
  /** リンクの招待の参加の口の答えが failed（確認のメールが送れなかった・K-422・K-423） */
  confirmFailed: "確認のメールを送れませんでした。もう一度押してください",
} as const;

/** 下見の答え（getInvitation）を画面の言葉にした物 */
export interface InvitePreview {
  workspaceName: string;
  /** 招いた人の名前。行が残っていない招待（下見の答えが null）は null：名前の所を「招待した人」と読ませ、頭の行からは外す */
  inviterName: string | null;
  /** グループ（層）の名前。決めていない招待は空 */
  groupName: string | null;
  role: InviteRole;
  /** 招いた人のひとこと。無ければ行を出さない */
  message: string | null;
  email: string;
  /** 期限の日（例「11/25」） */
  expiresOn: string;
  /** ログイン中のアカウントのメール（別のメール宛てのとき出す） */
  signedInEmail?: string | null;
}

export interface InviteJoin {
  name: string;
  password: string;
  /** 招待のリンク（宛てのメールが空）で新しく入るときだけ。欄が空なら入れない（K-422 が 409 E-INV-016 で返す） */
  email?: string;
}

export interface InviteAcceptProps {
  state: InviteState;
  preview?: InvitePreview;
  /** 入力の誤り（口の 422 の文・E-VAL-*） */
  errors?: { name?: string; password?: string; email?: string };
  /** 確認のメールを送りました（sent）の伏せたメール（例「ki****@engine-base.example」・K-422 の答え） */
  sentEmail?: string;
  /** 赤の知らせ（押した口が失敗した・K-335）。新しく作って参加・期限切れ・ログイン中の 2 つ（今のアカウントで参加・別のメール宛て）の、押したボタンの上に出す。押し直せる */
  notice?: string | null;
  /** 送りすぎのあと何秒（429） */
  waitSec?: number;
  busy?: boolean;
  links?: TermsLinks;
  /** 新しく作って参加（名前とパスワード）・今のアカウントで参加（引数なし） */
  onJoin?: (v?: InviteJoin) => void;
  onResend?: () => void;
  /** ログアウトして開き直す（別のメール宛て） */
  onSignOut?: () => void;
  /** ログインして戻る先（/login?next=/invite/<token>） */
  loginHref?: string;
  /** もう入っているワークスペースを開く先 */
  openHref?: string;
}

/** 招いた人の呼び方（名前があれば「〈名前〉 さん」・無ければ「招待した人」） */
const inviterOf = (p: InvitePreview): string => (p.inviterName ? `${p.inviterName} さん` : "招待した人");

const initialOf = (s: string): string => [...s.replace(/^(株式会社|有限会社|合同会社)\s*/, "").trim()][0] ?? "?";

/** 頭：頭文字の印・「〈ワークスペース〉に招待されています」・招いた人とグループと役割・ひとこと */
function InviteHead({ p, title }: { p: InvitePreview; title?: string }) {
  const group = p.groupName ? `${p.groupName}の ` : "";
  return (
    <>
      <div className="k-login-center">
        <span className="k-auth-mark" aria-hidden="true">
          {initialOf(p.workspaceName)}
        </span>
      </div>
      <h1>{title ?? `${p.workspaceName} に招待されています`}</h1>
      <p className="k-auth-lead" data-kind="sub">
        {p.inviterName ? `${p.inviterName} さんから ・ ` : ""}
        {group}
        {ROLE_LABEL[p.role]} として
      </p>
      {p.message ? (
        <NoteBox>
          <span data-part="invite-message">「{p.message}」</span>
        </NoteBox>
      ) : null}
    </>
  );
}

function Foot({ p, loginHref }: { p?: InvitePreview; loginHref?: string }) {
  return (
    <p className="k-auth-alt" data-part="invite-foot">
      {loginHref ? (
        <>
          もう Kaname のアカウントがある方は <Link href={loginHref as Route}>ログインして入る</Link>
          <br />
        </>
      ) : null}
      {p ? (
        <span className="k-login-muted">招待は {p.expiresOn} まで ・ 心当たりがなければ、このページを閉じる</span>
      ) : null}
    </p>
  );
}

function Dead({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return (
    <AuthFrame foot="status">
      <div className="k-auth-form" data-auth="invite" data-state="dead">
        <h1>{title}</h1>
        <ResultBox tone="bad">{body}</ResultBox>
        {children}
      </div>
    </AuthFrame>
  );
}

/** 招待を受けて参加する（/invite/:token） */
export function InviteAccept(p: InviteAcceptProps) {
  const links = p.links ?? DEFAULT_TERMS_LINKS;
  const pv = p.preview;
  if (p.state === "notfound")
    return (
      <Dead
        title="この招待は見つかりません"
        body="リンクが正しくないか、古い招待です。招待した人に、もう一度招待してもらってください"
      />
    );
  if (p.state === "down")
    return (
      <Dead
        title="いま Kaname の調子が悪くなっています"
        body="あなたの問題ではありません。しばらくしてから、このページをもう一度開いてください"
      />
    );
  if (p.state === "wait")
    return (
      <Dead
        title="少し待ってください"
        body={`短い間に何度も開いたので、いったん止めています。${p.waitSec ?? 60} 秒たってから、もう一度開いてください`}
      />
    );
  if (!pv) return null;
  if (p.state === "revoked")
    return (
      <Dead
        title="この招待は取り消されています"
        body="招待した人が取り消しました。招待した人に、もう一度招待してもらってください"
      >
        <NoteBox>
          {pv.workspaceName} ・ {inviterOf(pv)}からの招待
        </NoteBox>
      </Dead>
    );
  if (p.state === "used")
    return (
      <Dead title="この招待はもう使われています" body="参加した人は、ログインして入ってください">
        <Link href="/login" className="k-btn" data-variant="primary" data-size="lg">
          ログインする
        </Link>
      </Dead>
    );
  if (p.state === "expired" || p.state === "resent" || p.state === "resent-already")
    return (
      <AuthFrame foot="status">
        <div className="k-auth-form" data-auth="invite" data-state={p.state}>
          <h1>この招待は期限が過ぎました</h1>
          <p className="k-auth-lead k-login-left" data-kind="body">
            招待は 7 日の間使えます。{pv.workspaceName} の {inviterOf(pv)}に、送り直しを頼めます
          </p>
          {p.state === "resent" ? (
            <ResultBox tone="ok">
              {inviterOf(pv)}に、送り直しを頼みました。新しい招待のメールが届いたら、そのリンクから入ってください
            </ResultBox>
          ) : null}
          {p.state === "resent-already" ? (
            <ResultBox tone="ok">今日はもう頼んであります。新しい招待のメールを待ってください</ResultBox>
          ) : null}
          {p.state === "expired" && p.notice ? <ResultBox tone="bad">{p.notice}</ResultBox> : null}
          <Button
            size="lg"
            variant={p.state === "expired" ? "primary" : "outlined"}
            disabled={p.state !== "expired"}
            loading={p.busy}
            onClick={p.onResend}
          >
            送り直しを頼む
          </Button>
        </div>
      </AuthFrame>
    );
  if (p.state === "other")
    return (
      <AuthFrame foot="status">
        <div className="k-auth-form" data-auth="invite" data-state="other">
          <InviteHead p={pv} />
          <ResultBox tone="bad">
            この招待は {pv.email} 宛てです。いまは {pv.signedInEmail} でログインしています。{pv.email}{" "}
            のアカウントで入ってください
          </ResultBox>
          {p.notice ? <ResultBox tone="bad">{p.notice}</ResultBox> : null}
          <Button size="lg" loading={p.busy} onClick={p.onSignOut}>
            ログアウトして開き直す
          </Button>
        </div>
      </AuthFrame>
    );
  if (p.state === "member")
    return (
      <AuthFrame foot="status">
        <div className="k-auth-form" data-auth="invite" data-state="member">
          <InviteHead p={pv} title={`${pv.workspaceName} にはもう入っています`} />
          <Link href={(p.openHref ?? "/") as Route} className="k-btn" data-variant="primary" data-size="lg">
            {pv.workspaceName} を開く
          </Link>
        </div>
      </AuthFrame>
    );
  if (p.state === "signed")
    return (
      <AuthFrame links={links}>
        <div className="k-auth-form" data-auth="invite" data-state="signed">
          <InviteHead p={pv} />
          <TextField size="lg" label="メール" name="email" value={pv.email || (pv.signedInEmail ?? "")} readOnly />
          {p.notice ? <ResultBox tone="bad">{p.notice}</ResultBox> : null}
          <Button size="lg" loading={p.busy} onClick={() => p.onJoin?.()}>
            今のアカウントで参加する
          </Button>
          <p className="k-auth-note">
            参加すると {pv.workspaceName} に切り替わります。前のワークスペースへは左上から戻れます
          </p>
        </div>
        <Foot p={pv} />
      </AuthFrame>
    );
  if (p.state === "account")
    return (
      <AuthFrame links={links}>
        <div className="k-auth-form" data-auth="invite" data-state="account">
          <InviteHead p={pv} />
          <NoteBox>{pv.email} には、もう Kaname のアカウントがあります。ログインしてから参加してください</NoteBox>
          <Link href={(p.loginHref ?? "/login") as Route} className="k-btn" data-variant="primary" data-size="lg">
            ログインして参加する
          </Link>
        </div>
        <Foot p={pv} />
      </AuthFrame>
    );
  if (p.state === "sent")
    return (
      <AuthFrame links={links}>
        <div className="k-auth-form" data-auth="invite" data-state="sent">
          <InviteHead p={pv} />
          <NoteBox>
            {`確認のメールを送りました。メールのリンクを押すと参加が決まります（${p.sentEmail ?? ""}・24 時間で切れます）`}
          </NoteBox>
        </div>
        <Foot p={pv} />
      </AuthFrame>
    );
  // new：新しく作って参加（名前とパスワード → 入った直後に「付けるまで進めない」）。宛てのメールが空（招待のリンク）ならメールも書く
  const link = pv.email === "";
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = link ? String(f.get("email") ?? "").trim() : "";
    p.onJoin?.({
      name: String(f.get("name") ?? ""),
      password: String(f.get("password") ?? ""),
      ...(email ? { email } : {}),
    });
  };
  return (
    <AuthFrame links={links}>
      <form className="k-auth-form" data-auth="invite" data-state="new" noValidate onSubmit={submit}>
        <InviteHead p={pv} />
        {link ? (
          <TextField
            size="lg"
            label="メール"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue=""
            hint="このメールでアカウントを作ります"
            error={p.errors?.email}
          />
        ) : (
          <TextField
            size="lg"
            label="メール"
            name="email"
            value={pv.email}
            readOnly
            hint="招待されたアドレス。変えられない"
          />
        )}
        <TextField
          size="lg"
          label="名前"
          name="name"
          autoComplete="name"
          placeholder="例：木村 太郎"
          error={p.errors?.name}
        />
        <PasswordField
          size="lg"
          label="パスワード"
          name="password"
          autoComplete="new-password"
          placeholder="12 文字以上"
          hint="12 文字以上。漏れたことのあるパスワードは使えない。入った後に、パスキーか 2 段階認証を付ける"
          error={p.errors?.password}
        />
        {p.notice ? <ResultBox tone="bad">{p.notice}</ResultBox> : null}
        <Button type="submit" size="lg" loading={p.busy}>
          参加する
        </Button>
      </form>
      <p className="k-auth-note">
        続けると{" "}
        <Link href={links.terms as Route} target="_blank" rel="noopener">
          利用規約
        </Link>{" "}
        と{" "}
        <Link href={links.privacy as Route} target="_blank" rel="noopener">
          プライバシー
        </Link>{" "}
        に同意したことになる
      </p>
      <Foot p={pv} loginHref={p.loginHref ?? "/login"} />
    </AuthFrame>
  );
}

/** 確認のメールのリンクを開いた画面（/invite/confirm/:token・K-423）。開いただけでは口を呼ばず、「参加を決める」で確かめる（K-422）。
 *  ready＝押す前（notice は押した口が答えなかったとき・押し直せる）／closed＝もう使えない（文を出し、ボタンは出さない。login なら「ログインして入る」） */
export interface InviteConfirmProps {
  state: "ready" | "closed";
  /** closed のときの文（正本の E-INV-001・014・015 など） */
  message?: string;
  /** closed のとき「ログインして入る」を出す（E-INV-015：もう使った確認のリンク） */
  login?: boolean;
  notice?: string | null;
  busy?: boolean;
  onConfirm?: () => void;
}

export function InviteConfirm(p: InviteConfirmProps) {
  return (
    <AuthFrame foot="status">
      <div className="k-auth-form" data-auth="invite-confirm" data-state={p.state}>
        <h1>参加を確かめる</h1>
        {p.state === "ready" ? (
          <>
            {p.notice ? <ResultBox tone="bad">{p.notice}</ResultBox> : null}
            <Button size="lg" loading={p.busy} onClick={p.onConfirm}>
              参加を決める
            </Button>
          </>
        ) : (
          <>
            <ResultBox tone="bad">{p.message ?? ""}</ResultBox>
            {p.login ? (
              <Link href="/login" className="k-btn" data-variant="primary" data-size="lg">
                ログインして入る
              </Link>
            ) : null}
          </>
        )}
      </div>
    </AuthFrame>
  );
}

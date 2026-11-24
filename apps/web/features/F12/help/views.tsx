"use client";
// 困ったとき・お知らせ・問い合わせ（段 13・領域 user・下絵）。値を受け取って描くだけ（口は呼ばない・欄は読むだけ・押す関数は props で受けるが下絵では渡さない）。
//   画面：困ったとき・お知らせ（help）／お知らせ 1 件／問い合わせる小窓／問い合わせ 1 件のやり取り。
//   帯・止められた画面・運営が見ている間の帯は status-parts.tsx。キャンバス MeHelp・EdInquiry・MeInquiry を写す。
import type { ReactNode } from "react";
import {
  Badge,
  Button,
  Callout,
  Dialog,
  Empty,
  ErrorState,
  PAGE_ERROR,
  PageBody,
  PageHeader,
  Section,
  Select,
  TextArea,
  TextField,
  TextLink,
  type BadgeTone,
} from "@/components/k";
import "./help.css";
import "../shared/choice.css";

export type NoticeKind = "障害" | "メンテ" | "リリース";
export interface NoticeView {
  id: string;
  kind: NoticeKind;
  title: string;
  /** 一覧に出す 1 行の要約 */
  body: string;
  when: string;
  /** まだ読んでいない（印が付く） */
  unread?: boolean;
  /** 障害の今の様子（原因が分かった など） */
  state?: string;
}
export interface StatusView {
  label: string;
  state: "ふつう" | "遅れている" | "止まっている";
}
export interface InquiryView {
  id: string;
  title: string;
  /** 何について */
  kind: string;
  when: string;
  /** 運営から返事あり */
  replied?: boolean;
  /** 返事を待っている（送ったばかり） */
  waiting?: boolean;
  done?: boolean;
}

const KIND_TONE: Record<NoticeKind, BadgeTone> = { 障害: "danger", メンテ: "warning", リリース: "neutral" };
const STATE_TONE: Record<StatusView["state"], BadgeTone> = {
  ふつう: "success",
  遅れている: "warning",
  止まっている: "danger",
};

/** まだ使えない物（別の段・後のフェーズ）は、押せない形で出す（指を置くと title で読める） */
export function Inert({ children, label = "まだ使えません" }: { children: ReactNode; label?: string }) {
  return (
    <span className="k-uh-inert" aria-disabled="true" tabIndex={-1} title={label}>
      {children}
    </span>
  );
}

function NoticeRow({ n }: { n: NoticeView }) {
  return (
    <li className="k-uh-item" data-unread={n.unread ? "true" : undefined}>
      <Badge tone={KIND_TONE[n.kind]}>{n.kind}</Badge>
      <div className="k-uh-item-main">
        <h3 className="k-uh-item-title">
          {n.unread ? <span className="k-uh-new" role="img" aria-label="まだ読んでいません" /> : null}
          <TextLink href={`/help/notices/${n.id}`}>{n.title}</TextLink>
        </h3>
        <p className="k-uh-item-body">
          {n.state ? <strong>{n.state} ・ </strong> : null}
          {n.body}
        </p>
      </div>
      <span className="k-uh-item-when">{n.when}</span>
    </li>
  );
}

function InquiryRow({ q }: { q: InquiryView }) {
  return (
    <li className="k-uh-item">
      {q.done ? (
        <Badge tone="neutral">済み</Badge>
      ) : q.replied ? (
        <Badge tone="progress">返事あり</Badge>
      ) : (
        <Badge tone="warning">返事を待っている</Badge>
      )}
      <div className="k-uh-item-main">
        <h3 className="k-uh-item-title">
          <TextLink href={`/help/inquiries/${q.id}`}>{q.title}</TextLink>
        </h3>
        <p className="k-uh-item-body">
          {q.kind} ・ {q.when}
          {q.replied && !q.done ? " ・ 運営から返事あり" : ""}
        </p>
      </div>
    </li>
  );
}

export interface HelpHomeProps {
  notices: readonly NoticeView[];
  statuses: readonly StatusView[];
  inquiries: readonly InquiryView[];
  /** 送った直後の知らせ（「運営に届きました」） */
  sent?: string;
  /** 読めなかった */
  failed?: boolean;
  onAsk?: () => void;
  onRetry?: () => void;
}

export function HelpHome({ notices, statuses, inquiries, sent, failed, onAsk, onRetry }: HelpHomeProps) {
  const ask = (
    <Button variant="primary" {...(onAsk ? { onClick: onAsk } : {})}>
      問い合わせる
    </Button>
  );
  if (failed) {
    return (
      <PageBody labelledBy="help-title">
        <PageHeader id="help-title" title="困ったとき・お知らせ" actions={ask} />
        <div className="k-uh-top">
          <ErrorState code={PAGE_ERROR.loadFailed} acts={[onRetry ?? (() => undefined)]} />
        </div>
      </PageBody>
    );
  }
  const none = notices.length === 0 && inquiries.length === 0;
  return (
    <PageBody labelledBy="help-title">
      <PageHeader
        id="help-title"
        title="困ったとき・お知らせ"
        sub="運営からのお知らせと、運営への問い合わせ"
        actions={ask}
      />
      <div className="k-uh-top">
        {sent ? (
          <Callout tone="info" title={sent}>
            返事はここと画面のお知らせに届きます。
          </Callout>
        ) : null}
        {none ? (
          <Empty title="まだお知らせも問い合わせもありません" action={ask}>
            運営からのお知らせが出ると、ここに並びます。分からないことは、いつでも問い合わせてください。
          </Empty>
        ) : null}
        <Section title="お知らせ">
          {notices.length ? (
            <ul className="k-uh-list">
              {notices.map((n) => (
                <NoticeRow key={n.id} n={n} />
              ))}
            </ul>
          ) : (
            <p className="k-uh-lead">お知らせはまだありません。</p>
          )}
        </Section>
        <Section title="いまの稼働状況">
          <ul className="k-uh-status" aria-label="いまの稼働状況">
            {statuses.map((s) => (
              <li key={s.label}>
                <span>{s.label}</span>
                <Badge tone={STATE_TONE[s.state]}>{s.state}</Badge>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="自分の問い合わせ">
          {inquiries.length ? (
            <ul className="k-uh-list">
              {inquiries.map((q) => (
                <InquiryRow key={q.id} q={q} />
              ))}
            </ul>
          ) : (
            <p className="k-uh-lead">問い合わせはまだありません。</p>
          )}
        </Section>
        <aside className="k-uh-tip" aria-label="使い方">
          <b>使い方</b>
          <span>分からないことは、まず高本のAI に聞くと早い。キーボードの操作は「?」で出る</span>
        </aside>
      </div>
    </PageBody>
  );
}

export interface NoticeDetailView extends NoticeView {
  /** メンテの時間・影響 */
  window?: string;
  impact?: string;
  full: string;
}

export function NoticeDetail({ n }: { n: NoticeDetailView }) {
  return (
    <PageBody labelledBy="notice-title">
      <PageHeader
        id="notice-title"
        title={n.title}
        sub={n.when}
        actions={<Badge tone={KIND_TONE[n.kind]}>{n.kind}</Badge>}
      />
      <div className="k-uh-top">
        <dl className="k-uh-notice-meta">
          {n.window ? (
            <div>
              <dt>時間</dt>
              <dd>{n.window}</dd>
            </div>
          ) : null}
          {n.impact ? (
            <div>
              <dt>影響</dt>
              <dd>{n.impact}</dd>
            </div>
          ) : null}
          <div>
            <dt>内容</dt>
            <dd>{n.full}</dd>
          </div>
        </dl>
        <p className="k-uh-read" role="status">
          読みました（一覧の印が消えます）
        </p>
        <div>
          <TextLink href="/help">困ったとき・お知らせへ戻る</TextLink>
        </div>
      </div>
    </PageBody>
  );
}

// ---- 問い合わせる小窓 ----
export interface AskFile {
  name: string;
  size: string;
  /** 大きすぎて断られた */
  tooBig?: boolean;
}
export interface AskDialogProps {
  open?: boolean;
  kind: string;
  title: string;
  body: string;
  files?: readonly AskFile[];
  withScreen?: boolean;
  errors?: { title?: string; body?: string };
}

const KINDS = ["使い方", "うまく動かない", "お金・プラン", "ほか"].map((v) => ({ value: v, label: v }));

export function AskDialog({ open = true, kind, title, body, files = [], withScreen = true, errors }: AskDialogProps) {
  return (
    <Dialog
      open={open}
      title="問い合わせる"
      subtitle="Kaname の運営に届く。返事はここと画面のお知らせに届く"
      actions={
        <>
          <Button variant="outlined">やめる</Button>
          <Button variant="primary">送る</Button>
        </>
      }
    >
      <div className="k-uh-form">
        <Select label="何について" name="kind" options={KINDS} value={kind} />
        <TextField label="題" name="title" required defaultValue={title} readOnly error={errors?.title} />
        <TextArea label="内容" name="body" required rows={4} defaultValue={body} readOnly error={errors?.body} />
        <div className="k-uh-attach">
          <Inert>
            <Button variant="outlined" size="sm" tabIndex={-1} aria-disabled="true">
              ＋ ファイル・画面の写し
            </Button>
          </Inert>
          {files.length ? (
            <ul className="k-uh-list" aria-label="付けたファイル">
              {files.map((f) => (
                <li key={f.name} className="k-uh-file" data-bad={f.tooBig ? "true" : undefined}>
                  <span className="k-uh-file-name">
                    {f.name}（{f.size}）
                  </span>
                  {f.tooBig ? (
                    <span role="alert">大きすぎて付けられません（1 つ 10MB まで・5 つまで）</span>
                  ) : (
                    <Badge tone="success">付いた</Badge>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <label className="k-uh-check">
          <input type="checkbox" checked={withScreen} readOnly aria-describedby="uh-check-note" />
          <span id="uh-check-note">
            <b>いま見ている画面の情報を付ける</b>
            画面の場所・時刻・ブラウザ・PC がつながっているか。チケットの中身や会話は付けない
          </span>
        </label>
        <p className="k-uh-lead">運営は、支援と障害の対応のためにワークスペースの中を見ることがあります（利用規約）</p>
      </div>
    </Dialog>
  );
}

// ---- 問い合わせ 1 件のやり取り ----
export interface MessageView {
  id: string;
  from: "me" | "ops";
  initial: string;
  name: string;
  when: string;
  text: string;
  attach?: string;
}
export interface ThreadProps {
  title: string;
  kind: string;
  sentAt: string;
  messages: readonly MessageView[];
  done?: boolean;
  draft?: string;
}

export function Thread({ title, kind, sentAt, messages, done, draft = "" }: ThreadProps) {
  const head = done ? (
    <Badge tone="neutral">済み</Badge>
  ) : (
    <>
      <Badge tone="progress">返事あり</Badge>
      <Button variant="outlined">解決したので済みにする</Button>
    </>
  );
  return (
    <PageBody labelledBy="thread-title">
      <PageHeader id="thread-title" title={title} sub={`${kind} ・ ${sentAt} に送った`} actions={head} />
      <div className="k-uh-thread-grid">
        <div className="k-uh-top">
          {done ? (
            <Callout tone="info" title="済みにしました">
              あとから書き込むと、もう一度開きます。
            </Callout>
          ) : null}
          <ul className="k-uh-msgs" aria-label="やり取り">
            {messages.map((m) => (
              <li key={m.id} className="k-uh-msg" data-from={m.from}>
                <span className="k-uh-avatar" aria-hidden="true">
                  {m.initial}
                </span>
                <div className="k-uh-msg-box">
                  <div className="k-uh-msg-head">
                    <b>{m.name}</b>
                    <span>{m.when}</span>
                  </div>
                  <p className="k-uh-msg-text">{m.text}</p>
                  {m.attach ? <span className="k-uh-msg-attach">付けた情報：{m.attach}</span> : null}
                </div>
              </li>
            ))}
          </ul>
          <div className="k-uh-compose">
            <TextArea
              label={done ? "もう一度聞く" : "返事を書く"}
              name="reply"
              rows={3}
              defaultValue={draft}
              readOnly
              description="返事は運営の受信箱に届く"
            />
            <div className="k-uh-compose-foot">
              <Inert>
                <Button variant="outlined" size="sm" tabIndex={-1} aria-disabled="true">
                  ＋ ファイル
                </Button>
              </Inert>
              <Button variant="primary">{done ? "もう一度聞く" : "送る"}</Button>
            </div>
          </div>
        </div>
        <aside className="k-uh-top" aria-label="この問い合わせ">
          <div className="k-uh-tip">
            <b>すぐできること</b>
            <TextLink href="/settings/credentials">預けたログイン情報を開く</TextLink>
          </div>
          <div className="k-uh-tip">
            <b>この問い合わせ</b>
            <span>
              運営は支援のためにワークスペースの中を見ることがあります（利用規約）。見たときは、誰が・いつ・なぜ見たかがワークスペースの記録に残ります。社内メモは運営の中だけで、ここには出ません
            </span>
          </div>
        </aside>
      </div>
    </PageBody>
  );
}

export function ThreadNotFound() {
  return (
    <PageBody labelledBy="thread-missing">
      <div className="k-uh-top">
        <ErrorState code={PAGE_ERROR.notFound} acts={["/help"]} heading={1} />
      </div>
    </PageBody>
  );
}

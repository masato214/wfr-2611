"use client";
// 運営の人（段 13・領域 ops・キャンバス OpTeam）と運営のログイン。値を受け取って描くだけ（口は呼ばない）
import { Fingerprint, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { Button, Callout, Confirm, Dialog, PageBody, PageHeader, TextField } from "@/components/k";
import { NoteBox } from "@/components/k/auth-parts";
import "@/features/F1/sign-up/sign-up.css";
import { CapMark, Note, Person } from "./ops-parts";
import { CAP_LABELS, TEAM, type TeamPerson } from "./ops-sample";
import { RespTable, type RespColumn } from "@/features/F12/shared/resp-table";
import "../shared/choice.css";

const noop = () => undefined;

const COLUMNS: RespColumn<TeamPerson>[] = [
  {
    key: "who",
    header: "人",
    cell: (t) => (
      <Person initial={t.initial} sub={`${t.role} ・ パスキー`}>
        {t.name}
      </Person>
    ),
  },
  ...CAP_LABELS.map((label, i) => ({
    key: `cap-${i}`,
    header: label,
    cell: (t: TeamPerson) => <CapMark on={t.caps[i] === true} label={label} />,
  })),
  {
    key: "act",
    header: <span className="sr-only">操作</span>,
    card: "action",
    cell: (t) => (
      <span className="k-op-rowacts">
        <Button size="sm" variant="outlined" aria-label={`${t.name} さんのできることを変える`}>
          変える
        </Button>
        <Button size="sm" variant="outlined" aria-label={`${t.name} さんを外す`}>
          外す
        </Button>
      </span>
    ),
  },
];

/** 運営の人の一覧（できることの印・パスキー） */
export function TeamPage({ onAdd }: { onAdd?: () => void }) {
  return (
    <PageBody labelledBy="op-team-title">
      <PageHeader
        id="op-team-title"
        title="運営の人"
        sub="運営の場所に入れる人と、できること"
        actions={
          <Button icon={<Plus size={14} />} onClick={onAdd}>
            運営の人を足す
          </Button>
        }
      />
      <div className="k-op-body">
        <RespTable
          stack="wide"
          caption="運営の人とできること"
          columns={COLUMNS}
          rows={[...TEAM]}
          rowKey={(t) => t.name}
        />
        <Note>
          運営の人はパスキーでしか入れない。値段は案を作る人と決める人を分ける（自分の案は自分で決められない。「値段を決める」ができる人が
          1
          人しかいない間だけ、本人確認を取り直して自分で決められる）。「中を見る」「止める」「入金を記録」「値段を決める」の前には本人確認を取り直す。
          運営の人の操作はすべて、その相手のワークスペースの「記録」に残る
        </Note>
      </div>
    </PageBody>
  );
}

function CheckChoice({ label, checked, disabled }: { label: string; checked: boolean; disabled?: boolean }) {
  return (
    <label className="k-op-choice" data-disabled={disabled || undefined}>
      <input type="checkbox" name="caps" value={label} defaultChecked={checked} disabled={disabled} />
      <span className="k-op-choice-text">
        <b>{label}</b>
      </span>
    </label>
  );
}

function CapChoices({ caps, disabled }: { caps: readonly boolean[]; disabled?: boolean }) {
  return (
    <fieldset className="k-op-fieldset">
      <legend>できること</legend>
      <div className="k-op-checks">
        {CAP_LABELS.map((l, i) => (
          <CheckChoice key={l} label={l} checked={caps[i] === true} {...(disabled ? { disabled } : {})} />
        ))}
      </div>
    </fieldset>
  );
}

/** 運営の人を足す小窓：メール・できること 9 つ・パスキーの登録の案内 */
export function TeamAddDialog({ onClose = noop }: { onClose?: () => void }) {
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      size="connect"
      title="運営の人を足す"
      actions={
        <>
          <Button variant="outlined" onClick={onClose}>
            やめる
          </Button>
          <Button>招待を送る</Button>
        </>
      }
    >
      <div className="k-op-form">
        <TextField label="メールアドレス" name="mail" type="email" placeholder="例：suzuki@kaname.example" />
        <CapChoices caps={[true, false, false, false, false, false, false, false, false]} />
        <Callout tone="info" title="パスキーの登録">
          招待のメールのリンクから、本人がパスキーを登録します。登録するまでは運営の場所に入れません。足したことは記録に残ります
        </Callout>
      </div>
    </Dialog>
  );
}

/** できることを変える小窓：自分のは変えられない・最後の 1 人は外せない（高本さんが自分を開いた形） */
export function TeamEditDialog({ onClose = noop }: { onClose?: () => void }) {
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      size="connect"
      title="できることを変える"
      target="高本 聖斗 ・ 運営の管理者"
      actions={
        <>
          <Button variant="outlined" onClick={onClose}>
            やめる
          </Button>
          <Button aria-disabled="true" disabled title="自分のできることは変えられません">
            変える
          </Button>
        </>
      }
    >
      <div className="k-op-form">
        <CapChoices caps={TEAM[0]?.caps ?? []} disabled />
        <Callout tone="warn" title="この人のできることは変えられません">
          自分のできることは自分では変えられません。また「運営の人」ができるのは高本さん 1 人だけなので、最後の 1
          人として外すこともできません。 別の運営の人に「運営の人」を渡してから、その人に変えてもらってください
        </Callout>
      </div>
    </Dialog>
  );
}

/** 外す確かめ */
export function TeamRemoveConfirm({
  onClose = noop,
  onConfirm = noop,
}: {
  onClose?: () => void;
  onConfirm?: () => void;
}) {
  return (
    <Confirm
      open
      onOpenChange={(o) => !o && onClose()}
      onConfirm={onConfirm}
      confirmLabel="外す"
      title="佐野 美穂 さんを運営の人から外す"
      caution={["外すとすぐ、運営の場所に入れなくなります", "登録していたパスキーも使えなくなります"]}
      description="これまでの操作の記録は残ります。もう一度入れるには、運営の人を足し直します。外したことは記録に残ります"
    />
  );
}

/** 運営のログイン（パスキーで入る・パスキーしか使えない）。運営の外枠は出さない */
export function OpsLogin({ failed = false }: { failed?: boolean }): ReactNode {
  return (
    <div className="k-root k-auth">
      <div className="k-auth-logo">
        <span className="k-auth-mark" aria-hidden="true">
          K
        </span>
        <b>Kaname</b>
        <span className="k-op-tag">運営</span>
      </div>
      <main className="k-auth-card" data-part="auth-box">
        <h1>運営のログイン</h1>
        <NoteBox>
          顧客の方は、こちらではなく Kaname のログインから入ってください。運営の場所は運営の人だけが入れます
        </NoteBox>
        <Button size="lg" icon={<Fingerprint size={18} />}>
          パスキーで入る
        </Button>
        <p className="k-auth-note">
          指・顔・PC のロックで入ります。運営の場所は、パスキーしか使えません（メールとパスワードでは入れません）
        </p>
        {failed ? (
          <p role="alert" className="k-op-alert">
            パスキーで入れませんでした。もう一度試してください。入れないときは運営の管理者に、パスキーの登録し直しを頼んでください
          </p>
        ) : null}
      </main>
      <nav className="k-auth-foot" aria-label="Kaname について">
        <a href="/login">顧客のログインへ</a>
      </nav>
    </div>
  );
}

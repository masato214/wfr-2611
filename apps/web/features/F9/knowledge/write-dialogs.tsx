"use client";
// K-683 書いている画面の小窓と帯（値と関数を受けるだけ・口は呼ばない）。
//   DiscardDialog …… 直した公開済みのページを「やめる」：書いた内容を捨てますか
//   DiscardPageDialog …… まだ書き終えていないページを「やめる」：ページごと消えます
//   LoginLostBand …… 書き終えるが 401：入り直しへ勝手に移さず知らせる（書いた字は残す）
import { Band, Button, Dialog, NoticeBox, errorText } from "@/components/k";

export interface DiscardDialogProps {
  open: boolean;
  busy: boolean;
  /** 捨てる口が失敗したときの正本の ID（小窓の中の赤い箱） */
  errorCode: string | null;
  onKeep: () => void;
  onDiscard: () => void;
}

function ErrorBox({ code }: { code: string | null }) {
  if (!code) return null;
  return <NoticeBox>{errorText(code).entry.message}</NoticeBox>;
}

function ConfirmDiscard({
  title,
  body,
  confirmLabel,
  open,
  busy,
  errorCode,
  onKeep,
  onDiscard,
}: DiscardDialogProps & { title: string; body: string; confirmLabel: string }) {
  return (
    <Dialog
      title={title}
      size="confirm"
      open={open}
      onOpenChange={(o) => {
        if (!o && !busy) onKeep();
      }}
      actions={
        <>
          <Button variant="outlined" disabled={busy} onClick={onKeep}>
            書き続ける
          </Button>
          <Button variant="danger" loading={busy} onClick={onDiscard}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="k-dialog-desc">{body}</p>
      <ErrorBox code={errorCode} />
    </Dialog>
  );
}

export function DiscardDialog(props: DiscardDialogProps) {
  return (
    <ConfirmDiscard
      {...props}
      title="書いた内容を捨てますか"
      body="やめると、いま書いている内容は消えます。"
      confirmLabel="捨てる"
    />
  );
}

export function DiscardPageDialog(props: DiscardDialogProps) {
  return (
    <ConfirmDiscard
      {...props}
      title="このページを消しますか"
      body="まだ書き終えていないページは、やめるとページごと消えます。"
      confirmLabel="消す"
    />
  );
}

export function LoginLostBand({ next }: { next: string }) {
  return (
    <Band
      tone="danger"
      role="alert"
      title="ログインが切れました"
      sub="入り直すと、いま書いている内容は消えます。必要なら、先に別の場所へ写してください。"
      acts={
        <Button
          variant="outlined"
          size="sm"
          onClick={() => window.location.assign(`/login?next=${encodeURIComponent(next)}`)}
        >
          ログインし直す
        </Button>
      }
    />
  );
}

"use client";
// 子チケット・つながりの見た目（段 5・K-452・キャンバス TdLink。枝 c/段5 の下絵・部品先行）。口とはまだつながず、値と押したときの関数を props で受けて描くだけ。
//   代表に聞くことのおすすめ：つながりは「関連」「派生元」の 2 つだけ（絵の提案文「これが終わったら始める」は使わない）。
//   子チケットは「子チケットを作る」から（親の担当・期限を写せる）。つながりは今あるチケットを探して足す／外す（チケットは消えない）。
import type { ChangeEvent, ReactNode } from "react";
import { Badge, Button, Confirm, Dialog, Tabs, TextField, type BadgeTone } from "@/components/k";
import "./links.css";

const noop = (): void => undefined;

export type StageTone = "neutral" | "progress" | "success";

export interface TicketRef {
  /** 「EG-097」など */
  number: string;
  /** 見えない相手のときは使わない（空でよい） */
  title: string;
  /** 段の名前（「完了」「作業中」）。見えない相手のときは使わない */
  stage: string;
  stageTone: StageTone;
  /** 押すとその詳細へ行く先（在れば番号をリンクにする。見えない相手には付けない） */
  href?: string;
  /** false＝見えない相手（番号と「見えないチケット」だけを出し、題名と段の札は出さない・番号はリンクにしない） */
  visible?: false;
}
/** つながりの種類：derived＝自分から見て「派生元」（自分はそこから生まれた）／source＝「派生先」（相手が自分から生まれた）／related＝「関連」 */
export type LinkKind = "derived" | "source" | "related";
export interface LinkRow extends TicketRef {
  id: string;
  kind: LinkKind;
  /** 外せる（口の答えの can_remove）。false なら「外す」を出さない。無ければ外せる */
  canRemove?: boolean;
}
/** 小窓で足せる種類（派生先は相手の側から足すので、ここには出ない） */
export type AddLinkKind = "related" | "derived";

export const LINK_KIND_LABEL: Record<LinkKind, string> = {
  derived: "派生元",
  source: "派生先",
  related: "関連",
};
const LINK_KIND_HELP: Record<AddLinkKind, string> = {
  related: "つながりがあるだけ。順番は決めない",
  derived: "このチケットは、選んだチケットから生まれた",
};
/** 見えない相手の字 */
export const HIDDEN_TICKET = "見えないチケット";

const TONE: Record<StageTone, BadgeTone> = { neutral: "neutral", progress: "progress", success: "success" };

function StageBadge({ t }: { t: TicketRef }) {
  return <Badge tone={TONE[t.stageTone]}>{t.stage}</Badge>;
}

/** 番号。href が在れば押すとその詳細へ（見えない相手はリンクにしない） */
function TicketNo({ t }: { t: TicketRef }) {
  if (t.href && t.visible !== false) {
    return (
      <a className="k-f4-links-no k-f4-links-link" href={t.href}>
        {t.number}
      </a>
    );
  }
  return <span className="k-f4-links-no">{t.number}</span>;
}

/** 行の中身（番号・題名・段の札。見えない相手は番号と「見えないチケット」だけ） */
function RefBody({ t }: { t: TicketRef }) {
  if (t.visible === false) {
    return (
      <>
        <TicketNo t={t} />
        <span className="k-f4-links-title k-f4-links-hidden">{HIDDEN_TICKET}</span>
      </>
    );
  }
  return (
    <>
      <TicketNo t={t} />
      <span className="k-f4-links-title">{t.title}</span>
      <StageBadge t={t} />
    </>
  );
}

export interface LinksSectionProps {
  /** 子チケット */
  childTickets: readonly TicketRef[];
  links: readonly LinkRow[];
  /** 閉じた形（詳細を開いたときは件数だけ出し、「開く」を押したときに読む）。見出しの行だけを出す */
  collapsed?: boolean;
  /** 閉じた形の件数（まだ読んでいないので、口の件数を渡す） */
  counts?: { children: number; links: number };
  onOpen?: (() => void) | undefined;
  /** 子もつながりの代わりに出す物（読めない赤い箱と「もう一度読む」など）。あれば足すボタンも出さない */
  notice?: ReactNode;
  onAddChild?: (() => void) | undefined;
  onAddLink?: (() => void) | undefined;
  onUnlink?: ((id: string) => void) | undefined;
}

const KIND_ORDER: readonly LinkKind[] = ["derived", "source", "related"];

/** 詳細の「子チケット・つながり」のカード（外側のクラスは詳細のカードのまま） */
export function LinksSection({
  childTickets,
  links,
  notice,
  collapsed = false,
  counts,
  onOpen,
  onAddChild,
  onAddLink,
  onUnlink,
}: LinksSectionProps) {
  if (collapsed) {
    return (
      <section className="k-detail-links" aria-label="子チケット・つながり">
        <div className="k-detail-links-head">
          <h2>子チケット・つながり</h2>
          <span className="k-f4-links-count">{`子 ${counts?.children ?? childTickets.length} ・ つながり ${counts?.links ?? links.length}`}</span>
          <Button variant="outlined" size="sm" aria-expanded={false} onClick={onOpen}>
            開く
          </Button>
        </div>
      </section>
    );
  }
  return (
    <section className="k-detail-links" aria-label="子チケット・つながり">
      <div className="k-detail-links-head">
        <h2>子チケット・つながり</h2>
        {notice ? null : (
          <>
            <Button variant="outlined" size="sm" onClick={onAddChild}>
              子を足す
            </Button>
            <Button variant="outlined" size="sm" onClick={onAddLink}>
              つながりを足す
            </Button>
          </>
        )}
      </div>
      {notice ? (
        <div className="k-f4-links-body">{notice}</div>
      ) : (
        <div className="k-f4-links-body">
          <div className="k-f4-links-group">
            <h3>{`子チケット ${childTickets.length}`}</h3>
            {childTickets.length === 0 ? (
              <p className="k-f4-links-empty">子チケットはまだありません。「子を足す」から作れます。</p>
            ) : (
              <ul className="k-f4-links-list">
                {childTickets.map((c) => (
                  <li key={c.number} className="k-f4-links-row">
                    <RefBody t={c} />
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="k-f4-links-group">
            <h3>{`つながり ${links.length}`}</h3>
            {links.length === 0 ? (
              <p className="k-f4-links-empty">つながりはまだありません。「つながりを足す」から足せます。</p>
            ) : (
              <ul className="k-f4-links-list">
                {KIND_ORDER.flatMap((k) =>
                  links
                    .filter((l) => l.kind === k)
                    .map((l) => (
                      <li key={l.id} className="k-f4-links-row">
                        <Badge tone="neutral">{LINK_KIND_LABEL[l.kind]}</Badge>
                        <RefBody t={l} />
                        {l.canRemove === false ? null : (
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`${l.number} とのつながりを外す`}
                            onClick={() => onUnlink?.(l.id)}
                          >
                            外す
                          </Button>
                        )}
                      </li>
                    )),
                )}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export interface LinkCandidate extends TicketRef {
  /** グループの名前（「営業」） */
  group: string;
  /** もうつながっている（選べない） */
  linked?: boolean;
}

export interface LinkAddDialogProps {
  open: boolean;
  /** いま開いているチケット */
  ticket: { number: string; title: string };
  kind: AddLinkKind;
  query: string;
  candidates: readonly LinkCandidate[];
  /** 選んだ候補の番号 */
  selected: string | null;
  busy?: boolean;
  /** 小窓の上の赤い箱（口の断り・「もう一度読む」など） */
  notice?: ReactNode;
  /** 候補を読めなかった理由（探す欄・候補の下の赤い字。「候補を読み込めませんでした」など） */
  candidateError?: string;
  onKind?: (kind: AddLinkKind) => void;
  onQuery?: (query: string) => void;
  onSelect?: (number: string) => void;
  onSubmit?: () => void;
  onCancel?: () => void;
  /** 「子チケットを作る」（作る面を、親を決めて開く） */
  onCreateChild?: () => void;
}

function Candidates({ p }: { p: LinkAddDialogProps }) {
  if (p.candidateError) {
    return (
      <p className="k-err" role="alert">
        {p.candidateError}
      </p>
    );
  }
  if (p.candidates.length === 0) {
    return (
      <p className="k-f4-links-none" role="status">
        合うチケットがありません。番号か題名の一部で探してください。
      </p>
    );
  }
  return (
    <ul className="k-f4-links-cands" aria-label="候補">
      {p.candidates.map((c) => (
        <li key={c.number}>
          <button
            type="button"
            className="k-f4-links-cand"
            aria-pressed={p.selected === c.number}
            {...(c.linked ? { "aria-disabled": true, tabIndex: -1 } : { onClick: () => p.onSelect?.(c.number) })}
          >
            <span className="k-f4-links-no">{c.number}</span>
            <span className="k-f4-links-title">{c.title}</span>
            <span className="k-f4-links-no">{c.group}</span>
            <StageBadge t={c} />
            {c.linked ? <span className="k-f4-links-no">もうつながっている</span> : null}
          </button>
        </li>
      ))}
    </ul>
  );
}

function LinkPanel({ p }: { p: LinkAddDialogProps }) {
  return (
    <div className="k-dialog-stack">
      <fieldset className="k-dialog-group">
        <legend>つながりの種類</legend>
        <div className="k-f4-links-types">
          {(["related", "derived"] as const).map((k) => (
            <label key={k} className="k-dialog-check">
              <input type="radio" name="link-kind" checked={p.kind === k} onChange={() => p.onKind?.(k)} />
              <span>
                {LINK_KIND_LABEL[k]}
                <small>{LINK_KIND_HELP[k]}</small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <TextField
        label="チケットを探す"
        name="link-query"
        placeholder="番号か題名で探す"
        value={p.query}
        {...(p.onQuery
          ? { onChange: (e: ChangeEvent<HTMLInputElement>) => p.onQuery?.(e.target.value) }
          : { readOnly: true })}
      />
      <Candidates p={p} />
    </div>
  );
}

function ChildPanel({ onCreateChild }: { onCreateChild?: (() => void) | undefined }) {
  return (
    <div className="k-dialog-stack">
      <p className="k-f4-links-note">
        子チケットは、親の担当・期限を写して作れます。作る面が、このチケットを親にして開きます。
      </p>
      <Button variant="outlined" onClick={onCreateChild}>
        子チケットを作る
      </Button>
    </div>
  );
}

/** つながりを足す小窓（今あるチケットとつなぐ／子チケットを作る） */
export function LinkAddDialog(p: LinkAddDialogProps) {
  return (
    <Dialog
      title="つながりを足す"
      open={p.open}
      onOpenChange={(o) => {
        if (!o) p.onCancel?.();
      }}
      target={`${p.ticket.number} ${p.ticket.title}`}
      actions={
        <>
          <Button variant="outlined" disabled={p.busy} onClick={p.onCancel}>
            やめる
          </Button>
          <Button loading={p.busy} disabled={p.selected === null} onClick={p.onSubmit}>
            つなぐ
          </Button>
        </>
      }
    >
      {p.notice ? <div className="k-f4-links-dialog-notice">{p.notice}</div> : null}
      <div className="k-f4-links-tabs">
        <Tabs
          label="つなぎ方"
          items={[
            { value: "link", label: "今あるチケットとつなぐ", panel: <LinkPanel p={p} /> },
            { value: "child", label: "子チケットを作る", panel: <ChildPanel onCreateChild={p.onCreateChild} /> },
          ]}
        />
      </div>
    </Dialog>
  );
}

/** つながりを外す確かめ（チケットは消えない） */
export function UnlinkConfirm({
  open,
  link,
  notice,
  busy = false,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  link: Pick<LinkRow, "kind" | "number" | "title" | "visible">;
  /** 確かめの中の赤い箱（口の断りなど） */
  notice?: ReactNode;
  busy?: boolean;
  onOpenChange?: (open: boolean) => void;
  onConfirm?: () => void;
}) {
  return (
    <Confirm
      title="つながりを外しますか"
      description={`${link.number} ${link.visible === false ? HIDDEN_TICKET : link.title} との「${LINK_KIND_LABEL[link.kind]}」のつながりを外します。どちらのチケットも消えません。`}
      confirmLabel="外す"
      open={open}
      busy={busy}
      onOpenChange={onOpenChange ?? noop}
      onConfirm={onConfirm ?? noop}
    >
      {notice}
    </Confirm>
  );
}

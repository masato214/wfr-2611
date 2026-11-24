"use client";
// ワークスペースの一覧（段 13・領域 ops・キャンバス OpList）。値を受け取って描くだけ（口は呼ばない）。押す関数は props で受けるが下絵では渡さない
import type { KeyboardEvent } from "react";
import { Band, Button, Dialog, Empty, PageBody, PageHeader, Select, TextField } from "@/components/k";
import { Chip, Note, Stat, StatGrid, StatusBadge } from "./ops-parts";
import { PWNED_ROWS, WS_ROWS, type PwnedRow, type WsRow } from "./ops-sample";
import { RespTable, type RespColumn } from "@/features/F12/shared/resp-table";

const PLAN_CHIPS = [
  ["無料", 21],
  ["チーム", 19],
  ["ビジネス", 8],
] as const;

function billTone(b: string) {
  if (b === "払われた") return "success" as const;
  if (b === "—") return "neutral" as const;
  return "danger" as const;
}

const MOCK_HREF = "/dev/mock/f12-ops/op-ws";

const columnsOf = (href: (r: WsRow) => string): RespColumn<WsRow>[] => [
  {
    key: "name",
    header: "ワークスペース",
    cell: (r) => (
      <span className="k-op-name">
        <a className="k-link" href={href(r)}>
          {r.name}
        </a>
        <span>{r.admin}</span>
      </span>
    ),
  },
  { key: "plan", header: "プラン", cell: (r) => r.plan },
  { key: "people", header: "人数", num: true, cell: (r) => r.people },
  { key: "pc", header: "PC がつながる人", num: true, cell: (r) => r.pc },
  { key: "runs", header: "今月の実行", num: true, cell: (r) => r.runs },
  {
    key: "care",
    header: "気にかけること",
    cell: (r) => (r.care === "—" ? "—" : <StatusBadge tone="warning">{r.care}</StatusBadge>),
  },
  {
    key: "bill",
    header: "請求",
    cell: (r) => (r.bill === "—" ? "—" : <StatusBadge tone={billTone(r.bill)}>{r.bill}</StatusBadge>),
  },
  { key: "status", header: "状態", cell: (r) => <StatusBadge tone={r.tone}>{r.status}</StatusBadge> },
];
const COLUMNS = columnsOf(() => MOCK_HREF);

/** 絞り込みの札 1 つ（数・押した印・押したとき） */
export interface ListChip {
  label: string;
  count: number;
  on: boolean;
  onClick: () => void;
}
/** 上の数（渡さなければ下絵の見本） */
export interface ListStatsView {
  active: { value: string; sub: string };
  attention: string;
  runs: { value: string; sub: string | null };
  overdue: { value: string; sub: string | null };
}
/** 部品の並びの値（入れ物が口の値に読み替える） */
export type WsSort = "care" | "people" | "runs";
const SORT_OPTIONS: { value: WsSort; label: string }[] = [
  { value: "care", label: "気にかけるを上に" },
  { value: "people", label: "人数" },
  { value: "runs", label: "今月の実行" },
];
const SAMPLE_STATS: ListStatsView = {
  active: { value: "46", sub: "止めている 1 ・ やめる手続き中 1" },
  attention: "3",
  runs: { value: "48,210", sub: "先月より 12% 多い" },
  overdue: { value: "2 件", sub: "¥ 49,500（税込）" },
};
const SAMPLE_CHIPS = [
  { label: "すべて", count: 48, on: true },
  { label: "気にかける", count: 3, on: false },
  { label: "止めている", count: 1, on: false },
  { label: "やめる手続き中", count: 1, on: false },
] as const;

export interface WsListPageProps {
  rows?: readonly WsRow[];
  /** 探す欄に入っている字（下絵は読むだけ） */
  query?: string;
  /** パスワードの照合が使えなかった登録の件数（0 か無しなら帯を出さない） */
  pwned?: number;
  onPwned?: () => void;
  /** 見出しの下の全社の数（渡さなければ見本の 48） */
  total?: number;
  stats?: ListStatsView;
  /** 絞り込みの札（すべて・気にかける・止めている・やめる手続き中） */
  chips?: readonly ListChip[];
  /** プランの札（無料・チーム・ビジネス） */
  plans?: readonly ListChip[];
  /** 探す欄の Enter（渡すと欄に書ける） */
  onQuery?: (q: string) => void;
  sort?: WsSort;
  /** 並びを選んだとき（渡すと選べる） */
  onSort?: (s: WsSort) => void;
  /** 行の名前の行き先（既定は下絵の 1 社） */
  rowHref?: (r: WsRow) => string;
  /** 0 件の「探す欄を空にする」 */
  onClear?: () => void;
}

function SortField({ sort, onSort }: { sort: WsSort; onSort?: ((s: WsSort) => void) | undefined }) {
  if (!onSort) return <Select label="並び" name="sort" defaultValue={sort} options={SORT_OPTIONS} />;
  return (
    <label className="k-field">
      <span className="k-label">並び</span>
      <select className="k-input" name="sort" value={sort} onChange={(e) => onSort(e.target.value as WsSort)}>
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** 一覧の本体。上の数・気にかけるを上に・探す。rows が空なら「探して 0 件」 */
export function WsListPage({
  rows = WS_ROWS,
  query = "",
  pwned = 0,
  onPwned,
  total = 48,
  stats = SAMPLE_STATS,
  chips = SAMPLE_CHIPS.map((c) => ({ ...c, onClick: () => undefined })),
  plans = PLAN_CHIPS.map(([label, count]) => ({ label, count, on: false, onClick: () => undefined })),
  onQuery,
  sort = "care",
  onSort,
  rowHref,
  onClear,
}: WsListPageProps) {
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && onQuery) onQuery(e.currentTarget.value);
  };
  return (
    <PageBody labelledBy="op-list-title">
      <PageHeader id="op-list-title" title="ワークスペース" sub={`Kaname を使っているワークスペース ・ ${total}`} />
      <div className="k-op-body">
        {pwned > 0 ? (
          <Band
            tone="wait"
            title={`パスワードの照合が使えなかった登録が ${pwned} 件あります`}
            sub="登録のとき、漏れたパスワードの一覧との照合ができなかった分です。本人に連絡して、確かめたら印を付けます"
            acts={
              <Button size="sm" variant="outlined" onClick={onPwned}>
                見る
              </Button>
            }
          />
        ) : null}
        <StatGrid>
          <Stat label="使っている" value={stats.active.value} sub={stats.active.sub} />
          <Stat label="気にかける" value={stats.attention} sub="詰まり・未入金・PC がまだ" tone="warn" />
          <Stat label="今月の実行" value={stats.runs.value} sub={stats.runs.sub ?? undefined} />
          <Stat
            label="期限を過ぎた請求"
            value={stats.overdue.value}
            sub={stats.overdue.sub ?? undefined}
            tone="danger"
          />
        </StatGrid>
        <div className="k-op-tools">
          <div className="k-op-chips" role="group" aria-label="絞り込み">
            {chips.map((c) => (
              <Chip key={c.label} on={c.on} count={c.count} onClick={c.onClick}>
                {c.label}
              </Chip>
            ))}
          </div>
          <div className="k-op-chips" role="group" aria-label="プラン（仮）">
            <span className="k-op-chips-label">プラン（仮）</span>
            {plans.map((c) => (
              <Chip key={c.label} on={c.on} count={c.count} onClick={c.onClick}>
                {c.label}
              </Chip>
            ))}
          </div>
        </div>
        <div className="k-op-find">
          <TextField
            key={query}
            label="探す"
            name="q"
            placeholder="名前・管理者のメールで探す"
            defaultValue={query}
            readOnly={!onQuery}
            onKeyDown={onKey}
          />
          <SortField sort={sort} onSort={onSort} />
        </div>
        {rows.length === 0 ? (
          <Empty
            title={`「${query}」に合うワークスペースはありません`}
            action={
              <Button variant="outlined" onClick={onClear}>
                探す欄を空にする
              </Button>
            }
          >
            名前か管理者のメールの一部で探せます。別の言い方で探すか、絞り込みを「すべて」に戻してください
          </Empty>
        ) : (
          <RespTable
            stack="wide"
            caption="ワークスペースの一覧"
            columns={rowHref ? columnsOf(rowHref) : COLUMNS}
            rows={[...rows]}
            rowKey={(r) => r.id}
          />
        )}
        <Note>
          気にかけること：止まった実行が続く・請求の期限を過ぎた・登録から 7 日たっても PC がつながらない。
          数と種類だけで、中身（チケット・会話）はここには出ない。見るときは 1 社から「中を見る」
        </Note>
      </div>
    </PageBody>
  );
}

/** 照合が使えなかった登録の小窓（日時・ワークスペース・人・確かめた） */
export function PwnedDialog({ rows = PWNED_ROWS, onClose }: { rows?: readonly PwnedRow[]; onClose?: () => void }) {
  const cols: RespColumn<PwnedRow>[] = [
    { key: "at", header: "日時", cell: (r) => r.at },
    { key: "ws", header: "ワークスペース", cell: (r) => r.ws },
    { key: "person", header: "人", cell: (r) => r.person },
    {
      key: "act",
      header: <span className="sr-only">操作</span>,
      card: "action",
      cell: (r) => (
        <Button
          size="sm"
          variant="outlined"
          aria-label={r.person === "—" ? `${r.ws} を確かめた` : `${r.ws} の ${r.person} さんを確かめた`}
        >
          確かめた
        </Button>
      ),
    },
  ];
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose?.()}
      size="connect"
      title="パスワードの照合が使えなかった登録"
      description="登録のとき、漏れたパスワードの一覧との照合ができなかった分です。登録を確定しないまま去った申し込みも、まとめて 1 行に出します。本人に連絡して確かめたら「確かめた」を押します。押した人と日時は運営の記録に残ります"
    >
      <RespTable caption="照合が使えなかった登録" columns={cols} rows={[...rows]} rowKey={(r) => r.at} />
    </Dialog>
  );
}

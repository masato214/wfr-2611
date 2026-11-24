"use client";
// 請求書・請求先・プランを変える・値段が変わる知らせ（段 13・領域 user・下絵）。値を受け取って描くだけ（口は呼ばない・欄は読むだけ）。
//   キャンバス WsBills・EdPlan・WsPriceChange を写す。値段は仮（無料 ¥0・チーム ¥15,000・ビジネス ¥40,000）。カード払いは後のフェーズ（押せない形で出す）。
import {
  Badge,
  Button,
  Callout,
  Confirm,
  Dialog,
  Empty,
  PageBody,
  PageHeader,
  Row,
  Section,
  TextField,
  TextLink,
  type BadgeTone,
} from "@/components/k";
import "./billing.css";
import { RespTable, type RespColumn } from "@/features/F12/shared/resp-table";

export type BillState = "お支払い待ち" | "払われた" | "期限を過ぎた";
export interface BillView {
  month: string;
  amount: string;
  issued: string;
  due: string;
  state: BillState;
  /** 入金を確かめた日（まだなら無し） */
  paid?: string;
}
const BILL_TONE: Record<BillState, BadgeTone> = {
  お支払い待ち: "warning",
  払われた: "success",
  期限を過ぎた: "danger",
};

export interface ContactView {
  company: string;
  attn: string;
  email: string;
}
export interface BillsProps {
  terms: string;
  bank: readonly string[];
  contact: ContactView;
  bills: readonly BillView[];
  /** 期限を過ぎた請求がある（上に注意） */
  overdue?: string;
  /** 無料のプラン（請求書が出ない） */
  free?: boolean;
}

const COLUMNS: RespColumn<BillView>[] = [
  { key: "month", header: "月", cell: (b) => b.month },
  { key: "amount", header: "金額（税込）", cell: (b) => b.amount, num: true },
  { key: "issued", header: "出した日", cell: (b) => b.issued },
  { key: "due", header: "期限", cell: (b) => b.due },
  { key: "state", header: "状態", cell: (b) => <Badge tone={BILL_TONE[b.state]}>{b.state}</Badge> },
  { key: "paid", header: "入金を確かめた日", cell: (b) => b.paid ?? "—" },
  {
    key: "pdf",
    header: "請求書",
    cell: (b) => (
      <TextLink href="#" aria-label={`${b.month}の請求書（PDF）`}>
        PDF
      </TextLink>
    ),
  },
];

export function Bills({ terms, bank, contact, bills, overdue, free }: BillsProps) {
  return (
    <PageBody labelledBy="bills-title">
      <PageHeader
        id="bills-title"
        title="請求書"
        sub={`${terms}`}
        actions={<TextLink href="/settings">設定に戻る</TextLink>}
      />
      <div className="k-ub-top">
        {overdue ? (
          <Callout tone="warn" title="期限を過ぎた請求があります">
            {overdue}
          </Callout>
        ) : null}
        <dl className="k-ub-terms">
          <div>
            <dt>振込先</dt>
            <dd>
              {bank.map((l) => (
                <div key={l}>{l}</div>
              ))}
            </dd>
          </div>
          <div>
            <dt>請求先</dt>
            <dd>
              {contact.company} {contact.attn}
              <div>{contact.email}</div>
            </dd>
            <Button variant="outlined" size="sm">
              変える
            </Button>
          </div>
        </dl>
        <Section title="請求書の一覧">
          {free ? (
            <Empty title="まだ請求書がありません">
              無料のプランでは請求書は出ません。プランを上げると、月末締めで翌月 1 日に出ます。
            </Empty>
          ) : (
            <RespTable caption="請求書の一覧" columns={COLUMNS} rows={[...bills]} rowKey={(b) => b.month} />
          )}
        </Section>
        <p className="k-ub-note">
          請求書は請求先のメールにも届く。入金は運営が確かめてから「払われた」になる（数日かかることがある）。期限を過ぎると管理者にお知らせが出る。値段は仮。カード払いは後のフェーズ
        </p>
      </div>
    </PageBody>
  );
}

/** 請求先を変える小窓 */
export function ContactDialog({ contact, open = true }: { contact: ContactView; open?: boolean }) {
  return (
    <Dialog
      open={open}
      title="請求先を変える"
      subtitle="請求書の宛名と届け先のメール。次に出す請求書から変わる"
      actions={
        <>
          <Button variant="outlined">やめる</Button>
          <Button variant="primary">保存する</Button>
        </>
      }
    >
      <div className="k-ub-form">
        <TextField label="会社名" name="company" required defaultValue={contact.company} readOnly />
        <TextField label="宛名" name="attn" defaultValue={contact.attn} readOnly />
        <TextField label="メール" name="email" type="email" required defaultValue={contact.email} readOnly />
      </div>
    </Dialog>
  );
}

// ---- プランを変える ----
export interface PlanView {
  id: string;
  name: string;
  price: string;
  limit: string;
  current?: boolean;
  recommended?: boolean;
}
export interface PlanDialogProps {
  workspace: string;
  members: number;
  plans: readonly PlanView[];
  nextBill: string;
  open?: boolean;
}

export function PlanDialog({ workspace, members, plans, nextBill, open = true }: PlanDialogProps) {
  return (
    <Dialog
      open={open}
      title="プランを変える"
      subtitle={`${workspace} ・ いま ${members} 人`}
      actions={<Button variant="outlined">やめる</Button>}
    >
      <div className="k-ub-form">
        <ul className="k-ub-plans" aria-label="プラン">
          {plans.map((p) => (
            <li key={p.id} className="k-ub-plan" data-current={p.current ? "true" : undefined}>
              <h3 className="k-ub-plan-name">
                {p.current ? <Badge tone="progress">いま</Badge> : null}
                {p.recommended ? <Badge tone="success">おすすめ</Badge> : null}
                <span>{p.name}</span>
                <span className="k-ub-plan-price">{p.price}</span>
              </h3>
              <p className="k-ub-plan-limit">{p.limit}</p>
              {p.current ? null : (
                <Button className="k-ub-plan-act" variant={p.recommended ? "primary" : "outlined"} size="sm">
                  このプランにする
                </Button>
              )}
            </li>
          ))}
        </ul>
        <p className="k-ub-note">
          上げるとすぐ使える（今月の残り日数分だけ払う）。下げると次の請求日（{nextBill}
          ）から。人数が上限を超えるときは下げられない
        </p>
        <p className="k-ub-note">
          払い方：請求書払い（月末締め・翌月 1 日に出す・月末払い） ・{" "}
          <TextLink href="/settings/billing">請求書</TextLink> ・ 値段は仮 ・{" "}
          <span className="k-ub-inert" aria-disabled="true" tabIndex={-1} title="まだ使えません">
            カード払いは後のフェーズ
          </span>
        </p>
      </div>
    </Dialog>
  );
}

/** 上げる確かめ（今月の残り日数分・本人確認の取り直し） */
export function PlanConfirm({ plan, days, amount, due }: { plan: string; days: number; amount: string; due: string }) {
  return (
    <Confirm
      open
      tone="primary"
      title={`${plan} に上げる`}
      description={`上げるとすぐ使えます。今月の残り ${days} 日分（${amount}）を、${due} に出す請求書に足します。`}
      confirmLabel="上げる"
      onOpenChange={() => undefined}
      onConfirm={() => undefined}
    >
      <ol className="k-ub-steps">
        <li>このあと、本人確認をもう一度します（パスキーなど、ふだんのログインと同じ方法）</li>
        <li>確かめられると、プランが変わり、管理者全員にお知らせが届きます</li>
      </ol>
    </Confirm>
  );
}

/** 下げられない（人数が上限を超える） */
export function PlanBlocked({ plan, limit, members }: { plan: string; limit: number; members: number }) {
  return (
    <Dialog
      open
      title="このプランには下げられません"
      subtitle={`${plan} は ${limit} 人まで`}
      actions={
        <>
          <Button variant="outlined">メンバーを見る</Button>
          <Button variant="primary" disabled aria-disabled="true">
            このプランにする
          </Button>
        </>
      }
    >
      <div className="k-ub-form">
        <Callout tone="danger" title={`いまのメンバーは ${members} 人で、上限（${limit} 人）を超えています`}>
          先にメンバーを減らすか、いまのプランのままにしてください。減らして {limit} 人以内になると下げられます。
        </Callout>
      </div>
    </Dialog>
  );
}

/** 設定の「プランと支払い」の 1 行と、値段が変わる知らせ */
export function PriceChange({ line, change, noticeDate }: { line: string; change?: string; noticeDate?: string }) {
  return (
    <PageBody labelledBy="settings-title">
      <PageHeader id="settings-title" title="設定" sub="変えることがあるものだけ" />
      <div className="k-ub-top">
        <Section title="プランと支払い">
          <div className="k-ub-setting">
            <div className="k-ub-setting-line">
              <span>{line}</span>
              {change ? <Badge tone="warning">変わる</Badge> : null}
            </div>
            {change ? (
              <p className="k-ub-change" role="status">
                {change}（お知らせ {noticeDate}）
              </p>
            ) : null}
            <Row>
              <Button variant="outlined" size="sm">
                プランを変える
              </Button>
              <TextLink href="/settings/billing">請求書</TextLink>
            </Row>
          </div>
        </Section>
      </div>
    </PageBody>
  );
}

"use client";
// 1 社の小窓と帯（段 13・領域 ops・キャンバス OpPeek・OpStop）：中を見る・中を見ている間・止める・お知らせを送る。値を受け取って描くだけ
import { Fingerprint } from "lucide-react";
import { Band, Button, Callout, Dialog, Select, TextArea, TextField } from "@/components/k";
import { Bullets, Card, Note, RadioChoice } from "./ops-parts";
import { STOP_REASONS } from "./ops-sample";

const noop = () => undefined;

/** 中を見る小窓：理由・見る時間・できること・本人確認 */
export function PeekDialog({ onClose = noop }: { onClose?: () => void }) {
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      size="connect"
      title="中を見る"
      target="合同会社ミナト企画"
      actions={
        <>
          <Button variant="outlined" onClick={onClose}>
            やめる
          </Button>
          <Button icon={<Fingerprint size={14} />}>見るだけで開く</Button>
        </>
      }
    >
      <div className="k-op-form">
        <Select
          label="理由"
          name="reason"
          defaultValue="inquiry"
          description="問い合わせを選ぶか、書く（障害の調べ・請求の確認 など）"
          options={[
            { value: "inquiry", label: "問い合わせ「承認したのに動かない」（湊 さくら・11/02）" },
            { value: "incident", label: "障害の調べ" },
            { value: "billing", label: "請求の確認" },
            { value: "other", label: "ほか（書く）" },
          ]}
        />
        <Select
          label="見る時間"
          name="minutes"
          defaultValue="60"
          options={[
            { value: "30", label: "30 分" },
            { value: "60", label: "1 時間" },
          ]}
        />
        <div className="k-op-form-group">
          <b>できること</b>
          <Bullets
            label="見るだけで できること"
            items={[
              "見るだけ（何も変えられない）",
              "規約で先に許可をもらっているので、顧客に聞かずに開ける",
              "誰が・いつ・何を見たか・理由は、運営の記録と顧客のワークスペースの記録の両方に残る",
              "預けたログイン情報の値は運営にも見えない",
              "見ている間は画面のいちばん上に帯が出る",
            ]}
          />
        </div>
        <Callout tone="info">開く前に本人確認を取り直します（パスキー）</Callout>
      </div>
    </Dialog>
  );
}

/** 中を見ている間の帯（外枠の banner に渡す）：残り時間・閉じる */
export function PeekBand() {
  return (
    <Band
      tone="info"
      title="合同会社ミナト企画 の中を見ています（見るだけ）"
      sub="残り 38 分 ・ 理由：問い合わせ「承認したのに動かない」。何も変えられません。見たことは運営の記録と顧客の記録に残ります"
      acts={
        <Button size="sm" variant="outlined">
          閉じる
        </Button>
      }
    />
  );
}

/** 中を見ている間に見られる物（見るだけ。開く行は押せない形） */
export function PeekPanel() {
  const rows = [
    ["チケット", "4 件（承認待ちの 1 件を含む）"],
    ["承認待ち", "「請求書の送付先を変えて送る」湊さんの分身が待っている"],
    ["分身の実行の記録", "湊さんの分身 ・ 11/02 09:12 の実行が止まった"],
  ] as const;
  return (
    <Card title="いま見られる物（見るだけ）" aside="預けたログイン情報の値は運営にも見えない">
      <ul className="k-op-reasons">
        {rows.map(([k, v]) => (
          <li key={k}>
            <span className="k-op-reason-text">
              <b>{k}</b>
              <span>{v}</span>
            </span>
            <Button size="sm" variant="outlined" aria-disabled="true" tabIndex={-1} title="まだ使えません">
              開く（見るだけ）
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** 止める小窓：理由・いつ止めるか・管理者への知らせ・止めると */
export function StopDialog({ onClose = noop }: { onClose?: () => void }) {
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      size="connect"
      title="止める"
      target="合同会社ミナト企画 ・ 8 人"
      actions={
        <>
          <Button variant="outlined" onClick={onClose}>
            やめる
          </Button>
          <Button variant="danger">11/09 に止める</Button>
        </>
      }
    >
      <div className="k-op-form">
        <Select label="理由" name="reason" defaultValue="unpaid" options={[...STOP_REASONS]} />
        <fieldset className="k-op-fieldset">
          <legend>いつ止めるか</legend>
          <RadioChoice
            name="when"
            value="later"
            checked
            title="先に知らせて、日を決めて止める"
            desc="管理者にお知らせが出る ・ 止める日 11/09（7 日後）"
          />
          <RadioChoice name="when" value="now" title="すぐ止める" desc="規約に反する・危ないときだけ" />
        </fieldset>
        <TextField label="止める日" name="date" type="date" defaultValue="2026-11-09" readOnly />
        <TextArea
          label="管理者へのお知らせ"
          name="notice"
          rows={4}
          readOnly
          defaultValue="10 月分の請求書（¥16,500・期限 11/30）のお支払いが確かめられていません。11/09 までに確かめられない場合、ワークスペースを止めます。"
        />
        <div className="k-op-form-group">
          <b>止めると</b>
          <Bullets
            label="止めると どうなるか"
            items={[
              "止めた後にメンバーが入ると、止められた画面になる（理由・問い合わせ先・「問い合わせる」だけ使える）",
              "分身の実行も止まる。実行待ちのものは消さずに残す",
              "チケット・記録・分身の記憶はそのまま残る。再開すれば元に戻る",
            ]}
          />
        </div>
        <Note>止めるのは「止める」ができる運営の人だけ・記録に残る</Note>
      </div>
    </Dialog>
  );
}

/** 1 社にお知らせを送る小窓（この 1 社の人だけに届く） */
export function NoticeDialog({ onClose = noop }: { onClose?: () => void }) {
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="お知らせを送る"
      target="合同会社ミナト企画 ・ 8 人"
      actions={
        <>
          <Button variant="outlined" onClick={onClose}>
            やめる
          </Button>
          <Button>送る</Button>
        </>
      }
    >
      <div className="k-op-form">
        <TextField
          label="題"
          name="title"
          defaultValue="請求書の宛名のご確認"
          readOnly
          maxLength={100}
          description="100 字まで"
        />
        <TextArea
          label="本文"
          name="body"
          rows={5}
          readOnly
          defaultValue="10 月分の請求書の宛名を、ご依頼のとおり「経理 ご担当」に変えました。届いたメールをご確認ください。"
        />
        <Select
          label="出す場所"
          name="where"
          defaultValue="band"
          options={[
            { value: "band", label: "画面の上の帯" },
            { value: "list", label: "お知らせの一覧" },
            { value: "both", label: "どちらも" },
          ]}
        />
        <fieldset className="k-op-fieldset">
          <legend>誰に</legend>
          <RadioChoice name="to" value="all" checked title="この会社の人みんな" />
          <RadioChoice
            name="to"
            value="admins"
            title="管理者だけ"
            desc="管理者だけのお知らせは、お知らせの一覧にだけ出ます（上の帯には出しません）"
          />
        </fieldset>
        <Note>
          この会社の人だけに届きます。すべての顧客に出すお知らせは「お知らせ」から作ります。送ったことは運営の記録に残ります
        </Note>
      </div>
    </Dialog>
  );
}

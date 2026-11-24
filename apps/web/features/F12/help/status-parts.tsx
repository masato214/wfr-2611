"use client";
// 障害・メンテの帯／メンテ中・障害の画面／止められた画面／運営が中を見ている間の最上部の帯（段 13・領域 user・下絵）。値を受け取って描くだけ。
//   キャンバス MnIncident・ErrMaintenance・ErrDown・PeekMain を写す。帯は components/k の Band（箱 1 つ・右にボタン）。
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Band, BandLine, Button } from "@/components/k";
import "./help.css";

const CloseX = () => (
  <Button variant="ghost" size="sm" aria-label="閉じる" title="閉じる">
    <X size={16} aria-hidden="true" />
  </Button>
);

/** チケットなどの画面の上の障害の帯（原因が分かった・詳しく・×） */
export function IncidentBand({ title, state, note }: { title: string; state: string; note: string }) {
  return (
    <Band
      tone="danger"
      title={`障害 ・ ${title}`}
      sub={`${state} ・ ${note}`}
      acts={
        <>
          <Button variant="outlined" size="sm">
            詳しく
          </Button>
          <CloseX />
        </>
      }
    />
  );
}

/** メンテの予定の帯（3 日前から出る・閉じられる） */
export function MaintBand({ window, impact }: { window: string; impact: string }) {
  return (
    <Band
      tone="info"
      title={`メンテナンスの予定 ・ ${window}`}
      sub={impact}
      acts={
        <>
          <Button variant="outlined" size="sm">
            詳しく
          </Button>
          <CloseX />
        </>
      }
    />
  );
}

/** 止める日が決まった帯（管理者だけ・○日に止まります・理由・問い合わせる） */
export function StopSoonBand({ day, reason }: { day: string; reason: string }) {
  return (
    <Band
      tone="wait"
      title={`${day} にこのワークスペースを止めます`}
      sub="管理者だけに出ています。それまでは今までどおり使えます"
      acts={
        <Button variant="outlined" size="sm">
          問い合わせる
        </Button>
      }
    >
      <BandLine>理由：{reason}</BandLine>
    </Band>
  );
}

function FullCard({
  icon,
  title,
  lead,
  children,
  foot,
}: {
  icon: string;
  title: string;
  lead: string;
  children?: ReactNode;
  foot?: ReactNode;
}) {
  return (
    <main className="k-root k-error-page">
      <div className="k-error-card">
        <div className="k-uh-full-card">
          <span className="k-uh-full-mark" aria-hidden="true">
            {icon}
          </span>
          <div className="k-uh-full">
            <h1 className="k-state-title">{title}</h1>
            <p className="k-state-body">{lead}</p>
            {children}
          </div>
          {foot ? <div className="k-uh-full-foot">{foot}</div> : null}
        </div>
      </div>
    </main>
  );
}

const FOOT = (
  <>
    <span>いまの様子</span>
    <span aria-hidden="true">・</span>
    <span>困ったとき</span>
  </>
);

/** メンテ中の画面（終わると自動で切り替わる） */
export function MaintenanceView({ window, noticed }: { window: string; noticed: string }) {
  return (
    <FullCard
      icon="工"
      title="いまメンテナンス中です"
      lead={`${window} の予定です。終わると自動でこの画面が切り替わります`}
      foot={FOOT}
    >
      <section aria-label="分身の作業は">
        <h2 className="k-uh-item-title">分身の作業は</h2>
        <ul className="k-uh-full-list">
          <li>実行中のものは、メンテナンスの前に区切りまで進めて止めた</li>
          <li>承認したものは「実行待ち」になり、終わってから動く</li>
          <li>書きかけはこの PC に残っている</li>
        </ul>
      </section>
      <p className="k-uh-lead">お知らせは {noticed} に出しました</p>
    </FullCard>
  );
}

/** 障害の画面（調子が悪い） */
export function DownView({ updated, note, since, no }: { updated: string; note: string; since: string; no: string }) {
  return (
    <FullCard
      icon="!"
      title="Kaname の調子が悪くなっています"
      lead="ご迷惑をおかけしています。運営が直しています。あなたの操作や PC の問題ではありません"
      foot={FOOT}
    >
      <section aria-label="いまの様子">
        <h2 className="k-uh-item-title">いまの様子（{updated} 更新）</h2>
        <p className="k-uh-lead">{note}</p>
      </section>
      <div className="k-state-actions">
        <Button variant="primary">もう一度</Button>
        <Button variant="outlined">いまの様子を見る</Button>
      </div>
      <p className="k-state-code">
        {since} から ・ 障害の番号 {no}
      </p>
    </FullCard>
  );
}

/** 止められたワークスペースに入った画面（理由・再開の連絡先・問い合わせる） */
export function StoppedView({ reason, since, contact }: { reason: string; since: string; contact: string }) {
  return (
    <FullCard
      icon="止"
      title="このワークスペースは止められています"
      lead={`${since} から止まっています。データは消えていません。再開すると、そのまま続きから使えます`}
      foot={FOOT}
    >
      <section aria-label="止めた理由">
        <h2 className="k-uh-item-title">止めた理由</h2>
        <p className="k-uh-lead">{reason}</p>
      </section>
      <section aria-label="再開するには">
        <h2 className="k-uh-item-title">再開するには</h2>
        <p className="k-uh-lead">運営の {contact} に連絡するか、下の「問い合わせる」から相談してください。</p>
      </section>
      <div className="k-state-actions">
        <Button variant="primary">問い合わせる</Button>
      </div>
    </FullCard>
  );
}

/** 顧客の側：運営が中を見ている間の上の帯（閉じられない・見るのをやめるは無い・枠は出さない。D-156.50） */
export function CustomerPeekBand({ reason, rest }: { reason: string; rest: string }) {
  return <Band tone="info" role="status" title="運営が中を見ています" sub={`理由：${reason} ・ 残り ${rest}`} />;
}

/** 運営が中を見ている間の最上部の帯と枠（見るだけ）。画面の上に重ねる */
export function PeekBar({ who, reason, rest }: { who: string; reason: string; rest: string }) {
  return (
    <>
      <div className="k-uh-peek-bar" role="status">
        <span className="k-uh-peek-tag">運営として見ています</span>
        <span>{who} の画面 ・ 見るだけ（押しても何も変わらない）</span>
        <span>理由：{reason}</span>
        <span className="k-uh-peek-end">
          <span>残り {rest}</span>
          <Button variant="inverted" size="sm">
            見るのをやめる
          </Button>
        </span>
      </div>
      <div className="k-uh-peek-frame" aria-hidden="true" />
    </>
  );
}

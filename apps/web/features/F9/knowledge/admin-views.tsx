"use client";
// ナレッジの管理の面（管理者・マネージャー）：承認待ち／見直すページ（使われていない・食い違い・よく破られる）。
//   見た目だけ（値は props・口は呼ばない）
import { ArrowRight, ArrowUpToLine, Share2 } from "lucide-react";
import type { ReactNode } from "react";
import { Badge, Button, Callout, TextArea } from "@/components/k";
import type { ApprovalItem, BrokenRow, ConflictRow, UnusedRow } from "./types";
import "./knowledge.css";
import "./admin.css";

export type { ApprovalItem, BrokenRow, ConflictRow, UnusedRow };

// ---------------------------------------------------------------- 承認待ち

function ApprovalCard({ a }: { a: ApprovalItem }) {
  return (
    <li className="k-f9-ap" aria-label={`${a.from}：${a.title}`}>
      <div className="k-f9-ap-head">
        <Badge tone={a.kind === "raise" ? "progress" : "neutral"}>
          {a.kind === "raise" ? (
            <>
              <ArrowUpToLine size={12} aria-hidden="true" /> 上の棚に上げる
            </>
          ) : (
            <>
              <Share2 size={12} aria-hidden="true" /> 共有
            </>
          )}
        </Badge>
        <span className="k-f9-ap-route">
          {a.fromShelf}
          <ArrowRight size={12} aria-hidden="true" />
          <b>{a.toShelf}</b>
        </span>
        <span className="k-f9-sub">{`${a.from} ・ ${a.at}`}</span>
      </div>
      <h3 className="k-f9-ap-title">{a.title}</h3>
      <p className="k-f9-ap-desc">{a.desc}</p>
      {a.message ? <p className="k-f9-ap-msg">{`ひとこと：${a.message}`}</p> : null}
      {a.similar ? (
        <Callout tone="warn" title="似たページがあります">
          {a.similar}
        </Callout>
      ) : null}
      {a.declining ? (
        <div className="k-f9-ap-decline">
          <TextArea
            label="断る理由"
            name={`decline-${a.id}`}
            value={a.declining.reason}
            readOnly
            required
            rows={2}
            error={a.declining.error}
            description="頼んだ人のページに、この理由が出ます。"
          />
          <div className="k-f9-ap-acts">
            <Button variant="outlined" size="sm">
              やめる
            </Button>
            <Button variant="danger" size="sm">
              断る
            </Button>
          </div>
        </div>
      ) : (
        <div className="k-f9-ap-acts">
          <Button variant="ghost" size="sm">
            中身を見る
          </Button>
          <Button variant="outlined" size="sm">
            断る…
          </Button>
          <Button variant="secondary" size="sm">
            承認する
          </Button>
        </div>
      )}
    </li>
  );
}

export function ApprovalsView({ items }: { items: readonly ApprovalItem[] }) {
  return (
    <section className="k-f9-admin" aria-labelledby="kn-admin-title">
      <header className="k-f9-admin-head">
        <h1 id="kn-admin-title">承認待ち</h1>
        <p className="k-f9-sub">
          上の棚に上げる頼みと、ほかのグループからの共有の頼みが並びます。承認するまで、上の棚には出ません。
        </p>
      </header>
      {items.length ? (
        <ul className="k-f9-ap-list">
          {items.map((a) => (
            <ApprovalCard key={a.id} a={a} />
          ))}
        </ul>
      ) : (
        <p className="k-f9-none">承認待ちはありません</p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- 見直すページ

export interface ReviewProps {
  unused: readonly UnusedRow[];
  conflicts: readonly ConflictRow[];
  broken: readonly BrokenRow[];
}

function Block({
  id,
  title,
  n,
  lead,
  children,
}: {
  id: string;
  title: string;
  n: number;
  lead: string;
  children: ReactNode;
}) {
  return (
    <section className="k-f9-rv" aria-labelledby={id}>
      <div className="k-f9-rv-head">
        <h2 id={id}>
          {title}
          <span className="k-f9-count">{n}</span>
        </h2>
        <p className="k-f9-sub">{lead}</p>
      </div>
      {children}
    </section>
  );
}

export function ReviewView({ unused, conflicts, broken }: ReviewProps) {
  return (
    <section className="k-f9-admin" aria-labelledby="kn-admin-title">
      <header className="k-f9-admin-head">
        <h1 id="kn-admin-title">見直すページ</h1>
        <p className="k-f9-sub">
          AI が読んでいないページ・上と下で違うことが書いてあるページ・守られていない決まりを、ここで見つけて直します。
        </p>
      </header>

      <Block
        id="rv-unused"
        title="使われていないページ"
        n={unused.length}
        lead="AI が 90 日のあいだ 1 度も開いていないページです。要らなければ消し、要るなら題名と 1 行の説明を直します。"
      >
        <ul className="k-f9-rows">
          {unused.map((r) => (
            <li key={r.id} className="k-f9-row">
              <span className="k-f9-row-main">
                <b>{r.title}</b>
                <small>{r.place}</small>
              </span>
              <span className="k-f9-row-meta">{r.lastOpened}</span>
              <Button variant="outlined" size="sm" aria-label={`${r.title}を開く`}>
                開く
              </Button>
            </li>
          ))}
        </ul>
      </Block>

      <Block
        id="rv-conflict"
        title="食い違っているページ"
        n={conflicts.length}
        lead="上の棚と下の棚で、違うことが書いてあります。AI には上の棚（会社 › グループ › 自分 の順）が効きます。"
      >
        <ul className="k-f9-rows">
          {conflicts.map((r) => (
            <li key={r.id} className="k-f9-row" data-stack>
              <span className="k-f9-row-main">
                <span className="k-f9-pair">
                  <span>
                    <b>{r.upper}</b>
                    <small>{r.upperPlace}</small>
                  </span>
                  <span className="k-f9-pair-vs" aria-hidden="true" />
                  <span>
                    <b>{r.lower}</b>
                    <small>{r.lowerPlace}</small>
                  </span>
                </span>
                <span className="k-f9-row-point">{r.point}</span>
              </span>
              <Button variant="outlined" size="sm" aria-label={`${r.upper}と${r.lower}を並べて見る`}>
                並べて見る
              </Button>
            </li>
          ))}
        </ul>
      </Block>

      <Block
        id="rv-broken"
        title="よく破られる決まり"
        n={broken.length}
        lead="この 30 日に、AI が守れなかった数の多い順です。書き方があいまいなことが多いので、直します。"
      >
        <ul className="k-f9-rows">
          {broken.map((r) => (
            <li key={r.id} className="k-f9-row">
              <span className="k-f9-row-main">
                <b>{r.title}</b>
                <small>{r.place}</small>
                <span className="k-f9-row-point">{r.how}</span>
              </span>
              <span className="k-f9-row-num">
                <b>{r.count}</b> 回
              </span>
              <Button variant="outlined" size="sm" aria-label={`${r.title}の書き方を直す`}>
                書き方を直す
              </Button>
            </li>
          ))}
        </ul>
      </Block>
    </section>
  );
}

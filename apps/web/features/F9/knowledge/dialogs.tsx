"use client";
// ナレッジの小窓（中央に開く）：必ず守るの上限・上の棚に上げる・グループを選んで共有・似たページ。
//   見た目だけ（値は props・口は呼ばない）
import { ShieldCheck } from "lucide-react";
import { Button, Callout, Dialog, Select, TextArea } from "@/components/k";
import type { PageBrief } from "./types";
import "./knowledge.css";

const noop = (): void => undefined;

// ---------------------------------------------------------------- 必ず守る：上限に届いた
export interface MustFullProps {
  /** 棚の名前（会社・営業・自分） */
  shelf: string;
  /** 上限の数（会社 30・グループ 20・個人 10。運営が後から変えられる） */
  limit: number;
  /** 付けようとしたページ */
  target: string;
  /** いま付いているページ（読める量だけ並べる） */
  pages: readonly { id: string; title: string; folder: string }[];
  /** いま付いている数（上限に届いたとき limit と同じ。並べた数より多いとき「ほか N 個」を出す） */
  count?: number;
}

export function MustFullDialog({ shelf, limit, target, pages, count = pages.length }: MustFullProps) {
  return (
    <Dialog
      open
      onOpenChange={noop}
      title="「必ず守る」は、これ以上付けられません"
      target={target}
      actions={<Button variant="outlined">閉じる</Button>}
    >
      <div className="k-dialog-stack">
        <Callout tone="warn" title={`${shelf}の「必ず守る」は ${limit} 個までです`}>
          「必ず守る」のページは、AI に毎回全部渡します。多すぎると AI が守りきれなくなるので、上限があります。
          どれかを外すと、このページに付けられます。
        </Callout>
        <section aria-label="いま付いているページ" className="k-f9-pick">
          <h3 className="k-f9-pick-h">{`いま付いているページ（${count}）`}</h3>
          <ul className="k-f9-pick-list">
            {pages.map((p) => (
              <li key={p.id} className="k-f9-pick-row">
                <ShieldCheck size={14} aria-hidden="true" />
                <span className="k-f9-pick-main">
                  <b>{p.title}</b>
                  <small>{p.folder}</small>
                </span>
                <Button variant="outlined" size="sm" aria-label={`${p.title}の「必ず守る」を外す`}>
                  外す
                </Button>
              </li>
            ))}
          </ul>
          {count > pages.length ? <p className="k-f9-note">{`ほか ${count - pages.length} 個`}</p> : null}
        </section>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- 上の棚に上げる（頼む）
export interface RaiseProps {
  target: string;
  /** 上げる先の棚（営業／会社） */
  to: string;
  /** 承認する人 */
  approver: string;
  folders: readonly string[];
  folder: string;
  message: string;
}

export function RaiseDialog({ target, to, approver, folders, folder, message }: RaiseProps) {
  return (
    <Dialog
      open
      onOpenChange={noop}
      title="上の棚に上げる"
      target={target}
      actions={
        <>
          <Button variant="outlined">やめる</Button>
          <Button>上げるのを頼む</Button>
        </>
      }
    >
      <div className="k-dialog-stack">
        <dl className="k-f9-facts">
          <div>
            <dt>上げる先</dt>
            <dd>{`${to}の棚`}</dd>
          </div>
          <div>
            <dt>承認する人</dt>
            <dd>{approver}</dd>
          </div>
        </dl>
        <Select
          label="入れるフォルダ"
          name="raise_folder"
          options={folders.map((f) => ({ value: f, label: f }))}
          value={folder}
          onValueChange={noop}
        />
        <TextArea label="ひとこと" name="raise_message" value={message} readOnly rows={2} />
        <p className="k-f9-note">
          承認されると、このページは{to}の棚に移り、{to}
          の人が読めるようになります。断られたときは、理由がこのページに出ます。
        </p>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- グループを選んで共有
export interface ShareProps {
  target: string;
  from: string;
  groups: readonly { code: string; name: string; manager: string; checked: boolean; state?: string }[];
}

export function ShareDialog({ target, from, groups }: ShareProps) {
  const n = groups.filter((d) => d.checked && !d.state).length;
  return (
    <Dialog
      open
      onOpenChange={noop}
      title="グループを選んで共有"
      target={target}
      actions={
        <>
          <Button variant="outlined">やめる</Button>
          <Button>{n ? `${n} つのグループに共有を頼む` : "共有を頼む"}</Button>
        </>
      }
    >
      <div className="k-dialog-stack">
        <fieldset className="k-f9-pick">
          <legend className="k-f9-pick-h">見せるグループ</legend>
          <ul className="k-f9-pick-list">
            {groups.map((d) => (
              <li key={d.code} className="k-f9-pick-row">
                <input
                  type="checkbox"
                  id={`share-${d.code}`}
                  defaultChecked={d.checked}
                  disabled={Boolean(d.state)}
                  className="k-f9-checkbox"
                />
                <label htmlFor={`share-${d.code}`} className="k-f9-pick-main">
                  <b>{d.name}</b>
                  <small>{`承認する人：${d.manager}`}</small>
                </label>
                {d.state ? (
                  <span className="k-badge" data-tone="success">
                    {d.state}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </fieldset>
        <p className="k-f9-note">
          元は 1 つのままです。{from}で直すと、共有先にも同じ内容が出ます。共有先では読むだけで、直せません。
          相手のグループのマネージャーが承認すると、そのグループの人に見えるようになります。
        </p>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- 似たページ
export interface SimilarProps {
  /** いつ出たか：書き終えるとき／上げるのを頼むとき */
  when: "save" | "raise";
  target: string;
  pages: readonly PageBrief[];
}

export function SimilarDialog({ when, target, pages }: SimilarProps) {
  return (
    <Dialog
      open
      onOpenChange={noop}
      title="似たページがあります"
      target={target}
      actions={
        <>
          <Button variant="outlined">戻って直す</Button>
          <Button>{when === "save" ? "このまま作る" : "このまま頼む"}</Button>
        </>
      }
    >
      <div className="k-dialog-stack">
        <p className="k-f9-note">
          同じことが 2 か所に書いてあると、AI がどちらを読めばよいか迷います。先に開いて確かめてください。
        </p>
        <ul className="k-f9-pick-list" aria-label="似たページ">
          {pages.map((p) => (
            <li key={p.id} className="k-f9-pick-row">
              <span className="k-f9-pick-main">
                <b>{p.title}</b>
                <small>{p.place}</small>
                <span className="k-f9-pick-desc">{p.desc}</span>
              </span>
              <Button variant="outlined" size="sm" aria-label={`${p.title}を開く`}>
                開く
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </Dialog>
  );
}

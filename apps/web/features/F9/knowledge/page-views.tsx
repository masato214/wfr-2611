"use client";
// ナレッジのページ（右）。題名・1 行の説明・本文。印と操作は全部ページの上の帯か「…」に置く。
//   見た目だけ（値は props・口は呼ばない）
import { ArrowUpToLine, Copy, MoreHorizontal, Pencil, Share2, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Band, Button, Menu, MenuItem, MenuPopup, MenuTrigger, TextField } from "@/components/k";
import type { Doc } from "@kaname/contracts";
import { DocEditor, DocView } from "@/features/F4/doc/editor";
import type { PagePlace } from "./types";
import "./knowledge.css";

/** 見た目だけなので、本文を打っても何もしない（口を呼ばない。つなぐのは画面の葉） */
const noop = (): void => undefined;

// ---------------------------------------------------------------- ページの頭（場所・印・操作）
function Place({ place }: { place: PagePlace }) {
  return (
    <p className="k-f9-place">
      <span className="k-f9-shelfchip" data-shelf={place.shelf}>
        {place.shelf === "company" ? "会社" : place.shelf === "group" ? `グループ：${place.shelfName}` : "自分"}
      </span>
      {place.folders.map((f) => (
        <span key={f} className="k-f9-place-f">
          {f}
        </span>
      ))}
    </p>
  );
}

/** 「必ず守る」の切り替え（付いているときは押し込んだ形） */
export function MustToggle({ on, disabled }: { on: boolean; disabled?: string | undefined }) {
  return (
    <button
      type="button"
      className="k-f9-must"
      aria-pressed={on}
      {...(disabled ? { "aria-disabled": true, tabIndex: -1, title: disabled } : {})}
    >
      <ShieldCheck size={14} aria-hidden="true" />
      必ず守る
    </button>
  );
}

export type PageAct = "must-on" | "must-off" | "raise" | "share" | "copy" | "edit";

/** ページの上の帯の操作。主ボタンは 1 つ（書ける人は「直す」・読むだけの人は「写して直す」） */
export function PageActs({ acts, moreOpen = false }: { acts: readonly PageAct[]; moreOpen?: boolean }) {
  const has = (a: PageAct): boolean => acts.includes(a);
  const canEdit = has("edit");
  return (
    <div className="k-f9-acts">
      {has("must-on") || has("must-off") ? <MustToggle on={has("must-on")} /> : null}
      {has("raise") ? (
        <Button variant="outlined" size="sm" icon={<ArrowUpToLine size={14} />}>
          上の棚に上げる
        </Button>
      ) : null}
      {has("share") ? (
        <Button variant="outlined" size="sm" icon={<Share2 size={14} />}>
          グループを選んで共有
        </Button>
      ) : null}
      {has("copy") ? (
        <Button variant={canEdit ? "outlined" : "primary"} size="sm" icon={<Copy size={14} />}>
          写して直す
        </Button>
      ) : null}
      {canEdit ? (
        <Button size="sm" icon={<Pencil size={14} />}>
          直す
        </Button>
      ) : null}
      <Menu defaultOpen={moreOpen}>
        <MenuTrigger label="このページのほかの操作" className="k-btn k-f9-more">
          <MoreHorizontal size={16} aria-hidden="true" />
        </MenuTrigger>
        <MenuPopup>
          <MenuItem>前の版を見る</MenuItem>
          <MenuItem>リンクをコピー</MenuItem>
          {canEdit ? <MenuItem>別のフォルダへ動かす</MenuItem> : null}
          {canEdit ? <MenuItem>消す…</MenuItem> : null}
        </MenuPopup>
      </Menu>
    </div>
  );
}

// ---------------------------------------------------------------- ページ（読む）
export interface PageViewProps {
  place: PagePlace;
  title: string;
  /** 1 行の説明（AI に渡す目次になる） */
  desc: string;
  acts: readonly PageAct[];
  /** 「必ず守る」が付いている */
  must?: boolean;
  /** 題名の下の帯（承認待ち・断られた・写し・共有された） */
  bands?: ReactNode;
  /** 足元の 1 行（最後に直した人・AI が開いた数） */
  foot: string;
  /** 「…」メニューを開いた形（下絵 kn-more） */
  moreOpen?: boolean;
  /** 本文（段 5 の文書の木。読む形は DocView） */
  doc: Doc;
}

export function PageView({
  place,
  title,
  desc,
  acts,
  must = false,
  bands,
  foot,
  moreOpen = false,
  doc,
}: PageViewProps) {
  return (
    <article className="k-f9-card" aria-labelledby="kn-title">
      <header className="k-f9-phead">
        <Place place={place} />
        <PageActs acts={acts} moreOpen={moreOpen} />
      </header>
      <h1 id="kn-title" className="k-f9-title">
        {title}
      </h1>
      <p className="k-f9-desc">
        <span className="k-f9-desc-l">1 行の説明</span>
        {desc}
      </p>
      {must ? (
        <p className="k-f9-mustline">
          <ShieldCheck size={14} aria-hidden="true" />
          必ず守る：AI に毎回このページを全部渡します。チケットの確認項目にも入ります。
        </p>
      ) : null}
      {bands ? <div className="k-f9-bands">{bands}</div> : null}
      <DocView doc={doc} />
      <footer className="k-f9-pfoot">{foot}</footer>
    </article>
  );
}

// ---------------------------------------------------------------- ページ（書いている）
export interface PageEditProps {
  place: PagePlace;
  title: string;
  desc: string;
  saved: string;
  /** 本文（段 5 の文書の木。書く形は DocEditor） */
  doc: Doc;
}

/** 書いている所。枠に色は付けない。道具の帯・自動保存・「やめる」「書き終える」だけ（段 5 の本文と同じ書き心地） */
export function PageEdit({ place, title, desc, saved, doc }: PageEditProps) {
  return (
    <article className="k-f9-card" aria-label="ページを書いている">
      <header className="k-f9-phead">
        <Place place={place} />
        <div className="k-f9-acts">
          <span className="k-f9-saved" role="status">
            {saved}
          </span>
          <Button variant="outlined" size="sm">
            やめる
          </Button>
          <Button size="sm">書き終える</Button>
        </div>
      </header>
      <div className="k-f9-editfields">
        <TextField label="題名" name="kn_title" value={title} readOnly required />
        <TextField
          label="1 行の説明"
          name="kn_desc"
          value={desc}
          readOnly
          description="AI は毎回、題名とこの 1 行だけを読み、要るときにページを開きます。何が書いてあるページかを 1 行で。"
        />
      </div>
      <DocEditor doc={doc} onChange={noop} />
    </article>
  );
}

// ---------------------------------------------------------------- ページの帯
/** 上の棚に上げるのを頼んだ（承認待ち） */
export function WaitingBand({ to, who, at }: { to: string; who: string; at: string }) {
  return (
    <Band
      tone="wait"
      title={`${to}の棚に上げるのを頼んでいます`}
      sub={`${who}の承認を待っています ・ ${at} に頼んだ`}
      acts={
        <Button variant="outlined" size="sm">
          取り下げる
        </Button>
      }
    />
  );
}

/** 断られた（理由つき） */
export function DeclinedBand({ to, who, at, reason }: { to: string; who: string; at: string; reason: string }) {
  return (
    <Band
      tone="danger"
      title={`${to}の棚に上げるのを断られました`}
      sub={`${who} ・ ${at}`}
      acts={
        <>
          <Button variant="outlined" size="sm">
            このお知らせを消す
          </Button>
          <Button variant="outlined" size="sm">
            直してもう一度頼む
          </Button>
        </>
      }
    >
      <p className="k-f9-reason">
        <b>理由</b>
        {reason}
      </p>
    </Band>
  );
}

/** 写し（どのページの写しかを出す。必ず守るのページは写しても上が効く） */
export function CopyBand({ from, must }: { from: string; must: boolean }) {
  return (
    <Band
      tone="info"
      title={`${from}の写しです`}
      sub="自分用に直せます。直しても、元のページは変わりません。"
      acts={
        <Button variant="outlined" size="sm">
          元のページを開く
        </Button>
      }
    >
      {must ? (
        <p className="k-f9-reason">
          <b>上が効きます</b>
          元のページは「必ず守る」です。この写しと食い違う所は、会社のページが効きます。
        </p>
      ) : null}
    </Band>
  );
}

/** ほかのグループから共有されたページ（読むだけ） */
export function SharedBand({ from, writer }: { from: string; writer: string }) {
  return (
    <Band
      tone="plain"
      title={`${from}から共有されたページです`}
      sub={`元は 1 つです。${from}で直すと、ここにも同じ内容が出ます。直せるのは${writer}です。`}
    />
  );
}

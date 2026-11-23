"use client";
// 段 5 の下絵の作り直し（項目の表＋自由な本文＋確認項目・2026-11-21）。本番と同じ部品（components/k・features/F4/doc）で並べる。1 つの id ＝ 1 つの状態。
//   状態の並びは { id, screen, label, ticket, leaf } の順と引用符を崩さない（機械が読む）
import type { ReactNode } from "react";
import type { Theme } from "@/lib/theme";
import { Frame } from "../f4/frame";
import { CreateForm, BodyView, FreeDoc, Results, SPEC_LINES, SPEC_DETAIL } from "@/features/F4/doc/views";
import type { SpecLine } from "@/features/F4/doc/views";
import {
  CompleteDialog,
  DetailPage,
  EditBand,
  NoSpecsDialog,
  SpecAddDialog,
  VersionsHead,
  VersionsView,
} from "@/features/F4/doc/detail-views";
import "@/features/F4/create-ticket/create-ticket.css";
import { renderMore } from "./more-mocks";

export interface MockEntry {
  id: string;
  screen: "tickets";
  label: string;
  ticket: string;
  leaf: string;
}

// prettier-ignore
export const MOCKS: readonly MockEntry[] = [
  { id: "f4v2-create-template", screen: "tickets", label: "作る面：種別を選んだ直後（ひな形）", ticket: "K-442", leaf: "K-442" },
  { id: "f4v2-create-free", screen: "tickets", label: "作る面：本文を自由に書いた", ticket: "K-442", leaf: "K-442" },
  { id: "f4v2-create-long", screen: "tickets", label: "作る面：本文を長く書いたとき", ticket: "K-442", leaf: "K-442" },
  { id: "f4v2-create-blank", screen: "tickets", label: "作る面：ひな形を消して白紙から自由に書いた", ticket: "K-442", leaf: "K-442" },
  { id: "f4v2-create-custom", screen: "tickets", label: "作る面：会社が足した項目（7 つの型）", ticket: "K-569", leaf: "K-569" },
  { id: "f4v2-create-missing", screen: "tickets", label: "作る面：必須が足りない", ticket: "K-569", leaf: "K-569" },
  { id: "f4v2-detail-new", screen: "tickets", label: "詳細：作った直後（結果の場所は出ていない）", ticket: "K-571", leaf: "K-571" },
  { id: "f4v2-detail-worked", screen: "tickets", label: "詳細：AI や人が進めた後（成果物・決定ログ・申し送り）", ticket: "K-571", leaf: "K-571" },
  { id: "f4v2-detail-editing", screen: "tickets", label: "詳細：本文を直している", ticket: "K-447", leaf: "K-447" },
  { id: "f4v2-specs", screen: "tickets", label: "詳細：項目の「確認項目」を開いた形", ticket: "K-450", leaf: "K-450" },
  { id: "f4v2-spec-add", screen: "tickets", label: "確認項目を足す小窓", ticket: "K-450", leaf: "K-450" },
  { id: "f4v2-detail-thread", screen: "tickets", label: "詳細：やり取りに更新の行が並ぶ", ticket: "K-574", leaf: "K-574" },
  { id: "f4v2-complete", screen: "tickets", label: "完了にする小窓（未チェックが残っている）", ticket: "K-572", leaf: "K-572" },
  { id: "f4v2-nospecs", screen: "tickets", label: "「AI に任せる」を押したが確認項目が 0 件", ticket: "K-573", leaf: "K-573" },
  { id: "f4v2-versions", screen: "tickets", label: "版と差分（本文）", ticket: "K-449", leaf: "K-449" },
  { id: "f4v2-versions-items", screen: "tickets", label: "版と差分（項目の変更）", ticket: "K-449", leaf: "K-449" },
  // 葉を書く途中で出た「下絵に無い小さな画面」を足した状態（2026-11-22・描き分けは ./more-mocks.tsx）
  { id: "f4v2-body-read", screen: "tickets", label: "詳細：本文を読む形（長い本文・表・画像・チェックの箱）", ticket: "K-577", leaf: "K-577" },
  { id: "f4v2-create-head", screen: "tickets", label: "作る面：頭（作り方・下書きの保存の状態・下書きのまま閉じる）", ticket: "K-442", leaf: "K-442" },
  { id: "f4v2-create-group", screen: "tickets", label: "作る面：グループの欄（書けるグループが 2 つ以上の人）", ticket: "K-442", leaf: "K-442" },
  { id: "f4v2-create-missing-types", screen: "tickets", label: "作る面：必須が空の型ごとの誤りの文（7 つの型）", ticket: "K-569", leaf: "K-569" },
  { id: "f4v2-detail-item-edit", screen: "tickets", label: "詳細：会社の項目の値をその場で直している", ticket: "K-569", leaf: "K-569" },
  { id: "f4v2-detail-item-error", screen: "tickets", label: "詳細：会社の項目を直して断られた（空・選び直し）", ticket: "K-569", leaf: "K-569" },
  { id: "f4v2-spec-edit", screen: "tickets", label: "詳細：確認項目の文をその場で直している（チェックの付いた行は直せない）", ticket: "K-450", leaf: "K-450" },
  { id: "f4v2-spec-add-error", screen: "tickets", label: "確認項目を足す小窓：書かずに足した", ticket: "K-450", leaf: "K-450" },
  { id: "f4v2-create-specs", screen: "tickets", label: "作る面：確認項目のチェックの箱は押せない形", ticket: "K-450", leaf: "K-450" },
  { id: "f4v2-detail-more", screen: "tickets", label: "詳細：題の行の「…」とグループの行", ticket: "K-571", leaf: "K-571" },
  { id: "f4v2-detail-empty", screen: "tickets", label: "詳細：本文が空のとき", ticket: "K-571", leaf: "K-571" },
  { id: "f4v2-detail-edit-enter", screen: "tickets", label: "詳細：本文を直す入口", ticket: "K-447", leaf: "K-447" },
  { id: "f4v2-detail-edit-discard", screen: "tickets", label: "詳細：本文を直している・やめるの確かめの小窓", ticket: "K-447", leaf: "K-447" },
  { id: "f4v2-detail-edit-conflict", screen: "tickets", label: "詳細：本文を直している・先にほかの人が直した帯", ticket: "K-447", leaf: "K-447" },
  { id: "f4v2-detail-edit-session", screen: "tickets", label: "詳細：本文を直している・ログインが切れた帯", ticket: "K-447", leaf: "K-447" },
  { id: "f4v2-detail-edit-failed", screen: "tickets", label: "詳細：本文を直している・自動で保存できない・口の断り", ticket: "K-447", leaf: "K-447" },
  { id: "f4v2-versions-items-restored", screen: "tickets", label: "版と差分：項目を戻した後（戻せなかった項目の並び）", ticket: "K-579", leaf: "K-579" },
  { id: "f4v2-create-links", screen: "tickets", label: "作る面：つながりを足した後の並び", ticket: "K-580", leaf: "K-580" },
  { id: "f4v2-create-link-add", screen: "tickets", label: "作る面：つながりを足す小窓（相手を探して選ぶ）", ticket: "K-580", leaf: "K-580" },
  { id: "f4v2-editor-image-off", screen: "tickets", label: "本文の道具：帯の全体（画像のボタンは押せない形）", ticket: "K-587", leaf: "K-587" },
  { id: "f4v2-editor-link", screen: "tickets", label: "本文の道具：リンクの入力", ticket: "K-567", leaf: "K-567" },
  { id: "f4v2-editor-link-error", screen: "tickets", label: "本文の道具：リンクの入力（使えない値）", ticket: "K-567", leaf: "K-567" },
  { id: "f4v2-editor-color", screen: "tickets", label: "本文の道具：文字の色の小さな画面", ticket: "K-568", leaf: "K-568" },
  { id: "f4v2-editor-table", screen: "tickets", label: "本文の道具：表のメニュー", ticket: "K-568", leaf: "K-568" },
  { id: "f4v2-editor-paste-fail", screen: "tickets", label: "本文の道具：Markdown を貼れなかったときのお知らせ", ticket: "K-568", leaf: "K-568" },
];

const CRUMBS = [{ label: "チケット", href: "/tickets" }, { label: "チケットを作る" }];

function Create({ theme, children }: { theme: Theme; children: ReactNode }) {
  return (
    <Frame theme={theme} crumbs={CRUMBS}>
      <div className="k-root">{children}</div>
    </Frame>
  );
}

const FILLED = "セイコー商事の 11 月分の請求書を送る";

export function MockView({ id, theme }: { id: string; theme: Theme }) {
  const detail = (
    extra?: ReactNode,
    dialog?: ReactNode,
    writing = false,
    acts?: ReactNode,
    specs: readonly SpecLine[] = SPEC_DETAIL,
    open = false,
    tab: "attr" | "talk" = "attr",
  ): ReactNode => (
    <DetailPage
      theme={theme}
      specs={specs}
      specsOpen={open}
      tab={tab}
      {...(dialog ? { dialog } : {})}
      {...(acts ? { acts } : {})}
    >
      {writing ? <EditBand /> : null}
      <BodyView writing={writing}>
        <FreeDoc writing={writing} />
      </BodyView>
      {extra}
    </DetailPage>
  );
  switch (id) {
    case "f4v2-create-template":
      return (
        <Create theme={theme}>
          <CreateForm titleValue={FILLED} body="template" />
        </Create>
      );
    case "f4v2-create-free":
      return (
        <Create theme={theme}>
          <CreateForm titleValue={FILLED} body="free" specs={SPEC_LINES} />
        </Create>
      );
    case "f4v2-create-long":
      return (
        <Create theme={theme}>
          <CreateForm titleValue={FILLED} body="long" specs={SPEC_LINES} />
        </Create>
      );
    case "f4v2-create-blank":
      return (
        <Create theme={theme}>
          <CreateForm titleValue={FILLED} body="blank" specs={SPEC_LINES.slice(0, 2)} />
        </Create>
      );
    case "f4v2-create-custom":
      return (
        <Create theme={theme}>
          <CreateForm titleValue={FILLED} body="free" specs={SPEC_LINES} allCustom />
        </Create>
      );
    case "f4v2-create-missing":
      return (
        <Create theme={theme}>
          <CreateForm
            body="template"
            errors={{ title: "題名を書いてください", due: "支払期日を選んでください", pj: "PJコードを選んでください" }}
          />
        </Create>
      );
    case "f4v2-detail-new":
      return detail();
    case "f4v2-detail-worked":
      return detail(<Results />);
    case "f4v2-detail-editing":
      return detail(undefined, undefined, true, <></>);
    case "f4v2-specs":
      return detail(undefined, undefined, false, undefined, SPEC_DETAIL, true);
    case "f4v2-spec-add":
      return detail(undefined, <SpecAddDialog />, false, undefined, SPEC_DETAIL, true);
    case "f4v2-detail-thread":
      return detail(undefined, undefined, false, undefined, SPEC_DETAIL, true, "talk");
    case "f4v2-complete":
      return detail(undefined, <CompleteDialog />);
    case "f4v2-nospecs":
      return detail(undefined, <NoSpecsDialog />, false, undefined, [], true);
    case "f4v2-versions":
    case "f4v2-versions-items":
      return (
        <Frame
          theme={theme}
          crumbs={[{ label: "チケット", href: "/tickets" }, { label: "EG-119" }, { label: "版と差分" }]}
        >
          <div className="k-root k-page">
            <VersionsHead />
            <VersionsView field={id === "f4v2-versions" ? "本文" : "項目の変更"} />
          </div>
        </Frame>
      );
    default:
      return renderMore(id, theme) ?? <p>この状態はまだありません：{id}</p>;
  }
}

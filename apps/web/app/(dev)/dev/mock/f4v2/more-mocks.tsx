"use client";
// 段 5 の下絵 v2 に足した状態の描き分け（2026-11-22・葉を書く途中で出た「下絵に無い小さな画面」）。持っていない id は null を返す。
//   本物と同じ部品（components/k・features/F4/doc）に決めた値を渡して並べるだけ。口は呼ばない。状態の一覧は ./mocks.tsx の MOCKS
import { Bot } from "lucide-react";
import type { ReactNode } from "react";
import type { Theme } from "@/lib/theme";
import { Button } from "@/components/k";
import { Frame, Toast } from "../f4/frame";
import { InertButton } from "@/features/F4/create-ticket/detail-head";
import { MoreMenu } from "@/features/F4/detail-more/views";
import { BodyView, CreateForm, FreeDoc, SPEC_DETAIL, SPEC_LINES } from "@/features/F4/doc/views";
import { DetailPage, VersionsHead, VersionsView } from "@/features/F4/doc/detail-views";
import { EditorDemo, type EditorPiece } from "@/features/F4/doc/editor-views";
import {
  CHOSEN,
  ChosenLinks,
  CreateHeadFull,
  CreateLinkAddDialog,
  GroupField,
  RequiredTypes,
} from "@/features/F4/doc/create-views";
import {
  ConflictBand,
  DiscardDialog,
  EditBandMark,
  EnterButton,
  FailBox,
  SessionLostBand,
  SpecAddErrorDialog,
  SpecsItemV3,
  itemOverrides,
} from "@/features/F4/doc/detail-extra";

const FILLED = "セイコー商事の 11 月分の請求書を送る";
const SAVED = "下書きを自動で保存しました（10:42）";
const CRUMBS = [{ label: "チケット", href: "/tickets" }, { label: "チケットを作る" }];
const EDITORS: Record<string, EditorPiece> = {
  "f4v2-editor-image-off": "base",
  "f4v2-editor-link": "link",
  "f4v2-editor-link-error": "link-error",
  "f4v2-editor-color": "color",
  "f4v2-editor-table": "table",
  "f4v2-editor-paste-fail": "paste-fail",
};

function create(theme: Theme, props: Partial<Parameters<typeof CreateForm>[0]> = {}, dialog?: ReactNode): ReactNode {
  return (
    <Frame theme={theme} crumbs={CRUMBS} dialog={dialog}>
      <div className="k-root">
        <CreateForm
          titleValue={FILLED}
          body="free"
          specs={SPEC_LINES}
          head={<CreateHeadFull saved={SAVED} />}
          {...props}
        />
      </div>
    </Frame>
  );
}

const DETAIL_ACTS = (
  <>
    <InertButton>複製</InertButton>
    <InertButton>版と差分</InertButton>
    <InertButton>
      <Bot size={13} aria-hidden="true" />
      AI に任せる
    </InertButton>
    <Button className="k-f4d-done">完了にする</Button>
  </>
);

interface DetailOpts {
  theme: Theme;
  dialog?: ReactNode;
  acts?: ReactNode;
  panel?: Parameters<typeof DetailPage>[0]["panel"];
  open?: boolean;
  body?: ReactNode;
  /** 本文の上に並べる帯・箱 */
  above?: ReactNode;
  writing?: boolean;
  enter?: ReactNode;
  empty?: boolean;
}

function detail(o: DetailOpts): ReactNode {
  const { theme, dialog, acts, panel, open = false, body, above, writing = false, enter, empty = false } = o;
  return (
    <DetailPage
      theme={theme}
      specs={SPEC_DETAIL}
      specsOpen={open}
      {...(dialog ? { dialog } : {})}
      {...(acts ? { acts } : {})}
      {...(panel ? { panel } : {})}
    >
      {above}
      <BodyView writing={writing} {...(enter ? { enter } : {})}>
        {empty ? <p className="k-f4d-hint">本文はまだ書かれていません</p> : (body ?? <FreeDoc writing={writing} />)}
      </BodyView>
    </DetailPage>
  );
}

const SPEC_EDIT_PANEL = {
  specsSlot: (
    <SpecsItemV3
      mode="detail"
      lines={SPEC_DETAIL}
      editing="送る前に文面を目で見る"
      editText="送る前に文面を目で見て、宛先を確かめる"
      compact
    />
  ),
};

export function renderMore(id: string, theme: Theme): ReactNode | null {
  const piece = EDITORS[id];
  if (piece) return create(theme, { editor: <EditorDemo piece={piece} /> });
  switch (id) {
    case "f4v2-create-head":
      return create(theme);
    case "f4v2-create-group":
      return create(theme, { group: <GroupField /> });
    case "f4v2-create-specs":
      return create(theme, { specsSlot: <SpecsItemV3 mode="create" lines={SPEC_LINES} /> });
    case "f4v2-create-missing-types":
      return create(theme, {
        titleValue: "",
        body: "template",
        specs: [],
        customSlot: <RequiredTypes />,
        errors: { title: "題名を書いてください" },
      });
    case "f4v2-create-links":
      return create(theme, { links: <ChosenLinks rows={CHOSEN} /> });
    case "f4v2-create-link-add":
      return create(
        theme,
        { links: <ChosenLinks rows={CHOSEN.slice(0, 1)} /> },
        <CreateLinkAddDialog title={FILLED} />,
      );
    case "f4v2-detail-item-edit":
      return detail({ theme, panel: { overrides: itemOverrides("edit") } });
    case "f4v2-detail-item-error":
      return detail({ theme, panel: { overrides: itemOverrides("error") } });
    case "f4v2-spec-edit":
      return detail({ theme, open: true, panel: SPEC_EDIT_PANEL });
    case "f4v2-spec-add-error":
      return detail({ theme, open: true, dialog: <SpecAddErrorDialog /> });
    case "f4v2-detail-more":
      return detail({
        theme,
        panel: { group: true },
        acts: (
          <>
            {DETAIL_ACTS}
            <MoreMenu defaultOpen />
          </>
        ),
      });
    case "f4v2-body-read":
      return detail({ theme, body: <FreeDoc long /> });
    case "f4v2-detail-empty":
      return detail({ theme, empty: true, enter: <EnterButton /> });
    case "f4v2-detail-edit-enter":
      return detail({ theme, enter: <EnterButton /> });
    case "f4v2-detail-edit-discard":
      return detail({ theme, writing: true, acts: <></>, above: <EditBandMark />, dialog: <DiscardDialog /> });
    case "f4v2-detail-edit-conflict":
      return detail({
        theme,
        writing: true,
        acts: <></>,
        above: (
          <>
            <EditBandMark />
            <ConflictBand />
          </>
        ),
      });
    case "f4v2-detail-edit-session":
      return detail({
        theme,
        writing: true,
        acts: <></>,
        above: (
          <>
            <EditBandMark />
            <SessionLostBand />
          </>
        ),
      });
    case "f4v2-detail-edit-failed":
      return detail({
        theme,
        writing: true,
        acts: <></>,
        above: (
          <>
            <EditBandMark failed />
            <FailBox />
          </>
        ),
      });
    case "f4v2-versions-items-restored":
      return (
        <Frame
          theme={theme}
          crumbs={[{ label: "チケット", href: "/tickets" }, { label: "EG-119" }, { label: "版と差分" }]}
          dialog={<Toast title="項目の変更を版 2 の形に戻しました" />}
        >
          <div className="k-root k-page">
            <VersionsHead />
            <VersionsView field="項目の変更" restored />
          </div>
        </Frame>
      );
    default:
      return null;
  }
}

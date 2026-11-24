"use client";
// K-683 書いている画面。部品 PageEdit（page-views.tsx）に値と関数を渡す。状態と口は use-page-writing.ts、
//   書き終えるの前の小窓は差し込み口（publish-gate.tsx）、やめるの確かめと 401 の帯は write-dialogs.tsx。外枠・木は入れ物（K-682）のまま
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import type { Doc } from "@kaname/contracts";
import { NoticeBox, errorText } from "@/components/k";
import { PageEdit } from "./page-views";
import { usePublishGate } from "./publish-gate";
import { placeOf, type PageAnswer } from "./shape";
import { usePageWriting, type SavedKind } from "./use-page-writing";
import { DiscardDialog, DiscardPageDialog, LoginLostBand } from "./write-dialogs";

const EDIT_SEL = 'article[aria-label="ページを書いている"]';
const JST_TIME = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** 印の字（保存の前は口に在る下書きの時刻） */
export function savedLabel(kind: SavedKind, at: string | null): string {
  if (kind === "saving") return "保存しています…";
  if (kind === "failed") return "自動で保存できませんでした";
  if (!at) return "";
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? "" : `自動で保存しました（${JST_TIME.format(d)}）`;
}

/** 開いたとき本文に焦点を置く（本文の部品は遅れて読まれるので、出てくるまで待つ） */
function useFocusBody(): void {
  useEffect(() => {
    const find = () => document.querySelector<HTMLElement>(`${EDIT_SEL} [role="textbox"][aria-label="本文"]`);
    const now = find();
    if (now) {
      now.focus();
      return;
    }
    const obs = new MutationObserver(() => {
      const el = find();
      if (!el) return;
      obs.disconnect();
      el.focus();
    });
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);
}

export interface WritingPageProps {
  page: PageAnswer;
  setEditing: (on: boolean) => void;
  go: (href: string) => void;
  notify: (text: string) => void;
}

export function WritingPage({ page, setEditing, go, notify }: WritingPageProps) {
  const gate = usePublishGate();
  const path = usePathname();
  const w = usePageWriting({ page, gate, setEditing, go, notify });
  const { st } = w;
  useFocusBody();
  useEffect(() => {
    if (st.focusTitle) document.querySelector<HTMLElement>(`${EDIT_SEL} input[name="kn_title"]`)?.focus();
  }, [st.focusTitle]);

  const notice = st.loginLost ? (
    <LoginLostBand next={path ?? "/knowledge"} />
  ) : st.box ? (
    <NoticeBox>{errorText(st.box.code).entry.message}</NoticeBox>
  ) : null;
  const dialogProps = {
    busy: st.dialogBusy,
    errorCode: st.dialogBox,
    onKeep: w.keepWriting,
    onDiscard: () => void w.discard(),
  };
  return (
    <>
      <PageEdit
        place={placeOf(page)}
        title={st.fields.title}
        desc={st.fields.desc}
        doc={st.fields.doc}
        saved={savedLabel(st.saved, st.savedAt)}
        savedKind={st.saved}
        titleError={st.titleError}
        busy={st.busy}
        doneDisabled={st.conflict}
        notice={notice}
        onTitle={(v) => w.change("title", v)}
        onDesc={(v) => w.change("desc", v)}
        onDoc={(d: Doc) => w.change("doc", d)}
        onCancel={w.cancel}
        onFinish={() => void w.finish()}
      />
      <DiscardDialog open={st.dialog === "discard"} {...dialogProps} />
      <DiscardPageDialog open={st.dialog === "discard-page"} {...dialogProps} />
      {gate.dialog}
    </>
  );
}

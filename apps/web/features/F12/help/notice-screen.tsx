"use client";
// お知らせ 1 件（K-956・道 /notices/[id]）。1 件を読む口は無いので、一覧の答え（鍵を分け合う・一覧から来たら読み直さない）から id で選ぶ。
//   見た目はモック /dev/mock/f12-user/uh-notice と同じ部品（views.tsx の NoticeDetail）。
//   無い・見えないお知らせは見つからない（E-PAGE-001）で、読んだ印の口を呼ばない。在れば描いた後に読んだ印を 1 回（D-156.27）。
//   読んだ印が失敗しても中身は出し、「読みました」の行だけ出さない
import { useEffect, useState } from "react";
import { ErrorState, Loading, PAGE_ERROR, PageBody } from "@/components/k";
import { TicketShell } from "@/features/F4/create-ticket/ticket-shell";
import { HELP_CRUMBS } from "./help-screen";
import { noticeDetailView } from "./help-shape";
import { useMarkRead, useNotices } from "./use-help";
import { HelpHome, NoticeDetail } from "./views";

export function NoticeScreen({ id }: { id: string }) {
  const notices = useNotices();
  const found = notices.data?.find((n) => n.id === id);
  const { mark, tried, done, status } = useMarkRead(id);
  // 前に開いて済んでいれば読んだ印は付いている（呼び直さない）
  const [readBefore] = useState(done);
  const read = readBefore || status === "success";

  useEffect(() => {
    if (!found || tried()) return;
    mark();
  }, [found, mark, tried]);

  const crumbs = found ? [...HELP_CRUMBS, { label: found.title }] : HELP_CRUMBS;
  let body;
  if (notices.isError)
    body = <HelpHome notices={[]} statuses={[]} inquiries={[]} failed onRetry={() => void notices.refetch()} />;
  else if (!notices.isSuccess) body = <Loading />;
  else if (!found)
    body = (
      <PageBody labelledBy="notice-missing">
        <div className="k-uh-top">
          <ErrorState code={PAGE_ERROR.notFound} acts={["/notices"]} heading={1} />
        </div>
      </PageBody>
    );
  else body = <NoticeDetail n={noticeDetailView(found)} backHref="/notices" read={read} />;
  return (
    <TicketShell screen="notices" crumbs={crumbs}>
      {body}
    </TicketShell>
  );
}

// お知らせ 1 件（K-956・道 /notices/[id]）。中身は apps/web/features/F12/help/notice-screen.tsx
import { NoticeScreen } from "@/features/F12/help/notice-screen";

export default async function Notice({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <NoticeScreen id={id} />;
}

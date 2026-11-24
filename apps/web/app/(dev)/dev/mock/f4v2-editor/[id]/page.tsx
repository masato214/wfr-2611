import { Suspense } from "react";
import { cookies } from "next/headers";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";
import { LiveView } from "../live";

// 本文の道具の部品（本物）を置いた開発用の頁（K-567）。LIVE_PAGES に無い id は「この状態はまだありません」
export default async function MockF4V2EditorState({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <div data-mock={id}>
      <Suspense>
        <LiveView id={id} theme={theme} />
      </Suspense>
    </div>
  );
}

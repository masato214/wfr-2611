// ナレッジ（K-682・画面 knowledge）：木だけ（ページを開いていない）。中身は apps/web/features/F9/knowledge/。
//   (work)＝PC をつないでいなくても書ける（D-127.8）。役が合わない人には入れ物が「いまの権限では開けません」を出す
import { KnowledgePage } from "@/features/F9/knowledge/knowledge-page";

export default function Knowledge() {
  return <KnowledgePage />;
}

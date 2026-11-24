// ナレッジのページを開く（K-682・/knowledge/<ページの id>）。書いている間も同じ道（書いているかは口の答えと入れ物が決める）
import { KnowledgePage } from "@/features/F9/knowledge/knowledge-page";

export default async function KnowledgePageRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <KnowledgePage pageId={id} />;
}

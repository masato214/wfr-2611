import { PageBody, PageHeader } from "@/components/k/page";

// 運営のワークスペース（K-946 は見出しだけの入れ物。本文の一覧は K-965）
export default function OpsHomePage() {
  return (
    <PageBody labelledBy="ops-home-title">
      <PageHeader id="ops-home-title" title="ワークスペース" />
    </PageBody>
  );
}

// メンバー（K-420・members）。ワークスペースの管理の中の 1 画面：人の並びと「＋ 招く」。中身は apps/web/features/F10/invite/（D-148.1）。
//   チケット・承認待ちと同じ (work)＝はじめの設定の門の外：PC をつないでいなくても人は招ける。
//   見られない役の人には「いまの権限では開けません」と導線（RequireRole・screen-derivation §6）
import { RequireRole } from "@/lib/auth/role";
import { MembersPage } from "@/features/F10/invite/members-page";

export default function Members() {
  return (
    <RequireRole screen="members">
      <MembersPage />
    </RequireRole>
  );
}

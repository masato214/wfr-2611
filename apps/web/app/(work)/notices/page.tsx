// 困ったとき・お知らせ（K-956・画面 notices）。中身は apps/web/features/F12/help/。ログイン前の /help（K-315）とは別の道
import { HelpScreen } from "@/features/F12/help/help-screen";

export default function Notices() {
  return <HelpScreen />;
}

"use client";
// 段 3（F2 招かれて参加する）の詳細のモック（部品先行・枝 c/段3）。本番と同じ部品（features/F2/invite/views.tsx・components/k）を、決めた値で並べる。
//   1 つの id ＝ 1 つの状態。状態と葉の対応の正本は 07_functional/段3-F2/切り方.md のモックの欄
import { CATALOG } from "@kaname/errors/catalog";
import { INVITE_NOTICE, InviteAccept, InviteConfirm, type InvitePreview } from "@/features/F2/invite/views";

const msg = (id: string, fallback: string): string => CATALOG[id as keyof typeof CATALOG]?.message ?? fallback;

const PV: InvitePreview = {
  workspaceName: "株式会社ENGINE BASE",
  inviterName: "高本 聖斗",
  groupName: "経理グループ",
  role: "member",
  message: "経理の月次をいっしょに回してもらいます。よろしくお願いします",
  email: "kimura@engine-base.example",
  expiresOn: "11/25",
};
const LOGIN = "/login?next=%2Finvite%2Fmock-token";
/** 招待のリンク（宛てのメールを持たない・K-421）。下見の email が null → 画面の言葉では空 */
const LINK: InvitePreview = { ...PV, email: "" };
/** 確認のメールを送った宛て（K-422 の答えの伏せたメール） */
const SENT_TO = "ki****@engine-base.example";

export interface MockEntry {
  id: string;
  screen: "invite-accept";
  label: string;
  ticket: string;
}

export const MOCKS: readonly MockEntry[] = [
  { id: "inv-new", screen: "invite-accept", label: "新しく作って参加", ticket: "K-335" },
  { id: "inv-new-error", screen: "invite-accept", label: "入力の誤り", ticket: "K-335" },
  {
    id: "inv-new-nomsg",
    screen: "invite-accept",
    label: "ひとことの無い招待・グループを決めていない・閲覧のみ",
    ticket: "K-335",
  },
  { id: "inv-account", screen: "invite-accept", label: "アカウントがある：ログインして参加", ticket: "K-336" },
  { id: "inv-signed", screen: "invite-accept", label: "ログイン中・同じメール：今のアカウントで参加", ticket: "K-336" },
  { id: "inv-other", screen: "invite-accept", label: "ログイン中・別のメール宛て", ticket: "K-336" },
  { id: "inv-member", screen: "invite-accept", label: "もう入っている", ticket: "K-336" },
  { id: "inv-expired", screen: "invite-accept", label: "期限切れ：送り直しを頼む", ticket: "K-335" },
  { id: "inv-resent", screen: "invite-accept", label: "送り直しを頼みました", ticket: "K-335" },
  { id: "inv-resent-already", screen: "invite-accept", label: "今日はもう頼んである", ticket: "K-335" },
  { id: "inv-revoked", screen: "invite-accept", label: "取り消された", ticket: "K-335" },
  { id: "inv-used", screen: "invite-accept", label: "もう使われた", ticket: "K-335" },
  { id: "inv-notfound", screen: "invite-accept", label: "見つからない", ticket: "K-335" },
  { id: "inv-wait", screen: "invite-accept", label: "送りすぎ（あと何秒）", ticket: "K-335" },
  { id: "inv-down", screen: "invite-accept", label: "Kaname の調子が悪い", ticket: "K-335" },
  // 招待のリンクで新しく入る人（確認のメールを押すまで参加は決まらない・D-148.51・PM の決め：正の絵は本番の部品でここに足す）
  { id: "inv-link-new", screen: "invite-accept", label: "リンクの招待：メールも書いて参加", ticket: "K-423" },
  { id: "inv-link-error", screen: "invite-accept", label: "リンクの招待：メールが空", ticket: "K-423" },
  { id: "inv-link-sent", screen: "invite-accept", label: "リンクの招待：確認のメールを送りました", ticket: "K-423" },
  {
    id: "inv-link-failed",
    screen: "invite-accept",
    label: "リンクの招待：確認のメールを送れなかった",
    ticket: "K-423",
  },
  { id: "inv-confirm", screen: "invite-accept", label: "確認の画面：参加を決める", ticket: "K-423" },
  { id: "inv-confirm-expired", screen: "invite-accept", label: "確認の画面：期限切れ", ticket: "K-423" },
  { id: "inv-confirm-used", screen: "invite-accept", label: "確認の画面：もう使った", ticket: "K-423" },
  { id: "inv-confirm-down", screen: "invite-accept", label: "確認の画面：調子が悪い（押し直せる）", ticket: "K-423" },
];

export function MockView({ id }: { id: string }) {
  switch (id) {
    case "inv-new":
      return <InviteAccept state="new" preview={PV} loginHref={LOGIN} />;
    case "inv-new-error":
      return (
        <InviteAccept
          state="new"
          preview={PV}
          loginHref={LOGIN}
          errors={{
            name: msg("E-VAL-007", "お名前を入れてください"),
            password: msg("E-VAL-005", "パスワードは 12 文字以上にしてください"),
          }}
        />
      );
    case "inv-new-nomsg":
      return (
        <InviteAccept
          state="new"
          preview={{ ...PV, message: null, groupName: null, role: "viewer" }}
          loginHref={LOGIN}
        />
      );
    case "inv-account":
      return <InviteAccept state="account" preview={PV} loginHref={LOGIN} />;
    case "inv-signed":
      return <InviteAccept state="signed" preview={PV} />;
    case "inv-other":
      return <InviteAccept state="other" preview={{ ...PV, signedInEmail: "takamoto@engine-base.example" }} />;
    case "inv-member":
      return <InviteAccept state="member" preview={PV} openHref="/" />;
    case "inv-expired":
      return <InviteAccept state="expired" preview={PV} />;
    case "inv-resent":
      return <InviteAccept state="resent" preview={PV} />;
    case "inv-resent-already":
      return <InviteAccept state="resent-already" preview={PV} />;
    case "inv-revoked":
      return <InviteAccept state="revoked" preview={PV} />;
    case "inv-used":
      return <InviteAccept state="used" preview={PV} />;
    case "inv-notfound":
      return <InviteAccept state="notfound" />;
    case "inv-wait":
      return <InviteAccept state="wait" waitSec={42} />;
    case "inv-down":
      return <InviteAccept state="down" />;
    case "inv-link-new":
      return <InviteAccept state="new" preview={LINK} loginHref={LOGIN} />;
    case "inv-link-error":
      return (
        <InviteAccept
          state="new"
          preview={LINK}
          loginHref={LOGIN}
          errors={{ email: msg("E-INV-016", "メールアドレスを入れてください") }}
        />
      );
    case "inv-link-sent":
      return <InviteAccept state="sent" preview={LINK} sentEmail={SENT_TO} />;
    case "inv-link-failed":
      return <InviteAccept state="new" preview={LINK} loginHref={LOGIN} notice={INVITE_NOTICE.confirmFailed} />;
    case "inv-confirm":
      return <InviteConfirm state="ready" />;
    case "inv-confirm-expired":
      return (
        <InviteConfirm
          state="closed"
          message={msg(
            "E-INV-014",
            "確認のリンクの期限（24 時間）が過ぎました。招待のリンクから、もう一度参加してください",
          )}
        />
      );
    case "inv-confirm-used":
      return (
        <InviteConfirm
          state="closed"
          login
          message={msg("E-INV-015", "この確認のリンクはもう使われています。ログインして入ってください")}
        />
      );
    case "inv-confirm-down":
      return <InviteConfirm state="ready" notice={msg("E-PAGE-003", INVITE_NOTICE.down)} />;
    default:
      return <p>この状態はありません：{id}</p>;
  }
}

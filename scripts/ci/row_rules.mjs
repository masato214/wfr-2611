// 行に結ぶ言葉の確かめ（K-15・ZT4・D-128.88・D-128.115）。契約の生成（contract.mjs）が読み、ENDPOINTS の perm.row に出す。
//   入口（apps/api/src/contract/op.ts の 4.1）は、:id の行を行の守り（RLS）の中で読み、
//     見えなければ 404（無いのと同じ）・見えても下の条件に合わなければ 403。
//   条件は SQL の式で、:id の表の行の列をそのまま書く（`select (式) from 表 where id = $1` で確かめる）。
//   app.user_id() が呼んだ人。app.manages_scope(グループ) は、そのグループ（か上のグループ）のマネージャーか管理者（0082）。
//   ★ここに無い組み合わせは契約の生成で赤になる（行に結ぶ口は全部、どの表のどの列で確かめるかを持つ）。
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const ROW_WORDS = ["self", "read", "write", "assignee", "approver", "recipient", "manager"];

/** path の :id が指す表（path の :id の前の段）。段の名前が表の名前と違うものだけ書く */
export const ID_TABLE = {
  "/api/v1/work_types": "skills",
  "/api/v1/rules": "policies",
  "/api/v1/bridge/devices": "sessions",
  "/api/v1/me/sessions": "sessions",
  "/api/v1/me/workspaces": "tenant_memberships",
  "/api/v1/knowledge/proposals": "knowledge_page_versions",
  "/api/v1/knowledge_imports": "imports",
  "/api/v1/exports": "export_jobs",
};
/** 入口で行を読まない口（理由が必須）。認証の側の表など、public の表に無いもの */
export const ROW_EXEMPT = {
  "/api/v1/me/passkeys": "パスキーは認証の側の表（auth スキーマ・D-128.119）。本人の分だけを認証の仕組みが引く。入口は役（member）と本人確認の取り直しまで",
  "/api/v1/bridge/devices":
    "PC はアカウントのもの（D-128.137・D-128.156）。行の守り（sessions は今のワークスペースだけ見える）の中で読むと、別のワークスペースでつないだ自分の PC が 404 になる。持ち主の確かめは口の中（app.bridge_devices）と DB の関数（app.device_set_browser など・account_members）の 2 重（D-128.166・K-364）",
  "/api/v1/knowledge/folders":
    "ナレッジのフォルダの行の見える・書けるは、口が DB の関数 app.kfolder_visible（見えなければ 404）・app.kfolder_writable（見えて書けなければ 403）で決める。表を packages/db/src/repository.ts の TABLES に足すと、それを読む前からの試験が動くので入口では行を読まない（K-675）",
};
/** 入口の行の確かめから外す欄（口の名前 → 欄の名前 → 理由。理由が空なら外さない）。外すのは、道の :id の行を行の守り（RLS）の中で読む確かめだけ。
 *  口ごと外さない：ほかの口の :id と、ほかの欄の確かめは入口のまま。外した欄の守りは DB の関数が持つ（その口の実施事項に書く） */
export const ROW_EXEMPT_FIELDS = {
  deleteTicketLink: {
    id: "つながりの行は両端のチケットが両方見える人にしか見えない（行の守り ticket_links_both_read）ので、入口の行の確かめでは決めの「相手が見えなくても外せる」（外せるのは両端のどちらか 1 つに書ける人・K-441・PM の決め）が成り立たない。この欄の守りは DB の関数 app.ticket_link_remove（見える・書けるを確かめる）と契約の uuid の確かめの 1 層になる",
  },
};
const exemptField = (op, field) => {
  const why = ROW_EXEMPT_FIELDS[op]?.[field];
  return typeof why === "string" && why.trim() !== "";
};

const ME = "app.user_id()";
const TICKET_PEOPLE = (t) => `(${t}.assignee_member_id = ${ME} or ${t}.created_by = ${ME} or app.manages_scope(${t}.scope_id))`;
const VIA_TICKET = (col = "ticket_id") => `exists (select 1 from tickets t where t.id = ${col} and ${TICKET_PEOPLE("t")})`;
const CLIENT_MANAGER = (cid) =>
  `(app.client_editable(${cid}) or exists (select 1 from client_groups g where g.client_id = ${cid} and g.deleted_at is null and app.manages_scope(g.scope_id)))`;

/** 言葉 → :id の表 → 条件。read は「行が見える」だけ（RLS の select がそのまま守り） */
export const RULES = {
  self: {
    artifact_versions: `owner_member_id = ${ME}`,
    artifacts: `owner_member_id = ${ME}`,
    sessions: `member_id = ${ME}`,
    conversations: `owner_member_id = ${ME}`,
    credentials: `owner_member_id = ${ME}`,
    export_jobs: `requested_by = ${ME}`,
    inquiries: `opened_by_member_id = ${ME}`,
    learning_candidates: `owner_member_id = ${ME}`,
    tenant_memberships: `member_id = ${ME}`,
    memories: `owner_member_id = ${ME}`,
    // 会話の中の発言から作る：自分の会話の発言だけ
    messages: `exists (select 1 from conversations c where c.id = conversation_id and c.owner_member_id = ${ME})`,
    notifications: `member_id = ${ME}`,
    // 保存した見方：作った人とマネージャー（D-128.119）
    saved_views: `(member_id = ${ME} or app.manages_scope(scope_id))`,
    ticket_imports: `uploaded_by = ${ME}`,
    ticket_messages: `author_member_id = ${ME}`,
    policies: `created_by = ${ME}`,
    skills: `owner_member_id = ${ME}`,
    // お知らせを読んだ印は自分の分（お知らせ自体は会社の全員が読める）
    notices: `true`,
  },
  read: {},
  write: {
    tickets: `app.ticket_writable(id)`,
    // 消したページは入口を通し、口が deleted_at is null つきの読みで 404 にする（入口で 403 にすると「消した → 404」が口に届かない・K-675）
    knowledge_pages: `(deleted_at is not null or app.kpage_writable(id))`,
    // 残りは 07_functional/entities.json の update の条件をそのまま使う（RLS と同じ式）
  },
  assignee: {
    // 担当者・作成者・マネージャー。戻すは消した本人も（D-128.84）
    tickets: `(${TICKET_PEOPLE("tickets")} or deleted_by = ${ME})`,
    acceptances: VIA_TICKET(),
    // 実行：始めた人・そのグループのマネージャー・その実行の承認のチケットの担当者
    action_runs: `(created_by = ${ME} or app.manages_scope(scope_id) or exists (select 1 from approvals a join tickets t on t.id = a.ticket_id where a.action_run_id = action_runs.id and t.assignee_member_id = ${ME}))`,
  },
  approver: {
    approvals: `approver_member_id = ${ME}`,
    // ③ 人の確認：そのチケットの承認を割り当てられた人
    checks: `exists (select 1 from approvals a where a.ticket_id = checks.ticket_id and a.approver_member_id = ${ME} and a.deleted_at is null)`,
  },
  recipient: {
    ticket_handovers: `to_member_id = ${ME}`,
  },
  manager: {
    // 取引先の担当・担当グループのマネージャー・管理者
    clients: CLIENT_MANAGER("clients.id"),
    client_contacts: CLIENT_MANAGER("client_contacts.client_id"),
  },
};
/** 口ごとに言葉の中の人が違うもの（screen_api.py の範囲の説明） */
export const OP_RULES = {
  // 承認する人・今の担当者・マネージャー・チケットの作った人・AI に任せた人（requested_by）。担当者とマネージャーは読むだけ（K-161・D-131）
  getApproval: `(approver_member_id = ${ME} or requested_by = ${ME} or app.ticket_assignee_is_me(ticket_id) or app.manages_scope(scope_id) or ${VIA_TICKET()})`,
  // 承認する人＝そのチケットの今の担当者だけ（K-162・D-128.25・D-128.138）。RULES.approver は替えない（ほかの口に効かせない）。
  //   関数 app.approval_decide も中で同じ判定をする（守りは 2 層）
  approveApproval: `app.ticket_assignee_is_me(ticket_id)`,
  // 差し戻す人も承認する人と同じ（今の担当者だけ・K-163）
  returnApproval: `app.ticket_assignee_is_me(ticket_id)`,
  // 承認する人・担当者・マネージャー
  stopApproval: `(approver_member_id = ${ME} or app.manages_scope(scope_id) or ${VIA_TICKET()})`,
  // 取り消せる業務の型は、見えるものなら誰でも自分用に複製できる
  copyWorkType: `true`,
  // 預けたログイン情報の上書き・消す：入口は「行が見える」だけ（個人は持ち主・ワークスペースは会社の全員・RLS の select）。
  //   ワークスペースの物を別の管理者が直す・消すので持ち主で絞らない。edit の判定（403・E-CRED-007）と、消した物・失効しただけの物の 404 は
  //   口（features/F3/credentials/update.ts・delete.ts）と DB の関数（app.credential_soft_delete・app.credential_cancel_checks）が持つ（K-353）
  updateCredential: `true`,
  deleteCredential: `true`,
  // 止まった AI の仕事を自分で直す：入口は「その実行が見える」だけ。担当者の判定（403・E-STP-001）と、消した・無い（404）は
  //   DB の関数 app.run_takeover と口（features/F7/stopped/takeover.ts）が持つ（K-485・K-353 の updateCredential と同じ作り）
  takeoverActionRun: `true`,
  // チケットを消す・消す前の下見：入口は「そのチケットが見える」だけ（行が見える＝tickets の行の守り・消した物は見えない）。
  //   作った人か、そのグループで tickets の edit を持つ人か（403・E-DEL-001）は口と DB の関数が持つ（K-487・K-488・P14）。
  //   入口が担当者・作成者・マネージャーで止めると、edit を持つ別の人が通れず、消せない訳の文（E-DEL-001）も入口の汎用の 403 に奪われる。
  //   deleteTicket の行は K-488 の口が入るまで 501 が先に返る
  previewTicketDelete: `true`,
  deleteTicket: `true`,
};

let ENT = null;
function updatePredicate(root, table) {
  if (!ENT) {
    const p = join(root, "07_functional/entities.json");
    const d = existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : [];
    ENT = new Map((Array.isArray(d) ? d : d.entities ?? []).map((x) => [x.name, x]));
  }
  const pol = (ENT.get(table)?.access_control_policies ?? []).find((x) => String(x.operation).split(",").map((o) => o.trim()).includes("update") && (x.role ?? "member") === "member");
  return pol?.predicate ?? null;
}

/** 口 1 本の行の確かめ。null＝行を読まない（:id が無い・言葉が行に結ばない）。{error} は契約の生成で赤 */
export function rowOf(root, e, word) {
  if (!ROW_WORDS.includes(word)) return null;
  const m = /^(.*?)\/:id(\/|$)/.exec(e.path);
  if (!m) return null; // 一覧・作る：行の守り（RLS）が絞る。作る先の確かめは RLS の insert
  if (exemptField(e.operationId, "id")) return null; // 欄で名指しして外した口の :id（ROW_EXEMPT_FIELDS）
  const base = m[1];
  if (ROW_EXEMPT[base]) return null;
  const table = ID_TABLE[base] ?? base.split("/").pop();
  if (word === "read") return { table, sql: "true" };
  const sql = OP_RULES[e.operationId] ?? RULES[word]?.[table] ?? (word === "write" ? updatePredicate(root, table) : null);
  if (!sql) return { error: `${e.method} ${e.path}（${e.operationId}）：言葉 ${word} を表 ${table} のどの列で確かめるかが無い（scripts/ci/row_rules.mjs）` };
  return { table, sql };
}

export const rulesSource = (root) => readFileSync(join(root, "scripts/ci/row_rules.mjs"), "utf8");

// 題名の下の帯（上げる・共有の頼みの承認待ち・断られた）（K-677 が置いた器・K-687 が中身を差し替えた）。
//   承認待ちの頼み（先頭 1 つ・共有で複数なら to_name を「・」でつなぐ）→ waiting：who_name＝承認する人（名前のコードポイント順の先頭・頼んだ人を除く）・
//   at＝頼んだ時刻・can_withdraw＝呼んだ人が頼んだ人。無ければ、呼んだ人が頼んで断られ帯を消していない最新の頼み → declined：
//   who_name＝断った人・at＝断った時刻・reason つき・can_withdraw false。それ以外 null
import type { PagePartCtx, PageRequest } from "./types.js";

interface PendingRow {
  readonly id: string;
  readonly kind: "raise" | "share";
  readonly to_name: string | null;
  readonly who_name: string | null;
  readonly requested_by: string;
  readonly created_at: Date;
}
interface DeclinedRow {
  readonly id: string;
  readonly kind: "raise" | "share";
  readonly to_name: string | null;
  readonly who_name: string | null;
  readonly decided_at: Date | null;
  readonly decline_reason: string | null;
}

const PENDING_SQL = `select r.id, r.kind, r.requested_by, r.created_at, app.kn_shelf_name(r.to_scope_id, false) as to_name,
       (select m.display_name from members m
         where m.id in (select app.kn_approvers_of(r.to_scope_id)) and m.id <> r.requested_by
         order by m.display_name collate "C", m.id limit 1) as who_name
  from knowledge_requests r
 where r.page_id = $1 and r.tenant_id = app.tenant_id() and r.state = 'pending' and r.deleted_at is null
 order by r.created_at, r.id`;
const DECLINED_SQL = `select r.id, r.kind, r.decided_at, r.decline_reason, app.kn_shelf_name(r.to_scope_id, false) as to_name,
       (select m.display_name from members m where m.id = r.decided_by) as who_name
  from knowledge_requests r
 where r.page_id = $1 and r.tenant_id = app.tenant_id() and r.state = 'declined' and r.dismissed_at is null
   and r.requested_by = $2 and r.deleted_at is null
 order by r.decided_at desc nulls last, r.created_at desc, r.id
 limit 1`;

function waitingOf(rows: readonly PendingRow[], memberId: string): PageRequest {
  const first = rows[0]!;
  const names =
    first.kind === "share" ? rows.filter((r) => r.kind === "share").map((r) => r.to_name ?? "") : [first.to_name ?? ""];
  return {
    id: first.id,
    kind: first.kind,
    state: "waiting",
    to_name: names.join("・"),
    who_name: first.who_name ?? "",
    at: first.created_at.toISOString(),
    reason: null,
    can_withdraw: first.requested_by === memberId,
  };
}

export async function readRequest(p: PagePartCtx): Promise<PageRequest | null> {
  const pending = (await p.cl.query<PendingRow>(PENDING_SQL, [p.page.id])).rows;
  if (pending.length > 0) return waitingOf(pending, p.memberId);
  const d = (await p.cl.query<DeclinedRow>(DECLINED_SQL, [p.page.id, p.memberId])).rows[0];
  if (!d) return null;
  return {
    id: d.id,
    kind: d.kind,
    state: "declined",
    to_name: d.to_name ?? "",
    who_name: d.who_name ?? "",
    at: (d.decided_at ?? new Date()).toISOString(),
    reason: d.decline_reason,
    can_withdraw: false,
  };
}

"""rls_policies.py — 表の形からの当てはめ（build_functional.py）では決まらない行の守り（RLS）を、表ごとに書く所（D-128.115）。

build_functional.py は ER 図の列の印（<scoped>・<common>・本人の列）から RLS を当てはめる。でも次の 2 つは形からは分からない：
  1) 子の表は親の見え方に従う（チケットの本文・版・分類は、元のチケットを読める人だけ）。会社の列だけ見ると、グループの外の人にも見えてしまう
  2) 関わっている人（担当者・承認する人・渡された相手）はグループの外でも読める
ここに書いた表は、当てはめの代わりにこの方針を entities.json に入れる（scripts/ci/gen_rls.py がそこから SQL を作る）。

述語の中の関数は migration で作る：
  app.ticket_visible(ticket_id)  … そのチケットを読めるか（会社の中・見える層か関わっている人）
  app.ticket_writable(ticket_id) … そのチケットに書けるか（その層の edit の権限か担当者）
★自分の表の読む守りに「id でその表を引く関数」を使わない。作ったその行は文の中でまだ見えないので、INSERT … RETURNING が弾かれる。
  自分の表は列で直接書き、関数は子の表（元の行を引く）に使う
"""

T = "current_setting('app.tenant_id', true)::uuid"
U = "current_setting('app.user_id', true)::uuid"
OPS_GRANT = lambda t: f"current_setting('app.role', true) = 'ops' AND EXISTS (SELECT 1 FROM support_access_grants g WHERE g.tenant_id = {t}.tenant_id AND g.expires_at > now() AND g.revoked_at IS NULL)"
SRC_T = ["D-128.115", "D-073.1", "D-128.88"]


def ops_read(t: str) -> dict:
    return {"name": f"{t}_ops_read_with_grant", "operation": "select", "role": "ops", "predicate": OPS_GRANT(t),
            "rationale": "運営は理由つき・1 時間・見るだけの許可があるときだけ（D-128.68）", "source": ["D-128.68"]}


def child_of_ticket(t: str, write_ops: str = "insert,update,delete") -> list[dict]:
    """チケットの子の表：元のチケットを読める人だけ読む・書ける人だけ書く"""
    pol = [{"name": f"{t}_ticket_read", "operation": "select", "role": "member", "predicate": f"tenant_id = {T} AND app.ticket_visible(ticket_id)",
            "rationale": "元のチケットを読める人だけ（グループの外の人・他の会社には見せない）", "source": SRC_T}]
    if write_ops:
        pol.append({"name": f"{t}_ticket_write", "operation": write_ops, "role": "member", "predicate": f"tenant_id = {T} AND app.ticket_writable(ticket_id)",
                    "rationale": "元のチケットに書ける人だけ", "source": SRC_T})
    return pol + [ops_read(t)]


def workspace_master(t: str) -> list[dict]:
    """ワークスペースで共通の決まり（種別・段・軸・渡すとき）：メンバーは読む・直すのはワークスペース全体の edit を持つ人（既定は管理者・D-125.66）"""
    return [{"name": f"{t}_tenant_read", "operation": "select", "role": "member", "predicate": f"tenant_id = {T}",
             "rationale": "ワークスペースのメンバーは読む（チケットを作る・絞る・渡すときに使う）", "source": ["D-125.67"]},
            {"name": f"{t}_permission_write", "operation": "insert,update,delete", "role": "member",
             "predicate": f"tenant_id = {T} AND has_permission({U}, '{t}', NULL, 'edit')",
             "rationale": "決まりを直せる人（ワークスペース全体の edit・既定は管理者）", "source": ["D-125.66", "D-128.97"]},
            ops_read(t)]


POLICIES: dict[str, list[dict]] = {
    # チケット：読む＝見える層か関わっている人／作る＝その層の edit／直す＝その層の edit か担当者／消す（行の削除）は誰もしない（論理削除だけ・D-128.84）
    "tickets": [
        {"name": "tickets_read", "operation": "select", "role": "member",
         "predicate": f"tenant_id = {T} AND deleted_at IS NULL AND app.ticket_draft_ok(draft_import_id, {U}) AND (scope_id = ANY(visible_scopes({U})) OR assignee_member_id = {U} OR app.ticket_involved(id, {U}))",
         "rationale": "そのグループを見られる人と、グループの外でも関わっている人（担当者・承認する人・渡された相手）。取り込みの下書きは確定まで取り込んだ人だけ。消したものは誰にも見えない（消すのは app.ticket_soft_delete・戻す画面は security definer の関数で読む）", "source": SRC_T + ["D-128.119", "D-128.158"]},
        {"name": "tickets_create", "operation": "insert", "role": "member",
         "predicate": f"tenant_id = {T} AND app.ticket_draft_ok(draft_import_id, {U}) AND has_permission({U}, 'tickets', scope_id, 'edit')",
         "rationale": "そのグループで書ける人だけが作る（自分を担当者にしても、書けないグループには作れない）。下書きは自分の取り込みにだけ入れる", "source": SRC_T + ["D-128.119"]},
        {"name": "tickets_update", "operation": "update", "role": "member",
         "predicate": f"tenant_id = {T} AND app.ticket_draft_ok(draft_import_id, {U}) AND (has_permission({U}, 'tickets', scope_id, 'edit') OR assignee_member_id = {U})",
         "rationale": "そのグループで書ける人と担当者（消す・戻すは論理削除で、ここを通る）", "source": SRC_T + ["D-128.84"]},
        {"name": "tickets_client_read", "operation": "select", "role": "client",
         "predicate": f"tenant_id = {T} AND client_id = app.my_client() AND deleted_at IS NULL AND draft_import_id IS NULL AND client_share <> '{{}}'::jsonb",
         "rationale": "取引先の人は、自分の取引先のチケットのうち会社が見せると決めたものだけ（どの項目を見せるかは API が client_share で絞る・D-125.122・D-128.100）。消したものは見えない（D-128.158）", "source": ["D-125.122", "D-128.100", "D-128.158"]},
        ops_read("tickets"),
    ],
    "ticket_sections": child_of_ticket("ticket_sections"),
    "ticket_section_versions": child_of_ticket("ticket_section_versions", "insert"),   # 版は追記だけ（直さない・消さない）
    "ticket_class_values": child_of_ticket("ticket_class_values"),
    "ticket_kinds": workspace_master("ticket_kinds"),
    "kind_sections": workspace_master("kind_sections"),
    "ticket_stages": workspace_master("ticket_stages"),
    "class_axes": workspace_master("class_axes"),
    "class_values": workspace_master("class_values"),
    "handover_rules": workspace_master("handover_rules"),
    "custom_fields": workspace_master("custom_fields"),
    "custom_field_kinds": workspace_master("custom_field_kinds"),
    "ticket_field_values": child_of_ticket("ticket_field_values"),
    # ---- チケットのまわり（K-4）
    "test_specs": child_of_ticket("test_specs"),
    "checks": child_of_ticket("checks", "insert"),                       # 検査の結果は追記だけ
    "ticket_decisions": child_of_ticket("ticket_decisions", "insert,update"),   # 決定は消さない（改めるだけ・D-125.63）
    "reference_logs": child_of_ticket("reference_logs", "insert"),       # 参照の記録は追記だけ
    "ticket_messages": [
        {"name": "ticket_messages_ticket_read", "operation": "select", "role": "member", "predicate": f"tenant_id = {T} AND app.ticket_visible(ticket_id)",
         "rationale": "元のチケットを読める人だけ", "source": SRC_T},
        {"name": "ticket_messages_post", "operation": "insert", "role": "member",
         "predicate": f"tenant_id = {T} AND app.ticket_visible(ticket_id) AND ((kind = 'post' AND author_member_id = {U}) OR (kind <> 'post' AND app.ticket_writable(ticket_id)))",
         "rationale": "読める人は本人として書き込める（@ された人・渡された相手も答えられる）。変更・仕組みの記録は書ける人の操作から", "source": SRC_T + ["D-125.29", "D-125.131"]},
        {"name": "ticket_messages_own_update", "operation": "update", "role": "member",
         "predicate": f"tenant_id = {T} AND author_member_id = {U} AND app.ticket_visible(ticket_id)",
         "rationale": "直せるのは書いた本人だけ", "source": ["D-125.29"]},
        ops_read("ticket_messages"),
    ],
    "ticket_links": [
        {"name": "ticket_links_both_read", "operation": "select", "role": "member",
         "predicate": f"tenant_id = {T} AND app.ticket_visible(from_ticket_id) AND app.ticket_visible(to_ticket_id)",
         "rationale": "両方のチケットを読める人だけ（見えないチケットがあることを、つながりから知らせない）", "source": SRC_T + ["D-128.80"]},
        {"name": "ticket_links_write", "operation": "insert,update,delete", "role": "member",
         "predicate": f"tenant_id = {T} AND app.ticket_writable(from_ticket_id) AND app.ticket_visible(to_ticket_id)",
         "rationale": "元のチケットに書けて、つなぐ先を読める人", "source": SRC_T + ["D-128.80"]},
        ops_read("ticket_links"),
    ],
    "ticket_handovers": [
        {"name": "ticket_handovers_read", "operation": "select", "role": "member",
         "predicate": f"tenant_id = {T} AND (app.ticket_visible(ticket_id) OR from_member_id = {U} OR to_member_id = {U} OR has_permission({U}, 'ticket_handovers', to_scope_id, 'edit'))",
         "rationale": "チケットを読める人・渡した人・受ける人・渡す先のグループのマネージャー", "source": SRC_T + ["D-125.70"]},
        {"name": "ticket_handovers_create", "operation": "insert", "role": "member",
         "predicate": f"tenant_id = {T} AND from_member_id = {U} AND app.ticket_writable(ticket_id)",
         "rationale": "チケットに書ける人が、自分として渡す", "source": ["D-125.70"]},
        {"name": "ticket_handovers_answer", "operation": "update", "role": "member",
         "predicate": f"tenant_id = {T} AND (to_member_id = {U} OR from_member_id = {U} OR has_permission({U}, 'ticket_handovers', to_scope_id, 'edit'))",
         "rationale": "受ける人が答える・渡した人が取り下げる・渡す先のグループのマネージャーが受ける人を決める", "source": ["D-125.70"]},
        ops_read("ticket_handovers"),
    ],
    "saved_views": [
        {"name": "saved_views_read", "operation": "select", "role": "member",
         "predicate": f"tenant_id = {T} AND (member_id = {U} OR (share = 'group' AND scope_id = ANY(visible_scopes({U}))))",
         "rationale": "自分のものと、見えるグループに見せたもの", "source": ["D-128.83"]},
        {"name": "saved_views_create", "operation": "insert", "role": "member",
         "predicate": f"tenant_id = {T} AND member_id = {U} AND (share = 'self' OR scope_id = ANY(visible_scopes({U})))",
         "rationale": "自分のものとして作る。見せられるのは自分の見えるグループだけ", "source": ["D-128.83"]},
        {"name": "saved_views_edit", "operation": "update,delete", "role": "member",
         "predicate": f"tenant_id = {T} AND (member_id = {U} OR (share = 'group' AND has_permission({U}, 'saved_views', scope_id, 'edit')))",
         "rationale": "直す・消すのは作った人と、見せたグループのマネージャー（グループの人は使うだけ）", "source": ["D-128.83", "D-128.119"]},
        ops_read("saved_views"),
    ],
    "ticket_imports": [
        {"name": "ticket_imports_read", "operation": "select", "role": "member",
         "predicate": f"tenant_id = {T} AND (uploaded_by = {U} OR has_permission({U}, 'ticket_imports', NULL, 'view'))",
         "rationale": "取り込んだ人と、取り込みの記録を見られる人（既定は管理者）", "source": ["D-128.85", "D-128.119"]},
        {"name": "ticket_imports_create", "operation": "insert", "role": "member",
         "predicate": f"tenant_id = {T} AND uploaded_by = {U} AND has_permission({U}, 'tickets', scope_id, 'edit')",
         "rationale": "入れるグループで書ける人が、自分として取り込む", "source": ["D-128.85"]},
        {"name": "ticket_imports_own_update", "operation": "update", "role": "member",
         "predicate": f"tenant_id = {T} AND uploaded_by = {U}",
         "rationale": "確定・やめるは取り込んだ人だけ", "source": ["D-128.85", "D-128.119"]},
        ops_read("ticket_imports"),
    ],
    # ---- ナレッジ（K-5・D-128.50〜.52。K-674 で棚の決めに作り直した・D-152.1・D-152.3）
    #   棚は会社・グループ・自分の 3 つ。読める・書けるは app.kn_shelf_readable・app.kn_shelf_writable が唯一の正本（権限の束は使わない）。
    #   自分の表の守りは列で書く（id で自分の表を引く関数を使わない＝INSERT … RETURNING が弾かれる）。update は using と with check が同じ式なので、
    #   変えた後の行（下書き → 公開）でも通る形にしている
    "knowledge_pages": [
        {"name": "knowledge_pages_read", "operation": "select", "role": "member",
         "predicate": f"tenant_id = {T} AND (CASE WHEN state = 'draft' THEN owner_member_id = {U} ELSE (app.kn_shelf_readable(scope_id, is_personal, owner_member_id) OR app.kn_shared_visible(id)) END)",
         "rationale": "まだ書き終えていないページは持ち主だけ。公開済みは棚が読める人（会社＝社内の全員・グループ＝そのグループの人・自分＝本人）と共有先（K-689）。管理者でも入っていないグループの棚は読めない", "source": ["D-128.50", "D-128.51", "D-152.1", "D-152.3"]},
        {"name": "knowledge_pages_create", "operation": "insert", "role": "member",
         "predicate": f"tenant_id = {T} AND owner_member_id = {U} AND state = 'draft' AND app.kn_shelf_writable(scope_id, is_personal, owner_member_id)",
         "rationale": "自分を持ち主にして下書きで作る。その棚に書ける人（会社＝管理者・グループ＝そのグループのマネージャー・自分＝本人）", "source": ["D-128.51", "D-152.3"]},
        {"name": "knowledge_pages_update", "operation": "update", "role": "member",
         "predicate": f"tenant_id = {T} AND (CASE WHEN state = 'draft' THEN owner_member_id = {U} ELSE app.kn_shelf_writable(scope_id, is_personal, owner_member_id) END)",
         "rationale": "下書きは持ち主だけ・公開済みはその棚に書ける人（変えた後の行も同じ棚に書けること。行は消さない）", "source": ["D-128.51", "D-152.3"]},
        ops_read("knowledge_pages"),
    ],
    "knowledge_page_versions": [
        {"name": "knowledge_page_versions_read", "operation": "select", "role": "member",
         "predicate": f"tenant_id = {T} AND ((kind = 'published' AND app.kpage_visible(page_id)) OR (kind = 'draft' AND author_member_id = {U}))",
         "rationale": "公開した版はページを読める人。直している下書きの版は書いた人だけ", "source": ["D-128.50", "D-128.51", "D-152.3"]},
        {"name": "knowledge_page_versions_add", "operation": "insert", "role": "member",
         "predicate": f"tenant_id = {T} AND kind = 'draft' AND author_member_id = {U} AND app.kpage_writable(page_id)",
         "rationale": "下書きの版をページに書ける人が自分として足す（公開は下書きの行を更新する）", "source": ["D-128.50", "D-152.3"]},
        {"name": "knowledge_page_versions_decide", "operation": "update", "role": "member",
         "predicate": f"tenant_id = {T} AND app.kpage_writable(page_id) AND (kind <> 'draft' OR author_member_id = {U})",
         "rationale": "下書きの版を直す・公開に更新するのは書いた人で、ページに書ける人（変えた後の公開の版も同じ式で通る）", "source": ["D-128.50", "D-152.3"]},
        ops_read("knowledge_page_versions"),
    ],
    "knowledge_folders": [
        {"name": "knowledge_folders_read", "operation": "select", "role": "member",
         "predicate": f"tenant_id = {T} AND (app.kn_shelf_readable(scope_id, is_personal, owner_member_id) OR app.kn_shared_folder_visible(id))",
         "rationale": "棚が読める人と共有先（K-689）", "source": ["D-152.1", "D-152.3"]},
        {"name": "knowledge_folders_write", "operation": "insert,update", "role": "member",
         "predicate": f"tenant_id = {T} AND app.kn_shelf_writable(scope_id, is_personal, owner_member_id)",
         "rationale": "その棚に書ける人（グループの棚は誰が作っても同じ・自分の棚は本人）。行は消さない（deleted_at）", "source": ["D-152.3"]},
        ops_read("knowledge_folders"),
    ],
    "knowledge_links": [
        {"name": "knowledge_links_read", "operation": "select", "role": "member", "predicate": f"tenant_id = {T} AND app.kpage_visible(from_page_id)",
         "rationale": "元のページを読める人（つないだ先の中身はその先の守りで見る）", "source": ["D-128.52"]},
        {"name": "knowledge_links_write", "operation": "insert,update,delete", "role": "member", "predicate": f"tenant_id = {T} AND app.kpage_writable(from_page_id)",
         "rationale": "元のページに書ける人", "source": ["D-128.52"]},
        ops_read("knowledge_links"),
    ],
    # ---- 取引先（K-6・D-125.121〜.124・D-128.53・D-128.54）。社内の人（member）と取引先の人（client）で分ける
    "clients": [
        {"name": "clients_read", "operation": "select", "role": "member",
         "predicate": f"tenant_id = {T} AND (visibility = 'all' OR owner_member_id = {U} OR app.client_in_my_groups(id) OR has_permission({U}, 'clients', NULL, 'edit'))",
         "rationale": "全員に見える取引先か、取引先の担当か、担当グループが見える人（ワークスペースの既定は全員・取引先ごとに担当グループだけに絞れる）。取引先を直せる人（既定は管理者）は全部見える", "source": ["D-128.54"]},
        {"name": "clients_create", "operation": "insert", "role": "member", "predicate": f"tenant_id = {T} AND has_permission({U}, 'clients', NULL, 'edit')",
         "rationale": "取引先を作れる人（既定は管理者）", "source": ["D-125.121", "D-128.53"]},
        {"name": "clients_update", "operation": "update", "role": "member",
         "predicate": f"tenant_id = {T} AND (owner_member_id = {U} OR has_permission({U}, 'clients', NULL, 'edit'))",
         "rationale": "取引先の担当か、取引先を直せる人", "source": ["D-128.53"]},
        {"name": "clients_own_read", "operation": "select", "role": "client", "predicate": f"tenant_id = {T} AND id = app.my_client()",
         "rationale": "取引先の人は自分の取引先だけ", "source": ["D-125.122"]},
        ops_read("clients"),
    ],
    "client_groups": [
        {"name": "client_groups_read", "operation": "select", "role": "member", "predicate": f"tenant_id = {T} AND app.client_visible(client_id)",
         "rationale": "元の取引先が見える人", "source": ["D-128.54"]},
        {"name": "client_groups_write", "operation": "insert,update,delete", "role": "member", "predicate": f"tenant_id = {T} AND app.client_editable(client_id)",
         "rationale": "取引先を直せる人が担当グループを付け外しする", "source": ["D-128.54"]},
        ops_read("client_groups"),
    ],
    "client_contacts": [
        {"name": "client_contacts_read", "operation": "select", "role": "member", "predicate": f"tenant_id = {T} AND app.client_visible(client_id)",
         "rationale": "元の取引先が見える人", "source": ["D-128.53"]},
        {"name": "client_contacts_write", "operation": "insert,update,delete", "role": "member", "predicate": f"tenant_id = {T} AND app.client_editable(client_id)",
         "rationale": "取引先を直せる人が先方の人を足す・直す", "source": ["D-125.121"]},
        {"name": "client_contacts_same_client_read", "operation": "select", "role": "client", "predicate": f"tenant_id = {T} AND client_id = app.my_client()",
         "rationale": "同じ取引先の人どうしは見える", "source": ["D-125.121"]},
        ops_read("client_contacts"),
    ],
    "client_requests": [
        {"name": "client_requests_read", "operation": "select", "role": "member", "predicate": f"tenant_id = {T} AND app.client_visible(client_id)",
         "rationale": "元の取引先が見える人", "source": ["D-128.53"]},
        {"name": "client_requests_handle", "operation": "insert,update", "role": "member",
         "predicate": f"tenant_id = {T} AND app.client_visible(client_id) AND (app.client_editable(client_id) OR has_permission({U}, 'client_requests', routed_scope_id, 'edit'))",
         "rationale": "取引先の担当・取引先を直せる人・届け先のグループで依頼を受けられる人が、受ける／詳しく聞く／断る", "source": ["D-125.123", "D-128.54"]},
        {"name": "client_requests_same_client_read", "operation": "select", "role": "client", "predicate": f"tenant_id = {T} AND client_id = app.my_client()",
         "rationale": "同じ取引先の人は互いの依頼が見える（やり取りは全部）", "source": ["D-125.121", "D-125.122"]},
        {"name": "client_requests_submit", "operation": "insert", "role": "client",
         "predicate": f"tenant_id = {T} AND client_id = app.my_client() AND contact_id = app.my_contact() AND state = 'new' AND EXISTS (SELECT 1 FROM client_contacts k WHERE k.id = contact_id AND k.role = 'requester')",
         "rationale": "依頼できる人が、自分として新しい依頼を出す（見るだけの人は出せない）", "source": ["D-125.123", "D-128.53"]},
        {"name": "client_requests_own_edit", "operation": "update", "role": "client",
         "predicate": f"tenant_id = {T} AND client_id = app.my_client() AND contact_id = app.my_contact() AND state IN ('new', 'asking')",
         "rationale": "自分の依頼を、受けてもらう前（新しい・聞いている）のあいだ直せる", "source": ["D-125.123"]},
        ops_read("client_requests"),
    ],
    "acceptances": [
        {"name": "acceptances_ticket_read", "operation": "select", "role": "member", "predicate": f"tenant_id = {T} AND app.ticket_visible(ticket_id)",
         "rationale": "元のチケットを読める人", "source": ["D-125.124"]},
        {"name": "acceptances_ask", "operation": "insert,update", "role": "member", "predicate": f"tenant_id = {T} AND app.ticket_writable(ticket_id)",
         "rationale": "元のチケットに書ける人が検収を頼む・催促する", "source": ["D-125.124"]},
        {"name": "acceptances_client_read", "operation": "select", "role": "client",
         "predicate": f"tenant_id = {T} AND EXISTS (SELECT 1 FROM client_contacts k WHERE k.id = contact_id AND k.client_id = app.my_client())",
         "rationale": "自分の取引先に頼まれた検収", "source": ["D-125.124"]},
        {"name": "acceptances_client_answer", "operation": "update", "role": "client",
         "predicate": f"tenant_id = {T} AND contact_id = app.my_contact()",
         "rationale": "頼まれた本人が OK／直してほしい を返す", "source": ["D-125.124"]},
        ops_read("acceptances"),
    ],
    # ---- ワークスペースと人（K-7・D-125.115・D-125.150・D-125.162・D-128.92・D-128.93・D-128.97）
    "tenant_memberships": [
        {"name": "tenant_memberships_read", "operation": "select", "role": "member",
         "predicate": f"tenant_id = {T} AND (member_id = {U} OR has_permission({U}, 'members', NULL, 'edit'))",
         "rationale": "本人と、その会社のメンバーを直せる人（既定は管理者）だけ。ほかのワークスペースへの所属はログインの部品の口が本人にだけ返す", "source": ["D-125.150", "D-128.46"]},
        {"name": "tenant_memberships_admin_write", "operation": "insert,update", "role": "member", "predicate": f"tenant_id = {T} AND has_permission({U}, 'members', NULL, 'edit')",
         "rationale": "招く・役割を変える・止めるのは管理者と、その権限を個別に付けた人だけ（本人確認の取り直しは API で）", "source": ["D-128.97"]},
        ops_read("tenant_memberships"),
    ],
    "scope_memberships": [
        {"name": "scope_memberships_read", "operation": "select", "role": "member",
         "predicate": f"tenant_id = {T} AND (member_id = {U} OR scope_id = ANY(visible_scopes({U})))",
         "rationale": "本人と、そのグループが見える人", "source": ["D-125.115"]},
        {"name": "scope_memberships_admin_write", "operation": "insert,update,delete", "role": "member", "predicate": f"tenant_id = {T} AND has_permission({U}, 'members', NULL, 'edit')",
         "rationale": "グループを移す・兼ねる・役割を変えるのは管理者と、その権限を個別に付けた人だけ（マネージャーの束には入れない）", "source": ["D-128.97"]},
        ops_read("scope_memberships"),
    ],
    "terms_versions": [
        {"name": "terms_versions_all_read", "operation": "select", "role": "authenticated", "predicate": "true",
         "rationale": "運営が全員に出す規約の版。今の版を同意し直しの画面に出す", "source": ["D-125.162"]},
        {"name": "terms_versions_ops_write", "operation": "insert,update", "role": "ops", "predicate": "current_setting('app.role', true) = 'ops'",
         "rationale": "規約の版を出すのは運営だけ（消さない）", "source": ["D-125.162"]},
    ],
    "terms_consents": [
        {"name": "terms_consents_self_read", "operation": "select", "role": "member", "predicate": f"tenant_id = {T} AND member_id = {U}",
         "rationale": "本人だけ", "source": ["D-125.162"]},
        {"name": "terms_consents_self_add", "operation": "insert", "role": "member", "predicate": f"tenant_id = {T} AND member_id = {U}",
         "rationale": "本人として同意する（追記だけ・直さない・消さない）", "source": ["D-125.162"]},
        ops_read("terms_consents"),
    ],
    "notification_settings": [
        {"name": "notification_settings_self", "operation": "select,insert,update", "role": "member", "predicate": f"tenant_id = {T} AND member_id = {U}",
         "rationale": "知らせの設定は本人だけ（ワークスペースごと）", "source": ["D-128.92"]},
        ops_read("notification_settings"),
    ],
    # ---- 知らせ（K-461・D-151.3）：鈴の行は本人だけが読む・書く（権限のある人も他人宛ての行に触れない。題名入りの行が同じ会社の他の人に読めてしまうのを止める）。
    #      守りの名前 notifications_self_only_write は前のまま残す（場合表の「本人のもの」の行 RLS-D11-010 を動かさない）。読む守りだけ新しい名前 notifications_self_read。
    #      書き手（security definer の関数）は守りの外で入れるので変わらない
    "notifications": [
        {"name": "notifications_self_read", "operation": "select", "role": "member", "predicate": f"tenant_id = {T} AND member_id = {U}",
         "rationale": "自分宛ての知らせだけ（同じ会社の他の人宛ては、権限のある人にも見せない）", "source": ["D-151.3", "D-073.1"]},
        {"name": "notifications_self_only_write", "operation": "insert,update,delete", "role": "member", "predicate": f"tenant_id = {T} AND member_id = {U}",
         "rationale": "自分宛ての知らせだけ書く・読んだ印を付ける（他人宛てを足せない・直せない）", "source": ["D-151.3", "D-073.1"]},
        ops_read("notifications"),
    ],
    "bridge_pairing_codes": [
        {"name": "bridge_pairing_codes_self", "operation": "select,insert", "role": "member", "predicate": f"tenant_id = {T} AND member_id = {U}",
         "rationale": "接続コードは本人だけが作る・見る（コードそのものは持たない）。使うのは関門の関数", "source": ["D-128.93"]},
    ],
    # ---- 分身の「覚えたいこと」（K-8・D-128.41〜.43）。運営の表（operations・ops_plan_proposals）は形からの当てはめ（運営だけ）のまま
    "learning_candidates": [
        {"name": "learning_candidates_read", "operation": "select", "role": "member",
         "predicate": f"tenant_id = {T} AND (owner_member_id = {U} OR ((state = 'needs_ok' OR decided_by = {U}) AND has_permission({U}, 'learning_candidates', NULL, 'edit')))",
         "rationale": "本人（その人の分身の候補）だけ。会社のルールとぶつかって OK を待つもの・自分が決めたものは、OK を出せる人（既定は管理者）にも見える", "source": ["D-128.41", "D-128.43"]},
        {"name": "learning_candidates_self_write", "operation": "insert,update", "role": "member", "predicate": f"tenant_id = {T} AND owner_member_id = {U}",
         "rationale": "本人が 覚える／覚えない／あとで を決める", "source": ["D-128.41", "D-128.90"]},
        {"name": "learning_candidates_ok", "operation": "update", "role": "member",
         "predicate": f"tenant_id = {T} AND state IN ('needs_ok', 'learned', 'rejected') AND has_permission({U}, 'learning_candidates', NULL, 'edit')",
         "rationale": "会社のルールとぶつかるものに OK を出すのは管理者（OK を待つ間か、その決め直しだけ）", "source": ["D-128.43"]},
        ops_read("learning_candidates"),
    ],
    # ---- 分身との会話・記憶・問い合わせ（K-17 で見つけた穴・2026-11-03）：本人のものは本人だけ。管理者・マネージャーでも中身は見ない
    #      前の形（ER の印からの当てはめ）は「同じグループなら読める・グループの権限があれば他人のものも書ける」になっていた
    "conversations": [
        {"name": "conversations_self_read", "operation": "select", "role": "member",
         "predicate": f"tenant_id = {T} AND (owner_member_id = {U} OR {U} = ANY(participant_member_ids))",
         "rationale": "自分の会話だけ（一緒に話している人を含む）。管理者も中身は見ない（screen_api の listConversations・D-104）", "source": ["D-104", "D-128.96"]},
        {"name": "conversations_self_only_write", "operation": "insert,update,delete", "role": "member", "predicate": f"tenant_id = {T} AND owner_member_id = {U}",
         "rationale": "自分の会話だけを作り・直し・消す", "source": ["D-104"]},
        ops_read("conversations"),
    ],
    "messages": [
        {"name": "messages_conversation_read", "operation": "select", "role": "member", "predicate": f"tenant_id = {T} AND app.conversation_visible(conversation_id)",
         "rationale": "その会話を読める人だけ（自分の会話・一緒に話している人）。同じ会社の他人の会話の発言は見せない", "source": ["D-104", "D-112"]},
        {"name": "messages_conversation_write", "operation": "insert,update", "role": "member", "predicate": f"tenant_id = {T} AND app.conversation_visible(conversation_id)",
         "rationale": "その会話の人だけが書く（PC の写し・分身の返事は関門の関数 app.* が書く）", "source": ["D-104", "D-112"]},
        ops_read("messages"),
    ],
    "memories": [
        {"name": "memories_self_read", "operation": "select", "role": "member", "predicate": f"tenant_id = {T} AND owner_member_id = {U}",
         "rationale": "自分だけの記憶（D-128.42）。会社・層に上げるものは決まり（policies）になる", "source": ["D-128.42", "D-125.110"]},
        {"name": "memories_self_only_write", "operation": "insert,update,delete", "role": "member", "predicate": f"tenant_id = {T} AND owner_member_id = {U}",
         "rationale": "自分の記憶だけを足し・直し・消す。他人を持ち主にして作れない", "source": ["D-128.42"]},
        ops_read("memories"),
    ],
    "inquiries": [
        {"name": "inquiries_self_read", "operation": "select", "role": "member", "predicate": f"tenant_id = {T} AND opened_by_member_id = {U}",
         "rationale": "自分の問い合わせだけ（契約の権限の言葉 self・screen_api の listMyInquiries）", "source": ["D-128.88", "D-125.24"]},
        {"name": "inquiries_self_only_write", "operation": "insert,update", "role": "member", "predicate": f"tenant_id = {T} AND opened_by_member_id = {U}",
         "rationale": "自分の問い合わせを出し・閉じる", "source": ["D-128.88", "D-125.24"]},
        ops_read("inquiries"),
        {"name": "inquiries_ops_write", "operation": "update", "role": "ops", "predicate": f"current_setting('app.role', true) = 'ops' AND tenant_id = {T}",
         "rationale": "運営が対応して書く行（assignee_ops_member_id）。会社の 1 社の中で・証跡に残す", "source": ["D-075", "D-077.1"]},
    ],
    # ---- 承認（K-9・D-128.86・D-128.87・D-128.89）：承認する人・頼んだ人・担当者（チケットを読める人）・マネージャー
    "approvals": [
        {"name": "approvals_read", "operation": "select", "role": "member",
         "predicate": f"tenant_id = {T} AND (scope_id = ANY(visible_scopes({U})) OR approver_member_id = {U} OR requested_by = {U} OR (ticket_id IS NOT NULL AND (app.ticket_visible(ticket_id) OR app.ticket_assignee_is_me(ticket_id))))",
         "rationale": "見えるグループの人・承認する人（グループの外でも）・頼んだ人・元のチケットを読める人・元のチケットの今の担当者（承認する人は今の担当者・担当が替わった直後も読める・K-161）", "source": ["D-128.86", "D-128.115", "D-128.25"]},
        {"name": "approvals_request", "operation": "insert", "role": "member",
         "predicate": f"tenant_id = {T} AND requested_by = {U} AND (ticket_id IS NULL OR app.ticket_writable(ticket_id))",
         "rationale": "自分として頼む。チケットの承認は、そのチケットに書ける人が頼む", "source": ["D-128.86"]},
        {"name": "approvals_decide", "operation": "update", "role": "member",
         "predicate": f"tenant_id = {T} AND (approver_member_id = {U} OR requested_by = {U} OR has_permission({U}, 'approvals', scope_id, 'edit'))",
         "rationale": "承認する人が決める・頼んだ人が取り下げる・そのグループで承認を扱える人（マネージャー）が上へ回す。行は消さない", "source": ["D-128.86", "D-128.87"]},
        ops_read("approvals"),
    ],
    # 業務の型（K-9・D-126.2）：第1フェーズは運営の全社向けだけ。会社の人は全社向けを読んでチケットで選ぶ（D-126.13）
    "skills": [
        {"name": "skills_catalog_read", "operation": "select", "role": "authenticated", "predicate": "tenant_id = app.ops_tenant_id() AND scope_id IS NULL",
         "rationale": "運営が全社向けに出す業務の型。どの会社の人も同じものを読んで選ぶ（中の作りは見せない・D-126.21 は API で絞る）", "source": ["D-126.2", "D-126.13", "D-126.23"]},
        {"name": "skills_ops_all", "operation": "all", "role": "ops", "predicate": "tenant_id = app.ops_tenant_id() AND current_setting('app.role', true) = 'ops'",
         "rationale": "運営の業務の型は運営が作る（会社・層・個人の型は節目②・KN-21）", "source": ["D-126.4", "D-126.23"]},
    ],
    # ---- 中を見るの許可（K-10・D-125.128・D-128.68・D-128.108）：運営の人が理由を書いて開く。会社は誰がいつ見たかを見られる
    "support_access_grants": [
        {"name": "support_access_grants_tenant_view", "operation": "select", "role": "member",
         "predicate": f"tenant_id = {T} AND has_permission({U}, 'support_access_grants', NULL, 'view')",
         "rationale": "会社は、運営が中を見た記録（誰が・いつ・理由）を見られる（既定は管理者）。会社が許可を出す形はやめた（D-125.128）", "source": ["D-125.128", "D-128.108"]},
        {"name": "support_access_grants_ops_open", "operation": "select,insert,update", "role": "ops",
         "predicate": f"current_setting('app.role', true) = 'ops' AND EXISTS (SELECT 1 FROM ops_members om WHERE om.id = support_access_grants.ops_member_id AND om.member_id = {U} AND 'peek' = ANY(om.caps) AND om.revoked_at IS NULL AND om.deleted_at IS NULL)",
         "rationale": "「中を見る」ができる運営の人が、自分の許可だけを開く・見る・閉じる（理由・1 時間は行の決まりで守る）", "source": ["D-128.68", "D-128.70"]},
    ],
    # ---- 既にある表を契約から使う（K-11・D-128.93・D-128.119）
    # PC の仕事と出来事は本人だけ（同じグループの人にも他人の PC の仕事を見せない）。PC の印（device）は表を直接読まず、関門の関数（app.bridge_*）だけを通る
    "bridge_jobs": [
        {"name": "bridge_jobs_self_read", "operation": "select", "role": "member", "predicate": f"tenant_id = {T} AND member_id = {U}",
         "rationale": "本人の分身の PC の仕事だけ（グループの人・管理者にも中身は見せない）", "source": ["D-128.93", "D-128.40"]},
        {"name": "bridge_jobs_self_only_write", "operation": "insert,update", "role": "member", "predicate": f"tenant_id = {T} AND member_id = {U}",
         "rationale": "本人として頼む・止める（PC の側の書き込みは関門の関数）", "source": ["D-128.93"]},
        ops_read("bridge_jobs"),
    ],
    "bridge_job_events": [
        {"name": "bridge_job_events_self_read", "operation": "select", "role": "member", "predicate": f"tenant_id = {T} AND member_id = {U}",
         "rationale": "本人の PC の仕事の出来事だけ", "source": ["D-128.93"]},
        {"name": "bridge_job_events_self_only_write", "operation": "insert", "role": "member", "predicate": f"tenant_id = {T} AND member_id = {U}",
         "rationale": "本人の仕事の出来事を足すだけ（直さない・消さない）", "source": ["D-128.93"]},
        ops_read("bridge_job_events"),
    ],
    # ---- 預けたログイン情報（K-351・D-128.57 ①）：層はワークスペースと個人の 2 つ。個人の物は持ち主だけが読む・書く（権限のある人も他人の個人の物に触れない）。
    #      ワークスペースの物は同じ会社の人が読み（名前と使い方だけ。値は金庫）、書くのはワークスペース全体の edit を持つ人だけ（既定は管理者）。
    #      守りの名前を self_only_write にしない（場合表の「自分の行だけ」の扱いは持ち主の列だけで決まる表のもの。ここは層でも分かれる）
    "credentials": [
        {"name": "credentials_read", "operation": "select", "role": "member",
         "predicate": f"tenant_id = {T} AND (layer = 'workspace' OR owner_member_id = {U})",
         "rationale": "ワークスペースの物は同じ会社の人・個人の物は持ち主だけ（管理者にも他人の個人の物は見せない）", "source": ["D-128.57", "D-125.148"]},
        {"name": "credentials_personal_write", "operation": "insert,update,delete", "role": "member",
         "predicate": f"tenant_id = {T} AND layer = 'personal' AND owner_member_id = {U}",
         "rationale": "個人の物は持ち主だけが預け・直し・消す。他人を持ち主にして作れない", "source": ["D-128.57"]},
        {"name": "credentials_workspace_write", "operation": "insert,update,delete", "role": "member",
         "predicate": f"tenant_id = {T} AND layer = 'workspace' AND has_permission({U}, 'credentials', NULL, 'edit')",
         "rationale": "ワークスペースの物を預け・直し・消すのは、ワークスペース全体の edit を持つ人だけ（既定は管理者）", "source": ["D-128.57", "D-125.148"]},
        ops_read("credentials"),
    ],
    # パスキーはログインの部品（Better Auth）の側に置き、業務の表からは読めない（D-128.119）。public に表を作らない。作っても誰も読めない
    "passkeys": [{"name": "passkeys_no_app_access", "operation": "select", "role": "member", "predicate": "false",
                  "rationale": "パスキーはログインの部品の側（kaname_auth）。アプリの役からは読めない。自分の設定の一覧はログインの部品の口が出す（D-128.119）", "source": ["D-128.119"]}],
    # 役割の束の既定（K-16・D-125.117）：製品のマスタ。ログイン済みなら読める（自分の役割で何ができるかを画面に出す）。書くのは migration だけ
    "role_bundle_defaults": [{"name": "role_bundle_defaults_all_read", "operation": "select", "role": "authenticated", "predicate": "true",
                              "rationale": "製品の既定の束。どの会社の人にも同じものを見せる", "source": ["D-125.117"]}],
    # 登録の保留（ログインの前）。表は kaname_auth の側にあり、登録の口（auth-ext）だけが読み書きする。アプリの役からは誰も読めない
    "pending_signup": [{"name": "pending_signup_no_app_access", "operation": "select", "role": "member", "predicate": "false",
                        "rationale": "ログインの前の保留。アプリの役からは読めない（登録の口だけが kaname_auth の側で扱う・D-088.2）", "source": ["D-088.2", "D-128.115"]}],
}

# 誰でも（ログイン済みなら）読める・書けるのは本当のマスタだけ。それ以外でまだ直していない表と、直すチケット（zt_gate.py の ZT3 が見る）
PENDING_CHILD_TABLES = {
    "skill_versions": "KN-21（会社・層・個人の業務の型を入れる前に、元の型を見られる人だけにする。節目①は運営の全社向けだけ）",
}

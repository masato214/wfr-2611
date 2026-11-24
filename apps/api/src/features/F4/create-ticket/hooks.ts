// チケットを作る（K-60）の契約の口の振る舞い。
//   createTicket：入口で形を確かめ（題名・期限・優先度・見込み・本文 body・会社の項目 fields・確認項目 specs の形）、app.ticket_create（関門 C2・K-437 で作り直し）が
//     グループに書けるか・種別・担当者・親・知らせる人が同じ会社か・会社の項目の値（K-564 の app.ticket_fields_set）・確認項目の文を確かめ、
//     チケット・本文の行と版 1・項目の値・確認項目・つながり（K-581・K-441 の app.ticket_link_add）・受け箱の知らせ・下書きの片付けを 1 つの処理で書く（K-437）。
//     つなぐ相手が無い・見えないは 404 E-PAGE-001・相手に書けないは 403（欄なし）。
//     断り：選べない選び先（種別・担当者・知らせる人・親・項目の id）は 404 E-PAGE-001／親子が 3 段を超える 409 E-VAL-015／期限が今日より前 409 E-VAL-012／
//     開始が期限より後 409 E-VAL-028／会社の項目の 409 E-FLD-001〜004（どれも欄・details・detail を付けない＝在るかを漏らさない）。422 は契約に書ける形の誤りだけ（欄つき）。
//     sections だけで来た作り方（前の道）の必須の区画が空は 422 E-VAL-013（K-578 まで）。DB が落ちたら口の中で 503 E-PAGE-003（何も残らない・D-136.1）
//   複製（K-438・A129）：duplicate_of があれば同じ取引で ①app.ticket_duplicate_read（元を止めて材料を読む）→ ②app.ticket_create（材料から組んだ体）→
//     ③app.ticket_duplicate_apply（確認項目・つながり・子・派生元の線・知らせ・証跡）。元が見えない 404 E-DUP-001・子を写すと 3 段を超える 409 E-DUP-002（欄なし）。
//     ② の断りは K-437 の振り分けのまま（何も書かれていない）。③ の途中で落ちたら取引ごと戻して 503 E-PAGE-003
//   listTicketKinds：種別と、その種別の区画（必須か）を一緒に返す ／ listScopes：グループの一覧と、チケットを書けるグループ（meta.writable）
//   getTicket：読むだけの詳細（属性・区画・種別・段・担当者。K-560 で本文 body・会社の項目 fields・確認項目の数・親・子とつながりの数・結果の場所） ／ listMyTicketDrafts・saveMyTicketDraft：書きかけの下書き（サーバーに残す・D-128.138）
// ログに題名と本文を出さない（共通の決まり）
import type pg from "pg";
import { isUuid } from "@kaname/contracts";
import { withTenant } from "@kaname/db/context";
import type { Row } from "@kaname/db/repository";
import { KanameError } from "@kaname/errors";
import type { Hook, HookArgs, HookReply } from "../../../contract/deps.js";
import { bare, FIELD_CODES } from "../ticket-fields/errors.js";
import { buildDuplicate, type CopyName, type DuplicateRead } from "./duplicate.js";
import { checkCreate, todayJst, type RawParts } from "./input.js";

const fail = (status: number, error: string, code: string, extra: Record<string, unknown> = {}): HookReply => ({
  status,
  body: { error, code, ...extra },
});

/** 凍結の列（業務の型・K-582・D-150.60）は答えに出さない。列は表に残るので、読んだ行から頭の字で外す（列の名前はコードに書かない・K582-API-007） */
const FROZEN_PREFIX = "work_type_";
const withoutFrozen = (t: Row): Row =>
  Object.fromEntries(Object.entries(t).filter(([k]) => !k.startsWith(FROZEN_PREFIX)));

/** DB の答えの言葉 → 404 E-PAGE-001 になるもの（選べない・見えない選び先・欄なし・在るかを漏らさない） */
//   LINK_GONE（K-581）：つなぐ相手が無い・消した・見えない・別の会社
const GONE = new Set(["KIND_GONE", "ASSIGNEE_GONE", "NOTIFY_GONE", "PARENT_NOT_FOUND", "LINK_GONE"]);

/** 画面が送ったままの題名・本文・確認項目の文（入口の NFKC・前後の空白の揃えを当てない）。読めなければ入口が揃えた値を使う */
async function sentParts(a: HookArgs): Promise<{ title?: unknown; raw: RawParts }> {
  try {
    const j: unknown = await a.c.req.json();
    if (typeof j !== "object" || j === null || Array.isArray(j)) return { raw: {} };
    const o = j as Record<string, unknown>;
    const raw: RawParts = {};
    if ("body" in o) raw.body = o["body"];
    if ("specs" in o) raw.specs = o["specs"];
    return { title: o["title"], raw };
  } catch {
    return { raw: {} };
  }
}

/** app.ticket_create の断りの答え → 口の答え。知らない言葉は例外にする（口の中で 503 にする・既定の答えは置かない） */
function refusal(r: Record<string, unknown>): HookReply {
  const code = String(r["code"]);
  // LINK_FORBIDDEN（K-581）：つなぐ相手が見えるが書けない（欄なし）
  if (code === "FORBIDDEN" || code === "LINK_FORBIDDEN") return fail(403, "forbidden", "FORBIDDEN");
  if (GONE.has(code)) return bare("E-PAGE-001", 404);
  if (code === "PARENT_DEPTH") return bare("E-VAL-015", 409);
  if (code === "FIELD") {
    const word = String(r["detail"]);
    if (word === "field_not_found") return bare("E-PAGE-001", 404);
    const fld = FIELD_CODES[word];
    if (fld) return bare(fld, 409);
  }
  if (code === "BODY_INVALID" || code === "SPEC_INVALID") {
    const field = String(r["field"] ?? (code === "BODY_INVALID" ? "body" : "specs"));
    return fail(422, "validation_failed", "VALIDATION_ERROR", {
      details: [{ field, message: code === "BODY_INVALID" ? "本文の形が違います" : "確認項目の文を確かめてください" }],
    });
  }
  if (code === "SECTION_REQUIRED") {
    const keys = (r["detail"] as string[] | undefined) ?? [];
    const e = new KanameError("E-VAL-013");
    return {
      status: 422,
      body: {
        ...e.toJSON(),
        field: "sections",
        details: keys.map((k) => ({ field: `sections.${k}`, message: e.entry.message })),
      },
    };
  }
  throw new Error(`app.ticket_create の知らない答え（${code}）`);
}

const kindOf = (e: unknown): string => (e instanceof Error ? e.name : typeof e);
const LIST_MAX = 200;
/** チケットの詳細の帯（DB の app.ticket_band の答え・0096 と 0100） */
interface TicketBand {
  approval: unknown;
  can_complete?: boolean;
  completed_at?: string | null;
  completed_by_name?: string | null;
}
/** 詳細の進める分（DB の app.ticket_progress_info の答え・K-387） */
interface TicketProgressInfo {
  can_progress?: boolean;
  can_actual?: boolean;
  ai_minutes?: number;
  hold?: { reason: string | null; resume: string | null; at: string; by: string | null } | null;
}
/** 詳細に足す欄を読む 1 文（文の数を増やさない・K234-API-004）。列は関数ごとに 1 つ。
 *  欄を足す葉は、この文に列を 1 つ足し（例 app.ticket_handover_now($1) as h）、DetailExtras と detailExtras に鍵を 1 つ足す */
const DETAIL_EXTRAS_SQL =
  "select app.ticket_band($1) as v, app.ticket_progress_info($1) as p, app.ticket_handover_current($1) as h, app.ticket_handover_kinds($1) as k, app.ticket_read_adds($1) as f";
interface DetailExtras {
  v: TicketBand | null;
  p: TicketProgressInfo | null;
  /** 今の渡し（K-405・待っている 1 件か一番新しい 1 件・無ければ null。形は listTicketHandovers の 1 件と同じ） */
  h: Record<string, unknown> | null;
  /** 見ている人が渡せる種類（K-405・pass・distribute・offer） */
  k: string[] | null;
  /** 本文・会社の項目・確認項目の数・親・子とつながりの数・結果の場所（K-560・app.ticket_read_adds。見えなければ null） */
  f: TicketReadAdds | null;
}
/** 詳細に足す読み（DB の app.ticket_read_adds の答え・K-560） */
interface TicketReadAdds {
  body?: unknown;
  fields?: unknown[];
  spec_count?: number;
  spec_unchecked?: number;
  no_spec_reason?: string | null;
  parent?: unknown;
  child_count?: number;
  link_count?: number;
  results?: Record<string, unknown>;
}
const EMPTY_BODY = { doc: { type: "doc", content: [] }, text: "", version: 0 };
/** 詳細の答えのうち、app.ticket_read_adds から組む欄（K-560）。並びは DB の関数が決める（ここで切り詰め・並べ替えをしない） */
function readAdds(f: TicketReadAdds | null | undefined): Row {
  return {
    body: f?.body ?? EMPTY_BODY,
    fields: f?.fields ?? [],
    spec_count: f?.spec_count ?? 0,
    spec_unchecked: f?.spec_unchecked ?? 0,
    no_spec_reason: f?.no_spec_reason ?? null,
    parent: f?.parent ?? null,
    child_count: f?.child_count ?? 0,
    link_count: f?.link_count ?? 0,
    results: f?.results ?? {},
  };
}
/** 詳細の答えのうち、DETAIL_EXTRAS_SQL の列から組む欄（承認の帯・できること・完了・時間・保留の帯） */
function detailExtras(x: DetailExtras | undefined, t: Row): Row {
  const band = x?.v ?? null;
  const p = x?.p ?? null;
  return {
    approval: band?.approval ?? null,
    can: { complete: band?.can_complete === true, progress: p?.can_progress === true, actual: p?.can_actual === true },
    completed: band?.completed_at ? { at: band.completed_at, by: band.completed_by_name ?? null } : null,
    // 予定・人の分（実績）・AI の分（終わった実行の長さの合計・K-387）
    time: {
      estimate_minutes: t["estimate_minutes"] ?? null,
      human_minutes: t["actual_minutes"] ?? 0,
      ai_minutes: p?.ai_minutes ?? 0,
    },
    hold: p?.hold ?? null,
    // 渡しの今（帯の「→ 〇〇（返事待ち）」）と入口の出し分け（K-405）
    handover: x?.h ?? null,
    handover_kinds: x?.k ?? [],
    ...readAdds(x?.f),
  };
}

/** 作る（duplicate_of が無ければ K-437 の道のまま 1 文）か、複製の 3 文（①→②→③）を同じ取引で。
 *  ① の断りは { dup: 言葉 }・② の断りはその答えのまま（どちらも何も書いていないので取引を閉じて返す）。③ の断りは例外（取引ごと戻る） */
async function createOrDuplicate(cl: pg.PoolClient, value: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { duplicate_of: source, copy, ...input } = value;
  const create = async (v: Record<string, unknown>) =>
    (await cl.query<{ v: Record<string, unknown> }>("select app.ticket_create($1::jsonb) as v", [JSON.stringify(v)]))
      .rows[0]!.v;
  if (typeof source !== "string") return create(input);
  const names = (copy as CopyName[] | undefined) ?? [];
  const read = (
    await cl.query<{ v: Record<string, unknown> }>(
      "select app.ticket_duplicate_read($1::uuid, $2::text[], $3::uuid, $4::uuid) as v",
      [source, names, input["kind_id"], input["parent_ticket_id"] ?? null],
    )
  ).rows[0]!.v;
  if (read["ok"] !== true) {
    const word = String(read["error"]);
    if (word === "gone" || word === "depth" || word === "not_member") return { dup: word };
    throw new Error(`app.ticket_duplicate_read の知らない答え（${word}）`);
  }
  const plan = buildDuplicate(input, source, names, read as unknown as DuplicateRead);
  const r = await create(plan.create);
  if (r["ok"] !== true) return r;
  await cl.query("select app.ticket_duplicate_apply($1::uuid, $2::jsonb)", [r["id"], JSON.stringify(plan.apply)]);
  return r;
}

export function createTicketHooks(appPool: pg.Pool): Record<string, Hook> {
  return {
    createTicket: {
      before: async (a: HookArgs) => {
        const sent = await sentParts(a);
        const checked = checkCreate(a.input, todayJst(), sent.title, sent.raw);
        if (!checked.ok) {
          // 今の状態で決まる 2 つは、ほかの形の誤りより先に 409（欄なし）：期限が今日より前 → 開始が期限より後
          for (const c of ["E-VAL-012", "E-VAL-028"])
            if (checked.details.some((x) => x.code === c)) return bare(c, 409);
          return fail(422, "validation_failed", "VALIDATION_ERROR", {
            details: checked.details.map(({ field, message }) => ({ field, message })),
          });
        }
        let r: Record<string, unknown>;
        try {
          r = await withTenant(appPool, a.ctx, (cl) => createOrDuplicate(cl, checked.value));
          if (r["dup"] === "gone") return bare("E-DUP-001", 404);
          if (r["dup"] === "depth") return bare("E-DUP-002", 409);
          if (r["dup"] === "not_member") return fail(403, "forbidden", "FORBIDDEN");
          if (r["ok"] !== true) return refusal(r);
        } catch (ex) {
          // 取引の途中で落ちた（1 つの取引なので何も残らない）。ログは場所と例外の種類だけ（題名・本文・値を出さない）
          console.error(`[create-ticket] 作れなかった（${kindOf(ex)}）`);
          return bare("E-PAGE-003", 503);
        }
        const row = await a.repo.table("tickets").get(a.ctx, String(r["id"]));
        return { status: 201, body: { data: row ?? { id: r["id"], number: r["number"] } } };
      },
    },
    listTicketKinds: {
      before: async (a: HookArgs) => {
        // 種別と、その種別で出す会社の項目のマスタ（app.ticket_field_master・K-560）を 1 文で読む（文の数を増やさない・K234-API-002）
        const kinds = await withTenant(
          appPool,
          a.ctx,
          async (cl) =>
            (
              await cl.query<Row>(
                `select k.id, k.name, k.color, k.position, k.is_builtin, k.body_template, app.ticket_field_master(k.id) as fields
                   from ticket_kinds k
                  where k.tenant_id = app.tenant_id() and k.deleted_at is null
                  order by k.position, k.id
                  limit $1`,
                [LIST_MAX],
              )
            ).rows,
        );
        const secs = (await a.repo.table("kind_sections").list(a.ctx, { limit: 2000, orderBy: "position" })).filter(
          (s) => !s["deleted_at"],
        );
        const data = kinds.map((k) => ({
          id: k["id"],
          name: k["name"],
          color: k["color"] ?? null,
          position: k["position"],
          is_builtin: k["is_builtin"],
          // 種別のひな形（本文に入れる文書の木か null）と会社の項目のマスタ（値なし・並び位置の順・K-560）
          body_template: k["body_template"] ?? null,
          fields: k["fields"] ?? [],
          sections: secs
            .filter((s) => s["kind_id"] === k["id"] && s["mode"] !== "hidden")
            .map((s) => ({
              key: s["section_key"],
              label: s["label"],
              mode: s["mode"],
              position: s["position"],
              content_type: s["content_type"],
              hint: s["hint"] ?? null,
            })),
        }));
        return { status: 200, body: { data, meta: { limit: data.length } } };
      },
    },
    listScopes: {
      before: async (a: HookArgs) => {
        // 層の絞り込み（K-249）：入口が uuid と確かめ済み（registry の uuidParams）。空の値（?layer_id=）は指定なし。
        //   見える範囲は行の守りのまま（見えるグループの中で絞る）。別の会社の層・無い層は 0 件
        const layerId = a.c.req.query("layer_id") ?? "";
        const byLayer = layerId ? { where: { layer_id: layerId } } : {};
        const rows = (await a.repo.table("scopes").list(a.ctx, { limit: LIST_MAX, ...byLayer })).filter(
          (s) => !s["deleted_at"],
        );
        // チケットを書けるグループ：グループごとに聞かず、1 回の SQL で（has_permission を並びに当てる）
        const ids = rows.map((s) => String(s["id"]));
        const writable =
          a.ctx.role === "member" && ids.length
            ? await withTenant(appPool, a.ctx, async (cl) =>
                (
                  await cl.query<{ id: string }>(
                    "select s.id::text as id from unnest($1::uuid[]) as s(id) where has_permission(app.user_id(), 'tickets', s.id, 'edit')",
                    [ids],
                  )
                ).rows.map((r) => r.id),
              )
            : [];
        return { status: 200, body: { data: rows, meta: { limit: LIST_MAX, writable } } };
      },
    },
    getTicket: {
      before: async (a: HookArgs) => {
        const t = await a.repo.table("tickets").get(a.ctx, a.id!);
        if (!t || t["deleted_at"]) return fail(404, "not_found", "NOT_FOUND");
        const [secs, kindSecs, kind, stage, assignee] = await Promise.all([
          a.repo.table("ticket_sections").list(a.ctx, { where: { ticket_id: a.id }, limit: 100, orderBy: "position" }),
          a.repo.table("kind_sections").list(a.ctx, { where: { kind_id: t["kind_id"] }, limit: 100 }),
          a.repo.table("ticket_kinds").get(a.ctx, String(t["kind_id"])),
          a.repo.table("ticket_stages").get(a.ctx, String(t["stage_id"])),
          t["assignee_member_id"] ? a.repo.table("members").get(a.ctx, String(t["assignee_member_id"])) : null,
        ]);
        // 承認の帯（K-162・D-128.178）：決まっていない成果物の承認待ち 1 つ（呼んだ人が決められるか）。読むだけ。
        //   完了（K-165）：呼んだ人が完了にできるか（can.complete）と、完了の時刻と押した人の名前（completed）
        //   進める（K-387）：段を変えられるか（can.progress）・実績を入れられるか（can.actual）・AI の分の時間・保留の帯。帯と同じ 1 文で読む
        const extras = await withTenant(
          appPool,
          a.ctx,
          async (cl) => (await cl.query<DetailExtras>(DETAIL_EXTRAS_SQL, [a.id])).rows[0],
        );
        const label = new Map(kindSecs.map((s: Row) => [s["section_key"], s["label"]]));
        return {
          status: 200,
          body: {
            data: {
              ticket: withoutFrozen(t),
              // 区画の並び（K-578 が外すまで残す）。本文の行（鍵 body）は答えの body に出すので並びから除く（K-560）
              sections: secs
                .filter((s) => !s["deleted_at"] && s["section_key"] !== "body")
                .map((s) => ({
                  key: s["section_key"],
                  label: label.get(s["section_key"]) ?? s["section_key"],
                  body: s["body"],
                  version: s["version"],
                })),
              kind: kind ? { id: kind["id"], name: kind["name"], color: kind["color"] ?? null } : null,
              stage: stage ? { id: stage["id"], key: stage["key"], name: stage["name"] } : null,
              assignee: assignee ? { id: assignee["id"], display_name: assignee["display_name"] } : null,
              ...detailExtras(extras, t),
            },
          },
        };
      },
    },
    listMyTicketDrafts: {
      before: async (a: HookArgs) => {
        const v = await withTenant(
          appPool,
          a.ctx,
          async (cl) => (await cl.query<{ v: unknown[] }>("select app.ticket_drafts_mine() as v")).rows[0]!.v,
        );
        return { status: 200, body: { data: v, meta: { limit: v.length } } };
      },
    },
    saveMyTicketDraft: {
      before: async (a: HookArgs) => {
        const id = a.input["draft_id"];
        // 入口と同じ正式な uuid の確かめ（入口が先に断るので重ねの確かめ・K-144）
        if (typeof id !== "string" || !isUuid(id))
          return fail(422, "validation_failed", "VALIDATION_ERROR", {
            details: [{ field: "draft_id", message: "uuid" }],
          });
        const discard = a.input["discard"] === true;
        // 下書きの大きさに上限は置かない（D-130.3）。守りは入口の送る量 1MB だけ
        const body = a.input["body"] ?? {};
        const v = await withTenant(
          appPool,
          a.ctx,
          async (cl) =>
            (
              await cl.query<{ v: unknown }>("select app.ticket_draft_save($1::uuid, $2::jsonb, $3) as v", [
                id,
                JSON.stringify(body),
                discard,
              ])
            ).rows[0]!.v,
        );
        return { status: 201, body: { data: v } };
      },
    },
  };
}

// PC が仕事に付いた資料を受け取る（K-761・契約の口 getFileForBridge・GET /api/v1/bridge/files/:ref?job_id=<仕事の id>）。
//   前の道すじ POST /api/auth-ext/bridge/attachment（auth/agent.ts）の中身を移した。:ref は資料の id。
//   その仕事を受け取った PC だけ・動いている仕事だけ・その仕事に付いた消していない資料だけ（ほかは 404・D-128.163）。
//   署名 URL（期限 10 分）は置き場の関門 C4（ObjectStore.signUrl）が出し、証跡 object.sign（誰に出したか＝仕事の持ち主）を残す。
//   受け口 GET /api/auth-ext/files/:ref は前の道すじのまま（署名と期限だけで判定）。置き場の鍵（storage_ref）・署名の鍵は答えにもログにも出さない
import type pg from "pg";
import { isUuid } from "@kaname/contracts";
import type { ObjectStore } from "@kaname/storage";
import type { Hook, HookArgs, HookReply } from "../../../contract/deps.js";
import { kanameError } from "@kaname/errors";

/** 署名 URL の期限（秒）。前の道すじと同じ 10 分 */
export const FILE_URL_TTL_SEC = 600;

const invalid = (field: string, message: string): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details: [{ field, message }] },
});
/** 止める側に倒す（503・E-PAGE-003）。ログには場所と言葉の種類だけ */
const down = (where: string, word: string): HookReply => {
  console.error(`[${where}] 止める側に倒した（${word}）`);
  return { status: 503, body: kanameError("E-PAGE-003").toJSON() };
};
const notFound = (): HookReply => ({ status: 404, body: { error: "not_found", code: "NOT_FOUND" } });
const gone = (): HookReply => ({ status: 401, body: { error: "unauthenticated", code: "UNAUTHENTICATED" } });
const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};

type FileRow = {
  storage_ref: string;
  name: string | null;
  mime: string | null;
  size: number | null;
  tenant_id: string;
  member_id: string;
};

/** 置き場と配り先の URL（要求のときに読む） */
export type JobFileDeps = () => { objects: ObjectStore | undefined; baseUrl: string };

export function jobFileHooks(pool: pg.Pool, deps: JobFileDeps): Record<string, Hook> {
  return {
    getFileForBridge: {
      before: async (a: HookArgs) => {
        const sid = a.ctx.sessionId ?? null;
        if (!sid) return gone();
        const ref = a.c.req.param("ref") ?? "";
        if (!isUuid(ref)) return invalid("ref", "uuid");
        // job_id は必須（無ければ 422）。空の値（?job_id=）は入口の決まりどおり「指定なし」として扱い、どの仕事も指さない（404）
        const job = a.c.req.query("job_id");
        if (job === undefined) return invalid("job_id", "必須");
        if (job === "") return notFound();
        if (!isUuid(job)) return invalid("job_id", "uuid");
        let v: FileRow | null;
        try {
          v =
            (await pool.query<{ v: FileRow | null }>("select app.bridge_job_file($1, $2, $3) as v", [sid, job, ref]))
              .rows[0]?.v ?? null;
        } catch (e) {
          console.error(`[job-file] 資料を引けなかった（${kindOf(e)}）`);
          return down("job-file", "db");
        }
        if (!v) return notFound();
        const { objects, baseUrl } = deps();
        if (!objects) return down("job-file", "no_store");
        const s = await objects.signUrl(
          { tenantId: v.tenant_id, userId: v.member_id, role: "member" },
          v.storage_ref,
          FILE_URL_TTL_SEC,
        );
        if (s.status !== "done") {
          console.error(`[job-file] 置き場が署名 URL を出せなかった（${s.status}）`);
          return { status: 502, body: kanameError("E-TALK-040").toJSON() };
        }
        return {
          status: 200,
          body: { data: { url: `${baseUrl}/api/auth-ext${s.value.url}`, name: v.name, mime: v.mime, size: v.size } },
        };
      },
    },
  };
}

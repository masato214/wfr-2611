// お知らせの口（K-954）の答えの形：DB の関数（app.member_notices・app.member_notice_read）の jsonb → 契約の Notice（9 欄）・NoticeRead（2 欄）。
//   鍵はちょうど決めた数だけ（関数が余計な鍵を返しても答えに出さない）。続報の 1 行は state・body・at の 3 つ
type Obj = Record<string, unknown>;

export interface NoticeUpdate {
  state: string;
  body: string;
  at: string;
}
export interface NoticeMaintenance {
  from: string;
  to: string;
  impact: string | null;
}
export interface Notice {
  id: string;
  kind: string;
  title: string;
  body: string;
  state: string | null;
  published_at: string;
  unread: boolean;
  maintenance: NoticeMaintenance | null;
  updates: NoticeUpdate[];
}
export interface NoticeRead {
  id: string;
  read_at: string;
}

const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));
const strOrNull = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));

const toMaintenance = (v: unknown): NoticeMaintenance | null => {
  if (v === null || v === undefined) return null;
  const m = obj(v);
  return { from: str(m["from"]), to: str(m["to"]), impact: strOrNull(m["impact"]) };
};

const toUpdate = (v: unknown): NoticeUpdate => {
  const u = obj(v);
  return { state: str(u["state"]), body: str(u["body"]), at: str(u["at"]) };
};

export function toNotice(v: unknown): Notice {
  const n = obj(v);
  return {
    id: str(n["id"]),
    kind: str(n["kind"]),
    title: str(n["title"]),
    body: str(n["body"]),
    state: strOrNull(n["state"]),
    published_at: str(n["published_at"]),
    unread: n["unread"] === true,
    maintenance: toMaintenance(n["maintenance"]),
    updates: Array.isArray(n["updates"]) ? n["updates"].map(toUpdate) : [],
  };
}

export function toNoticeRead(v: unknown): NoticeRead {
  const d = obj(v);
  return { id: str(d["id"]), read_at: str(d["read_at"]) };
}

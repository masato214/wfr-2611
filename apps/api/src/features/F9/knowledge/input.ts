// ナレッジの口の入力の確かめ（K-675）。入口の zod は strict と型・uuid だけを見て、契約の必須・長さ・値域・欄をまたぐ決まりは写さない（K-144 の作り・PM の決め 2026-11-23）。
//   決まりの正本は契約（05_flow/screen_api.d/K-675.py の REQUIRED_INPUTS・VALUE_RANGES・INPUT_RULES）で、ここはそれを口の側で同じに確かめる。
//   口の葉は before の最初に checkKnowledgeInput(操作 ID, a.input) を呼び、null でなければそのまま返す（422・欄の名前つき）。ログに値を出さない
import type { HookReply } from "../../../contract/deps.js";
import { isUuid } from "@kaname/contracts";
import { invalid } from "./reply.js";

type Input = Readonly<Record<string, unknown>>;
type Rule = (v: Input) => string | null;

const SHELVES = ["company", "group", "me"];
const len = (s: string): number => [...s].length;

const has = (v: Input, k: string): boolean => v[k] !== undefined;
/** 文字の欄。need＝無いと断る・blank＝空白だけを断る */
const text =
  (k: string, max: number, o: { need?: boolean; blank?: boolean } = {}): Rule =>
  (v) => {
    if (!has(v, k)) return o.need ? k : null;
    const x = v[k];
    if (typeof x !== "string" || len(x) > max) return k;
    return o.blank && !/\S/.test(x) ? k : null;
  };
const uuid =
  (k: string, o: { nullable?: boolean } = {}): Rule =>
  (v) => {
    if (!has(v, k)) return null;
    const x = v[k];
    if (x === null) return o.nullable ? null : k;
    return typeof x === "string" && isUuid(x) ? null : k;
  };
const shelf: Rule = (v) => (typeof v["shelf"] === "string" && SHELVES.includes(v["shelf"]) ? null : "shelf");
/** グループの棚は group_id（uuid）が要る。会社・自分の棚は group_id を使わない（あっても通す） */
const groupNeedsId: Rule = (v) => {
  if (v["shelf"] !== "group") return uuid("group_id", { nullable: true })(v);
  return typeof v["group_id"] === "string" && isUuid(v["group_id"]) ? null : "group_id";
};
/** 並びの列は DB の int。契約の VALUE_RANGES（05_flow/screen_api.d/K-675.py の _POS_MAX）と同じ上限で、超える数は 422（DB の 22003 で 503 にしない） */
const POSITION_MAX = 2147483647;
const position: Rule = (v) => {
  if (!has(v, "position")) return null;
  const x = v["position"];
  return Number.isInteger(x) && (x as number) >= 0 && (x as number) <= POSITION_MAX ? null : "position";
};
const bool =
  (k: string): Rule =>
  (v) =>
    typeof v[k] === "boolean" ? null : k;
const object =
  (k: string): Rule =>
  (v) => {
    if (!has(v, k)) return null;
    const x = v[k];
    return typeof x === "object" && x !== null && !Array.isArray(x) ? null : k;
  };
/** 欄が 1 つは要る（空の体は欄 body） */
const oneOf =
  (...keys: string[]): Rule =>
  (v) =>
    keys.some((k) => has(v, k)) ? null : "body";

const NAME = 100;
const TITLE = 200;
const DESC = 200;
const TEXT = 10_000;

const RULES: Readonly<Record<string, readonly Rule[]>> = {
  createKnowledgeFolder: [
    shelf,
    groupNeedsId,
    uuid("parent_folder_id", { nullable: true }),
    text("name", NAME, { need: true, blank: true }),
  ],
  updateKnowledgeFolder: [
    oneOf("name", "parent_folder_id", "position"),
    text("name", NAME, { blank: true }),
    uuid("parent_folder_id", { nullable: true }),
    position,
  ],
  createKnowledgePage: [
    shelf,
    groupNeedsId,
    uuid("folder_id", { nullable: true }),
    text("title", TITLE, { need: true, blank: true }),
    text("desc", DESC),
  ],
  saveKnowledgeDraft: [
    oneOf("title", "desc", "doc"),
    text("title", TITLE, { blank: true }),
    text("desc", DESC),
    object("doc"),
  ],
  publishKnowledgePage: [],
  updateKnowledgePage: [oneOf("folder_id", "position"), uuid("folder_id", { nullable: true }), position],
  setKnowledgeMust: [bool("must")],
  findSimilarKnowledge: [
    text("title", TITLE, { need: true, blank: true }),
    text("desc", DESC),
    text("text", TEXT),
    uuid("exclude_page_id"),
  ],
  copyKnowledgePage: [uuid("folder_id", { nullable: true })],
};

const MESSAGE = "入力内容を確認してください";

/** 体を受ける 9 口の入力を確かめる。外れは 422（最初に外れた欄の名前）・通れば null。表に無い口は確かめない */
export function checkKnowledgeInput(op: string, input: Input): HookReply | null {
  for (const rule of RULES[op] ?? []) {
    const field = rule(input);
    if (field) return invalid(field, MESSAGE);
  }
  return null;
}

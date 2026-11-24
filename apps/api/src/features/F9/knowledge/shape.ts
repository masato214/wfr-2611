// ナレッジの答えの形の部品（K-675・土台 3 章）：木の印・置き場の形・場所の字・必ず守るの字数の上限。DB に触らない
export type ShelfKind = "company" | "group" | "me";

/** 必ず守るのページの本文の上限（字）。DB の app.kn_must_text_max() と同じ数（K675-API-017 が突き合わせる） */
export const KNOWLEDGE_MUST_TEXT_MAX = 2000;

/** 置き場（答えの place）。folders は棚の直下からのフォルダの名前 */
export interface PagePlace {
  readonly shelf: ShelfKind;
  readonly shelf_name: string;
  readonly group_id: string | null;
  readonly folder_id: string | null;
  readonly folders: readonly string[];
}

/** 似たページなどの短い 1 行（place は「会社 › 経理」の字） */
export interface PageBrief {
  readonly id: string;
  readonly title: string;
  readonly desc: string;
  readonly place: string;
}

export type TreeMark = "waiting" | "declined" | "draft" | "copy";
export type TreeNode =
  | {
      readonly kind: "page";
      readonly id: string;
      readonly title: string;
      readonly must: boolean;
      readonly mark: TreeMark | null;
    }
  | { readonly kind: "folder"; readonly id: string; readonly name: string; readonly children: readonly TreeNode[] };

export interface MarkFlags {
  readonly draft: boolean;
  readonly waiting: boolean;
  readonly declined: boolean;
  readonly copied: boolean;
}

/** 木の印は 1 つだけ：承認待ち ＞ 断られた ＞ 下書き ＞ 写し。どれも無ければ null */
export function treeMark(f: MarkFlags): TreeMark | null {
  if (f.waiting) return "waiting";
  if (f.declined) return "declined";
  if (f.draft) return "draft";
  if (f.copied) return "copy";
  return null;
}

export function toPlace(
  shelf: ShelfKind,
  shelfName: string,
  groupId: string | null,
  folderId: string | null,
  folders: readonly string[],
): PagePlace {
  return { shelf, shelf_name: shelfName, group_id: groupId, folder_id: folderId, folders: [...folders] };
}

/** 場所の字（棚の名前とフォルダを › でつなぐ） */
export const placeText = (shelfName: string, folders: readonly string[]): string => [shelfName, ...folders].join(" › ");

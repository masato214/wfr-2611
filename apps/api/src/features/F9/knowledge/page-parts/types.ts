// ページの答えの部品の型（K-677・土台 3.1）。page-parts/ の関数はどれも同じ PagePartCtx を受ける。
//   後ろの葉（K-685・K-687・K-689・K-690・K-719）は自分のファイルの中身だけを差し替える。この形を変えるときは持ち主の葉の md と一緒に直す
import type pg from "pg";
import type { ShelfKind } from "../shape.js";

export type PageAct = "must-on" | "must-off" | "raise" | "share" | "copy" | "edit";

/** 読んだページの行（read.ts の 1 文目） */
export interface PageRow {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly state: "draft" | "published";
  readonly is_must: boolean;
  readonly is_personal: boolean;
  readonly scope_id: string;
  readonly owner_member_id: string;
  readonly folder_id: string | null;
  readonly copied_from_page_id: string | null;
  readonly current_version: number;
  readonly updated_at: Date;
}

export interface PagePartCtx {
  readonly cl: pg.PoolClient;
  readonly memberId: string;
  readonly page: PageRow;
  readonly shelf: { readonly kind: ShelfKind; readonly name: string; readonly groupId: string | null };
  readonly writable: boolean;
}

/** 題名の下の帯（承認待ち・断られた）。who_name＝相手の名前・at＝その状態になった時刻（K-687 が作る） */
export interface PageRequest {
  readonly id: string;
  readonly kind: "raise" | "share";
  readonly state: "waiting" | "declined";
  readonly to_name: string;
  readonly who_name: string;
  readonly at: string;
  readonly reason: string | null;
  readonly can_withdraw: boolean;
}

/** 上げる小窓の上げる先・承認する人（K-687 が作る） */
export interface RaiseTo {
  readonly shelf: "group" | "company";
  readonly shelf_name: string;
  readonly group_id: string | null;
  readonly approver_names: readonly string[];
}

/** 共有された側の帯（K-719 が作る） */
export interface SharedFrom {
  readonly group_name: string;
  readonly manager_names: readonly string[];
  readonly writable: false;
}

/** 写しの帯。元が消えた・見えないときは gone true・ほかは空（在るかを漏らさない） */
export interface CopiedFrom {
  readonly page_id: string | null;
  readonly title: string;
  readonly shelf_name: string;
  readonly folders: readonly string[];
  readonly must: boolean;
  readonly gone: boolean;
}

/** 足元の 1 行 */
export interface PageFoot {
  readonly last_editor_name: string | null;
  readonly last_edited_at: string;
  readonly version: number;
  readonly ai_opened_30d: number;
}

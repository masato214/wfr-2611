// UUID v7（時刻順・主キー）。API 層（関門 C2 の中）で生成する。DB 既定の gen_random_uuid() は v4 なので、行の生成は必ずここを通す。
import { randomBytes } from "node:crypto";

export function uuidv7(now: number = Date.now()): string {
  const b = randomBytes(16);
  const ms = BigInt(now);
  b[0] = Number((ms >> 40n) & 0xffn);
  b[1] = Number((ms >> 32n) & 0xffn);
  b[2] = Number((ms >> 24n) & 0xffn);
  b[3] = Number((ms >> 16n) & 0xffn);
  b[4] = Number((ms >> 8n) & 0xffn);
  b[5] = Number(ms & 0xffn);
  b[6] = (b[6]! & 0x0f) | 0x70; // version 7
  b[8] = (b[8]! & 0x3f) | 0x80; // variant
  const h = b.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** 正式な uuid の形（依存を持てない層の正本・K-145）。契約の isUuid（zod 4 の z.uuid()）と同じ文字列：版（1〜8）と variant（8・9・a・b）の桁を見る・
 *  nil と max は通す・大文字は通す・前後の空白は通さない。apps/bridge/src/pairing.ts に同じ文字列を 1 つ置く（K144-SHAPE-019 が同じことを見る） */
export const UUID_RE =
  /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/;

/** 運営の会社の id（0003 の app.ops_tenant_id() と同じ値・K-1001）。同じ値を 2 か所に書かない */
export const OPS_TENANT_ID = "00000000-0000-4000-8000-000000000001";

// 問い合わせの添付の中身の頭を、名乗った種類と照らす（K-950・D-156.11「検査してから受ける」）。
//   中身（ウイルスなど）の検査はしない（D-029）。照らすのは頭のバイトだけ

/** 付けられる種類（D-156.26：画像と PDF と zip） */
export const INQUIRY_MIMES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/zip",
] as const;

const bytes = (s: string): number[] => [...Buffer.from(s, "latin1")];
const starts = (head: Uint8Array, sig: readonly number[], at = 0): boolean =>
  head.length >= at + sig.length && sig.every((b, i) => head[at + i] === b);

/** 種類ごとの決まった頭（どれか 1 つに合えば通る） */
const HEADS: Record<string, (h: Uint8Array) => boolean> = {
  "image/png": (h) => starts(h, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  "image/jpeg": (h) => starts(h, [0xff, 0xd8, 0xff]),
  "image/gif": (h) => starts(h, bytes("GIF87a")) || starts(h, bytes("GIF89a")),
  "image/webp": (h) => starts(h, bytes("RIFF")) && starts(h, bytes("WEBP"), 8),
  "application/pdf": (h) => starts(h, bytes("%PDF-")),
  "application/zip": (h) => starts(h, [0x50, 0x4b, 0x03, 0x04]) || starts(h, [0x50, 0x4b, 0x05, 0x06]),
};

/** 中身の頭が名乗った種類の頭と合うか。知らない種類は通さない */
export function sniffOk(mime: string, head: Uint8Array): boolean {
  const check = HEADS[mime];
  return check ? check(head) : false;
}

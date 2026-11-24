import { notFound } from "next/navigation";

// /ops の中で、まだ頁の無い道（K-946）。無い道を運営の入れ物の中で受ける：Next.js は合わない道を根の not-found で描き、
//   /ops の入れ物（外枠の口で入っていない人をログインへ移す）を通らないため。頁の葉（K-965 ほか）が足した道はそちらが先に当たる
export default function OpsRest(): never {
  notFound();
}

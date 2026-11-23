// 自分の会話の探し方（K-469・D-151.8・D-127.4）：会話の名前と本文（人の書き込みも AI の返事も）で当たる。
//   見えるのは本人の会話だけ（app.user_id() に結ぶ・管理者も他人の会話は読めない）。消した会話・書き込みは関数が外す。
//   DB の関数 app.agent_conversations（0041・0061）をそのまま使う（表記ゆらぎの正規化・% _ の逃がしは関数の中）。
//   並びは関数のまま（星 → 更新の新しい順）を ordinality で保ち、上位 limit 件は SQL の limit で切る。select は 1 本。ログに名前・本文・q を出さない
import type { SearchHit, Searcher } from "./kinds.js";

// $1 そろえた探す言葉・$2 件数
const SQL = `
select e.x->>'id' as id, e.x->>'title' as title, e.x->>'hit' as hit
  from jsonb_array_elements(app.agent_conversations(app.user_id(), $1::text)) with ordinality as e(x, n)
 order by e.n
 limit $2`;

interface Row {
  id: string;
  title: string;
  hit: string | null;
}

export const searchConversations: Searcher = async (cl, input) => {
  // 探す言葉が空なら関数は会話の一覧を丸ごと返す。探す欄を開いただけでは何も返さない（口の入口でも止めるが二重に守る）
  if (input.q === "") return [];
  const rows = (await cl.query<Row>(SQL, [input.q, input.limit])).rows;
  return rows.map((r): SearchHit => ({
    kind: "conversation",
    id: r.id,
    title: r.title,
    snippet: r.hit ?? "",
    url: `/ai/chat?c=${r.id}`,
  }));
};

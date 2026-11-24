# 運営の外枠 OpsShell（領域 ops が作った・領域 ops2 が import する）

外枠ができた。`import { OpsShell } from "@/features/F12/ops/ops-shell"`（"use client"）。利用者の `Shell` は使わない。
本体は外枠の名前（k-shell・k-nav・k-bar）を使うので `components/k/ops-shell.tsx` に置き、この入口が運営だけの見た目 `ops-shell.css`（k-op-）を読み込んで出す（本文の CSS に外枠の名前を書かない・class_gate）。

```tsx
<OpsShell
  screen="ops-support"                       // 左のバーの印を決める
  crumbs={[{ label: "問い合わせ" }]}          // 最後の 1 つは押せない・href を持つ前の段は押せる
  badges={{ support: 3, billing: 2 }}        // 左のバーの数の印（無い・0 なら出さない）
  operator={{ name: "高本 聖斗", initial: "高" }}
  notices={3}                                // 鈴の数（鈴は押せない形）
  banner={<Band …/>}                         // 省略可：帯の上に置く帯（中を見ている間など）
>
  …本文（PageBody / PageHeader / Section など。外枠が main#k-main を持つ）
</OpsShell>
```

- `screen`：`"ops-home" | "ops-tenant" | "ops-team" | "ops-support" | "ops-notices" | "ops-billing" | "ops-skills"`。
  ops2 の 4 つ（ops-support・ops-notices・ops-billing・ops-skills）はそれぞれ 問い合わせ・お知らせ・請求・配るもの の印になる
- 左のバーの行き先は `OPS_NAV`（`/dev/mock/f12-ops2/oq-inbox` など）。本番では呼ぶ側が差し替える
- 767 以下は左のバーを出さず、帯の左のボタンから引き出しが開く（`drawerOpen` を true にすると開いた形で描く）
- 本文の見出し・区画・表・帯・小窓は `@/components/k` を使う。運営の本文で使える補助の部品と css は `features/F12/ops/ops-parts.tsx`・`ops.css`（クラスは `k-op-`）

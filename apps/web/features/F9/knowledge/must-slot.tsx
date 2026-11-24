"use client";
// K-691「必ず守る」の差し込み（page-slots.ts の PAGE_SLOTS に 1 行）。acts の鍵は口の読み（must-on＝付ける・must-off＝外す）。
//   上限の小窓（部品 MustFullDialog・K-671）を overlay に渡す。ページが無い間は何も渡さない
import { MustFullDialog } from "./dialogs";
import type { PageCtx, PageSlot } from "./page-slots";
import { useMust } from "./use-must";

export function useMustSlot(ctx: PageCtx): PageSlot {
  const m = useMust(ctx);
  if (!ctx.page) return {};
  const f = m.full;
  return {
    acts: {
      "must-on": () => void m.press(true),
      "must-off": () => void m.press(false),
    },
    ...(f
      ? {
          overlay: (
            <MustFullDialog
              open={f.open}
              shelf={f.shelfName}
              limit={f.limit}
              target={f.target}
              pages={f.pages}
              busy={f.busy}
              error={f.error}
              onRemove={(id) => void m.removeAndAttach(id)}
              onClose={m.close}
            />
          ),
        }
      : {}),
  };
}

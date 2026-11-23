"use client";
// 詳細の「…」のメニューの見た目（段 5・K-431・キャンバス TdMore。枝 c/段5 の下絵・部品先行）。口とはまだつながず、押したときの関数を props で受けて描くだけ。
//   代表に聞くことのおすすめ：使えるのは「複製する」と「版と差分を見る」だけ。ほかの項目（ほかのグループへ移す・種別を変える・ひな形にする・
//   リンクをコピー・実行の記録を見る・消す）は隠さず、押せない形（薄く・まだ使えません）で出す（キャンバス UiDisabled）。
//   ⌘D・⌘L のキーの字は、動かないので出さない。
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/components/k";
import "./more.css";

interface Item {
  key: string;
  label: string;
  sub?: string;
  /** 使える項目の押したとき（無ければ押せない形） */
  usable?: boolean;
  danger?: boolean;
}

/** 項目の並び（キャンバスの順）。"—" は区切り線 */
const ITEMS: readonly (Item | "—")[] = [
  { key: "duplicate", label: "複製する", usable: true },
  { key: "move", label: "ほかのグループへ移す" },
  { key: "kind", label: "種別を変える", sub: "タスク → 依頼 など" },
  { key: "template", label: "ひな形にする", sub: "この本文の形を次から使う" },
  "—",
  { key: "link", label: "リンクをコピー" },
  { key: "versions", label: "版と差分を見る", usable: true },
  { key: "runs", label: "実行の記録を見る" },
  "—",
  { key: "delete", label: "消す", danger: true },
];

export interface MoreMenuProps {
  /** 最初から開いておく（モックで中身を見せる） */
  defaultOpen?: boolean;
  onDuplicate?: () => void;
  onVersions?: () => void;
}

function Row({ item, handlers }: { item: Item; handlers: Record<string, (() => void) | undefined> }) {
  const body = (
    <span className="k-f4-more-main">
      <span className={item.danger ? "k-f4-more-danger" : undefined}>{item.label}</span>
      {item.sub ? <small>{item.sub}</small> : null}
    </span>
  );
  if (item.usable) {
    return (
      <MenuItem className="k-f4-more-item" onSelect={handlers[item.key]}>
        {body}
      </MenuItem>
    );
  }
  return (
    <MenuItem className="k-f4-more-item" disabled>
      <span title="まだ使えません">{body}</span>
    </MenuItem>
  );
}

/** 詳細の頭の「…」と、開いた一覧 */
export function MoreMenu({ defaultOpen = false, onDuplicate, onVersions }: MoreMenuProps) {
  const handlers = { duplicate: onDuplicate, versions: onVersions };
  return (
    <Menu defaultOpen={defaultOpen}>
      <MenuTrigger label="ほかの操作" className="k-f4-more-btn">
        …
      </MenuTrigger>
      <MenuPopup align="end" className="k-f4-more-popup">
        {ITEMS.map((it, i) =>
          it === "—" ? (
            <div key={`sep-${i}`} role="separator" className="k-f4-more-sep" />
          ) : (
            <Row key={it.key} item={it} handlers={handlers} />
          ),
        )}
      </MenuPopup>
    </Menu>
  );
}

// リンクの道具（小さな入力）の hook（K-567）。
// 出どころ：Tiptap UI Components（https://github.com/ueberdosis/tiptap-ui-components）
//   版（コミット）：799929bea4804c73767562b69f8acc2acdb8ac86（2025-10-07）
//   元のファイルの道：apps/web/src/components/tiptap-ui/link-popover/use-link-popover.ts
// 許諾：MIT License — Copyright (c) 2025 Tiptap
//   許諾の全文はファイルの終わり（写した部分に元の著作権の表示と許諾の文を付ける）
// 改めた所：editor を引数で受ける（useTiptapEditor・アイコン・開く命令 openLink を外す）。付ける前にリンク先を link-policy で確かめ、
//   許されない値は付けずに false を返す（画面が赤い字を出す）。付けた後に何も選んでいないときはリンク先の字を入れる所は元のまま
import { useCallback, useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { normalizeHref } from "../link-policy";
import { useEditorTick } from "./use-mark-button";

/** いまリンクを付けられるか */
export function canSetLink(editor: Editor | null): boolean {
  if (!editor || !editor.isEditable) return false;
  return editor.can().setMark("link");
}

/** いまリンクの上か */
export function isLinkActive(editor: Editor | null): boolean {
  if (!editor || !editor.isEditable) return false;
  return editor.isActive("link");
}

export interface LinkPopoverState {
  canSet: boolean;
  isActive: boolean;
  url: string;
  setUrl: (url: string) => void;
  /** リンクを付ける。許されないリンク先なら付けずに false */
  setLink: () => boolean;
  removeLink: () => void;
  /** 小さな入力を開くときに、いまのリンク先を読み直す */
  refresh: () => void;
}

/** リンクの道具の状態と命令 */
export function useLinkPopover(editor: Editor | null): LinkPopoverState {
  useEditorTick(editor);
  const [url, setUrl] = useState("");

  const refresh = useCallback(() => {
    if (!editor) return;
    const { href } = editor.getAttributes("link") as { href?: string };
    setUrl(isLinkActive(editor) ? (href ?? "") : "");
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    editor.on("selectionUpdate", refresh);
    return () => {
      editor.off("selectionUpdate", refresh);
    };
  }, [editor, refresh]);

  const setLink = useCallback((): boolean => {
    const href = normalizeHref(url);
    if (!editor || !href) return false;
    const isEmpty = editor.state.selection.empty;
    let chain = editor.chain().focus().extendMarkRange("link").setLink({ href });
    if (isEmpty) chain = chain.insertContent({ type: "text", text: href, marks: [{ type: "link", attrs: { href } }] });
    chain.run();
    return true;
  }, [editor, url]);

  const removeLink = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().extendMarkRange("link").unsetLink().setMeta("preventAutolink", true).run();
    setUrl("");
  }, [editor]);

  return { canSet: canSetLink(editor), isActive: isLinkActive(editor), url, setUrl, setLink, removeLink, refresh };
}

/*
 * MIT License
 *
 * Copyright (c) 2025 Tiptap
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

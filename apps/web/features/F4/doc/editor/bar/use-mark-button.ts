// 字の印の道具（太字・斜体・下線・取り消し線・行の中のコード・上付き・下付き）の hook（K-567）。
// 出どころ：Tiptap UI Components（https://github.com/ueberdosis/tiptap-ui-components）
//   版（コミット）：799929bea4804c73767562b69f8acc2acdb8ac86（2025-10-07）
//   元のファイルの道：apps/web/src/components/tiptap-ui/mark-button/use-mark.ts
// 許諾：MIT License — Copyright (c) 2025 Tiptap
//   許諾の全文はファイルの終わり（写した部分に元の著作権の表示と許諾の文を付ける）
// 改めた所：editor を引数で受ける（useTiptapEditor・アイコン・react-hotkeys-hook の呼びを外し、キーは Tiptap の既定に任せる）。
//   描き直しは useEditorTick（このファイルの下・3 つの hook が共有）。今押せるか・押されているか・押したときの命令の中身は元のまま
import { useCallback, useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";

export type MarkType = "bold" | "italic" | "strike" | "code" | "underline" | "superscript" | "subscript";

const isMarkInSchema = (type: MarkType, editor: Editor | null): boolean => !!editor?.schema.marks[type];
const isImageSelected = (editor: Editor): boolean => editor.isActive("image");

/** いま印を付け外しできるか */
export function canToggleMark(editor: Editor | null, type: MarkType): boolean {
  if (!editor || !editor.isEditable) return false;
  if (!isMarkInSchema(type, editor) || isImageSelected(editor)) return false;
  return editor.can().toggleMark(type);
}

/** いま印が付いているか */
export function isMarkActive(editor: Editor | null, type: MarkType): boolean {
  if (!editor || !editor.isEditable) return false;
  return editor.isActive(type);
}

/** 印を付け外しする */
export function toggleMark(editor: Editor | null, type: MarkType): boolean {
  if (!editor || !canToggleMark(editor, type)) return false;
  return editor.chain().focus().toggleMark(type).run();
}

export interface MarkButtonState {
  canToggle: boolean;
  isActive: boolean;
  handleMark: () => boolean;
}

/** 字の印の道具の状態と命令 */
export function useMarkButton(editor: Editor | null, type: MarkType): MarkButtonState {
  useEditorTick(editor);
  const handleMark = useCallback(() => toggleMark(editor, type), [editor, type]);
  return { canToggle: canToggleMark(editor, type), isActive: isMarkActive(editor, type), handleMark };
}

// ---- 編集の部品が変わるたび（選びの移り・取引）に帯の道具を描き直す（元のリポジトリの useTiptapEditor の代わり・3 つの hook が共有）
/** editor の取引ごとに数を 1 つ進めて、呼んだ部品を描き直させる */
export function useEditorTick(editor: Editor | null): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const bump = (): void => setTick((n) => n + 1);
    editor.on("transaction", bump);
    editor.on("selectionUpdate", bump);
    editor.on("focus", bump);
    return () => {
      editor.off("transaction", bump);
      editor.off("selectionUpdate", bump);
      editor.off("focus", bump);
    };
  }, [editor]);
  return tick;
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

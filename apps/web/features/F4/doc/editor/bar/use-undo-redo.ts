// 戻す・やり直すの道具の hook（K-567）。
// 出どころ：Tiptap UI Components（https://github.com/ueberdosis/tiptap-ui-components）
//   版（コミット）：799929bea4804c73767562b69f8acc2acdb8ac86（2025-10-07）
//   元のファイルの道：apps/web/src/components/tiptap-ui/undo-redo-button/use-undo-redo.ts
// 許諾：MIT License — Copyright (c) 2025 Tiptap
//   許諾の全文はファイルの終わり（写した部分に元の著作権の表示と許諾の文を付ける）
// 改めた所：editor を引数で受ける（useTiptapEditor・アイコン・react-hotkeys-hook の呼びを外し、キーは Tiptap の既定に任せる）。
//   描き直しは useEditorTick。今押せるか・押したときの命令の中身は元のまま
import { useCallback } from "react";
import type { Editor } from "@tiptap/react";
import { useEditorTick } from "./use-mark-button";

export type UndoRedoAction = "undo" | "redo";

/** いま戻せる・やり直せるか */
export function canExecuteUndoRedoAction(editor: Editor | null, action: UndoRedoAction): boolean {
  if (!editor || !editor.isEditable) return false;
  if (editor.isActive("image")) return false;
  return action === "undo" ? editor.can().undo() : editor.can().redo();
}

/** 戻す・やり直す */
export function executeUndoRedoAction(editor: Editor | null, action: UndoRedoAction): boolean {
  if (!editor || !canExecuteUndoRedoAction(editor, action)) return false;
  const chain = editor.chain().focus();
  return action === "undo" ? chain.undo().run() : chain.redo().run();
}

export interface UndoRedoState {
  canExecute: boolean;
  handleAction: () => boolean;
}

/** 戻す・やり直すの道具の状態と命令 */
export function useUndoRedo(editor: Editor | null, action: UndoRedoAction): UndoRedoState {
  useEditorTick(editor);
  const handleAction = useCallback(() => executeUndoRedoAction(editor, action), [editor, action]);
  return { canExecute: canExecuteUndoRedoAction(editor, action), handleAction };
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

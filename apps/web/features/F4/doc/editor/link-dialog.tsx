"use client";
// リンクの小さな入力（K-567）：名前『リンク』・入力欄『リンク先』・ボタン『リンクを外す』『付ける』。
//   見た目は下絵 v2 の f4v2-editor-link・f4v2-editor-link-error と同じ class（k-f4d-pop k-f4d-pop-link・k-f4d-pop-title・k-f4d-pop-acts・k-field・k-input・k-err）。
//   決められるのは http・https・mailto だけ（link-policy）。通らない値で『付ける』を押すと、小さな入力の中に role="alert" で理由を出して付けない。Esc で閉じる
import { useEffect, useId, useRef, type KeyboardEvent } from "react";
import { Button } from "@/components/k";

export const BAD_LINK = "http・https・mailto のリンクだけ使えます";

export interface LinkDialogProps {
  url: string;
  error: boolean;
  onUrl: (url: string) => void;
  onApply: () => void;
  onRemove: () => void;
  onClose: () => void;
}

export function LinkDialog({ url, error, onUrl, onApply, onRemove, onClose }: LinkDialogProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  const onKey = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };
  return (
    <div role="dialog" aria-label="リンク" className="k-f4d-pop k-f4d-pop-link" data-at="end" onKeyDown={onKey}>
      <p className="k-f4d-pop-title">リンク</p>
      <div className="k-field" data-size="md" {...(error ? { "data-invalid": "" } : {})}>
        <label className="k-label" htmlFor={`${id}-href`}>
          リンク先
        </label>
        <input
          ref={input}
          id={`${id}-href`}
          className="k-input"
          name="link_href"
          type="text"
          inputMode="url"
          autoComplete="off"
          value={url}
          aria-invalid={error || undefined}
          {...(error ? { "aria-describedby": `${id}-err`, "data-invalid": "" } : {})}
          onChange={(e) => onUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onApply();
            }
          }}
        />
        {error ? (
          <p id={`${id}-err`} className="k-err" role="alert">
            {BAD_LINK}
          </p>
        ) : null}
      </div>
      <div className="k-f4d-pop-acts">
        <Button variant="ghost" size="sm" onClick={onRemove}>
          リンクを外す
        </Button>
        <Button size="sm" onClick={onApply}>
          付ける
        </Button>
      </div>
    </div>
  );
}

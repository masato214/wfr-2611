"use client";
// 詳細の右のパネルの「やり取り」の流れ（人のコメントと更新の行が 1 つの流れで並ぶ・Backlog のコメント欄と同じ）。
//   段 7 のやり取り（c/段7 の features/F6/thread）と同じ形（顔・書き込み・変更の 1 行・日の区切り・書く欄）を、段 5 の下絵用に写した。
//   本物にするときは段 7 の部品を使う（ここは見た目の下絵だけ）。機械でも AI でも名前は「AI」の 1 つ
import type { ReactNode } from "react";
import { Button, TextArea } from "@/components/k";
import "./thread.css";

type Who = { name: string; initial: string; tone?: "indigo" | "teal" | "lavender" };
const TAKAMOTO: Who = { name: "高本", initial: "高", tone: "indigo" };
const SATO: Who = { name: "佐藤", initial: "佐", tone: "teal" };
const AI: Who = { name: "AI", initial: "AI" };

function Avatar({ who, small }: { who: Who; small?: boolean }) {
  return (
    <span className="k-f4d-talk-avatar" data-tone={who.tone} data-size={small ? "sm" : undefined} aria-hidden="true">
      {who.initial}
    </span>
  );
}
function Post({ who, time, body }: { who: Who; time: string; body: ReactNode }) {
  return (
    <article className="k-f4d-talk-post" aria-label={`${who.name} ${time}`}>
      <Avatar who={who} />
      <div className="k-f4d-talk-main">
        <div className="k-f4d-talk-head">
          <b>{who.name}</b>
          <time>{time}</time>
        </div>
        <p>{body}</p>
      </div>
    </article>
  );
}
function Line({ who, text, time }: { who: Who; text: ReactNode; time: string }) {
  return (
    <div className="k-f4d-talk-line">
      <Avatar who={who} small />
      <span>{text}</span>
      <time>{time}</time>
    </div>
  );
}

/** やり取りのタブの中身：流れ（上）と書く欄（下） */
export function TalkBody() {
  return (
    <div className="k-f4d-talk">
      <div className="k-f4d-talk-thread" role="feed" aria-label="やり取り">
        <div className="k-f4d-talk-day">11/21（土）</div>
        <Post who={TAKAMOTO} time="10:25" body="先月と同じ書式でお願いします" />
        <Line
          who={TAKAMOTO}
          text={
            <>
              <b>高本</b>が担当者を 佐藤 → 高本 に変えました
            </>
          }
          time="10:30"
        />
        <Line
          who={TAKAMOTO}
          text={
            <>
              <b>高本</b>が確認項目を足しました：承認する人が中身を見る
            </>
          }
          time="10:36"
        />
        <Line
          who={AI}
          text={
            <>
              <b>AI</b>が確認項目『PDF の合計が請求額と合う』にチェックを付けました
            </>
          }
          time="10:41"
        />
        <Line
          who={SATO}
          text={
            <>
              <b>佐藤</b>が確認項目『承認する人が中身を見る』にチェックを付けました
            </>
          }
          time="10:42"
        />
        <Post who={SATO} time="10:45" body="金額を確認しました、送って大丈夫です" />
      </div>
      <div className="k-f4d-talk-composer">
        <TextArea
          label={<span className="k-f4d-sr">書き込み</span>}
          name="message_body"
          placeholder="書き込む（@ で人を呼べます）"
          rows={1}
        />
        <div className="k-f4d-talk-send">
          <Button size="sm">書き込む</Button>
        </div>
      </div>
    </div>
  );
}

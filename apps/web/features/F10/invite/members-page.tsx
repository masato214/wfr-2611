"use client";
// メンバー（K-420・画面 members・道 /members）。外枠（TicketShell）の中に、ワークスペースの管理の頭（WsHead）・第 2 ナビ（WsSub）・本文（MembersBody）。
//   見た目はモック /dev/mock/f8/inv-* と同じ部品（views.tsx）。動き：getWorkspaceMembers（K-419）を 1 回読む → グループごとの並び。
//   「＋ 招く」の小窓：足す（宛てをそろえて形を見る）・外す・グループと役割・ひとこと・リンク。送るのは createInvitations（K-419）、リンクは createInvitationLink（K-421）。
//   管理者として招く（口が 403・STEP_UP_REQUIRED）なら本人確認の取り直し（step-up.tsx）を出し、通ったら止まった操作を 1 回だけ送り直す。
//   口の断り方の出し分けは状態でなく答えの code と details：宛てごとの文（E-INV-009・010）と 51 人以上（E-INV-012）は欄の下、ほか（404・503 など）は小窓の上の赤い箱。書いた中身は残す。
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import type { Ops } from "@kaname/contracts";
import { CATALOG } from "@kaname/errors/catalog";
import { Loading, Toaster, useNotify } from "@/components/k";
import { PAGE_ERROR, errorCodeOf } from "@/components/k/error-of";
import { call, type CallErr } from "@/lib/api/call";
import { me } from "@/lib/auth/ext";
import { StepUp } from "@/features/F1/security/step-up";
import { ONCE, TicketShell } from "@/features/F4/create-ticket/ticket-shell";
import { isEmail, MEMBERS_KEY, SCREEN, splitEmails, useMembers } from "./use-members";
import { InviteDialog, MembersBody, WsHead, WsSub, type InviteValues } from "./views";

const LOAD_FAILED = "メンバーを読み込めませんでした";
const NEED_ONE = "メールを 1 つ以上入れてください";
const STEP_UP_REASON = "管理者として招く前に、本人か確かめます";
const COPIED = "招待のリンクをコピーしました";
const COPY_FAILED = "コピーできませんでした。リンクを選んでコピーしてください";
const NOTE_TOO_LONG = "ひとことは 500 字までです";
/** ひとことの上限（口 createInvitations と invitations_message_len と同じ 500・数え方も口と同じく字ごと） */
const MESSAGE_MAX = 500;
const msgOf = (code: string): string => CATALOG[code]?.message ?? "";

const EMPTY: InviteValues = { typing: "", emails: [], group: "", role: "member", message: "" };

/** 欄に打った字を足す。形の違う字は並びに入れず、欄に残して理由を返す（同じ宛ては 1 つ） */
function absorb(v: InviteValues): { values: InviteValues; error: string | null } {
  const parts = splitEmails(v.typing);
  if (parts.length === 0) return { values: v, error: null };
  const good = parts.filter(isEmail);
  const bad = parts.filter((p) => !isEmail(p));
  const emails = [...v.emails, ...good.filter((e, i) => !v.emails.includes(e) && good.indexOf(e) === i)];
  if (bad.length === 0) return { values: { ...v, emails, typing: "" }, error: null };
  const typing = good.length === 0 ? v.typing : bad.join(", ");
  return { values: { ...v, emails, typing }, error: bad.map((b) => `${b} はメールの形ではありません`).join("。") };
}

/** 口が断ったときの宛てごとの文を「。」でつなぐ。E-INV-010 は detail.already の宛て（details は付かない・K-419）、E-INV-009 は details の email と message */
function detailText(r: CallErr): string {
  if (r.code === "E-INV-010") {
    const raw = (r.body["detail"] as { already?: unknown } | undefined)?.already;
    const already = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
    return already.map((email) => `${email} は${msgOf("E-INV-010")}`).join("。");
  }
  const d = Array.isArray(r.body["details"]) ? (r.body["details"] as { email?: string; message?: string }[]) : [];
  return d
    .filter((x) => x.email && x.message)
    .map((x) => `${x.email} は${x.message}`)
    .join("。");
}

/** 小窓の上の赤い箱に出す文（401 はログイン切れ・正本の文・口の文の順） */
function noticeOf(r: CallErr): string {
  if (r.status === 401) return msgOf(PAGE_ERROR.sessionExpired);
  return msgOf(r.code) || r.message || msgOf(errorCodeOf(r));
}

interface Sent {
  email: string;
  mail: string;
}
const sentText = (sent: Sent[], n: number): string =>
  n > 1 ? `${n} 人に招待を送りました` : `${sent[0]?.email ?? ""} に招待を送りました`;
const failedText = (sent: Sent[]): string | undefined => {
  const failed = sent.filter((s) => s.mail === "failed").map((s) => s.email);
  return failed.length ? `${failed.join("・")} にはメールが届きませんでした。もう一度招いてください` : undefined;
};

/** 止まった操作を取り直しのあとで 1 回だけ送り直すために、送る中身ごと持つ */
type Req =
  | { kind: "invite"; body: Ops["createInvitations"]["body"] }
  | { kind: "link"; body: Ops["createInvitationLink"]["body"] };

export function MembersPage() {
  const qc = useQueryClient();
  const notify = useNotify();
  const members = useMembers();
  const who = useQuery({ queryKey: ["me"], queryFn: me, ...ONCE });
  const view = members.data;

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<InviteValues>(EMPTY);
  const [localErr, setLocalErr] = useState<string | null>(null);
  const [noteErr, setNoteErr] = useState<string | null>(null);
  const [serverErr, setServerErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [stepUp, setStepUp] = useState<{ withCode: boolean; withPasskey: boolean } | null>(null);
  const sending = useRef(false);
  const pending = useRef<Req | null>(null);

  const company = (who.data as { workspace_name?: string | null } | undefined)?.workspace_name?.trim() ?? "";

  const reset = () => {
    setLocalErr(null);
    setNoteErr(null);
    setServerErr(null);
    setNotice(null);
    setLink(null);
    setMore(false);
  };
  const openDialog = () => {
    reset();
    setForm({ ...EMPTY, group: view?.scopes[0]?.id ?? "" });
    setOpen(true);
  };
  const close = () => {
    if (sending.current) return;
    setOpen(false);
  };

  // ---- 欄の動き
  const typing = (v: string) => {
    setLocalErr(null);
    setForm((f) => ({ ...f, typing: v }));
  };
  const add = () => {
    const r = absorb(form);
    setForm(r.values);
    setLocalErr(r.error);
    if (r.values.emails.length !== form.emails.length) setServerErr(null);
  };
  const remove = (email: string) => {
    setServerErr(null);
    setForm((f) => ({ ...f, emails: f.emails.filter((e) => e !== email) }));
  };
  const pick = (patch: Partial<InviteValues>) => {
    setLink(null); // 作ったリンクは選んだグループと役割のもの（変えたら出さない）
    setForm((f) => ({ ...f, ...patch }));
  };

  // ---- 口を呼ぶ（招く・リンク）。403・STEP_UP_REQUIRED は取り直しの後に 1 回だけ送り直す
  const askStepUp = async () => {
    const s = await call("getMySecurity", { screenId: SCREEN, keepOn401: true });
    const sec = s.ok ? s.data : {};
    setStepUp({ withCode: sec.two_factor === true, withPasskey: sec.has_password === false });
  };

  const showFailure = (r: CallErr) => {
    if (r.code === "E-INV-009" || r.code === "E-INV-010") setServerErr(detailText(r) || msgOf(r.code));
    else if (r.code === "E-INV-012") setServerErr(msgOf(r.code));
    else setNotice(noticeOf(r));
  };

  const run = async (req: Req, retried: boolean): Promise<void> => {
    if (sending.current) return;
    sending.current = true;
    const setWait = req.kind === "invite" ? setBusy : setLinkBusy;
    setWait(true);
    setNotice(null);
    setServerErr(null);
    try {
      const r =
        req.kind === "invite"
          ? await call("createInvitations", { body: req.body, screenId: SCREEN })
          : await call("createInvitationLink", { body: req.body, screenId: SCREEN });
      if (r.ok) {
        pending.current = null;
        if (req.kind === "link") return setLink((r.data as unknown as { url?: string }).url ?? null);
        const sent = (r.data as unknown as { invitations?: Sent[] }).invitations ?? [];
        setOpen(false);
        const failed = failedText(sent);
        notify(sentText(sent, req.body.emails.length), failed ? { description: failed } : {});
        void qc.invalidateQueries({ queryKey: MEMBERS_KEY });
        return;
      }
      if (r.kind === "step_up" && !retried) {
        pending.current = req;
        return await askStepUp();
      }
      showFailure(r);
    } catch {
      setNotice(msgOf(PAGE_ERROR.offline)); // 網が切れた（口に届かない）：書いた中身は残す
    } finally {
      sending.current = false;
      setWait(false);
    }
  };

  const send = () => {
    if (sending.current) return;
    const r = absorb(form);
    setForm(r.values);
    setLocalErr(r.error);
    if (r.error) return;
    if (r.values.emails.length === 0) return setLocalErr(NEED_ONE);
    const message = r.values.message.trim();
    if (Array.from(message).length > MESSAGE_MAX) return setNoteErr(NOTE_TOO_LONG);
    setNoteErr(null);
    void run(
      {
        kind: "invite",
        body: {
          emails: [...r.values.emails],
          scope_id: r.values.group,
          role_key: r.values.role,
          ...(message ? { message } : {}),
        },
      },
      false,
    );
  };
  const makeLink = () => void run({ kind: "link", body: { scope_id: form.group, role_key: form.role } }, false);
  const copy = () => {
    if (!link) return;
    navigator.clipboard.writeText(link).then(
      () => void notify(COPIED),
      () => void notify(COPY_FAILED, { type: "error" }),
    );
  };

  const emailsError = [localErr, serverErr].filter(Boolean).join("。");
  return (
    <Toaster>
      <TicketShell screen="members" crumbs={[{ label: "ワークスペースの管理", disabled: true }, { label: "メンバー" }]}>
        {members.isPending || who.isPending ? (
          <Loading />
        ) : (
          <>
            <WsHead name={company} initial={company.slice(0, 1)} />
            <div className="k-me-wrap">
              <WsSub members={view?.count ?? 0} />
              <MembersBody
                groups={view?.groups ?? []}
                inviteDisabled={!view}
                onInvite={openDialog}
                {...(members.isError ? { failure: { text: LOAD_FAILED, onRetry: () => void members.refetch() } } : {})}
              />
            </div>
          </>
        )}
        <InviteDialog
          open={open && stepUp === null}
          values={form}
          errors={{ ...(emailsError ? { emails: emailsError } : {}), ...(noteErr ? { message: noteErr } : {}) }}
          {...(notice ? { notice } : {})}
          {...(link ? { link } : {})}
          more={more}
          groups={view?.scopes ?? []}
          busy={busy}
          linkBusy={linkBusy}
          onTyping={typing}
          onAdd={add}
          onRemove={remove}
          onGroup={(group) => pick({ group })}
          onRole={(role) => pick({ role })}
          onMessage={(message) => {
            setNoteErr(null);
            setForm((f) => ({ ...f, message }));
          }}
          onMore={setMore}
          onLink={makeLink}
          onCopy={copy}
          onSend={send}
          onCancel={close}
        />
        <StepUp
          open={stepUp !== null}
          reason={STEP_UP_REASON}
          withCode={stepUp?.withCode ?? false}
          withPasskey={stepUp?.withPasskey ?? false}
          onDone={() => {
            setStepUp(null);
            const req = pending.current;
            if (req) void run(req, true);
          }}
          onCancel={() => {
            setStepUp(null);
            pending.current = null;
          }}
        />
      </TicketShell>
    </Toaster>
  );
}

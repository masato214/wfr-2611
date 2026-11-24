"use client";
// 確認のメールのリンクを開いた画面（/invite/confirm/:token・K-423）。画面の中身は features/F2/invite/confirm-page。ここは入れ物だけ
import { Suspense } from "react";
import { AuthLoading } from "@/features/F1/sign-up/auth-loading";
import { InviteConfirmPage } from "@/features/F2/invite/confirm-page";

export default function InviteConfirmRoute() {
  return (
    <Suspense fallback={<AuthLoading />}>
      <InviteConfirmPage />
    </Suspense>
  );
}

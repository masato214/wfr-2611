# K-945 パスキーを付けるリンクの口（startOpsSetup）：契約の形は screen_api.d/K-945.py に書いた。ここは口が「無い」ことで 422 にする欄だけ
REQUIRED_INPUTS = {
    "startOpsSetup": {"token"},   # apps/api/src/features/F12/ops-setup/setup.ts（印が無い・43 字の base64url でないは 422・strict）
}

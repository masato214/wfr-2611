# K-985 運営の人を読む・足す口（listOpsMembers・addOpsMember）：契約の形は screen_api.d/K-985.py に書いた。ここは口が「無い」ことで 422 にする欄だけ
REQUIRED_INPUTS = {
    "addOpsMember": {"email", "caps"},   # apps/api/src/features/F12/ops/team.ts（メール・できることが無いは 422・strict）
}

# 口の値域（契約 screen_api.d と同じ数）：メールは 3〜254 字（team.ts の checkAddInput）・入るときの名前は 1〜40 字（ops-setup/setup.ts・K-985 が足した欄）
VALUE_RANGES = {
    "addOpsMember": {"email": {"minLength": 3, "maxLength": 254}},
    "startOpsSetup": {"name": {"minLength": 1, "maxLength": 40}},
}

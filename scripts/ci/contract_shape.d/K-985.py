# K-985 運営の人を読む・足す口（listOpsMembers・addOpsMember）：契約の形は screen_api.d/K-985.py に書いた。ここは口が「無い」ことで 422 にする欄だけ
REQUIRED_INPUTS = {
    "addOpsMember": {"email", "caps"},   # apps/api/src/features/F12/ops/team.ts（メール・できることが無いは 422・strict）
}

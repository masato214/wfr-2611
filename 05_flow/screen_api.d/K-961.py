# K-961 選べるプラン（listWorkspacePlans）とプランを変える（changePlan）の振る舞いの断り方（答えの形は K-1005）
#   上げるとすぐ・下げると来月 1 日から・人数が上限を超えるプランには下げられない（D-128.65・D-156.36・D-156.51）
ERRORS_4XX = {
    "changePlan": [
        {"status": 404, "code": "E-PAGE-001", "body": {"error": "not_found", "code": "E-PAGE-001"}, "errors": ["E-PAGE-001"],
         "trigger": "プランの鍵が無い・消したプラン（欄も details も付けない＝在るかを漏らさない）",
         "ears_form": "UNWANTED: IF 無いプランの鍵を選んだなら、Kaname は 404 と E-PAGE-001 を返し、契約も頼みの行も変えない"},
        {"status": 409, "code": "E-PLAN-001", "body": {"error": "conflict", "code": "E-PLAN-001"}, "errors": ["E-PLAN-001", "E-PLAN-002"],
         "trigger": "今のプランを選んだ（下げる予定が無いとき・同時に 2 人が同じプランに上げたときの後の 1 つも）（E-PLAN-001）・人数が選んだプランの上限を超える（E-PLAN-002・detail に members と member_limit）",
         "ears_form": "UNWANTED: IF 今のプランか人数が上限を超えるプランを選んだなら、Kaname は 409 と E-PLAN-001／E-PLAN-002 を返し、契約も頼みの行も変えない"},
    ],
}

# 変える口は新しい物を返すのではなく、今の契約を変えた結果を返す（POST だが 200）
SUCCESS_STATUS = {
    "changePlan": 200,
}

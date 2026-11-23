// 生成物（scripts/ci/errors_used.mjs gen ← 07_qa/test-specs/errors.json）。手で直さない。263 件
export interface CatalogEntry {
  id: string;
  cls: string;
  message: string;
  action: string;
  undo: boolean;
  severity: string;
  support_code: string;
  must_not: boolean;
  layers: string[];
  where: Record<string, unknown>;
}
export const CATALOG: Record<string, CatalogEntry> = {
  "E-AUTH-001": {
    "id": "E-AUTH-001",
    "cls": "auth",
    "message": "メールアドレスかパスワードが違います。あと 4 回で 15 分ロックします",
    "action": "入力し直す／パスワードを忘れた",
    "undo": false,
    "severity": "high",
    "support_code": "AUTH-001",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "login",
      "state": "e"
    }
  },
  "E-AUTH-002": {
    "id": "E-AUTH-002",
    "cls": "auth",
    "message": "15 分間ロックしました。15 分たってから、もう一度入ってください",
    "action": "15 分待ってから入り直す。急ぐときはパスキーかパスワードの再設定で入る",
    "undo": false,
    "severity": "critical",
    "support_code": "AUTH-002",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "login",
      "state": "e"
    }
  },
  "E-AUTH-003": {
    "id": "E-AUTH-003",
    "cls": "auth",
    "message": "リンクの期限が切れました。もう一度登録してください",
    "action": "もう一度登録する",
    "undo": false,
    "severity": "medium",
    "support_code": "E-AUTH-003",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "verify-email",
      "state": "x"
    }
  },
  "E-AUTH-004": {
    "id": "E-AUTH-004",
    "cls": "auth",
    "message": "コードが違います。認証アプリの時刻が合っているか確かめてください",
    "action": "もう一度入力する／時刻を合わせる",
    "undo": false,
    "severity": "high",
    "support_code": "AUTH-004",
    "must_not": true,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "mfa-setup"
    }
  },
  "E-AUTH-005": {
    "id": "E-AUTH-005",
    "cls": "auth",
    "message": "アカウントの状態が変わったので、ログインし直してください",
    "action": "ログインへ",
    "undo": false,
    "severity": "critical",
    "support_code": "E-AUTH-005",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "account-close",
      "choke_point": "C8"
    }
  },
  "E-AUTH-006": {
    "id": "E-AUTH-006",
    "cls": "auth",
    "message": "このリンクはもう使えません。もう一度、再設定メールを送ってください",
    "action": "再設定メールを送る",
    "undo": false,
    "severity": "medium",
    "support_code": "E-AUTH-006",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "password-reset"
    }
  },
  "E-PERM-001": {
    "id": "E-PERM-001",
    "cls": "permission",
    "message": "この権限では見えません。見える範囲は代表が決めています",
    "action": "今日へ戻る／代表に頼む",
    "undo": false,
    "severity": "high",
    "support_code": "E-PERM-001",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "goals"
    }
  },
  "E-PERM-002": {
    "id": "E-PERM-002",
    "cls": "permission",
    "message": "配分を変えられるのは部門長と代表です。提案として送れます",
    "action": "提案として送る／やめる",
    "undo": false,
    "severity": "high",
    "support_code": "E-PERM-002",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "goal-allocation"
    }
  },
  "E-VAL-001": {
    "id": "E-VAL-001",
    "cls": "validation",
    "message": "やることを 1 行で書いてください（100 文字まで）",
    "action": "入力し直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-VAL-001",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tasks",
      "state": "a"
    }
  },
  "E-VAL-002": {
    "id": "E-VAL-002",
    "cls": "validation",
    "message": "親の目標は「円」、この目標は「件」です。変換のしかた（1 件＝いくら）を決めてください",
    "action": "変換を決める／単位を合わせる",
    "undo": false,
    "severity": "medium",
    "support_code": "E-VAL-002",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "goal-edit"
    }
  },
  "E-VAL-003": {
    "id": "E-VAL-003",
    "cls": "validation",
    "message": "秘密鍵の形式が違います。認証アプリの設定画面に出る 32 文字を貼ってください",
    "action": "貼り直す／秘密鍵の場所を見る",
    "undo": false,
    "severity": "medium",
    "support_code": "E-VAL-003",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "credentials"
    }
  },
  "E-VAL-004": {
    "id": "E-VAL-004",
    "cls": "validation",
    "message": "メールアドレスの形式が違います",
    "action": "入力し直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-VAL-004",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "signup"
    }
  },
  "E-NF-001": {
    "id": "E-NF-001",
    "cls": "not_found",
    "message": "この招待は取り消されています。招いた人にもう一度送ってもらってください",
    "action": "招いた人に連絡する",
    "undo": false,
    "severity": "medium",
    "support_code": "E-NF-001",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "invite-accept",
      "state": "x"
    }
  },
  "E-NF-002": {
    "id": "E-NF-002",
    "cls": "not_found",
    "message": "この案件はもうありません（削除されたか、見える範囲が変わりました）",
    "action": "台帳へ戻る",
    "undo": false,
    "severity": "medium",
    "support_code": "E-NF-002",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "record-detail"
    }
  },
  "E-CONF-001": {
    "id": "E-CONF-001",
    "cls": "conflict",
    "message": "このメールアドレスは既に登録されています。ログインするか、パスワードを再設定してください",
    "action": "ログイン／パスワードを再設定",
    "undo": false,
    "severity": "high",
    "support_code": "E-CONF-001",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "signup",
      "state": "e"
    }
  },
  "E-CONF-002": {
    "id": "E-CONF-002",
    "cls": "conflict",
    "message": "田中さんが先にこの案件を変えました。最新を読み込んでから直してください",
    "action": "最新を読み込む／自分の変更を見る",
    "undo": false,
    "severity": "high",
    "support_code": "E-CONF-002",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "record-detail",
      "choke_point": "C2"
    }
  },
  "E-CONF-003": {
    "id": "E-CONF-003",
    "cls": "conflict",
    "message": "この承認はもう処理されています",
    "action": "動きを見る",
    "undo": false,
    "severity": "critical",
    "support_code": "E-CONF-003",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "approvals",
      "choke_point": "C1"
    }
  },
  "E-DEP-001": {
    "id": "E-DEP-001",
    "cls": "dependency",
    "message": "行き先のないタスクが 3 件あります。目標を選ぶまで赤で残ります",
    "action": "目標を選ぶ／自主目標にする／やめる",
    "undo": false,
    "severity": "medium",
    "support_code": "E-DEP-001",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tasks",
      "state": "o"
    }
  },
  "E-DEP-002": {
    "id": "E-DEP-002",
    "cls": "dependency",
    "message": "未配分が 3 件あります。配り切るまで赤で残ります",
    "action": "配分を見直す",
    "undo": false,
    "severity": "medium",
    "support_code": "E-DEP-002",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "goals",
      "state": "u"
    }
  },
  "E-DEP-003": {
    "id": "E-DEP-003",
    "cls": "dependency",
    "message": "この目標には 4 件のタスクと 2 件の仮説が紐づいています。行き先を決めてから終えられます",
    "action": "行き先を決める／まとめて自主目標に",
    "undo": false,
    "severity": "high",
    "support_code": "E-DEP-003",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "goal-edit"
    }
  },
  "E-EXT-001": {
    "id": "E-EXT-001",
    "cls": "external",
    "message": "発注ナビの画面が変わり、営業社員の覚えた操作が手順 3 で止まりました。覚え直させると再開できます",
    "action": "覚え直させる／このまま止めておく",
    "undo": false,
    "severity": "high",
    "support_code": "E-EXT-001",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "onboard-testrun",
      "state": "x"
    }
  },
  "E-EXT-002": {
    "id": "E-EXT-002",
    "cls": "external",
    "message": "止まっている操作が 1 件あります。画面を見ながら手順を作り直します",
    "action": "覚え直しを始める",
    "undo": false,
    "severity": "medium",
    "support_code": "E-EXT-002",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "automation-repair",
      "state": "n"
    }
  },
  "E-EXT-003": {
    "id": "E-EXT-003",
    "cls": "external",
    "message": "セイコー様への追いメールの送信が、先方のメールサーバーの都合で失敗しました。書いたものは残っています",
    "action": "もう一度送る／別の宛先で送る／やめる",
    "undo": false,
    "severity": "high",
    "support_code": "E-EXT-003",
    "must_not": false,
    "layers": [
      "API"
    ],
    "where": {
      "screen": "clone-chat",
      "state": "x",
      "choke_point": "C6"
    }
  },
  "E-EXT-004": {
    "id": "E-EXT-004",
    "cls": "external",
    "message": "発注ナビで本人確認（CAPTCHA）が出たので止めました。あなたが一度通すと、続きから動きます",
    "action": "自分で通しに行く／あとで",
    "undo": false,
    "severity": "critical",
    "support_code": "E-EXT-004",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "onboard-testrun"
    }
  },
  "E-CONN-001": {
    "id": "E-CONN-001",
    "cls": "connectivity",
    "message": "まだつながっていません。Bridge を開いたら、この画面が自分で気づきます",
    "action": "Bridge を開く／入れる（接続を確かめる を押してもよい）",
    "undo": false,
    "severity": "high",
    "support_code": "E-CONN-001",
    "must_not": true,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "bridge-setup",
      "state": "ng"
    }
  },
  "E-CONN-002": {
    "id": "E-CONN-002",
    "cls": "connectivity",
    "message": "あなたのPCが閉じているので、いまは動けません。ここで言ったことは溜めておいて、PC が起きたときに順に片づけます",
    "action": "PC を起こす／PC の状態を見る（書いたことは起きたら順に送る）",
    "undo": false,
    "severity": "high",
    "support_code": "E-CONN-002",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "clone-chat",
      "state": "x"
    }
  },
  "E-CONN-003": {
    "id": "E-CONN-003",
    "cls": "connectivity",
    "message": "インターネットにつながっていません。つながると自動で続きます",
    "action": "もう一度",
    "undo": false,
    "severity": "medium",
    "support_code": "E-CONN-003",
    "must_not": false,
    "layers": [
      "UI"
    ],
    "where": {
      "screen": "today"
    }
  },
  "E-CONN-004": {
    "id": "E-CONN-004",
    "cls": "connectivity",
    "message": "自動実行を止めています。理由：発注ナビの画面が変わり、営業社員の覚えた操作が途中で止まりました",
    "action": "覚え直させる／このまま止めておく",
    "undo": false,
    "severity": "high",
    "support_code": "E-CONN-004",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "today",
      "state": "s"
    }
  },
  "E-GATE-001": {
    "id": "E-GATE-001",
    "cls": "gate",
    "message": "外に出るので承認待ちに入れました。中身を見てから押してください",
    "action": "承認カードを開く",
    "undo": false,
    "severity": "critical",
    "support_code": "E-GATE-001",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "approvals",
      "choke_point": "C1"
    }
  },
  "E-GATE-002": {
    "id": "E-GATE-002",
    "cls": "gate",
    "message": "この操作は「しない」に設定されています。設定を変えるとできます",
    "action": "設定を見る",
    "undo": false,
    "severity": "high",
    "support_code": "E-GATE-002",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "policies",
      "choke_point": "C1"
    }
  },
  "E-GATE-003": {
    "id": "E-GATE-003",
    "cls": "gate",
    "message": "LINE は自動操作が禁じられているので、AI社員は送れません。下書きまで作るので、あなたが送ってください",
    "action": "下書きを作らせる／やめる",
    "undo": false,
    "severity": "critical",
    "support_code": "E-GATE-003",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "credentials",
      "choke_point": "C1"
    }
  },
  "E-GATE-004": {
    "id": "E-GATE-004",
    "cls": "gate",
    "message": "値引きに応じるかは私では決められません。判断の材料と選択肢を出すので選んでください",
    "action": "値引きしない／1 割まで／私が直接返す",
    "undo": false,
    "severity": "medium",
    "support_code": "E-GATE-004",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "clone-thread",
      "state": "a"
    }
  },
  "E-GATE-005": {
    "id": "E-GATE-005",
    "cls": "gate",
    "message": "この宛先は会社の外です。外に送るには代表の承認が要ります",
    "action": "承認を頼む／やめる",
    "undo": false,
    "severity": "critical",
    "support_code": "E-GATE-005",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "members",
      "choke_point": "C1"
    }
  },
  "E-SIG-001": {
    "id": "E-SIG-001",
    "cls": "no_signal",
    "message": "営業社員の実行が結果を返さずに終わりました。完了とは見なしていません",
    "action": "もう一度やらせる／動きを見る",
    "undo": false,
    "severity": "high",
    "support_code": "E-SIG-001",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "ai-activity",
      "choke_point": "C5"
    }
  },
  "E-SIG-002": {
    "id": "E-SIG-002",
    "cls": "no_signal",
    "message": "ここで止まりました。Claude Code が何も返さずに終わりました",
    "action": "続けるなら「続けて」と書いて送る／ほかのことならそのまま書く（ボタンは置かない）",
    "undo": false,
    "severity": "medium",
    "support_code": "E-SIG-002",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "Bridge"
    ],
    "where": {
      "screen": "clone-chat",
      "state": "stp"
    }
  },
  "E-LIM-001": {
    "id": "E-LIM-001",
    "cls": "limit",
    "message": "エントリーで作れる AI社員は 3 体までです。プランを変えると増やせます",
    "action": "プランを見る／既存を整理する",
    "undo": false,
    "severity": "medium",
    "support_code": "E-LIM-001",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "ai-staff"
    }
  },
  "E-LIM-002": {
    "id": "E-LIM-002",
    "cls": "limit",
    "message": "このファイルは大きすぎます（50MB まで）。分けるか、圧縮してください",
    "action": "別のファイルを選ぶ",
    "undo": false,
    "severity": "low",
    "support_code": "E-LIM-002",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "clone-chat",
      "state": "f",
      "choke_point": "C4"
    }
  },
  "E-LIM-003": {
    "id": "E-LIM-003",
    "cls": "limit",
    "message": "混み合っています。順番にご案内します（およそ 30 秒）",
    "action": "そのまま待つ",
    "undo": false,
    "severity": "critical",
    "support_code": "E-LIM-003",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "login",
      "choke_point": "C2"
    }
  },
  "E-DATA-001": {
    "id": "E-DATA-001",
    "cls": "data",
    "message": "預かった情報が読めません。安全のため、もう一度預け直してください",
    "action": "預け直す",
    "undo": false,
    "severity": "critical",
    "support_code": "E-DATA-001",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "credentials",
      "choke_point": "C8"
    }
  },
  "E-DATA-002": {
    "id": "E-DATA-002",
    "cls": "data",
    "message": "作っている間に会社モデルが変わったので、作り直します",
    "action": "作り直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-DATA-002",
    "must_not": false,
    "layers": [
      "API"
    ],
    "where": {
      "screen": "export"
    }
  },
  "E-TO-001": {
    "id": "E-TO-001",
    "cls": "timeout",
    "message": "◯◯商事の返事待ちで 12 日止まっています。催促の下書きを作れます",
    "action": "催促のメールを下書かせる／来期に回す",
    "undo": false,
    "severity": "medium",
    "support_code": "E-TO-001",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tasks",
      "state": "b"
    }
  },
  "E-TO-002": {
    "id": "E-TO-002",
    "cls": "timeout",
    "message": "止まっている案件が 2 件あります",
    "action": "1 件をひらく／高本AIに配らせる",
    "undo": false,
    "severity": "low",
    "support_code": "E-TO-002",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "records",
      "state": "s"
    }
  },
  "E-TO-003": {
    "id": "E-TO-003",
    "cls": "timeout",
    "message": "切れています。いまは仕事を渡せません。言ったことは溜めておき、Bridge を開いたら続けます",
    "action": "Bridge を開く（接続を確かめる を押してもよい）",
    "undo": false,
    "severity": "high",
    "support_code": "E-TO-003",
    "must_not": true,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "bridge-setup"
    }
  },
  "E-TO-004": {
    "id": "E-TO-004",
    "cls": "timeout",
    "message": "営業社員の実行が 10 分を超えたので止めました。途中までの結果は残っています",
    "action": "続きをやらせる／動きを見る",
    "undo": false,
    "severity": "medium",
    "support_code": "E-TO-004",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "ai-activity",
      "choke_point": "C5"
    }
  },
  "E-LIM-004": {
    "id": "E-LIM-004",
    "cls": "limit",
    "message": "今月の AI の実行量が上限に達しました。来月まで待つか、プランを変えると続けられます",
    "action": "プランを見る／来月まで待つ",
    "undo": false,
    "severity": "high",
    "support_code": "E-LIM-004",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "clone-chat",
      "choke_point": "C3"
    }
  },
  "E-DEP-004": {
    "id": "E-DEP-004",
    "cls": "dependency",
    "message": "本番に切り替える前に 2 つ足りません：経理社員の freee のログイン情報／営業社員の目標。埋めると切り替えられます",
    "action": "足りないものを埋める／その AI社員は止めたまま本番へ",
    "undo": false,
    "severity": "high",
    "support_code": "E-DEP-004",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "onboard-golive",
      "act": "A12"
    }
  },
  "E-EXT-005": {
    "id": "E-EXT-005",
    "cls": "external",
    "message": "送ったメールは取り消せません。代わりに訂正メールの下書きを作れます",
    "action": "訂正の下書きを作る／やめる",
    "undo": false,
    "severity": "medium",
    "support_code": "E-EXT-005",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "audit",
      "act": "A34"
    }
  },
  "E-A39-NA": {
    "id": "E-A39-NA",
    "cls": "n/a",
    "message": "",
    "action": "",
    "undo": false,
    "severity": "medium",
    "support_code": "E-A39-NA",
    "must_not": false,
    "layers": [],
    "where": {}
  },
  "E-MOCK-001": {
    "id": "E-MOCK-001",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-001",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "account-close",
      "state": "gs"
    }
  },
  "E-MOCK-002": {
    "id": "E-MOCK-002",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-002",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "account",
      "state": "gs"
    }
  },
  "E-MOCK-003": {
    "id": "E-MOCK-003",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-003",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "ai-activity",
      "state": "gs"
    }
  },
  "E-MOCK-004": {
    "id": "E-MOCK-004",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-004",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "ai-staff-detail",
      "state": "gs"
    }
  },
  "E-MOCK-005": {
    "id": "E-MOCK-005",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-005",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "ai-staff",
      "state": "gs"
    }
  },
  "E-MOCK-006": {
    "id": "E-MOCK-006",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-006",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "approvals",
      "state": "gs"
    }
  },
  "E-MOCK-007": {
    "id": "E-MOCK-007",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-007",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "audit",
      "state": "gs"
    }
  },
  "E-MOCK-008": {
    "id": "E-MOCK-008",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-008",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "billing",
      "state": "gs"
    }
  },
  "E-MOCK-009": {
    "id": "E-MOCK-009",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-009",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "clone-memory",
      "state": "gs"
    }
  },
  "E-MOCK-010": {
    "id": "E-MOCK-010",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-010",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "clone-thread",
      "state": "gs"
    }
  },
  "E-MOCK-011": {
    "id": "E-MOCK-011",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-011",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "company-model",
      "state": "gs"
    }
  },
  "E-MOCK-012": {
    "id": "E-MOCK-012",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-012",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "company-settings",
      "state": "gs"
    }
  },
  "E-MOCK-013": {
    "id": "E-MOCK-013",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-013",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "duties",
      "state": "gs"
    }
  },
  "E-MOCK-014": {
    "id": "E-MOCK-014",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-014",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "export",
      "state": "gs"
    }
  },
  "E-MOCK-015": {
    "id": "E-MOCK-015",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-015",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "goal-allocation",
      "state": "gs"
    }
  },
  "E-MOCK-016": {
    "id": "E-MOCK-016",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-016",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "goal-edit",
      "state": "gs"
    }
  },
  "E-MOCK-017": {
    "id": "E-MOCK-017",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-017",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "goals",
      "state": "gs"
    }
  },
  "E-MOCK-018": {
    "id": "E-MOCK-018",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-018",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "hypotheses",
      "state": "gs"
    }
  },
  "E-MOCK-019": {
    "id": "E-MOCK-019",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-019",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "import",
      "state": "gs"
    }
  },
  "E-MOCK-020": {
    "id": "E-MOCK-020",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-020",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "inquiry",
      "state": "gs"
    }
  },
  "E-MOCK-021": {
    "id": "E-MOCK-021",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-021",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "ledger-def",
      "state": "gs"
    }
  },
  "E-MOCK-022": {
    "id": "E-MOCK-022",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-022",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "member-detail",
      "state": "gs"
    }
  },
  "E-MOCK-023": {
    "id": "E-MOCK-023",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-023",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "members",
      "state": "gs"
    }
  },
  "E-MOCK-024": {
    "id": "E-MOCK-024",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-024",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "my-progress",
      "state": "gs"
    }
  },
  "E-MOCK-025": {
    "id": "E-MOCK-025",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-025",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "notices",
      "state": "gs"
    }
  },
  "E-MOCK-026": {
    "id": "E-MOCK-026",
    "cls": "external",
    "message": "詰まっている会社。失敗の型で並べる。型ごとに対処がある",
    "action": "会社の詳細で対処を送る",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-026",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "ops-home",
      "state": "s"
    }
  },
  "E-MOCK-027": {
    "id": "E-MOCK-027",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-027",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "policies",
      "state": "gs"
    }
  },
  "E-MOCK-028": {
    "id": "E-MOCK-028",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-028",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "record-detail",
      "state": "gs"
    }
  },
  "E-MOCK-029": {
    "id": "E-MOCK-029",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-029",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "records",
      "state": "gs"
    }
  },
  "E-MOCK-030": {
    "id": "E-MOCK-030",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-030",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "review",
      "state": "gs"
    }
  },
  "E-MOCK-031": {
    "id": "E-MOCK-031",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-031",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "search",
      "state": "gs"
    }
  },
  "E-MOCK-032": {
    "id": "E-MOCK-032",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-032",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "security-brief",
      "state": "gs"
    }
  },
  "E-MOCK-033": {
    "id": "E-MOCK-033",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-033",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "services",
      "state": "gs"
    }
  },
  "E-MOCK-034": {
    "id": "E-MOCK-034",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-034",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tasks",
      "state": "gs"
    }
  },
  "E-ACT-035": {
    "id": "E-ACT-035",
    "cls": "dependency",
    "message": "引き継ぎ先が決まっていないものがあります。決めるまで無効にできません",
    "action": "自分のAIの案を全部採る／1 件ずつ決める",
    "undo": false,
    "severity": "high",
    "support_code": "E-ACT-035",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "act": "A62",
      "screen": "member-detail"
    }
  },
  "E-ACT-036": {
    "id": "E-ACT-036",
    "cls": "connectivity",
    "message": "運営に送れませんでした。内容は下書きに残っています。もう一度送るか、しばらくしてからお試しください",
    "action": "もう一度送る／下書きを確認する",
    "undo": false,
    "severity": "medium",
    "support_code": "E-ACT-036",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "act": "A67",
      "screen": "inquiry"
    }
  },
  "E-ACT-037": {
    "id": "E-ACT-037",
    "cls": "connectivity",
    "message": "お知らせを読み込めませんでした。前回の内容を表示しています",
    "action": "再読み込みする",
    "undo": false,
    "severity": "low",
    "support_code": "E-ACT-037",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "act": "A68",
      "screen": "notices"
    }
  },
  "E-ACT-038": {
    "id": "E-ACT-038",
    "cls": "validation",
    "message": "対象の会社がありません。プランか会社を選んでください",
    "action": "対象を選び直す／失敗した分を再送する",
    "undo": false,
    "severity": "medium",
    "support_code": "E-ACT-038",
    "must_not": true,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "act": "A71",
      "screen": "ops-notices"
    }
  },
  "E-ACT-039": {
    "id": "E-ACT-039",
    "cls": "data",
    "message": "セキュリティの記録を読み込めませんでした。運営に連絡してください",
    "action": "再読み込み／運営に連絡する",
    "undo": false,
    "severity": "high",
    "support_code": "E-ACT-039",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "act": "A73",
      "screen": "ops-audit"
    }
  },
  "E-ACT-040": {
    "id": "E-ACT-040",
    "cls": "auth",
    "message": "保存できませんでした。もう一度お試しください。パスワードを変えた場合は他の端末で入り直しが必要です",
    "action": "もう一度保存する／端末の一覧で失効を確認する",
    "undo": false,
    "severity": "high",
    "support_code": "E-ACT-040",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "act": "A74",
      "screen": "account"
    }
  },
  "E-ACT-041": {
    "id": "E-ACT-041",
    "cls": "validation",
    "message": "この版は出せません。テストで失敗した場面があります（外部サービスの規約変更）。直して再テストしてください",
    "action": "失敗した場面を見る／直して「上げてテストで動かす」",
    "undo": false,
    "severity": "high",
    "support_code": "E-ACT-041",
    "must_not": true,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "act": "A80",
      "screen": "ops-skills"
    }
  },
  "E-PAY-001": {
    "id": "E-PAY-001",
    "cls": "payment",
    "message": "カードが拒否されました。別のカードを使うか、カード会社に確認してください。請求書払いに切り替えることもできます",
    "action": "別のカードで登録する／請求書払いにする",
    "undo": false,
    "severity": "medium",
    "support_code": "PAY-001",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "billing-setup",
      "state": "x",
      "choke_point": "C7"
    }
  },
  "E-PAY-002": {
    "id": "E-PAY-002",
    "cls": "payment",
    "message": "カードの本人確認が終わっていません。Stripe の画面でもう一度、カード会社の確認を済ませてください",
    "action": "Stripe の画面に戻る",
    "undo": false,
    "severity": "medium",
    "support_code": "PAY-002",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "billing-setup",
      "state": "x",
      "choke_point": "C7"
    }
  },
  "E-PAY-003": {
    "id": "E-PAY-003",
    "cls": "payment",
    "message": "今月の引き落としができませんでした。9/23 までに支払い方法を直してください。過ぎると休止になり、AI社員が止まります",
    "action": "支払い方法を直す（Stripe の画面）",
    "undo": false,
    "severity": "high",
    "support_code": "PAY-003",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "billing",
      "state": "n",
      "choke_point": "C7"
    }
  },
  "E-PAY-004": {
    "id": "E-PAY-004",
    "cls": "payment",
    "message": "カードが登録されていません。先に支払い方法を登録するか、請求書払いのままにしてください",
    "action": "支払い方法を登録する",
    "undo": false,
    "severity": "medium",
    "support_code": "PAY-004",
    "must_not": true,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "billing",
      "state": "c",
      "choke_point": "C7"
    }
  },
  "E-PAY-005": {
    "id": "E-PAY-005",
    "cls": "payment",
    "message": "決済事業者からの通知の署名が合いませんでした。通知は処理していません。運営が鍵を確かめます",
    "action": "運営に連絡（自動で記録済み）",
    "undo": false,
    "severity": "high",
    "support_code": "PAY-005",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "ops-billing",
      "state": "n",
      "choke_point": "C7"
    }
  },
  "E-PAY-006": {
    "id": "E-PAY-006",
    "cls": "payment",
    "message": "カードの変更画面（Stripe）が今開けません。しばらくしてからもう一度お試しください。請求は止まりません",
    "action": "もう一度開く",
    "undo": false,
    "severity": "low",
    "support_code": "PAY-006",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "billing",
      "state": "n",
      "choke_point": "C7"
    }
  },
  "E-LLM-001": {
    "id": "E-LLM-001",
    "cls": "external",
    "message": "Anthropic のキーが無効です（提供者が拒否）。新しいキーを預けるか、経路を Bridge か運営マネージドに戻してください。動いていた仕事は止めてあります",
    "action": "新しいキーを預ける／Bridge に戻す",
    "undo": false,
    "severity": "high",
    "support_code": "LLM-001",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "llm-routes",
      "state": "x",
      "choke_point": "C8"
    }
  },
  "E-LLM-002": {
    "id": "E-LLM-002",
    "cls": "external",
    "message": "OpenAI が応答しません。この経路の仕事は止めてあります。Bridge に戻すか、しばらくしてから再開してください",
    "action": "Bridge に戻す／あとで再開",
    "undo": false,
    "severity": "medium",
    "support_code": "LLM-002",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "llm-routes",
      "state": "x",
      "choke_point": "C3"
    }
  },
  "E-LLM-003": {
    "id": "E-LLM-003",
    "cls": "limit",
    "message": "運営マネージドが今月の上限（100 万）に届きました。超えた分は従量で同じ請求書に乗ります。止めるなら経路を Bridge に戻してください",
    "action": "従量で続ける／Bridge に戻す",
    "undo": false,
    "severity": "medium",
    "support_code": "LLM-003",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "llm-routes",
      "state": "x",
      "choke_point": "C3"
    }
  },
  "E-LLM-004": {
    "id": "E-LLM-004",
    "cls": "gate",
    "message": "この機能はまだ使えません（提供者の間で揃っていないため、どの経路でも出していません）",
    "action": "別のやり方（文字で伝える）",
    "undo": false,
    "severity": "low",
    "support_code": "LLM-004",
    "must_not": true,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "llm-routes",
      "state": "n",
      "choke_point": "C3"
    }
  },
  "E-APP-001": {
    "id": "E-APP-001",
    "cls": "gate",
    "message": "iPhone の通知が許可されていません。承認待ちはメールと PC にだけ届きます。iPhone の設定 › 通知 › Kaname で許可すると、ここに戻ります",
    "action": "設定の開き方を見る",
    "undo": false,
    "severity": "medium",
    "support_code": "APP-001",
    "must_not": false,
    "layers": [
      "UI"
    ],
    "where": {
      "screen": "app-setup",
      "state": "x",
      "choke_point": "C6"
    }
  },
  "E-APP-002": {
    "id": "E-APP-002",
    "cls": "connectivity",
    "message": "インターネットにつながっていません。最後に見た「今日」「タスク」「承認待ち」は読めます。書くのはつながってから",
    "action": "つながったら自動で続く",
    "undo": false,
    "severity": "low",
    "support_code": "APP-002",
    "must_not": false,
    "layers": [
      "UI"
    ],
    "where": {
      "screen": "app-setup",
      "state": "x",
      "choke_point": null
    }
  },
  "E-DISC-001": {
    "id": "E-DISC-001",
    "cls": "external",
    "message": "PDF を作れませんでした（保存先が応答しません）。もう一度押すか、しばらくしてから試してください。画面の内容は最新の版です",
    "action": "もう一度 PDF を出す",
    "undo": false,
    "severity": "low",
    "support_code": "DISC-001",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "disclosure",
      "state": "x",
      "choke_point": "C4"
    }
  },
  "E-DISC-002": {
    "id": "E-DISC-002",
    "cls": "data",
    "message": "公開中の開示資料（第 7 版）は設計より古くなっています。新しい版を出して全社にお知らせしてください",
    "action": "新しい版を出す",
    "undo": false,
    "severity": "medium",
    "support_code": "DISC-002",
    "must_not": true,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "ops-disclosure",
      "state": "n",
      "choke_point": "C2"
    }
  },
  "E-MOCK-035": {
    "id": "E-MOCK-035",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-035",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "llm-routes",
      "state": "gs"
    }
  },
  "E-MOCK-036": {
    "id": "E-MOCK-036",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-036",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "disclosure",
      "state": "gs"
    }
  },
  "E-MAIL-001": {
    "id": "E-MAIL-001",
    "cls": "external",
    "message": "確認のメールを出せませんでした。こちら側の都合です。あなたのメールアドレスに問題はありません",
    "action": "少し時間をおいて送り直す／別のメールアドレスで登録し直す／運営に連絡する",
    "undo": false,
    "severity": "high",
    "support_code": "E-MAIL-001",
    "must_not": false,
    "layers": [
      "API"
    ],
    "where": {
      "screen": "verify-email",
      "state": "f"
    }
  },
  "E-MAIL-002": {
    "id": "E-MAIL-002",
    "cls": "external",
    "message": "このメールアドレスは受け取れませんでした。受信箱がいっぱいか、アドレスが違うかもしれません",
    "action": "受信箱を空ける／入力し直して別のアドレスで登録する",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MAIL-002",
    "must_not": false,
    "layers": [
      "API"
    ],
    "where": {
      "screen": "verify-email",
      "state": "f"
    }
  },
  "E-MAIL-003": {
    "id": "E-MAIL-003",
    "cls": "not_found",
    "message": "この申し込みは残っていません。もう一度はじめからやり直してください",
    "action": "はじめから登録し直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-MAIL-003",
    "must_not": false,
    "layers": [
      "API"
    ],
    "where": {
      "screen": "verify-email",
      "state": "n"
    }
  },
  "E-CONN-010": {
    "id": "E-CONN-010",
    "cls": "auth",
    "message": "Claude Code にログインできていません。Bridge の「ログインする」を押して、ブラウザで 1 回許可してください",
    "action": "Bridge で「ログインする」を押す",
    "undo": false,
    "severity": "high",
    "support_code": "E-CONN-010",
    "must_not": false,
    "layers": [
      "UI",
      "Bridge"
    ],
    "where": {
      "screen": "clone-chat",
      "state": "stp"
    }
  },
  "E-LIM-010": {
    "id": "E-LIM-010",
    "cls": "limit",
    "message": "サブスクの 5 時間の枠に達しました。18:40 に戻ります。それまで自分のAI は動けません。ここで書いたことは送れます（戻ったら順に）",
    "action": "使用量を見る／戻ってからそのまま書く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-LIM-010",
    "must_not": false,
    "layers": [
      "UI",
      "Bridge"
    ],
    "where": {
      "screen": "clone-chat",
      "state": "x"
    }
  },
  "E-LIM-005": {
    "id": "E-LIM-005",
    "cls": "limit",
    "message": "送りすぎです。{秒}秒たってから、もう一度お試しください",
    "action": "待ってから、もう一度押す",
    "undo": false,
    "severity": "low",
    "support_code": "E-LIM-005",
    "must_not": true,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "signup",
      "state": "a"
    }
  },
  "E-CONN-011": {
    "id": "E-CONN-011",
    "cls": "dependency",
    "message": "Claude Code は入っていますが、本体が落ちてきていないので動きません。下のボタンで取り直せば直ります",
    "action": "Bridge で「Claude Code を取り直す」を押す",
    "undo": false,
    "severity": "high",
    "support_code": "E-CONN-011",
    "must_not": false,
    "layers": [
      "UI",
      "Bridge"
    ],
    "where": {
      "screen": "bridge-setup",
      "state": "e"
    }
  },
  "E-GATE-010": {
    "id": "E-GATE-010",
    "cls": "gate",
    "message": "本人が許可しませんでした（確認に答えが無いまま時間がたったので、実行していません）",
    "action": "会話で「続けて」と書いて送り、次の問いで答える",
    "undo": false,
    "severity": "medium",
    "support_code": "E-GATE-010",
    "must_not": true,
    "layers": [
      "Bridge",
      "UI"
    ],
    "where": {
      "screen": "clone-chat",
      "state": "a"
    }
  },
  "E-GATE-011": {
    "id": "E-GATE-011",
    "cls": "gate",
    "message": "{サービス}（{ドメイン}）は規約で自動操作が禁止のため止めました。正規の連携か、手で操作してください",
    "action": "返事にある正規の連携の案内か、手作業の手順に沿って進める",
    "undo": false,
    "severity": "high",
    "support_code": "E-GATE-011",
    "must_not": true,
    "layers": [
      "Bridge",
      "UI"
    ],
    "where": {
      "screen": "clone-chat",
      "state": "a"
    }
  },
  "E-CONF-011": {
    "id": "E-CONF-011",
    "cls": "conflict",
    "message": "このメールアドレスの登録は確認まで終わっています。ログインしてください",
    "action": "ログインへ",
    "undo": false,
    "severity": "low",
    "support_code": "E-CONF-011",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "verify-email",
      "state": "done"
    }
  },
  "E-CONF-012": {
    "id": "E-CONF-012",
    "cls": "conflict",
    "message": "規約の版が新しくなりました。新しい版を読んで同意してください",
    "action": "新しい版を読んで、もう一度同意する",
    "undo": false,
    "severity": "low",
    "support_code": "E-CONF-012",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "login",
      "state": "terms"
    }
  },
  "E-SEC-001": {
    "id": "E-SEC-001",
    "cls": "dependency",
    "message": "預かり先に保管できませんでした。もう一度試してください",
    "action": "もう一度「保存」を押す。続くときは運営に連絡する",
    "undo": false,
    "severity": "high",
    "support_code": "E-SEC-001",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "credentials",
      "state": "e"
    }
  },
  "E-SEC-002": {
    "id": "E-SEC-002",
    "cls": "dependency",
    "message": "いまはログイン情報を預かれません。預かり先の用意ができたら使えるようになります",
    "action": "預かり先が決まるまで、そのサービスは本人がログインして使う",
    "undo": false,
    "severity": "medium",
    "support_code": "E-SEC-002",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "credentials",
      "state": "e"
    }
  },
  "E-SEC-003": {
    "id": "E-SEC-003",
    "cls": "dependency",
    "message": "いま混み合っています。◯ 秒ほど待ってからもう一度保存してください",
    "action": "待ってからもう一度保存する（上限の 8 割で運営に知らせが届いている）",
    "undo": false,
    "severity": "medium",
    "support_code": "E-SEC-003",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "credentials",
      "state": "e"
    }
  },
  "E-AUTH-007": {
    "id": "E-AUTH-007",
    "cls": "auth",
    "message": "このアカウントは、会社の登録が見つからないため使えません。もう一度アカウントを作るか、運営に連絡してください",
    "action": "アカウントを作る／運営に連絡する",
    "undo": false,
    "severity": "high",
    "support_code": "E-AUTH-007",
    "must_not": true,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "login",
      "state": "e"
    }
  },
  "E-AUTH-008": {
    "id": "E-AUTH-008",
    "cls": "auth",
    "message": "このリンクは使えません。新しく届いたメールのリンクを開いてください",
    "action": "新しく届いたメールのリンクを開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-AUTH-008",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "verify-email",
      "state": "old_link"
    }
  },
  "E-AUTH-009": {
    "id": "E-AUTH-009",
    "cls": "auth",
    "message": "別のアカウントの登録のリンクです",
    "action": "今のアカウントのまま使う／ログアウトしてから、そのアカウントでログインする",
    "undo": false,
    "severity": "low",
    "support_code": "E-AUTH-009",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "verify-email",
      "state": "other_account"
    }
  },
  "E-AUTH-010": {
    "id": "E-AUTH-010",
    "cls": "gate",
    "message": "利用規約とプライバシーポリシーが新しくなりました。同意してから続けてください",
    "action": "新しい版を読んで同意する／ログアウトする",
    "undo": false,
    "severity": "medium",
    "support_code": "E-AUTH-010",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "login",
      "state": "terms"
    }
  },
  "E-AUTH-011": {
    "id": "E-AUTH-011",
    "cls": "auth",
    "message": "このアカウントは、いま止められています。ワークスペースの管理者に聞いてください",
    "action": "ワークスペースの管理者に聞く",
    "undo": false,
    "severity": "medium",
    "support_code": "AUTH-011",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "login",
      "state": "suspended-member"
    }
  },
  "E-AUTH-012": {
    "id": "E-AUTH-012",
    "cls": "auth",
    "message": "このワークスペースは、いま止められています。データは残っています。管理者か運営に連絡してください",
    "action": "管理者か運営に連絡する",
    "undo": false,
    "severity": "medium",
    "support_code": "AUTH-012",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "login",
      "state": "suspended-ws"
    }
  },
  "E-AUTH-013": {
    "id": "E-AUTH-013",
    "cls": "auth",
    "message": "時間が過ぎました。最初からログインし直してください",
    "action": "メールとパスワードから入り直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-AUTH-013",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "login",
      "state": "code"
    }
  },
  "E-AUTH-014": {
    "id": "E-AUTH-014",
    "cls": "auth",
    "message": "コードを 5 回違えたので 15 分止めました。15 分たってから、もう一度入ってください",
    "action": "15 分待つ。端末をなくしたなら『端末をなくした』から管理者に頼む",
    "undo": false,
    "severity": "medium",
    "support_code": "E-AUTH-014",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "login",
      "state": "code"
    }
  },
  "E-AUTH-015": {
    "id": "E-AUTH-015",
    "cls": "conflict",
    "message": "入り方が 1 つだけなので外せません。先にほかの入り方を付けてください",
    "action": "パスキーかパスワードと 2 段階認証を付けてから外す",
    "undo": false,
    "severity": "high",
    "support_code": "AUTH-015",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "mfa-setup",
      "state": "sec-remove-last"
    }
  },
  "E-AUTH-016": {
    "id": "E-AUTH-016",
    "cls": "conflict",
    "message": "パスワードで入るには 2 段階認証が要ります。先に 2 段階認証を付けてください",
    "action": "2 段階認証を付けてから外す",
    "undo": false,
    "severity": "high",
    "support_code": "AUTH-016",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "mfa-setup",
      "state": "sec-remove-last"
    }
  },
  "E-AUTH-017": {
    "id": "E-AUTH-017",
    "cls": "auth",
    "message": "2 段階認証はもう付いています",
    "action": "安全の設定の画面に戻る",
    "undo": false,
    "severity": "low",
    "support_code": "AUTH-017",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "mfa-setup",
      "state": "already"
    }
  },
  "E-AUTH-018": {
    "id": "E-AUTH-018",
    "cls": "conflict",
    "message": "このパスキーは、もうこの端末に付いています",
    "action": "そのまま使う／別の端末で足す",
    "undo": false,
    "severity": "low",
    "support_code": "AUTH-018",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "mfa-setup",
      "state": "sec-add-dup"
    }
  },
  "E-AUTH-019": {
    "id": "E-AUTH-019",
    "cls": "gate",
    "message": "入り方を 1 つ足してから使い始めます",
    "action": "パスキーか 2 段階認証を付ける",
    "undo": false,
    "severity": "medium",
    "support_code": "AUTH-019",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "mfa-setup",
      "state": "mfa-required"
    }
  },
  "E-AUTH-020": {
    "id": "E-AUTH-020",
    "cls": "auth",
    "message": "2 段階認証を付けるには、先にパスワードを決めてください",
    "action": "パスワードを決める",
    "undo": false,
    "severity": "low",
    "support_code": "AUTH-020",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "mfa-setup",
      "state": "no-password"
    }
  },
  "E-AUTH-021": {
    "id": "E-AUTH-021",
    "cls": "auth",
    "message": "本人か確かめられませんでした。もう一度確かめてください",
    "action": "もう一度確かめる",
    "undo": false,
    "severity": "medium",
    "support_code": "AUTH-021",
    "must_not": true,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "mfa-setup",
      "state": "step-up"
    }
  },
  "E-CHAT-001": {
    "id": "E-CHAT-001",
    "cls": "connectivity",
    "message": "送れませんでした（回線が切れていました）。書いた文は残っています",
    "action": "もう一度送る",
    "undo": false,
    "severity": "high",
    "support_code": "E-CHAT-001",
    "must_not": true,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "clone-chat",
      "state": "x"
    }
  },
  "E-CHAT-002": {
    "id": "E-CHAT-002",
    "cls": "external",
    "message": "資料を置けませんでした（保存先が応答しません）。付けた一覧に残っているので、もう一度送ってください",
    "action": "もう一度送る／外す",
    "undo": false,
    "severity": "high",
    "support_code": "E-CHAT-002",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "C4"
    ],
    "where": {
      "screen": "clone-chat",
      "state": "f",
      "choke_point": "C4"
    }
  },
  "E-CHAT-003": {
    "id": "E-CHAT-003",
    "cls": "no_signal",
    "message": "止める合図を PC に届けられませんでした（PC が応答しません）。PC が起きたらすぐ止めます",
    "action": "PC の状態を見る",
    "undo": false,
    "severity": "medium",
    "support_code": "E-CHAT-003",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "Bridge"
    ],
    "where": {
      "screen": "clone-chat",
      "state": "s"
    }
  },
  "E-MEM-001": {
    "id": "E-MEM-001",
    "cls": "connectivity",
    "message": "あなたの PC が閉じているので、まとめを始められません。PC を起こしてから、もう一度押してください。溜まっている分は消えません",
    "action": "PC の状態を見る／あとで押す",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MEM-001",
    "must_not": true,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "today",
      "state": "dg"
    }
  },
  "E-ART-001": {
    "id": "E-ART-001",
    "cls": "validation",
    "message": "大きすぎて成果物にできません（1 MB まで）。分けて書き出してください",
    "action": "本文を分けて、別々に書き出す",
    "undo": false,
    "severity": "medium",
    "support_code": "E-ART-001",
    "must_not": true,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "clone-chat",
      "state": "art",
      "choke_point": "C4"
    }
  },
  "E-ART-002": {
    "id": "E-ART-002",
    "cls": "dependency",
    "message": "成果物を保存できませんでした（保存先が応答しません）。直した中身は残っているので、もう一度保存してください",
    "action": "もう一度保存する",
    "undo": false,
    "severity": "high",
    "support_code": "E-ART-002",
    "must_not": true,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "clone-chat",
      "state": "art",
      "choke_point": "C4"
    }
  },
  "E-CONN-012": {
    "id": "E-CONN-012",
    "cls": "dependency",
    "message": "この PC の Bridge が古いので、自分のAI に仕事を渡せません。Bridge を入れ直してください",
    "action": "Bridge を入れ直す（書いたことは溜めておき、入れ直した後に順に片づける）",
    "undo": false,
    "severity": "high",
    "support_code": "E-CONN-012",
    "must_not": true,
    "layers": [
      "Bridge",
      "API",
      "UI"
    ],
    "where": {
      "screen": "clone-chat",
      "state": "x"
    }
  },
  "E-SIG-003": {
    "id": "E-SIG-003",
    "cls": "no_signal",
    "message": "ここで止まりました。あなたが止めました。「{対象}」は途中だったので、その結末は分かりません。先方の画面で確かめてください",
    "action": "先方の画面（送った先・書いた先）で結末を確かめる／続けるなら「続けて」と書いて送る",
    "undo": false,
    "severity": "medium",
    "support_code": "E-SIG-003",
    "must_not": false,
    "layers": [
      "UI",
      "Bridge"
    ],
    "where": {
      "screen": "clone-chat",
      "state": "stp"
    }
  },
  "E-NF-003": {
    "id": "E-NF-003",
    "cls": "not_found",
    "message": "前の会話の記録がこの PC に無かったので、新しい会話として続けます。これまでの内容は Kaname の写しに残っています",
    "action": "そのまま続ける（何もしなくてよい）",
    "undo": false,
    "severity": "low",
    "support_code": "E-NF-003",
    "must_not": false,
    "layers": [
      "UI",
      "Bridge"
    ],
    "where": {
      "screen": "clone-chat",
      "state": "n"
    }
  },
  "E-VAL-005": {
    "id": "E-VAL-005",
    "cls": "validation",
    "message": "パスワードは 12 文字以上にしてください",
    "action": "入力し直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-VAL-005",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "signup",
      "state": "a"
    }
  },
  "E-VAL-006": {
    "id": "E-VAL-006",
    "cls": "validation",
    "message": "会社名（または屋号）を入れてください",
    "action": "入力し直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-VAL-006",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "signup",
      "state": "a"
    }
  },
  "E-VAL-007": {
    "id": "E-VAL-007",
    "cls": "validation",
    "message": "お名前を入れてください",
    "action": "入力し直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-VAL-007",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "invite-accept",
      "state": "a"
    }
  },
  "E-VAL-008": {
    "id": "E-VAL-008",
    "cls": "validation",
    "message": "ログイン名とパスワードを入れてください",
    "action": "入力し直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-VAL-008",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "login",
      "state": "a"
    }
  },
  "E-VAL-009": {
    "id": "E-VAL-009",
    "cls": "validation",
    "message": "コードを入れてください",
    "action": "入力し直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-VAL-009",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "login",
      "state": "a"
    }
  },
  "E-VAL-010": {
    "id": "E-VAL-010",
    "cls": "validation",
    "message": "名前を入れてください",
    "action": "入力し直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-VAL-010",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "signup",
      "state": "a"
    }
  },
  "E-VAL-011": {
    "id": "E-VAL-011",
    "cls": "validation",
    "message": "漏れたことのあるパスワードです。別のパスワードにしてください",
    "action": "別のパスワードを入れ直す",
    "undo": false,
    "severity": "medium",
    "support_code": "E-VAL-011",
    "must_not": true,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "signup",
      "state": "a"
    }
  },
  "E-VAL-016": {
    "id": "E-VAL-016",
    "cls": "validation",
    "message": "会社名は 100 文字までにしてください",
    "action": "入力し直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-VAL-016",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "signup",
      "state": "a"
    }
  },
  "E-VAL-019": {
    "id": "E-VAL-019",
    "cls": "validation",
    "message": "同意する場合は、チェックを入れてください",
    "action": "チェックを入れて押し直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-VAL-019",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "login",
      "state": "terms"
    }
  },
  "E-VAL-020": {
    "id": "E-VAL-020",
    "cls": "validation",
    "message": "差し戻す理由を書いてください",
    "action": "理由を書いてから差し戻す",
    "undo": false,
    "severity": "low",
    "support_code": "VAL-020",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "approvals",
      "state": "return"
    }
  },
  "E-VAL-022": {
    "id": "E-VAL-022",
    "cls": "validation",
    "message": "実施事項がまだ残っています。全部チェックしてから完了にしてください",
    "action": "残っている実施事項を済ませてチェックする",
    "undo": false,
    "severity": "low",
    "support_code": "VAL-022",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "complete"
    }
  },
  "E-VAL-023": {
    "id": "E-VAL-023",
    "cls": "validation",
    "message": "完了の条件を満たしたか確かめて、チェックを入れてください",
    "action": "完了の条件を確かめてチェックを入れる",
    "undo": false,
    "severity": "low",
    "support_code": "VAL-023",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "complete"
    }
  },
  "E-VAL-024": {
    "id": "E-VAL-024",
    "cls": "validation",
    "message": "終わっていない子のチケットがあります。先に子を完了にしてください",
    "action": "子のチケットを先に完了にする",
    "undo": false,
    "severity": "low",
    "support_code": "VAL-024",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "complete"
    }
  },
  "E-VAL-025": {
    "id": "E-VAL-025",
    "cls": "validation",
    "message": "ほかに、あなたに見えない子のチケットがあります",
    "action": "その子の担当者か、子が見える人に、子を完了にしてもらう",
    "undo": false,
    "severity": "low",
    "support_code": "VAL-025",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "complete"
    }
  },
  "E-VAL-026": {
    "id": "E-VAL-026",
    "cls": "validation",
    "message": "パスワードは 128 文字以内にしてください",
    "action": "短くする",
    "undo": false,
    "severity": "low",
    "support_code": "VAL-026",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "password-reset",
      "state": "p"
    }
  },
  "E-CONF-016": {
    "id": "E-CONF-016",
    "cls": "conflict",
    "message": "承認待ち・実行中・確認中のチケットは完了にできません",
    "action": "今の実行・承認が終わるのを待つ",
    "undo": false,
    "severity": "low",
    "support_code": "CONF-016",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "complete"
    }
  },
  "E-CONF-017": {
    "id": "E-CONF-017",
    "cls": "conflict",
    "message": "実施事項が変わりました。読み直してから完了にしてください",
    "action": "読み直して、もう一度確かめる",
    "undo": false,
    "severity": "low",
    "support_code": "CONF-017",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "complete"
    }
  },
  "E-CONF-018": {
    "id": "E-CONF-018",
    "cls": "conflict",
    "message": "このチケットはもう完了しています",
    "action": "チケットを読み直す",
    "undo": false,
    "severity": "low",
    "support_code": "CONF-018",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "complete"
    }
  },
  "E-CONF-019": {
    "id": "E-CONF-019",
    "cls": "conflict",
    "message": "完了にできるのは作業中のチケットだけです",
    "action": "AI に任せて、終わってから完了にする",
    "undo": false,
    "severity": "low",
    "support_code": "CONF-019",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "complete"
    }
  },
  "E-INV-001": {
    "id": "E-INV-001",
    "cls": "not_found",
    "message": "この招待は見つかりません。もう一度招待してもらってください",
    "action": "招待した人にもう一度招待してもらう",
    "undo": false,
    "severity": "medium",
    "support_code": "E-INV-001",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "invite-accept",
      "state": "a"
    }
  },
  "E-INV-002": {
    "id": "E-INV-002",
    "cls": "not_found",
    "message": "この招待は取り消されています。招待した人に、もう一度招待してもらってください",
    "action": "招待した人にもう一度招待してもらう",
    "undo": false,
    "severity": "medium",
    "support_code": "E-INV-002",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "invite-accept",
      "state": "a"
    }
  },
  "E-PAGE-001": {
    "id": "E-PAGE-001",
    "cls": "not_found",
    "message": "見つかりませんでした。消されたか、見る権限が無いかもしれません",
    "action": "自分に関わるものへ戻る／探す",
    "undo": false,
    "severity": "medium",
    "support_code": "PAGE-001",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "*",
      "state": "not_found"
    }
  },
  "E-PAGE-002": {
    "id": "E-PAGE-002",
    "cls": "permission",
    "message": "この画面を見る権限がありません。見る必要があれば、マネージャーに頼めます。頼んだことは相手に知らせ、記録に残ります",
    "action": "マネージャーに頼む／戻る",
    "undo": false,
    "severity": "high",
    "support_code": "PAGE-002",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "*",
      "state": "forbidden"
    }
  },
  "E-PAGE-003": {
    "id": "E-PAGE-003",
    "cls": "dependency",
    "message": "Kaname の調子が悪くなっています。運営が直しています。あなたの操作や PC の問題ではありません",
    "action": "もう一度／いまの様子を見る",
    "undo": false,
    "severity": "critical",
    "support_code": "PAGE-003",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "*",
      "state": "down"
    }
  },
  "E-PAGE-004": {
    "id": "E-PAGE-004",
    "cls": "dependency",
    "message": "いまメンテナンス中です。終わると自動でこの画面が切り替わります。書きかけはこの PC に残っています",
    "action": "いまの様子を見る",
    "undo": false,
    "severity": "high",
    "support_code": "PAGE-004",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "*",
      "state": "maintenance"
    }
  },
  "E-PAGE-005": {
    "id": "E-PAGE-005",
    "cls": "auth",
    "message": "ログインが切れました。書きかけのものはこの PC に残っています。入り直すと続きから書けます",
    "action": "入り直す",
    "undo": false,
    "severity": "high",
    "support_code": "PAGE-005",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "*",
      "state": "session_expired"
    }
  },
  "E-PAGE-006": {
    "id": "E-PAGE-006",
    "cls": "not_found",
    "message": "このリンクは使えなくなりました。期限が切れたか、もう使われています",
    "action": "送り直してもらう／もう一度はじめから",
    "undo": false,
    "severity": "medium",
    "support_code": "PAGE-006",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "*",
      "state": "link_expired"
    }
  },
  "E-PAGE-007": {
    "id": "E-PAGE-007",
    "cls": "connectivity",
    "message": "読み込めませんでした。ネットにつながっていないか、Kaname が混み合っています。書きかけのものはこの PC に残っています",
    "action": "もう一度／いまの様子を見る",
    "undo": false,
    "severity": "medium",
    "support_code": "PAGE-007",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "*",
      "state": "load_failed"
    }
  },
  "E-PAGE-008": {
    "id": "E-PAGE-008",
    "cls": "connectivity",
    "message": "オフラインです。読むことはできます。書いたものはつながったら送ります",
    "action": "そのまま続ける（つながったら自動で送る）",
    "undo": false,
    "severity": "medium",
    "support_code": "PAGE-008",
    "must_not": false,
    "layers": [
      "UI"
    ],
    "where": {
      "screen": "*",
      "state": "offline"
    }
  },
  "E-CONN-013": {
    "id": "E-CONN-013",
    "cls": "not_found",
    "message": "その接続コードは使えません。Kaname の「PC をつなぐ」の画面に出ている、新しいコードを入れてください",
    "action": "画面の新しいコードを入れ直す",
    "undo": false,
    "severity": "medium",
    "support_code": "CONN-013",
    "must_not": false,
    "layers": [
      "Bridge",
      "API"
    ],
    "where": {
      "screen": "bridge-setup",
      "state": "code_invalid"
    }
  },
  "E-CONN-014": {
    "id": "E-CONN-014",
    "cls": "not_found",
    "message": "まだ配布していません。署名と置き場の用意ができたら、ここから入れられるようになります",
    "action": "待つ（用意ができたら知らせる）",
    "undo": false,
    "severity": "low",
    "support_code": "CONN-014",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "bridge-setup",
      "state": "not_released"
    }
  },
  "E-VAL-012": {
    "id": "E-VAL-012",
    "cls": "validation",
    "message": "期限は今日か、それより後の日にしてください",
    "action": "期限を入れ直す",
    "undo": false,
    "severity": "low",
    "support_code": "VAL-012",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets",
      "state": "create"
    }
  },
  "E-VAL-013": {
    "id": "E-VAL-013",
    "cls": "validation",
    "message": "この区画は書かないと作れません",
    "action": "区画を書く",
    "undo": false,
    "severity": "low",
    "support_code": "VAL-013",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "create"
    }
  },
  "E-VAL-014": {
    "id": "E-VAL-014",
    "cls": "validation",
    "message": "選んだものが、いまは選べなくなりました。選び直してください。書いたものは残っています",
    "action": "選び直す",
    "undo": false,
    "severity": "medium",
    "support_code": "VAL-014",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "create"
    }
  },
  "E-VAL-015": {
    "id": "E-VAL-015",
    "cls": "validation",
    "message": "チケットの親子は 3 段までです。ほかの親を選んでください",
    "action": "親を選び直す",
    "undo": false,
    "severity": "low",
    "support_code": "VAL-015",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "create"
    }
  },
  "E-VAL-017": {
    "id": "E-VAL-017",
    "cls": "validation",
    "message": "探す言葉は 100 文字までにしてください",
    "action": "探す言葉を短くする",
    "undo": false,
    "severity": "low",
    "support_code": "VAL-017",
    "must_not": false,
    "layers": [
      "API"
    ],
    "where": {
      "screen": "tickets",
      "state": "list"
    }
  },
  "E-VAL-018": {
    "id": "E-VAL-018",
    "cls": "validation",
    "message": "この絞り込みはまだ使えません",
    "action": "絞り込みを外して開き直す",
    "undo": false,
    "severity": "low",
    "support_code": "VAL-018",
    "must_not": false,
    "layers": [
      "API"
    ],
    "where": {
      "screen": "tickets",
      "state": "list"
    }
  },
  "E-CONF-013": {
    "id": "E-CONF-013",
    "cls": "conflict",
    "message": "このチケットはいま自分のAI が作っています。今の実行の様子を見てください",
    "action": "今の実行の様子を見る",
    "undo": false,
    "severity": "low",
    "support_code": "CONF-013",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "running"
    }
  },
  "E-CONF-014": {
    "id": "E-CONF-014",
    "cls": "conflict",
    "message": "いまの段のチケットは AI に任せられません（承認待ち・確認中・実行中・完了）。チケットの帯で次の一手を選んでください",
    "action": "承認の帯で決める",
    "undo": false,
    "severity": "low",
    "support_code": "CONF-014",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "awaiting_approval"
    }
  },
  "E-SIG-004": {
    "id": "E-SIG-004",
    "cls": "no_signal",
    "message": "自分のAI が結果を返さずに終わりました。完了とは見なしていません",
    "action": "もう一度 AI に任せる／自分でやる",
    "undo": false,
    "severity": "medium",
    "support_code": "SIG-004",
    "must_not": true,
    "layers": [
      "API",
      "DB",
      "UI"
    ],
    "where": {
      "screen": "tickets",
      "state": "stopped"
    }
  },
  "E-TO-005": {
    "id": "E-TO-005",
    "cls": "timeout",
    "message": "PC から 10 分知らせがありません。止まったとみなしています。PC の Bridge が動いているか確かめてください",
    "action": "PC の Bridge が動いているか確かめる",
    "undo": false,
    "severity": "medium",
    "support_code": "TO-005",
    "must_not": false,
    "layers": [
      "API",
      "UI"
    ],
    "where": {
      "screen": "tickets",
      "state": "running"
    }
  },
  "E-INV-004": {
    "id": "E-INV-004",
    "cls": "not_found",
    "message": "この招待はもう使われています。参加した人は、ログインして入ってください",
    "action": "参加した人はログインして入る",
    "undo": false,
    "severity": "medium",
    "support_code": "E-INV-004",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "invite-accept",
      "state": "a"
    }
  },
  "E-INV-003": {
    "id": "E-INV-003",
    "cls": "not_found",
    "message": "この招待は期限（7 日）が過ぎました。送り直しを頼めます",
    "action": "送り直しを頼む",
    "undo": false,
    "severity": "medium",
    "support_code": "E-INV-003",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "invite-accept",
      "state": "a"
    }
  },
  "E-INV-006": {
    "id": "E-INV-006",
    "cls": "conflict",
    "message": "このメールアドレスにはもうアカウントがあります。ログインしてから参加してください",
    "action": "ログインしてから参加する",
    "undo": false,
    "severity": "medium",
    "support_code": "E-INV-006",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "invite-accept",
      "state": "a"
    }
  },
  "E-INV-005": {
    "id": "E-INV-005",
    "cls": "permission",
    "message": "この招待は別のメールアドレス宛てです。そのアドレスのアカウントで入ってください",
    "action": "宛てのアカウントで入り直す",
    "undo": false,
    "severity": "medium",
    "support_code": "E-INV-005",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "invite-accept",
      "state": "a"
    }
  },
  "E-INV-007": {
    "id": "E-INV-007",
    "cls": "conflict",
    "message": "このワークスペースにはもう入っています",
    "action": "そのワークスペースを開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-INV-007",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "invite-accept",
      "state": "a"
    }
  },
  "E-INV-008": {
    "id": "E-INV-008",
    "cls": "conflict",
    "message": "この招待はまだ使えます。届いたリンクから参加してください",
    "action": "届いたリンクから参加する",
    "undo": false,
    "severity": "low",
    "support_code": "E-INV-008",
    "must_not": false,
    "layers": [
      "API"
    ],
    "where": {
      "screen": "invite-accept",
      "state": "a"
    }
  },
  "E-CRED-001": {
    "id": "E-CRED-001",
    "cls": "validation",
    "message": "名前は英大文字・数字・_ で、英字から始めてください（64 文字まで）",
    "action": "名前を直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-CRED-001",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "credentials"
    }
  },
  "E-CRED-002": {
    "id": "E-CRED-002",
    "cls": "validation",
    "message": "使える場所はドメイン（例：example.com）で、20 個までにしてください",
    "action": "使える場所を直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-CRED-002",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "credentials"
    }
  },
  "E-CRED-003": {
    "id": "E-CRED-003",
    "cls": "validation",
    "message": "使える場所を 1 つ以上入れてください。この宛先にだけ使います",
    "action": "使う宛先のドメインを入れる",
    "undo": false,
    "severity": "low",
    "support_code": "E-CRED-003",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "credentials"
    }
  },
  "E-CRED-004": {
    "id": "E-CRED-004",
    "cls": "conflict",
    "message": "期限は今日以降の日付にしてください",
    "action": "期限を直すか空にする",
    "undo": false,
    "severity": "low",
    "support_code": "E-CRED-004",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "credentials"
    }
  },
  "E-CRED-005": {
    "id": "E-CRED-005",
    "cls": "validation",
    "message": "ログイン情報は ID とパスワード、API キー・値は値だけを入れてください",
    "action": "中身を入れ直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-CRED-005",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "credentials"
    }
  },
  "E-CRED-006": {
    "id": "E-CRED-006",
    "cls": "conflict",
    "message": "同じ名前のものがもう預けてあります。別の名前にするか、前のものを上書きしてください",
    "action": "名前を変えるか上書きする",
    "undo": false,
    "severity": "low",
    "support_code": "E-CRED-006",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "credentials"
    }
  },
  "E-CRED-007": {
    "id": "E-CRED-007",
    "cls": "permission",
    "message": "ワークスペースに預けたものを変えられるのは管理者だけです。自分だけのものとして預けてください",
    "action": "自分だけに預ける／管理者に頼む",
    "undo": false,
    "severity": "medium",
    "support_code": "E-CRED-007",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "credentials"
    }
  },
  "E-CRED-008": {
    "id": "E-CRED-008",
    "cls": "validation",
    "message": "変える物がありません。新しい値か、使える場所・期限・説明を入れてください",
    "action": "変える物を入れる",
    "undo": false,
    "severity": "low",
    "support_code": "E-CRED-008",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "credentials"
    }
  },
  "E-CRED-009": {
    "id": "E-CRED-009",
    "cls": "conflict",
    "message": "ほかの画面で同時に上書きされました。開き直してから、もう一度上書きしてください",
    "action": "開き直してもう一度",
    "undo": false,
    "severity": "low",
    "support_code": "E-CRED-009",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "credentials"
    }
  },
  "E-CRED-015": {
    "id": "E-CRED-015",
    "cls": "conflict",
    "message": "この預けた物の種類や 2 段階の設定に合わない中身です。開き直して、合う欄だけを入れてください",
    "action": "開き直して合う欄だけを入れる",
    "undo": false,
    "severity": "low",
    "support_code": "E-CRED-015",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "credentials"
    }
  },
  "E-CRED-016": {
    "id": "E-CRED-016",
    "cls": "gate",
    "message": "使える場所の外には入れません。必要なら、預けたログイン情報の使える場所に足してください",
    "action": "預けたログイン情報の使える場所に足す（持ち主に知らせる）",
    "undo": false,
    "severity": "medium",
    "support_code": "E-CRED-016",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "credentials"
    }
  },
  "E-CRED-010": {
    "id": "E-CRED-010",
    "cls": "gate",
    "message": "動いている仕事のためにだけ使えます",
    "action": "PC の Bridge を新しい版にする（次の仕事を待つ）",
    "undo": false,
    "severity": "low",
    "support_code": "E-CRED-010",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "credentials"
    }
  },
  "E-CRED-011": {
    "id": "E-CRED-011",
    "cls": "dependency",
    "message": "このログイン情報は失効しているか、期限が過ぎています。預け直してください",
    "action": "預け直す",
    "undo": false,
    "severity": "medium",
    "support_code": "E-CRED-011",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "credentials"
    }
  },
  "E-CRED-012": {
    "id": "E-CRED-012",
    "cls": "conflict",
    "message": "いま確かめています。終わるまで待ってください",
    "action": "終わるまで待つ",
    "undo": false,
    "severity": "low",
    "support_code": "E-CRED-012",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "credentials"
    }
  },
  "E-CRED-013": {
    "id": "E-CRED-013",
    "cls": "conflict",
    "message": "API キー・値はログインして確かめません",
    "action": "なし（確かめは要らない）",
    "undo": false,
    "severity": "low",
    "support_code": "E-CRED-013",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "credentials"
    }
  },
  "E-CRED-014": {
    "id": "E-CRED-014",
    "cls": "not_found",
    "message": "いまはコードを頼まれていません（もう答えたか、確かめが止まりました）",
    "action": "一覧を読み直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-CRED-014",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "credentials"
    }
  },
  "E-CONN-018": {
    "id": "E-CONN-018",
    "cls": "conflict",
    "message": "PC の Bridge が動いていないので確かめられません。Bridge を起こしてから押してください",
    "action": "Bridge を起こす",
    "undo": false,
    "severity": "medium",
    "support_code": "E-CONN-018",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "bridge-setup",
      "state": "browser_check_asleep"
    }
  },
  "E-CONN-016": {
    "id": "E-CONN-016",
    "cls": "auth",
    "message": "Claude Code にログインできていません。下の「ログインする」を押して、ブラウザで 1 回許可してください",
    "action": "この画面の「ログインする」を押す",
    "undo": false,
    "severity": "high",
    "support_code": "E-CONN-016",
    "must_not": false,
    "layers": [
      "UI",
      "Bridge"
    ],
    "where": {
      "screen": "bridge-setup",
      "state": "e"
    }
  },
  "E-CONN-017": {
    "id": "E-CONN-017",
    "cls": "auth",
    "message": "この PC の Claude Code にログインできていません",
    "action": "その PC でこの画面を開いて、ログインする",
    "undo": false,
    "severity": "high",
    "support_code": "E-CONN-017",
    "must_not": false,
    "layers": [
      "UI",
      "Bridge"
    ],
    "where": {
      "screen": "bridge-setup",
      "state": "e"
    }
  },
  "E-VAL-027": {
    "id": "E-VAL-027",
    "cls": "validation",
    "message": "書き込む文を書いてください",
    "action": "文を書いてから送る",
    "undo": false,
    "severity": "low",
    "support_code": "VAL-027",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "talk"
    }
  },
  "E-CONF-030": {
    "id": "E-CONF-030",
    "cls": "conflict",
    "message": "AI が動いている間と承認待ちの間は、状態を変えられません",
    "action": "今の実行・承認が終わるのを待つ",
    "undo": false,
    "severity": "low",
    "support_code": "CONF-030",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "progress"
    }
  },
  "E-CONF-032": {
    "id": "E-CONF-032",
    "cls": "conflict",
    "message": "完了したチケットは、開き直してから状態を変えてください",
    "action": "「作業中（開き直す）」で開き直してから状態を変える",
    "undo": false,
    "severity": "low",
    "support_code": "CONF-032",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "progress"
    }
  },
  "E-CONF-034": {
    "id": "E-CONF-034",
    "cls": "conflict",
    "message": "この状態には、ここから変えられません",
    "action": "ほかの状態を選ぶ（完了は「完了にする」から）",
    "undo": false,
    "severity": "low",
    "support_code": "CONF-034",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "progress"
    }
  },
  "E-CONF-035": {
    "id": "E-CONF-035",
    "cls": "conflict",
    "message": "保留にするときは、保留の理由と再開の条件を書いてください",
    "action": "保留の理由と再開の条件を書いてから、もう一度保留にする",
    "undo": false,
    "severity": "low",
    "support_code": "CONF-035",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "progress"
    }
  },
  "E-CONF-036": {
    "id": "E-CONF-036",
    "cls": "conflict",
    "message": "保留にしていないチケットには、保留の理由と再開の条件を書けません",
    "action": "保留にしてから理由と条件を書く",
    "undo": false,
    "severity": "low",
    "support_code": "CONF-036",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "progress"
    }
  },
  "E-VAL-041": {
    "id": "E-VAL-041",
    "cls": "validation",
    "message": "保留の理由を書いてください",
    "action": "保留の理由を書く",
    "undo": false,
    "severity": "low",
    "support_code": "VAL-041",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets",
      "state": "progress"
    }
  },
  "E-VAL-047": {
    "id": "E-VAL-047",
    "cls": "validation",
    "message": "再開の条件を書いてください",
    "action": "再開の条件を書く",
    "undo": false,
    "severity": "low",
    "support_code": "VAL-047",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets",
      "state": "progress"
    }
  },
  "E-VAL-042": {
    "id": "E-VAL-042",
    "cls": "validation",
    "message": "決めたことを書いてください",
    "action": "決めたことを書く",
    "undo": false,
    "severity": "low",
    "support_code": "VAL-042",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "decisions"
    }
  },
  "E-CONF-037": {
    "id": "E-CONF-037",
    "cls": "conflict",
    "message": "取引先の画面ができてから使えます",
    "action": "このチケットの決定として残す",
    "undo": false,
    "severity": "low",
    "support_code": "CONF-037",
    "must_not": false,
    "layers": [
      "API"
    ],
    "where": {
      "screen": "tickets",
      "state": "decisions"
    }
  },
  "E-CONF-031": {
    "id": "E-CONF-031",
    "cls": "conflict",
    "message": "この決定は、いま別の人が改めました。読み直してから、もう一度お試しください",
    "action": "読み直す",
    "undo": false,
    "severity": "low",
    "support_code": "CONF-031",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "decisions"
    }
  },
  "E-CONF-033": {
    "id": "E-CONF-033",
    "cls": "conflict",
    "message": "この決定は、いま別の人が取り消しました。読み直してから、もう一度お試しください",
    "action": "読み直す",
    "undo": false,
    "severity": "low",
    "support_code": "CONF-033",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "decisions"
    }
  },
  "E-VAL-045": {
    "id": "E-VAL-045",
    "cls": "validation",
    "message": "取り消す理由を書いてください",
    "action": "取り消す理由を書く",
    "undo": false,
    "severity": "low",
    "support_code": "VAL-045",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "decisions"
    }
  },
  "E-VAL-046": {
    "id": "E-VAL-046",
    "cls": "validation",
    "message": "時間と分は 0 以上の整数で入れてください（分は 0〜59）",
    "action": "時間と分を直す",
    "undo": false,
    "severity": "low",
    "support_code": "VAL-046",
    "must_not": false,
    "layers": [
      "UI"
    ],
    "where": {
      "screen": "tickets",
      "state": "progress"
    }
  },
  "E-INV-009": {
    "id": "E-INV-009",
    "cls": "validation",
    "message": "メールの形ではありません",
    "action": "宛てを直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-INV-009",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "members",
      "state": "invite"
    }
  },
  "E-INV-010": {
    "id": "E-INV-010",
    "cls": "conflict",
    "message": "もうこのワークスペースに入っています",
    "action": "その宛てを外す",
    "undo": false,
    "severity": "low",
    "support_code": "E-INV-010",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "members",
      "state": "invite"
    }
  },
  "E-INV-011": {
    "id": "E-INV-011",
    "cls": "not_found",
    "message": "このグループには招けません",
    "action": "グループを選び直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-INV-011",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "members",
      "state": "invite"
    }
  },
  "E-INV-012": {
    "id": "E-INV-012",
    "cls": "validation",
    "message": "一度に招けるのは 50 人までです",
    "action": "宛てを分けて招く",
    "undo": false,
    "severity": "low",
    "support_code": "E-INV-012",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "members",
      "state": "invite"
    }
  },
  "E-SEC-004": {
    "id": "E-SEC-004",
    "cls": "conflict",
    "message": "先に直されました。読み直してから、もう一度直してください",
    "action": "読み直してもう一度",
    "undo": false,
    "severity": "low",
    "support_code": "E-SEC-004",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-SEC-005": {
    "id": "E-SEC-005",
    "cls": "conflict",
    "message": "このチケットは完了しています。完了したチケットの本文は変えられません",
    "action": "新しいチケットで書く",
    "undo": false,
    "severity": "low",
    "support_code": "E-SEC-005",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-SPEC-001": {
    "id": "E-SPEC-001",
    "cls": "conflict",
    "message": "このチケットは完了しています。完了したチケットの確認項目は変えられません",
    "action": "新しいチケットで確かめる",
    "undo": false,
    "severity": "low",
    "support_code": "E-SPEC-001",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-SPEC-020": {
    "id": "E-SPEC-020",
    "cls": "conflict",
    "message": "別の人が先にこの確認項目を変えました。読み直してから、もう一度お試しください",
    "action": "読み直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-SPEC-020",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-SPEC-021": {
    "id": "E-SPEC-021",
    "cls": "conflict",
    "message": "チェックが付いている確認項目の文は直せません。チェックを外してから直してください",
    "action": "チェックを外す",
    "undo": false,
    "severity": "low",
    "support_code": "E-SPEC-021",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-SPEC-022": {
    "id": "E-SPEC-022",
    "cls": "conflict",
    "message": "ナレッジの「必ず守る」から入った確認項目は、文を直したり外したりできません。チェックの付け外しだけできます",
    "action": "チェックを付け外しする",
    "undo": false,
    "severity": "low",
    "support_code": "E-SPEC-022",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-LNK-001": {
    "id": "E-LNK-001",
    "cls": "conflict",
    "message": "同じチケットとはつなげられません",
    "action": "ほかのチケットを選ぶ",
    "undo": false,
    "severity": "low",
    "support_code": "E-LNK-001",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "links"
    }
  },
  "E-LNK-002": {
    "id": "E-LNK-002",
    "cls": "conflict",
    "message": "このチケットとは、もうつながっています",
    "action": "つながりの一覧を見る",
    "undo": false,
    "severity": "low",
    "support_code": "E-LNK-002",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "links"
    }
  },
  "E-LNK-003": {
    "id": "E-LNK-003",
    "cls": "conflict",
    "message": "派生元が輪になるので、つなげられません",
    "action": "ほかのチケットを選ぶ",
    "undo": false,
    "severity": "low",
    "support_code": "E-LNK-003",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "links"
    }
  },
  "E-NTF-001": {
    "id": "E-NTF-001",
    "cls": "conflict",
    "message": "お知らせの続きを読めませんでした。最初から読み直してください",
    "action": "最初から読み直す（続きの鍵を付けずに開き直す）",
    "undo": false,
    "severity": "low",
    "support_code": "E-NTF-001",
    "must_not": false,
    "layers": [
      "API"
    ],
    "where": {
      "screen": "tickets",
      "state": "notifications"
    }
  },
  "E-SRC-001": {
    "id": "E-SRC-001",
    "cls": "validation",
    "message": "探す言葉は 100 文字までにしてください",
    "action": "探す言葉を短くする",
    "undo": false,
    "severity": "low",
    "support_code": "E-SRC-001",
    "must_not": false,
    "layers": [
      "API"
    ],
    "where": {
      "screen": "tickets",
      "state": "search"
    }
  },
  "E-SRC-002": {
    "id": "E-SRC-002",
    "cls": "validation",
    "message": "探す種類は チケット・決定・会話・ナレッジ から選んでください",
    "action": "種類を選び直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-SRC-002",
    "must_not": false,
    "layers": [
      "API"
    ],
    "where": {
      "screen": "tickets",
      "state": "search"
    }
  },
  "E-LST-001": {
    "id": "E-LST-001",
    "cls": "conflict",
    "message": "一覧の続きを読めませんでした。最初から読み直してください",
    "action": "最初から読み直す（続きの鍵を付けずに開き直す）",
    "undo": false,
    "severity": "low",
    "support_code": "E-LST-001",
    "must_not": false,
    "layers": [
      "API"
    ],
    "where": {
      "screen": "tickets",
      "state": "list"
    }
  },
  "E-VWS-001": {
    "id": "E-VWS-001",
    "cls": "validation",
    "message": "名前を入れてください",
    "action": "名前を入れる",
    "undo": false,
    "severity": "low",
    "support_code": "E-VWS-001",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets",
      "state": "save"
    }
  },
  "E-VWS-002": {
    "id": "E-VWS-002",
    "cls": "validation",
    "message": "名前は 60 文字までにしてください",
    "action": "名前を短くする",
    "undo": false,
    "severity": "low",
    "support_code": "E-VWS-002",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets",
      "state": "save"
    }
  },
  "E-VWS-003": {
    "id": "E-VWS-003",
    "cls": "validation",
    "message": "グループの全員に見せるときは、見せるグループを選んでください",
    "action": "見せるグループを選ぶ",
    "undo": false,
    "severity": "low",
    "support_code": "E-VWS-003",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets",
      "state": "save"
    }
  },
  "E-VWS-004": {
    "id": "E-VWS-004",
    "cls": "not_found",
    "message": "見せるグループが見つかりませんでした。消されたか、見る権限が無いかもしれません",
    "action": "見せるグループを選び直す",
    "undo": false,
    "severity": "medium",
    "support_code": "E-VWS-004",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets",
      "state": "save"
    }
  },
  "E-VWS-005": {
    "id": "E-VWS-005",
    "cls": "conflict",
    "message": "同じ名前の保存した条件が、もうあります。別の名前にしてください",
    "action": "別の名前にする",
    "undo": false,
    "severity": "low",
    "support_code": "E-VWS-005",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets",
      "state": "save"
    }
  },
  "E-VWS-006": {
    "id": "E-VWS-006",
    "cls": "conflict",
    "message": "保存できる条件は 50 件までです。いらないものを消してから保存してください",
    "action": "いらない条件を消す",
    "undo": false,
    "severity": "low",
    "support_code": "E-VWS-006",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets",
      "state": "save"
    }
  },
  "E-VWS-007": {
    "id": "E-VWS-007",
    "cls": "validation",
    "message": "条件の形が正しくありません。条件・列の並び・大きさを確かめてください",
    "action": "条件を作り直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-VWS-007",
    "must_not": false,
    "layers": [
      "API"
    ],
    "where": {
      "screen": "tickets",
      "state": "save"
    }
  },
  "E-VWS-008": {
    "id": "E-VWS-008",
    "cls": "validation",
    "message": "名前に改行などの制御文字は使えません",
    "action": "名前を打ち直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-VWS-008",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets",
      "state": "save"
    }
  },
  "E-STP-001": {
    "id": "E-STP-001",
    "cls": "permission",
    "message": "自分で直すにできるのは、このチケットの担当者だけです",
    "action": "担当者に頼む",
    "undo": false,
    "severity": "medium",
    "support_code": "E-STP-001",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "stopped"
    }
  },
  "E-STP-002": {
    "id": "E-STP-002",
    "cls": "conflict",
    "message": "いまは自分で直すに切り替えられません（承認待ち・完了のとき、または承認の後の実行です）",
    "action": "画面を読み直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-STP-002",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "awaiting_approval"
    }
  },
  "E-STP-003": {
    "id": "E-STP-003",
    "cls": "conflict",
    "message": "もう自分で進めることにしています",
    "action": "画面を読み直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-STP-003",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "stopped"
    }
  },
  "E-STP-004": {
    "id": "E-STP-004",
    "cls": "conflict",
    "message": "この実行はもう新しい実行に替わっています",
    "action": "画面を読み直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-STP-004",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "stopped"
    }
  },
  "E-STP-010": {
    "id": "E-STP-010",
    "cls": "timeout",
    "message": "承認から 24 時間を過ぎたので、実行の前にもう一度確かめます",
    "action": "承認をもう一度確かめる",
    "undo": false,
    "severity": "medium",
    "support_code": "E-STP-010",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets",
      "state": "stopped"
    }
  },
  "E-STP-011": {
    "id": "E-STP-011",
    "cls": "connectivity",
    "message": "AI がブラウザを使えませんでした。Chrome を開き、拡張機能「Claude in Chrome」が入っていて、この Claude と同じアカウントでログインしているか確かめてください",
    "action": "Chrome と拡張機能を確かめる",
    "undo": false,
    "severity": "medium",
    "support_code": "E-STP-011",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets",
      "state": "stopped"
    }
  },
  "E-STP-012": {
    "id": "E-STP-012",
    "cls": "dependency",
    "message": "AI が途中で止まりました（理由の種類は分かりません）。もう一度「AI に任せる」か、自分で直すを選べます",
    "action": "AI に任せ直す／自分で直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-STP-012",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets",
      "state": "stopped"
    }
  },
  "E-DEL-001": {
    "id": "E-DEL-001",
    "cls": "permission",
    "message": "このチケットを消せるのは、作った人と、このグループで編集の権限を持つ人です",
    "action": "作った人か権限のある人に頼む",
    "undo": false,
    "severity": "low",
    "support_code": "E-DEL-001",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-DEL-010": {
    "id": "E-DEL-010",
    "cls": "conflict",
    "message": "このチケットには子・孫がいます。別の親へ移す・一緒に消す・親を外して残す、のどれかを選んでください",
    "action": "扱いを選ぶ",
    "undo": false,
    "severity": "low",
    "support_code": "E-DEL-010",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-DEL-011": {
    "id": "E-DEL-011",
    "cls": "conflict",
    "message": "子の移し先に、消すチケット自身やその子・孫は選べません",
    "action": "別の親を選ぶ",
    "undo": false,
    "severity": "low",
    "support_code": "E-DEL-011",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-DEL-012": {
    "id": "E-DEL-012",
    "cls": "conflict",
    "message": "その親に移すと、親子が 3 段を超えます",
    "action": "浅い親を選ぶ",
    "undo": false,
    "severity": "low",
    "support_code": "E-DEL-012",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-DEL-013": {
    "id": "E-DEL-013",
    "cls": "permission",
    "message": "一緒に消す子・孫に、あなたが消せないチケットがあります",
    "action": "別の扱いを選ぶか、そのグループの人に頼む",
    "undo": false,
    "severity": "low",
    "support_code": "E-DEL-013",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-DEL-014": {
    "id": "E-DEL-014",
    "cls": "not_found",
    "message": "子の移し先のチケットが見つかりませんでした",
    "action": "親を選び直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-DEL-014",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-CONF-020": {
    "id": "E-CONF-020",
    "cls": "conflict",
    "message": "確認項目が 1 つもありません。確認項目を足すか、使わない理由を書いてから任せてください",
    "action": "確認項目を足す／理由を書く",
    "undo": false,
    "severity": "medium",
    "support_code": "CONF-020",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "delegate"
    }
  },
  "E-TALK-040": {
    "id": "E-TALK-040",
    "cls": "external",
    "message": "資料の場所を出せませんでした。少し待ってから、もう一度お試しください",
    "action": "待ってやり直す（PC は取れなかった資料を名前と理由で文に添えて続ける）",
    "undo": false,
    "severity": "low",
    "support_code": "E-TALK-040",
    "must_not": false,
    "layers": [
      "API",
      "C4"
    ],
    "where": {
      "screen": "clone-chat",
      "choke_point": "C4"
    }
  }
};

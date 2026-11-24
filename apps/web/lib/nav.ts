// 生成物（scripts/ci/gen_routes.mjs ← 05_flow/flow.json navigation／screens／product_states）。手で直さない。flow:689868f0131ef036
export interface NavSection { key: string; label: string; icon: string; screens: string[]; tab?: string }
export interface SubItem { label: string; desc: string; group?: string; state?: string }
export interface ScreenMeta { id: string; name: string; route: string; needsLogin: boolean; hasShell: boolean; roles: string[]; purpose: string; primaryAction: string; release: string }
export interface ProductState { id: string; name: string; caps: string[] }
export interface NavData {
  sections: readonly NavSection[]; sectionsByRole: Record<string, readonly string[]>; byRole: Record<string, readonly string[]>;
  subByScreen: Record<string, readonly SubItem[]>; layoutByScreen: Record<string, string>; subModeByScreen: Record<string, string>; mainMinPx: number;
  productStates: readonly ProductState[]; screens: Record<ScreenId, ScreenMeta>; roles: readonly { id: RoleId; name: string }[];
}
export type RoleId = "R1" | "R2" | "R3" | "R4" | "R6";
export type ScreenId = "signup" | "verify-email" | "invite-accept" | "mfa-setup" | "billing-setup" | "login" | "password-reset" | "onboard-interview" | "onboard-draft" | "bridge-setup" | "credentials" | "onboard-testrun" | "onboard-golive" | "today" | "approvals" | "clone-thread" | "tasks" | "clone-chat" | "ai-activity" | "records" | "record-detail" | "goals" | "goal-allocation" | "goal-edit" | "my-progress" | "review" | "hypotheses" | "duties" | "ledger-def" | "company-model" | "automation-repair" | "audit" | "policies" | "members" | "ai-staff" | "ai-staff-detail" | "security-brief" | "disclosure" | "export" | "account-close" | "ops-support" | "ops-home" | "ops-catalog" | "account" | "company-settings" | "llm-routes" | "app-setup" | "import" | "services" | "ops-services" | "ops-skills" | "inquiry" | "notices" | "billing" | "ops-notices" | "ops-billing" | "ops-llm" | "ops-disclosure" | "ops-tenant" | "ops-review" | "ops-audit" | "member-detail" | "tickets" | "masters" | "layers" | "rules" | "work-types" | "knowledge" | "clients" | "requests" | "ops-team" | "legal" | "help" | "portal";
export const NAV: NavData = {
  "sections": [
    {
      "key": "tickets",
      "label": "チケット",
      "icon": "list",
      "screens": [
        "tickets"
      ],
      "tab": "チケット"
    },
    {
      "key": "approvals",
      "label": "承認待ち",
      "icon": "check",
      "screens": [
        "approvals"
      ],
      "tab": "承認"
    },
    {
      "key": "ai",
      "label": "（名前）のAI",
      "icon": "bot",
      "screens": [
        "clone-chat",
        "ai-activity"
      ],
      "tab": "AI"
    },
    {
      "key": "knowledge",
      "label": "ナレッジ",
      "icon": "book",
      "screens": [
        "knowledge"
      ]
    },
    {
      "key": "company",
      "label": "ワークスペースの管理",
      "icon": "building",
      "screens": [
        "members",
        "member-detail",
        "layers",
        "masters",
        "audit",
        "company-settings",
        "billing"
      ]
    },
    {
      "key": "clients",
      "label": "取引先",
      "icon": "briefcase",
      "screens": [
        "clients",
        "requests"
      ]
    },
    {
      "key": "me",
      "label": "自分のメニュー",
      "icon": "circle-user",
      "screens": [
        "account",
        "credentials",
        "bridge-setup",
        "inquiry",
        "notices"
      ]
    },
    {
      "key": "portal",
      "label": "クライアントの場所",
      "icon": "inbox",
      "screens": [
        "portal"
      ]
    },
    {
      "key": "admin",
      "label": "運営",
      "icon": "life-buoy",
      "screens": [
        "ops-home",
        "ops-tenant",
        "ops-support",
        "ops-notices",
        "ops-billing",
        "ops-skills",
        "ops-team"
      ]
    }
  ],
  "sectionsByRole": {
    "R1": [
      "tickets",
      "approvals",
      "ai",
      "knowledge",
      "company",
      "clients",
      "me"
    ],
    "R2": [
      "tickets",
      "approvals",
      "ai",
      "knowledge",
      "company",
      "clients",
      "me"
    ],
    "R3": [
      "tickets",
      "approvals",
      "ai",
      "knowledge",
      "company",
      "me"
    ],
    "R4": [
      "portal",
      "me"
    ],
    "R6": [
      "admin"
    ]
  },
  "byRole": {
    "R1": [
      "tickets",
      "approvals",
      "clone-chat",
      "ai-activity",
      "knowledge",
      "members",
      "member-detail",
      "layers",
      "masters",
      "audit",
      "company-settings",
      "billing",
      "clients",
      "requests",
      "account",
      "credentials",
      "bridge-setup",
      "inquiry",
      "notices"
    ],
    "R2": [
      "tickets",
      "approvals",
      "clone-chat",
      "ai-activity",
      "knowledge",
      "members",
      "member-detail",
      "layers",
      "masters",
      "audit",
      "company-settings",
      "billing",
      "clients",
      "requests",
      "account",
      "credentials",
      "bridge-setup",
      "inquiry",
      "notices"
    ],
    "R3": [
      "tickets",
      "approvals",
      "clone-chat",
      "ai-activity",
      "knowledge",
      "account",
      "credentials",
      "bridge-setup",
      "inquiry",
      "notices"
    ],
    "R4": [
      "portal",
      "account",
      "notices"
    ],
    "R6": [
      "ops-home",
      "ops-tenant",
      "ops-support",
      "ops-notices",
      "ops-billing",
      "ops-skills",
      "ops-team"
    ]
  },
  "subByScreen": {
    "tickets": [
      {
        "label": "自分に関わるもの",
        "desc": "既定。担当者が自分・自分の分身が動いている・自分が承認するもの（D-128.11・D-128.25）"
      },
      {
        "label": "概要",
        "desc": "グループを選んだとき。状態の内訳・節目の進み・最近の更新（D-128.10）"
      },
      {
        "label": "一覧と詳細",
        "desc": "左に一覧、中央に選んだ 1 件。絞り込みの帯で言葉・分類・担当者・状態・日付・期限間近・炎（実行者の欄は持たない・D-128.26）"
      },
      {
        "label": "カレンダー",
        "desc": "期限と開始日で並べる"
      },
      {
        "label": "ガント",
        "desc": "期間と節目。親子で開ける"
      }
    ],
    "approvals": [
      {
        "label": "未処理",
        "desc": "自分が承認するもの"
      },
      {
        "label": "取り下げたもの",
        "desc": "承認を取り下げた・止めたもの"
      },
      {
        "label": "履歴",
        "desc": "押した記録"
      }
    ],
    "clone-chat": [
      {
        "label": "新しく話す",
        "desc": "新しい会話を始める"
      },
      {
        "label": "会話",
        "desc": "一覧。探す・星・消す"
      }
    ],
    "ai-activity": [
      {
        "label": "実行した",
        "desc": ""
      },
      {
        "label": "作った",
        "desc": ""
      },
      {
        "label": "覚えた",
        "desc": ""
      },
      {
        "label": "止まった・落ちた",
        "desc": "理由と一手"
      }
    ],
    "work-types": [
      {
        "label": "使える型",
        "desc": "自分の AI が使える型（運営・会社・グループ・自分）"
      },
      {
        "label": "自分の型",
        "desc": "自分で作った型と広げる申請"
      },
      {
        "label": "申請",
        "desc": "マネージャーが OK するもの"
      }
    ],
    "rules": [
      {
        "label": "会社",
        "desc": "会社の全員の AI に効く"
      },
      {
        "label": "層",
        "desc": "その層・グループの人の AI に効く"
      },
      {
        "label": "自分",
        "desc": "自分の AI にだけ効く"
      },
      {
        "label": "取引先",
        "desc": "その取引先のチケットだけに効く"
      }
    ],
    "knowledge": [
      {
        "label": "ページ",
        "desc": "会社・グループ・自分の棚のページ"
      },
      {
        "label": "管理",
        "desc": "承認待ちと見直すページ（管理者とマネージャーだけ）"
      }
    ],
    "masters": [
      {
        "label": "種別",
        "desc": "名前・色・本文のひな形"
      },
      {
        "label": "状態",
        "desc": "名前・色・並び"
      },
      {
        "label": "項目",
        "desc": "会社が足す項目"
      }
    ],
    "member-detail": [
      {
        "label": "グループと役割",
        "desc": "主と兼務"
      },
      {
        "label": "できること",
        "desc": "役割の束と個別に足した／外したもの"
      },
      {
        "label": "担当しているもの",
        "desc": "抜ける前に引き継ぐもの"
      },
      {
        "label": "分身とログイン",
        "desc": "PC・使った量・入り方・2 段階を戻す"
      },
      {
        "label": "最近の記録",
        "desc": ""
      }
    ],
    "account": [
      {
        "label": "プロフィール",
        "desc": "名前・呼ばれ方・顔・言語・見た目"
      },
      {
        "label": "ログインと安全",
        "desc": "パスキー・2 段階（任意）・端末"
      },
      {
        "label": "PC と使った量",
        "desc": "つないでいる PC・5 時間の枠と今月の量"
      },
      {
        "label": "預けたログイン情報",
        "desc": "値は見せない"
      },
      {
        "label": "知らせ",
        "desc": "ワークスペースごと"
      }
    ],
    "clients": [
      {
        "label": "担当者",
        "desc": "招待した人"
      },
      {
        "label": "依頼",
        "desc": "この取引先の依頼"
      },
      {
        "label": "見せる項目",
        "desc": "既定"
      }
    ],
    "ops-home": [
      {
        "label": "すべて",
        "desc": ""
      },
      {
        "label": "気にかける",
        "desc": "止まった実行・期限を過ぎた請求・PC がまだ・上限が近い"
      },
      {
        "label": "止めている",
        "desc": ""
      },
      {
        "label": "やめる手続き中",
        "desc": ""
      }
    ],
    "ops-billing": [
      {
        "label": "すべて",
        "desc": "月ごと"
      },
      {
        "label": "お支払い待ち",
        "desc": ""
      },
      {
        "label": "払われた",
        "desc": ""
      },
      {
        "label": "期限を過ぎた",
        "desc": "前の月の分も"
      }
    ],
    "ops-tenant": [
      {
        "label": "いまの状態",
        "desc": "止まった理由は種類と数だけ"
      },
      {
        "label": "メンバー",
        "desc": ""
      },
      {
        "label": "プランと請求",
        "desc": "その会社の請求書と入金"
      },
      {
        "label": "問い合わせ",
        "desc": ""
      },
      {
        "label": "記録",
        "desc": "運営の誰が何をしたか"
      }
    ],
    "ops-skills": [
      {
        "label": "操作",
        "desc": "読むだけ。版はコードで出す"
      },
      {
        "label": "ひな形",
        "desc": "種別・状態・項目の版を出す"
      },
      {
        "label": "プラン",
        "desc": "いまのプラン・変える案（別の人が決める）・記録"
      }
    ]
  },
  "layoutByScreen": {
    "tickets": "threepane",
    "approvals": "threepane",
    "knowledge": "threepane"
  },
  "subModeByScreen": {},
  "mainMinPx": 720,
  "productStates": [
    {
      "id": "PS0",
      "name": "登録直後 ── 見本のチケットとはじめにやること。AI の入口は「PC をつなぐ」の案内。AI を使わないことは全部できる",
      "caps": [
        "nobridge",
        "app"
      ]
    },
    {
      "id": "PS1",
      "name": "PC がつながった ── 自分の AI が話せる・チケットを任せられる",
      "caps": [
        "bridge",
        "ai",
        "app"
      ]
    },
    {
      "id": "PS2",
      "name": "使っている ── 承認待ち・実行・完了が積まれる",
      "caps": [
        "bridge",
        "ai",
        "data",
        "app"
      ]
    },
    {
      "id": "PS3",
      "name": "PC が閉じている ── データは見られる。AI の仕事は実行待ち（承認から 24 時間を過ぎたら実行の前に聞き直す）",
      "caps": [
        "data",
        "stopped",
        "app"
      ]
    }
  ],
  "screens": {
    "signup": {
      "id": "signup",
      "name": "アカウントを作る",
      "route": "/signup",
      "needsLogin": false,
      "hasShell": false,
      "roles": [
        "R1",
        "R2",
        "R3",
        "R4"
      ],
      "purpose": "名前・メール・パスワードと会社名（空なら個人のテナント）で使い始める。規約に同意する",
      "primaryAction": "はじめる",
      "release": "v1"
    },
    "verify-email": {
      "id": "verify-email",
      "name": "メールを確認する",
      "route": "/verify-email",
      "needsLogin": false,
      "hasShell": false,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "届いたリンクで本人であることを示し、そのままチケットの画面に入る",
      "primaryAction": "続ける",
      "release": "v1"
    },
    "invite-accept": {
      "id": "invite-accept",
      "name": "招待を受けて参加する",
      "route": "/invite/:token",
      "needsLogin": false,
      "hasShell": false,
      "roles": [
        "R3",
        "R4"
      ],
      "purpose": "招待の中身（会社・層・権限の束）を見て、新しく作るか今のアカウントで参加する",
      "primaryAction": "参加する",
      "release": "v1"
    },
    "mfa-setup": {
      "id": "mfa-setup",
      "name": "安全の設定",
      "route": "/mfa-setup",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2",
        "R3",
        "R4"
      ],
      "purpose": "パスキーを登録する。パスワードの人は認証アプリとバックアップコードを設定する",
      "primaryAction": "登録する",
      "release": "v1"
    },
    "billing-setup": {
      "id": "billing-setup",
      "name": "支払い方法を登録する",
      "route": "/billing-setup",
      "needsLogin": false,
      "hasShell": false,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "プランを選び、Stripe の登録画面でカードを登録する。カード番号はここを通らない。請求書払いなら何もしなくてよい",
      "primaryAction": "登録する",
      "release": "v2"
    },
    "login": {
      "id": "login",
      "name": "ログインする",
      "route": "/login",
      "needsLogin": false,
      "hasShell": false,
      "roles": [
        "R1",
        "R2",
        "R3",
        "R4"
      ],
      "purpose": "パスキー、またはメールとパスワードと 2 段階のコードで入る。入ったらチケットの画面へ",
      "primaryAction": "ログイン",
      "release": "v1"
    },
    "password-reset": {
      "id": "password-reset",
      "name": "パスワードの再設定",
      "route": "/password-reset",
      "needsLogin": false,
      "hasShell": false,
      "roles": [
        "R1",
        "R2",
        "R3",
        "R4"
      ],
      "purpose": "パスワードを忘れたときに、届いたリンクから自分で再設定して入り直す。全部の端末は入り直しになる",
      "primaryAction": "再設定メールを送る",
      "release": "v1"
    },
    "onboard-interview": {
      "id": "onboard-interview",
      "name": "自分のAIと話す",
      "route": "/onboard/interview",
      "needsLogin": false,
      "hasShell": false,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "自分のAIの質問に答えるだけで、会社のことが伝わる。自分で欄を埋めない",
      "primaryAction": "次の質問へ",
      "release": "v2"
    },
    "onboard-draft": {
      "id": "onboard-draft",
      "name": "たたき台を確かめる",
      "route": "/onboard/draft",
      "needsLogin": false,
      "hasShell": false,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "自分のAIが作った目標・台帳・担当業務・AI社員を見て、違うところを言って直させる",
      "primaryAction": "これでいく",
      "release": "v2"
    },
    "bridge-setup": {
      "id": "bridge-setup",
      "name": "PC をつなぐ",
      "route": "/setup/bridge",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2",
        "R3"
      ],
      "purpose": "Bridge を入れて自分の PC をつなぎ、自分の AI が動けるようにする。案内から開く",
      "primaryAction": "接続を確かめる",
      "release": "v1"
    },
    "credentials": {
      "id": "credentials",
      "name": "預けたログイン情報",
      "route": "/settings/credentials",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2",
        "R3"
      ],
      "purpose": "ログイン情報・API キー・決まった値を、環境変数のように名前で層ごとに管理する。秘密は保存後に見えず、AI にも見せない",
      "primaryAction": "保存する",
      "release": "v1"
    },
    "onboard-testrun": {
      "id": "onboard-testrun",
      "name": "テストで動かす",
      "route": "/onboard/testrun",
      "needsLogin": false,
      "hasShell": false,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "外に一切出さない状態でAI社員を動かし、出てきたものを見て納得する",
      "primaryAction": "本番に切り替える",
      "release": "v2"
    },
    "onboard-golive": {
      "id": "onboard-golive",
      "name": "本番に切り替える",
      "route": "/onboard/golive",
      "needsLogin": false,
      "hasShell": false,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "足りていない設定を潰して、明日から自動で動く状態にする",
      "primaryAction": "切り替える",
      "release": "v2"
    },
    "today": {
      "id": "today",
      "name": "今日",
      "route": "/today",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2",
        "R3",
        "R4"
      ],
      "purpose": "朝に自分のAIの候補から今日やる分を確定し、申し送りと承認待ちを把握し、夕方に持ち越しを整理する",
      "primaryAction": "今日を確定する",
      "release": "v2"
    },
    "approvals": {
      "id": "approvals",
      "name": "承認待ち",
      "route": "/approvals",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2",
        "R3"
      ],
      "purpose": "自分が承認するものを、成果物の中身と検査の結果（確実／AI 判定と根拠／人が見る項目）を見てから押す。ボタンは 4 つ",
      "primaryAction": "承認する",
      "release": "v1"
    },
    "clone-thread": {
      "id": "clone-thread",
      "name": "自分のAIとAI社員のやりとり",
      "route": "/ai/thread",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2",
        "R3"
      ],
      "purpose": "差し戻したものが今どうなっているか、何を直させたかを追う",
      "primaryAction": "AI社員に伝える",
      "release": "v2"
    },
    "tasks": {
      "id": "tasks",
      "name": "タスク",
      "route": "/tasks",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2",
        "R3"
      ],
      "purpose": "人とAI社員の分を同じ一覧で片づける。足す・引き継いでもらう・引き継ぐ・詰まりを解くがここででき、必ず目標に紐づく。リスト／カンバン／カレンダー／ガントに切り替えられる。親タスクは子に分けて開ける",
      "primaryAction": "終わりにする",
      "release": "v2"
    },
    "clone-chat": {
      "id": "clone-chat",
      "name": "分身の部屋：会話と知っていること",
      "route": "/ai/chat",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2",
        "R3",
        "R4"
      ],
      "purpose": "壁打ちで相談し、チケットの案を作って確定する。資料を付ける・許可に答える・成果物を書き出す",
      "primaryAction": "送る",
      "release": "v1"
    },
    "ai-activity": {
      "id": "ai-activity",
      "name": "分身の部屋：やったこと",
      "route": "/ai-staff/activity",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2",
        "R3"
      ],
      "purpose": "分身（高本のAI）が実行した・作った・覚えた・止まったを時間の順に見て、止まった理由ごとの一手を打ってチケットへ戻る。専用の『AI の動き』の画面は持たず、分身の部屋の中に置く",
      "primaryAction": "チケットへ",
      "release": "v1"
    },
    "records": {
      "id": "records",
      "name": "台帳",
      "route": "/records",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2",
        "R3",
        "R4"
      ],
      "purpose": "案件・請求・問い合わせを工程のカンバンか一覧で見て、止まっているものを見つける",
      "primaryAction": "1件をひらく",
      "release": "v2"
    },
    "record-detail": {
      "id": "record-detail",
      "name": "台帳の1件",
      "route": "/records/:id",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2",
        "R3",
        "R4"
      ],
      "purpose": "1件の中身・段階・関連するタスクと証跡を見て、次の段階へ動かす",
      "primaryAction": "次の段階へ",
      "release": "v2"
    },
    "goals": {
      "id": "goals",
      "name": "目標",
      "route": "/goals",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2",
        "R3"
      ],
      "purpose": "会社から自分まで何層でも、降ろした数と積み上がった数を同じ画面で見て、届くかを判断する",
      "primaryAction": "配分を見直す",
      "release": "v2"
    },
    "goal-allocation": {
      "id": "goal-allocation",
      "name": "目標の配分",
      "route": "/goals/:id/allocation",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "層ごとに誰に・どれだけ降ろすかと、その層にどこまで見せるかを決める。未配分は赤で残る",
      "primaryAction": "配る",
      "release": "v2"
    },
    "goal-edit": {
      "id": "goal-edit",
      "name": "目標を改訂する",
      "route": "/goals/:id/edit",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "期の途中で目標を直す・無くす。紐づく配分とタスクへの影響を先に見て、行き先のないものを残さない",
      "primaryAction": "改訂する",
      "release": "v2"
    },
    "my-progress": {
      "id": "my-progress",
      "name": "自分の目標",
      "route": "/my-progress",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2",
        "R3",
        "R4"
      ],
      "purpose": "配られた分の進み・自主目標・自分のAI社員への配分を、本人がここで管理する",
      "primaryAction": "自主目標を足す",
      "release": "v2"
    },
    "review": {
      "id": "review",
      "name": "ふりかえり",
      "route": "/review",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "なぜ届いた／届かなかったかを、自分のAIが書いた差分と要因で読む",
      "primaryAction": "仮説を見る",
      "release": "v2"
    },
    "hypotheses": {
      "id": "hypotheses",
      "name": "仮説と施策",
      "route": "/hypotheses",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "出た仮説から採るものを決め、施策に予算を置いてタスクまで落とす。効いたかと、いくらで効いたかを見る。施策の期間はタイムラインで見る",
      "primaryAction": "採る",
      "release": "v2"
    },
    "duties": {
      "id": "duties",
      "name": "担当業務",
      "route": "/duties",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "AI社員がやる仕事の定義を書き換える。覚えた操作はこの下に畳まれている",
      "primaryAction": "保存する",
      "release": "v2"
    },
    "ledger-def": {
      "id": "ledger-def",
      "name": "台帳の形",
      "route": "/settings/ledgers",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "この会社の台帳の項目と段階を決める。台帳ごとに画面は作らない",
      "primaryAction": "保存する",
      "release": "v2"
    },
    "company-model": {
      "id": "company-model",
      "name": "会社モデル",
      "route": "/company-model",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "目標・台帳・担当業務・組織・ルール・記憶が1つの定義として今どうなっているかを見る",
      "primaryAction": "中身を見る",
      "release": "v2"
    },
    "automation-repair": {
      "id": "automation-repair",
      "name": "覚え直させる",
      "route": "/automations/:id/repair",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "外部サービスの画面が変わって止まったとき、AIに手順を覚え直させる",
      "primaryAction": "覚え直させる",
      "release": "v2"
    },
    "audit": {
      "id": "audit",
      "name": "記録",
      "route": "/audit",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "ワークスペースで起きた大事なこと（権限が変わった・持ち出し・外に出した・新しい端末・消した）を探すことから始めて追い、本人確認を取り直して書き出す。消したチケットは 30 日ここから戻せる",
      "primaryAction": "書き出す",
      "release": "v1"
    },
    "policies": {
      "id": "policies",
      "name": "ルール",
      "route": "/policies",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2",
        "R3",
        "R4"
      ],
      "purpose": "AIにやらせる範囲を決める。運営／会社／部署／個人の4層で持つ",
      "primaryAction": "保存する",
      "release": "v2"
    },
    "members": {
      "id": "members",
      "name": "メンバー",
      "route": "/members",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "グループごとに人を並べ、役割をその場で変える。招く・グループを作る。上に気づいてほしいこと（PC がつながっていない人・招待中）を 1 行。名前を押すとメンバーの 1 人",
      "primaryAction": "招く",
      "release": "v1"
    },
    "ai-staff": {
      "id": "ai-staff",
      "name": "AI社員",
      "route": "/ai-staff",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "いるAI社員を見て、増やす・人に託す",
      "primaryAction": "AI社員を作る",
      "release": "v2"
    },
    "ai-staff-detail": {
      "id": "ai-staff-detail",
      "name": "AI社員の1体",
      "route": "/ai-staff/:id",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "このAI社員が何をやるか・誰に託されているか・何を守るか・どのスキルを使えるかを見る。会社の権限者はスキルを外せる",
      "primaryAction": "担当業務を編集",
      "release": "v2"
    },
    "security-brief": {
      "id": "security-brief",
      "name": "この製品でできること・できないこと",
      "route": "/security",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "情シスやコンプラに、Bridgeが何をして何をしないかをそのまま見せる",
      "primaryAction": "PDFで出す",
      "release": "v2"
    },
    "disclosure": {
      "id": "disclosure",
      "name": "開示資料",
      "route": "/security/disclosure",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "情シス・コンプラに渡す資料（できる操作の列挙・送るもの／送らないもの・サブプロセッサ・DPA・アンインストールの検証結果）を版つきで見て PDF で出す",
      "primaryAction": "PDF で出す",
      "release": "v2"
    },
    "export": {
      "id": "export",
      "name": "持ち出す",
      "route": "/export",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "会社モデルもデータも全部書き出す。囲い込まない",
      "primaryAction": "書き出す",
      "release": "v2"
    },
    "account-close": {
      "id": "account-close",
      "name": "退会する",
      "route": "/settings/close",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "全オブジェクトで何が消えて何が残るかを見て、持ち出してから退会する。全端末・接続・資格情報は即失効、データは 30 日猶予",
      "primaryAction": "退会する",
      "release": "v2"
    },
    "ops-support": {
      "id": "ops-support",
      "name": "運営：問い合わせ",
      "route": "/ops/support",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R6"
      ],
      "purpose": "受信箱（まだ誰も持っていない・自分・返事待ち・後で・済み）で答える。社内メモは先方に見えない。右にそのワークスペースの様子",
      "primaryAction": "返す",
      "release": "v1"
    },
    "ops-home": {
      "id": "ops-home",
      "name": "運営：ワークスペースの一覧",
      "route": "/ops",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R6"
      ],
      "purpose": "全部のワークスペースのプラン・人数・PC・今月の実行・請求・状態を並べ、気にかけること（止まった実行が続く・期限を過ぎた請求・PC がつながらない・上限が近い）を上に出す。中身は出さない",
      "primaryAction": "1 社を開く",
      "release": "v1"
    },
    "ops-catalog": {
      "id": "ops-catalog",
      "name": "運営：配るもの",
      "route": "/ops/catalog",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R6"
      ],
      "purpose": "運営配布のAI社員・担当業務・ルール・テンプレ・目標スキルをマスタとして版で管理し、プラン別に出し分ける。プランの定義（価格・上限）もここ",
      "primaryAction": "版を出す",
      "release": "v2"
    },
    "account": {
      "id": "account",
      "name": "自分の設定",
      "route": "/account",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2",
        "R3",
        "R4"
      ],
      "purpose": "プロフィール・ログインと安全（パスキー・2 段階は任意・端末）・PC と使った量・知らせ を自分で整える",
      "primaryAction": "保存する",
      "release": "v1"
    },
    "company-settings": {
      "id": "company-settings",
      "name": "ワークスペースの設定",
      "route": "/settings/company",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "名前とロゴ・プランと支払い・取引先の見え方・誰ができるか・ワークスペースを消す。変えることがあるものだけ置く",
      "primaryAction": "保存する",
      "release": "v1"
    },
    "llm-routes": {
      "id": "llm-routes",
      "name": "AI の経路",
      "route": "/settings/llm",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "Bridge／自分の API キー／運営マネージド を、会社の既定と PC が閉じているときの経路として選ぶ。キーは預けるだけで見えない。使用量と上限もここ",
      "primaryAction": "保存する",
      "release": "v2"
    },
    "app-setup": {
      "id": "app-setup",
      "name": "アプリと通知",
      "route": "/settings/app",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2",
        "R3",
        "R4"
      ],
      "purpose": "PC の Bridge の窓とスマホのアプリを入れ、承認待ち・AI 停止・お知らせの通知を受け取る端末を整える",
      "primaryAction": "通知を許可する",
      "release": "v2"
    },
    "import": {
      "id": "import",
      "name": "取り込み",
      "route": "/import",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "既存の顧客リスト・過去の請求書・メール・画像を形式を問わず入れる。自分のAIが読んで台帳の下書きと書式の候補を出す",
      "primaryAction": "取り込む",
      "release": "v2"
    },
    "services": {
      "id": "services",
      "name": "外部サービスの連携",
      "route": "/services",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "使っている外部サービスごとに 自動操作の可否と理由・正規連携（API）のつなぎ方・今の接続を見る",
      "primaryAction": "つなぐ",
      "release": "v2"
    },
    "ops-services": {
      "id": "ops-services",
      "name": "運営：サービス台帳",
      "route": "/ops/services",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R6"
      ],
      "purpose": "外部サービスごとの自動操作の可否（api／allowed／unspecified／forbidden／bank）と理由を版で管理する。全社に効く",
      "primaryAction": "版を出す",
      "release": "v2"
    },
    "ops-skills": {
      "id": "ops-skills",
      "name": "運営：配るもの",
      "route": "/ops/skills",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R6"
      ],
      "purpose": "全部のワークスペースに効く物を版で持つ：操作（読むだけ・版はコードで出す）・ひな形（新しく入る会社が最初に使う既定の形。種別・状態・項目の版を出し、会社が手を付けていない所だけ「そのままにする／変える」を選ぶ）・プラン（値段と中身。変えるときは案を作り別の人が決める）",
      "primaryAction": "版を出す",
      "release": "v1"
    },
    "inquiry": {
      "id": "inquiry",
      "name": "問い合わせ",
      "route": "/inquiry",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2",
        "R3"
      ],
      "purpose": "右上の顔 › 困ったとき・お知らせ から運営に聞く（いま見ている画面の情報を付けられる）。返事と状態をここで見る",
      "primaryAction": "問い合わせる",
      "release": "v1"
    },
    "notices": {
      "id": "notices",
      "name": "お知らせ",
      "route": "/notices",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2",
        "R3",
        "R4"
      ],
      "purpose": "困ったとき・お知らせ で運営からのお知らせ（リリース・障害・メンテ）といまの稼働状況を見る。障害の間は上の帯にも出る",
      "primaryAction": "読む",
      "release": "v1"
    },
    "billing": {
      "id": "billing",
      "name": "請求書",
      "route": "/billing",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "ワークスペースの管理 › 設定 で請求書・振込先・請求先・払われたか と、プランの値段が変わる知らせを見る（請求書払い）",
      "primaryAction": "請求書を開く",
      "release": "v1"
    },
    "ops-notices": {
      "id": "ops-notices",
      "name": "運営：お知らせ",
      "route": "/ops/notices",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R6"
      ],
      "purpose": "リリース・障害・メンテを書いて、誰に・どこに・いつ出すかを決める。障害は 調べている → 原因が分かった → 様子を見ている → 直った と状態を足す",
      "primaryAction": "出す",
      "release": "v1"
    },
    "ops-billing": {
      "id": "ops-billing",
      "name": "運営：請求",
      "route": "/ops/billing",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R6"
      ],
      "purpose": "月ごとに全社の請求書をまとめて出し、入金を 1 件ずつ記録する（差があれば未入金のまま）。期限を過ぎたものは前の月の分も上に出す",
      "primaryAction": "入金を記録",
      "release": "v1"
    },
    "ops-llm": {
      "id": "ops-llm",
      "name": "運営：AI の経路と使用量",
      "route": "/ops/llm",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R6"
      ],
      "purpose": "会社ごとに運営マネージドの経路を許可し、3 社の使用量と費用を横断で見る。キーの中身は見ない",
      "primaryAction": "許可する",
      "release": "v2"
    },
    "ops-disclosure": {
      "id": "ops-disclosure",
      "name": "運営：開示資料",
      "route": "/ops/disclosure",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R6"
      ],
      "purpose": "成果物から生成した開示資料の版を出し、DPA の雛形とサブプロセッサ一覧を整える。変えたら全社にお知らせ",
      "primaryAction": "版を出す",
      "release": "v2"
    },
    "ops-tenant": {
      "id": "ops-tenant",
      "name": "運営：ワークスペースの 1 社",
      "route": "/ops/tenants/:id",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R6"
      ],
      "purpose": "タブ：いまの状態・メンバー・プランと請求・問い合わせ・記録（運営の誰が何をしたか）。中を見る（理由・1 時間・見るだけ）・止める（先に知らせる）・再開する",
      "primaryAction": "対応する",
      "release": "v1"
    },
    "ops-review": {
      "id": "ops-review",
      "name": "運営：公開の審査",
      "route": "/ops/review",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R6"
      ],
      "purpose": "会社が明示的に公開したテンプレ・担当業務を横断で並べる入口。匿名化の確認と承認・却下は会社の詳細の審査で行う",
      "primaryAction": "承認する",
      "release": "v2"
    },
    "ops-audit": {
      "id": "ops-audit",
      "name": "運営：運営の証跡",
      "route": "/ops/audit",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R6"
      ],
      "purpose": "運営全体の証跡（誰が・どの会社に・何をしたか）とセキュリティの出来事を横断で見て、運営メンバーの権限を決める。会社ごとの証跡は会社の詳細にもある",
      "primaryAction": "書き出す",
      "release": "v2"
    },
    "member-detail": {
      "id": "member-detail",
      "name": "メンバーの 1 人",
      "route": "/members/:id",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "グループと役割・できること（役割の束と個別に足した／外したもの）・担当しているもの・分身・ログイン・最近の記録。一時的に止める・外す（担当を引き継いでから）・2 段階認証を戻す",
      "primaryAction": "保存する",
      "release": "v1"
    },
    "tickets": {
      "id": "tickets",
      "name": "チケット",
      "route": "/tickets",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2",
        "R3",
        "R4"
      ],
      "purpose": "毎日の入口。チケットを作り（画面で・壁打ちで・複製で）、中身とテスト仕様を書き、AI に任せ、渡し、完了にする。一覧と詳細・カレンダー・ガントを切り替える",
      "primaryAction": "作る",
      "release": "v1"
    },
    "masters": {
      "id": "masters",
      "name": "チケットの設定",
      "route": "/workspace/ticket-settings",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "ワークスペースの管理 › チケットの設定。種別（名前・色・本文のひな形）・状態（名前・色・並び）・項目（会社が足す項目）を会社のやり方に合わせて足す・直す・並べる・消す。管理者だけが開ける",
      "primaryAction": "保存する",
      "release": "v1"
    },
    "layers": {
      "id": "layers",
      "name": "グループ（メンバーの中）",
      "route": "/workspace/members/groups",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "メンバーの画面の「＋ グループ」から、グループを作る・名前を付ける・並べる（0〜n 段・並列のグループ）。専用の画面は持たず小窓で開く",
      "primaryAction": "作る",
      "release": "v1"
    },
    "rules": {
      "id": "rules",
      "name": "ルール",
      "route": "/ai/rules",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2",
        "R3"
      ],
      "purpose": "会社・層・個人・取引先 ごとにルール（書式・宛名・CC・禁止）を書く。見える・直せる範囲は権限で変わる",
      "primaryAction": "保存する",
      "release": "v2"
    },
    "work-types": {
      "id": "work-types",
      "name": "業務の型",
      "route": "/ai/work-types",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2",
        "R3"
      ],
      "purpose": "業務の型（運営の全社向け／運営が作った会社向け／会社／グループ／自分）を見る・作る・広げる。見せるのは欄と説明だけで、裏のスキルの作りは見せない",
      "primaryAction": "作る",
      "release": "v2"
    },
    "knowledge": {
      "id": "knowledge",
      "name": "ナレッジ",
      "route": "/knowledge",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2",
        "R3"
      ],
      "purpose": "会社・グループ・自分の棚のページを、フォルダの木から選んで書く・直す・上げる・共有する・写す。必ず守るのページは AI が毎回読んで守る。管理する人は承認待ちと見直すページを見る",
      "primaryAction": "ページを書く",
      "release": "v1"
    },
    "clients": {
      "id": "clients",
      "name": "取引先",
      "route": "/clients",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "取引先と担当者を管理し、招待し、見せる項目の既定を決める",
      "primaryAction": "取引先を足す",
      "release": "v1"
    },
    "requests": {
      "id": "requests",
      "name": "届いた依頼",
      "route": "/requests",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "取引先からの依頼とやり取りを見て、受けてチケットにする／断る",
      "primaryAction": "受けてチケットにする",
      "release": "v1"
    },
    "ops-team": {
      "id": "ops-team",
      "name": "運営：運営の人",
      "route": "/ops/team",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R6"
      ],
      "purpose": "運営の場所に入れる人と、できること（問い合わせ・中を見る・お金・止める・お知らせ・配るもの・値段の案・値段を決める・運営の人）を決める。パスキーでしか入れない",
      "primaryAction": "運営の人を足す",
      "release": "v1"
    },
    "legal": {
      "id": "legal",
      "name": "規約・プライバシーポリシー",
      "route": "/legal/:kind",
      "needsLogin": false,
      "hasShell": false,
      "roles": [
        "R1",
        "R2",
        "R3",
        "R4"
      ],
      "purpose": "利用規約とプライバシーポリシーの今の版を、登録の前でも読める",
      "primaryAction": "読む",
      "release": "v1"
    },
    "help": {
      "id": "help",
      "name": "困ったとき",
      "route": "/help",
      "needsLogin": false,
      "hasShell": false,
      "roles": [
        "R1",
        "R2",
        "R3",
        "R4"
      ],
      "purpose": "ログインできない・困ったときに、よくある困りごとから次の画面へ進み、いまの稼働状況を見て、解けなければ運営にメールする",
      "primaryAction": "困りごとを選ぶ",
      "release": "v1"
    },
    "portal": {
      "id": "portal",
      "name": "クライアントの場所",
      "route": "/portal",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R4"
      ],
      "purpose": "取引先の人が依頼を出し、やり取りし、進みと成果物を見て検収する",
      "primaryAction": "依頼を出す",
      "release": "v1"
    }
  },
  "roles": [
    {
      "id": "R1",
      "name": "自分で全部回している人"
    },
    {
      "id": "R2",
      "name": "数人の会社の代表"
    },
    {
      "id": "R3",
      "name": "配られた仕事をする人"
    },
    {
      "id": "R4",
      "name": "依頼を出す取引先の人"
    },
    {
      "id": "R6",
      "name": "Kaname 運営"
    }
  ]
};

/** 指定が無い・無い・見えない のときの行き先（D-086・flow.json navigation.fallbacks） */
export const FALLBACKS = {
  "entry": {
    "anonymous": "/login",
    "noBridge": "/tickets",
    "signedIn": "/tickets"
  },
  "notFound": {
    "title": "この画面はありません"
  },
  "forbidden": {
    "title": "この権限では見えない",
    "back": "/tickets"
  }
} as const;

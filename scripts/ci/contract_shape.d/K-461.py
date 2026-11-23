# K-461 知らせを読む口（listNotifications）
#   体を受けない GET なので、6 つの表に足す行は無い（登録先の決まりがチケットごとの住所を求めるので、空の表を置く）。
#   422 は全部契約に書ける形の誤り（unread の enum・limit の最小と最大・actor_member_id の uuid・cursor の形）。契約に書けない 422 は残さない
REQUIRED_INPUTS = {}
NO_REQUIRED_INPUTS = {}
PATH_PATTERNS = {}
VALUE_RANGES = {}
UNEXPRESSIBLE_422 = {}
AGENT_ANSWERS = {}

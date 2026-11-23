# K-761 PC の側の口 2 本（reportBrowserState・POST /api/v1/bridge/jobs/:id/browser／getFileForBridge・GET /api/v1/bridge/files/:ref）の入力・答え・断りの表（K-325 の断片）
#   振る舞いの本体は apps/api/src/features/F5/delegate/browser-state.ts・job-file.ts（DB の関数 app.bridge_browser_report・app.bridge_job_file）。
#   reportBrowserState の触る表（attachments を外した）と 2 つの PERMS の説明は本体 05_flow/screen_api.py の前からある行を直した
INPUTS = {
    "reportBrowserState": ("BridgeBrowserStateInput", {"browser": "string", "state": "string"}),
}
# 2 つとも必須（無ければ口が 422・欄つき）。値は決まった 2 つずつ（口が 422 にする値と同じ集まり）
REQUIRED_INPUTS = {"reportBrowserState": ["browser", "state"]}
VALUE_RANGES = {"reportBrowserState": {"browser": {"enum": ["chrome", "dedicated"]}, "state": {"enum": ["using", "off"]}}}
RESPONSES = {
    "reportBrowserState": ("BridgeBrowserReported", {"ok": "boolean"}),
    # 署名 URL（期限 10 分）・名前・種類・大きさ。置き場の鍵（storage_ref）は出さない。name・mime・size は資料の表の列が null を許すので契約も null を許す（K144-SHAPE-013）
    "getFileForBridge": ("BridgeJobFile", {"url": "string", "name": "string?", "mime": "string?", "size": "integer?"}),
}
# 資料の仕事の id（job_id は名前の _id で作り手が uuid の形にする・必須は口が 422）
QUERIES = {"getFileForBridge": ["job_id"]}
# 道の値 ref は資料の id（uuid の形。名前が id で終わらないので形をここに書く・口が 422 欄 ref）
PATH_PATTERNS = {"getFileForBridge": {"ref": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"}}
UNEXPRESSIBLE_422: dict = {}
_DOWN = {"status": 503, "code": "E-PAGE-003", "body": {"error": "unavailable", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"]}
ERRORS_4XX = {
    "reportBrowserState": [
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"}, "errors": [],
         "trigger": "受け取っていない仕事（ほかの PC・ほかの人の PC）・動いていない仕事（終わった・待っている）・無い仕事",
         "ears_form": "UNWANTED: IF その PC が受け取っていない・動いていない仕事の様子を送ったなら、Kaname は 404 を返し、何も残さない"},
        {**_DOWN, "trigger": "出来事を書く DB の関数が落ちた",
         "ears_form": "UNWANTED: IF 出来事を書く DB の関数が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、何も残さない"},
    ],
    "getFileForBridge": [
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"}, "errors": [],
         "trigger": "仕事に付いていない・ほかの仕事の・消した資料・動いていない仕事・受け取っていない PC・無い資料や仕事",
         "ears_form": "UNWANTED: IF その仕事に付いていない資料か、受け取っていない・動いていない仕事なら、Kaname は 404 を返し、署名 URL を出さない"},
        {"status": 502, "code": "E-TALK-040", "body": {"error": "upstream_failed", "code": "E-TALK-040"}, "errors": ["E-TALK-040"],
         "trigger": "置き場が資料の署名 URL を出せない（置き場の名前空間の外・置き場に届かない）",
         "ears_form": "UNWANTED: IF 置き場が資料の署名 URL を出せないなら、Kaname は 502 と E-TALK-040 を返し、署名の鍵を出さない"},
        {**_DOWN, "trigger": "資料を引く DB の関数が落ちた",
         "ears_form": "UNWANTED: IF 資料を引く DB の関数が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、署名 URL を出さない"},
    ],
}

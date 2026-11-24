# build_api.d（K-1121）
05_flow/build_api.py（契約の作り手）の本体の表に足す分は、チケットごとに K-<番号>.py に同じ大文字の表の名前で書く。足せる表は 3 つだけ：
`INTERNAL_TABLES`（dict：表の名前 → 画面に出ない訳）・`INTERNAL`（set：画面に出ない列の名前）・`KEY_CURSOR_OPS`（set：続きの印を鍵の文字列で受ける一覧の口の operationId）。
build_api.py が INTERNAL の定義の直後で足し合わせる。同じ鍵を 2 つのファイルか本体とファイルが持てば止まる。足した値が契約の一覧の口・ER の表・ER の列に無ければ止まる。
新しい鍵は本体に書かず、ここに書く（G74 が build_api.py の本体の 3 つの表への直の足しと、3 つの表を書き換える文を赤にする）。今ある鍵の値を直すのは本体。作り方の手順の直し（表でない所）は本体。
KEY_CURSOR_OPS に足すときは、入口 apps/api/src/contract/op.ts の KEY_CURSOR_OPS にも同じ口を足す（契約と入口を照らす検査は無い）。
screen_api.py の表（SUCCESS_STATUS・LIST_RESULT_OPS・ALSO_2XX など、作り手が screen_api から読む表）は 05_flow/screen_api.d に書く。

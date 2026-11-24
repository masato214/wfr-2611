# screen_api.d（K-325）
05_flow/screen_api.py の表に足す分は、チケットごとに K-<番号>.py に大文字の表の名前で書く（T などの手助けは使える）。
screen_api.py の最後で足し合わせる。同じ鍵・同じ operationId を 2 つのファイルが持てば止まる。
新しい鍵（口の表・権限・INPUT_RULES・UNEXPRESSIBLE_422 など、本体の頭の段の表のどれでも）は本体に書かず、ここに書く（K-1112・G74 が本体に直に足した鍵を赤にする。今ある鍵の値を直すのは本体）。
05_flow/build_api.py（契約の作り手）の本体の表（INTERNAL_TABLES・INTERNAL・KEY_CURSOR_OPS）に足す分は 05_flow/build_api.d/K-<番号>.py に書く（K-1121）。

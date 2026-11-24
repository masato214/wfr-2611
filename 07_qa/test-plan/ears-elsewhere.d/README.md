# ears-elsewhere.d（K-325）
表に足す分はチケットごとに K-<番号>.json（ops の鍵）に書く。前からの中身は _base.json。
足し合わせは python3 scripts/ci/build_registries.py。同じ ops の口は _base.json と断片のあいだでも足し合わせられる：covers は、同じ名前を同じ値で結べば 1 つにまとめ、違う値なら止まる。covers 以外の鍵（file・reason・na など）は書かないか同じ値だけ（違う値は止まる）。口の値がオブジェクトでなければ止まる（K-440）。

-- K-426 の続き：20261120160000_function_execute_private.sql より後の名前で本線に入った migration の分を直す（決まり D-128.171）。
--   まっさらな DB では 20261120160000 の後にこの 2 本が当たり、既に当てた DB（staging）では 20261120160000 がこの 2 本の後に当たる。
--   どちらの順でも同じ形になるよう、名前がいちばん後のこの migration で次の 2 つをする：
--   ① 20261122093400_test_spec_create.sql が app.test_spec_title_check(jsonb) を明示で public に渡している。
--      app の関数を PUBLIC から外す決まりに合わせ、app のスキーマの関数をもう一度まとめて PUBLIC から外す（関数ごとに並べない）。
--      呼ぶのは口と app.test_spec_create（持ち主の権限）で、kaname_app には同じ migration が明示で渡している。
--   ② 20261122090100_ticket_body.sql の app.ticket_body_valid(jsonb) は、ticket_sections の検査の制約の中で呼ばれ、
--      文を流した役（kaname_app）の権限で動く。既定の権限で誰にも渡らないので kaname_app に渡す。
revoke execute on all functions in schema app from public;
grant execute on function app.ticket_body_valid(jsonb) to kaname_app;

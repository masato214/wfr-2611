# K-950 問い合わせの添付を上げる先を求める口（uploadInquiryAttachment・POST /api/v1/inquiries/attachments）。
#   入力と答えの形は K-948 の断片が持つ（ここでは形の鍵を足さない）。断りは 401・403・422・429・503 の共通だけなので ERRORS_4XX は足さない。
#   振る舞いは apps/api/src/features/F12/inquiries/upload.ts と DB の関数 app.inquiry_attachment_start（K-950 の migration）。
#   上げ終わりの受け口（POST /api/uploads/inquiry/:token/done）は契約の口の外（upload-route.ts）
ERRORS_4XX = {}

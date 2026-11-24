// 本文を見たまま編集する部品（K-567）と読む形（K-577・DocView・編集の部品を読まない）の外への口。使う側（K-442・K-447）は editor/ の中の物をこれ以外で import しない（境界 B10）
export { DocEditor, type DocEditorProps } from "./doc-editor";
export { isAllowedHref } from "./link-policy";
export { DocView, type DocViewProps } from "./doc-view";

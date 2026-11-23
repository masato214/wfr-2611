"""本文 1 枚の文書の木（doc）を、契約の入力の形に書く言葉（K-432・D-150.35）。
正本は packages/contracts/src/doc.ts の validateDoc。契約は口が受ける集合より狭く書かない（広く書き、狭める分は口が 422・欄 doc で断る）ので、
節の種類ごとの子の決まり・中身の無い節・colwidth の長さなどは書かず、書ける決まり（節と印の種類・見出しの段・寄せ・番号・結合の数・色・リンクの形・入れ子の深さ）だけを書く。
再帰の定義は OpenAPI 3.0.3 の入力の形の中に置けないので、入れ子の深さ（DOC_MAX_DEPTH＝12）まで 1 段ずつ広げて書く（段の数に比べて線の長さで増える）。
05_flow/screen_api.d/K-432.py と scripts/ci/contract_shape.d/K-432.py が同じ物を使う。"""
from __future__ import annotations

DOC_MAX_DEPTH = 12  # packages/contracts/src/doc.ts の DOC_MAX_DEPTH と同じ
BLOCKS = ["paragraph", "heading", "bulletList", "orderedList", "horizontalRule", "taskList", "table", "blockquote", "codeBlock", "image",
          "listItem", "taskItem", "tableRow", "tableHeader", "tableCell"]
INLINES = ["text", "hardBreak"]
MARKS = ["bold", "italic", "underline", "strike", "code", "superscript", "subscript", "highlight", "color", "link"]
ALIGNS = ["left", "center", "right", "justify"]
COLORS = ["red", "teal", "amber"]
HEX = "^#[0-9a-f]{6}$"
HREF = "^(?:https?://|mailto:)"


def _int(lo: int, hi: int) -> dict:
    return {"type": "integer", "minimum": lo, "maximum": hi}


def _attrs() -> dict:
    return {"type": "object", "additionalProperties": False, "properties": {
        "level": {"type": "integer", "enum": [2, 3, 4]},
        "ghost": {"type": "boolean"},
        "textAlign": {"type": "string", "enum": list(ALIGNS)},
        "start": _int(1, 9999),
        "colspan": _int(1, 50),
        "rowspan": _int(1, 50),
        "colwidth": {"type": "array", "items": _int(1, 2000)},
        "checked": {"type": "boolean"},
        "caption": {"type": "string"},
        "attachment_id": {"type": "string", "format": "uuid", "nullable": True},
    }}


def _mark() -> dict:
    return {"type": "object", "required": ["type"], "additionalProperties": False, "properties": {
        "type": {"type": "string", "enum": list(MARKS)},
        "attrs": {"type": "object", "additionalProperties": False, "properties": {
            "color": {"type": "string", "anyOf": [{"enum": list(COLORS)}, {"pattern": HEX}]},
            "href": {"type": "string", "pattern": HREF, "maxLength": 2048},
        }},
    }}


def _inline() -> dict:
    return {"type": "object", "required": ["type"], "additionalProperties": False, "properties": {
        "type": {"type": "string", "enum": list(INLINES)},
        "text": {"type": "string", "minLength": 1},
        "marks": {"type": "array", "items": _mark()},
    }}


def _node(level: int) -> dict:
    """入れ子の level 段目の節（doc の直下が 1 段目）。12 段目の子は字だけ（13 段目の節は書けない）"""
    child = _node(level + 1) if level < DOC_MAX_DEPTH else _inline()
    return {"type": "object", "required": ["type"], "additionalProperties": False, "properties": {
        "type": {"type": "string", "enum": BLOCKS + INLINES},
        "attrs": _attrs(),
        "text": {"type": "string", "minLength": 1},
        "marks": {"type": "array", "items": _mark()},
        "content": {"type": "array", "items": child},
    }}


def doc_schema() -> dict:
    """入力の欄 doc の値の形。呼ぶたびに新しい辞書を返す（同じ辞書を 2 か所に置くと YAML の別名が出る）"""
    return {"type": "object", "required": ["type", "content"], "additionalProperties": False, "properties": {
        "type": {"type": "string", "enum": ["doc"]},
        "content": {"type": "array", "items": _node(1)},
    }}

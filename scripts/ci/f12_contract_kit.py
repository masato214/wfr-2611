"""段 13（F12）の契約の作り直しの葉（K-948・K-1004・K-1005・K-1006）の試験が使う読み方（K-948 が切る段で書いた）。

契約の生成物（08_api/openapi.yaml・08_api/endpoints.json・08_api/retired-endpoints.json）を読み、口ごとの
入力の欄・答えの欄・必須・問い合わせの名前・権限の言葉・関門を返す。手で書いた表ではなく、作り手が出した物を読む。
"""
from __future__ import annotations

import json
import pathlib

import yaml

ROOT = pathlib.Path(__file__).resolve().parents[2]
OA = yaml.safe_load((ROOT / "08_api" / "openapi.yaml").read_text(encoding="utf-8"))
SCHEMAS: dict = OA["components"]["schemas"]
EPS: list = json.loads((ROOT / "08_api" / "endpoints.json").read_text(encoding="utf-8"))["endpoints"]
RETIRED: list = json.loads((ROOT / "08_api" / "retired-endpoints.json").read_text(encoding="utf-8")).get("retired", [])


def operation(op_id: str) -> tuple[str, str, dict]:
    """(道, 方法, 口) を返す。無ければ AssertionError"""
    for path, methods in OA["paths"].items():
        for method, op in methods.items():
            if isinstance(op, dict) and op.get("operationId") == op_id:
                return path, method.upper(), op
    raise AssertionError(f"契約に {op_id} が無い")


def has_op(op_id: str) -> bool:
    try:
        operation(op_id)
        return True
    except AssertionError:
        return False


def _ref(s: dict) -> str:
    return s["$ref"].rsplit("/", 1)[-1]


def input_schema(op_id: str) -> dict:
    """入力の体の形（requestBody の $ref の先）。体の無い口は {}"""
    _, _, op = operation(op_id)
    body = op.get("requestBody")
    if not body:
        return {}
    return SCHEMAS[_ref(body["content"]["application/json"]["schema"])]


def input_fields(op_id: str) -> set[str]:
    return set(input_schema(op_id).get("properties", {}))


def required_fields(op_id: str) -> set[str]:
    return set(input_schema(op_id).get("required", []))


def input_prop(op_id: str, field: str) -> dict:
    props = input_schema(op_id).get("properties", {})
    assert field in props, f"{op_id} の入力に {field} が無い"
    return props[field]


def output_schema(op_id: str) -> dict:
    """答えの data の形（一覧は items の先）"""
    _, _, op = operation(op_id)
    ok = next(v for k, v in op["responses"].items() if str(k).startswith("2"))
    data = ok["content"]["application/json"]["schema"]["properties"]["data"]
    target = data.get("items", data)
    return SCHEMAS[_ref(target)]


def output_fields(op_id: str) -> set[str]:
    return set(output_schema(op_id).get("properties", {}))


def output_prop(op_id: str, field: str) -> dict:
    props = output_schema(op_id).get("properties", {})
    assert field in props, f"{op_id} の答えに {field} が無い"
    return props[field]


def is_list(op_id: str) -> bool:
    _, _, op = operation(op_id)
    ok = next(v for k, v in op["responses"].items() if str(k).startswith("2"))
    return "items" in ok["content"]["application/json"]["schema"]["properties"]["data"]


def query_names(op_id: str) -> set[str]:
    _, _, op = operation(op_id)
    return {p["name"] for p in op.get("parameters", []) if p.get("in") == "query"}


def query_param(op_id: str, name: str) -> dict:
    _, _, op = operation(op_id)
    for p in op.get("parameters", []):
        if p.get("in") == "query" and p["name"] == name:
            return p["schema"]
    raise AssertionError(f"{op_id} の問い合わせに {name} が無い")


def meta_fields(op_id: str) -> set[str]:
    _, _, op = operation(op_id)
    ok = next(v for k, v in op["responses"].items() if str(k).startswith("2"))
    meta = ok["content"]["application/json"]["schema"]["properties"].get("meta", {})
    return set(meta.get("properties", {}))


def endpoint(op_id: str) -> dict:
    for e in EPS:
        if e.get("operation_id") == op_id:
            return e
    raise AssertionError(f"endpoints.json に {op_id} が無い")


def perm_word(op_id: str) -> str:
    return str(operation(op_id)[2].get("x-permission"))


def choke_points(op_id: str) -> set[str]:
    return set(endpoint(op_id).get("choke_points", []))


def retired(method: str, path: str) -> dict | None:
    for r in RETIRED:
        if r.get("method") == method and r.get("path") == path:
            return r
    return None


def id_fields_are_uuid(schema: dict) -> list[str]:
    """`_id` で終わる欄が uuid でない物（控え帳・K144-SHAPE-004）"""
    bad = []
    for name, p in schema.get("properties", {}).items():
        if name.endswith("_id") and p.get("format") != "uuid":
            bad.append(name)
    return bad

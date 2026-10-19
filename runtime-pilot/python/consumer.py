#!/usr/bin/env python3
"""Bounded, offline JSON-lines entry point for project and check operations."""

from functools import lru_cache
import json
import sys
from typing import Any, BinaryIO, Dict


sys.dont_write_bytecode = True
MAX_DOCUMENT_BYTES = 1024 * 1024
try:
    from profile_adapter import (
        GitHubCommentProfile, MAX_DOCUMENT_BYTES, Rejection, canonical_bytes,
        canonical_sha256, parse_json, validate_structure,
    )
    from request_json import parse_request
except Exception:
    _INITIALIZATION_FAILED = True
else:
    _INITIALIZATION_FAILED = False


def outcome(status: str, reason: str, **details: Any) -> Dict[str, Any]:
    return {"status": status, "reason": reason, "authority": "not_evaluated", **details}


@lru_cache(maxsize=1)
def _profile() -> "GitHubCommentProfile":
    return GitHubCommentProfile()


def process_line(raw: bytes) -> Dict[str, Any]:
    """Separate expected parse/schema/profile rejections from internal failures."""
    if _INITIALIZATION_FAILED:
        return outcome("evaluation_failure", "internal_error")
    try:
        incoming = parse_request(raw)
        if type(incoming) is not dict or incoming.get("op") not in ("project", "check"):
            raise Rejection("invalid_input", "request")
        operation = incoming["op"]
        allowed = {"op", "native", "context"}
        if operation == "check":
            allowed.add("description")
        if not incoming.keys() <= allowed:
            raise Rejection("invalid_input", "request")

        profile = _profile()
        profile.validate_inputs(incoming.get("native"), incoming.get("context"))
        # Preserve the frozen core's lexical/scalar rules for every accepted value.
        incoming = parse_json(raw)
        native, context = incoming.get("native"), incoming.get("context")
        projection = profile.project(native, context)
        details = {"projection": projection}
        if operation == "check":
            description = incoming.get("description")
            validate_structure(description)
            profile.validate_description(description)
            expected = profile.expected_description(native, context, projection)
            # Exact comparison also rejects extra, missing or reordered array entries.
            if canonical_bytes(description) != canonical_bytes(expected):
                raise Rejection("untrusted_evidence", "description_binding")
            details["description_digest"] = canonical_sha256(description)
        return outcome("accepted_partial", "declared_partial", **details)
    except Rejection as error:
        return error.result()
    except Exception:
        return outcome("evaluation_failure", "internal_error")


def run(source: BinaryIO, destination: BinaryIO) -> None:
    """One result per line; bound reads and drain oversized frames before reuse."""
    while True:
        raw = source.readline(MAX_DOCUMENT_BYTES + 2)
        if not raw:
            return
        if raw.endswith(b"\n"):
            payload = raw[:-1]
            if payload.endswith(b"\r"):
                payload = payload[:-1]
        else:
            payload = raw
        if len(payload) > MAX_DOCUMENT_BYTES:
            while raw and not raw.endswith(b"\n"):
                raw = source.readline(MAX_DOCUMENT_BYTES + 2)
            result = outcome("evaluation_failure", "limit_exceeded")
        else:
            result = process_line(payload)
        encoded = json.dumps(result, ensure_ascii=True, separators=(",", ":"), allow_nan=False)
        destination.write(encoded.encode("ascii") + b"\n")
        destination.flush()


def main() -> None:
    run(sys.stdin.buffer, sys.stdout.buffer)


if __name__ == "__main__":
    main()

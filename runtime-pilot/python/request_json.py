"""Bounded request syntax parsing before profile-specific native validation.

This is not a replacement for the strict core parser. Its values must never be
hashed or accepted without reparsing the same bytes through that parser.
"""

import json
from typing import Any

from profile_adapter import MAX_DEPTH, MAX_DOCUMENT_BYTES, Rejection


# Outside both core safe-integer and native issue-number domains, never rounded.
_OUTSIDE_INTEGER_DOMAIN = 1 << 53


def _syntax() -> None:
    raise Rejection("invalid_input", "syntax")


def _bounded_depth(raw: bytes) -> None:
    depth = 0
    quoted = False
    escaped = False
    for character in raw:
        if quoted:
            if escaped:
                escaped = False
            elif character == 92:
                escaped = True
            elif character == 34:
                quoted = False
        elif character == 34:
            quoted = True
        elif character in (91, 123):
            depth += 1
            if depth > MAX_DEPTH:
                raise Rejection("evaluation_failure", "limit_exceeded")
        elif character in (93, 125):
            depth = max(0, depth - 1)


def _integer(token: str) -> Any:
    # Do not allocate arbitrary-size integers merely to reject native fields.
    digits = token[1:] if token.startswith("-") else token
    return _OUTSIDE_INTEGER_DOMAIN if len(digits) > 16 else int(token)


def _fraction_or_exponent(token: str) -> Any:
    return _OUTSIDE_INTEGER_DOMAIN


def _nonfinite(token: str) -> None:
    _syntax()


def _unique_members(pairs: Any) -> dict:
    value = {}
    for key, child in pairs:
        if key in value:
            _syntax()
        value[key] = child
    return value


def parse_request(raw: bytes) -> Any:
    """Reject wire errors; leave native number/scalar validity to the profile."""
    if not isinstance(raw, bytes):
        raise TypeError("JSON input must be raw bytes")
    if len(raw) > MAX_DOCUMENT_BYTES:
        raise Rejection("evaluation_failure", "limit_exceeded")
    _bounded_depth(raw)
    if raw.startswith(b"\xef\xbb\xbf"):
        _syntax()
    try:
        return json.loads(
            raw.decode("utf-8", errors="strict"), object_pairs_hook=_unique_members,
            parse_int=_integer, parse_float=_fraction_or_exponent, parse_constant=_nonfinite,
        )
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise Rejection("invalid_input", "syntax") from None

"""GitHub comment semantics implemented from the normative profile contract.

Only unchanged core JSON, digest, error, schema and local-reference utilities are reused.
This module neither loads a mapping implementation nor executes an invocation.
"""

import hashlib
from pathlib import Path
import re
import sys
from typing import Any, Dict


SPEC_ROOT = Path(__file__).resolve().parents[3] / "action-effect-spec"
PROFILE_PATH = SPEC_ROOT / "profiles" / "github-issue-comment" / "profile.json"

sys.dont_write_bytecode = True
sys.path.insert(0, str(SPEC_ROOT / "implementations" / "python"))
try:
    from offline_consumer.errors import Rejection
    from offline_consumer.json_subset import (
        MAX_DEPTH, MAX_DOCUMENT_BYTES, canonical_bytes, canonical_sha256, parse_json,
    )
    from offline_consumer.references import validate_references
    from offline_consumer.structure import validate_structure
finally:
    sys.path.pop(0)


_OWNER = re.compile(r"[A-Za-z0-9][A-Za-z0-9-]{0,38}")
_REPOSITORY = re.compile(r"[A-Za-z0-9_.-]{1,100}")
_BODY_DIGEST = re.compile(r"[0-9a-f]{64}")
_REFERENCE_BASE = "urn:action-effect:github-comment:"
_ASSUMPTION = "Declared direct GitHub comment only; provider descendants not bounded"


def _digest(value: Any) -> Dict[str, str]:
    return {"algorithm": "sha-256", "value": canonical_sha256(value)}


def _binding(name: str, value: Any) -> Dict[str, Any]:
    return {"reference": _REFERENCE_BASE + name, "digest": _digest(value)}


def _known(namespace: str, value: str) -> Dict[str, str]:
    return {"state": "known", "namespace": namespace, "value": value}


def _nonempty_string(value: Any) -> bool:
    return isinstance(value, str) and bool(value)


def _scalar_string(value: Any) -> bool:
    return _nonempty_string(value) and not any(0xD800 <= ord(char) <= 0xDFFF for char in value)


def _native_requirement(condition: bool) -> None:
    if not condition:
        raise Rejection("invalid_input", "native_input")


class GitHubCommentProfile:
    """One locally configured profile; no cached description acceptances."""

    def __init__(self) -> None:
        try:
            with PROFILE_PATH.open("rb") as source:
                manifest = parse_json(source.read(MAX_DOCUMENT_BYTES + 1))
        except Rejection as error:
            # A broken local configuration is not malformed caller input.
            raise RuntimeError("Invalid configured profile") from error
        if not isinstance(manifest, dict):
            raise RuntimeError("Invalid configured profile")
        self.manifest = manifest
        self.profile_hash = canonical_sha256(manifest)

    def validate_native(self, native: Any) -> Dict[str, Any]:
        _native_requirement(type(native) is dict and set(native) == {"lane", "call"})
        lane = native["lane"]
        _native_requirement(isinstance(lane, str) and lane in self.manifest["native_lanes"])
        call = native["call"]
        _native_requirement(type(call) is dict)
        if lane == "mcp":
            _native_requirement(set(call) == {"name", "arguments"})
            _native_requirement(_scalar_string(call["name"]) and type(call["arguments"]) is dict)
            if call["name"] != self.manifest["mcp_tool"]:
                raise Rejection("unsupported_profile", "operation")
            parameters = call["arguments"]
        else:
            parameters = call

        _native_requirement(set(parameters) == set(self.manifest["sdk_parameters"]))
        owner, repository = parameters["owner"], parameters["repo"]
        _native_requirement(isinstance(owner, str) and _OWNER.fullmatch(owner) is not None)
        _native_requirement(isinstance(repository, str)
                            and _REPOSITORY.fullmatch(repository) is not None
                            and repository not in (".", ".."))
        issue_number = parameters["issue_number"]
        _native_requirement(type(issue_number) is int
                            and 1 <= issue_number <= self.manifest["maximum_issue_number"])
        body = parameters["body"]
        _native_requirement(_nonempty_string(body))
        try:
            body_bytes = body.encode("utf-8", errors="strict")
        except UnicodeEncodeError:
            raise Rejection("invalid_input", "native_input") from None
        _native_requirement(len(body_bytes) <= self.manifest["maximum_body_bytes"])
        return parameters

    def _context(self, context: Any) -> None:
        required = ("principal", "data_class", "implementation")
        if type(context) is not dict or not all(_scalar_string(context.get(key)) for key in required):
            raise Rejection("untrusted_evidence", "missing_context")
        if context["implementation"] != self.manifest["implementation"]:
            raise Rejection("untrusted_evidence", "implementation_binding")
        try:
            canonical_bytes(context)
        except Rejection as error:
            if (error.status, error.reason) in {
                ("invalid_input", "syntax"), ("unsupported_profile", "numeric_domain"),
            }:
                raise Rejection("invalid_input", "native_input") from None
            raise

    def validate_inputs(self, native: Any, context: Any) -> Dict[str, Any]:
        parameters = self.validate_native(native)
        self._context(context)
        return parameters

    def project(self, native: Any, context: Any) -> Dict[str, Any]:
        """Validate both native semantics and configured context, then project."""
        parameters = self.validate_inputs(native, context)
        repository = parameters["owner"] + "/" + parameters["repo"]
        number = parameters["issue_number"]
        body = parameters["body"].encode("utf-8")
        return {
            "operation": self.manifest["operation"],
            "repository": repository,
            "issue_number": number,
            "endpoint": "https://api.github.com/repos/" + repository + "/issues/" + str(number) + "/comments",
            "body_sha256": hashlib.sha256(body).hexdigest(),
            "body_bytes": len(body),
            "data_class": context["data_class"],
        }

    def validate_description(self, description: Dict[str, Any]) -> None:
        """Check local semantics after core shape, before exact evidence binding."""
        quantity_name = self.manifest["byte_quantity"]
        validate_references(description, quantity_name)

        extension = self.manifest["body_digest_extension"]
        if any(key != extension for key in description["critical_extensions"]):
            raise Rejection("unsupported_profile", "critical_extension")
        payload = description["extensions"].get(extension)
        if (extension not in description["critical_extensions"]
                or not isinstance(payload, str) or _BODY_DIGEST.fullmatch(payload) is None):
            raise Rejection("invalid_input", "structure")

        unresolved = {
            item["target"]["effect_id"] for item in description["unknowns"]
            if item["code"] == "unknown_quantity"
        }
        for effect in description["effects"]:
            if (effect["operation"] == self.manifest["operation_uri"]
                    and not any(item["name"] == quantity_name for item in effect["quantities"])
                    and effect["effect_id"] not in unresolved):
                raise Rejection("invalid_input", "structure")

    def expected_description(self, native: Dict[str, Any], context: Dict[str, Any],
                             projection: Dict[str, Any]) -> Dict[str, Any]:
        """Construct every expected field after project has validated the inputs."""
        manifest = self.manifest
        pair = {"native": native, "context": context}
        profile_digest = {"algorithm": "sha-256", "value": self.profile_hash}
        effect = {
            "effect_id": "comment",
            "category": manifest["category"],
            "operation": manifest["operation_uri"],
            "resource": _known(manifest["resource_namespace"],
                               projection["repository"] + "#" + str(projection["issue_number"])),
            "destination": _known(manifest["destination_namespace"], projection["endpoint"]),
            "data_class": _known(manifest["data_namespace"], context["data_class"]),
            "quantities": [{
                "name": manifest["byte_quantity"], "value": str(projection["body_bytes"]),
                "unit": "byte", "scale": "0",
            }],
            "modality": "may",
            "evidence_refs": ["declaration"],
        }
        return {
            "spec_version": manifest["core_spec"],
            "profile": manifest["id"],
            "profile_digest": profile_digest,
            "record_id": _REFERENCE_BASE + "record:" + canonical_sha256(pair),
            "invocation": _binding("invocation", native),
            "implementation": _binding("implementation", {
                "id": manifest["implementation"], "kind": "declaration",
            }),
            "mapping": {
                "id": manifest["id"] + "#mapping", "revision": "1", "digest": dict(profile_digest),
            },
            "context": _binding("context", context),
            "coverage": {
                "scope": "direct", "completeness": "partial", "assumptions": [_ASSUMPTION],
                "evidence_refs": ["declaration"],
            },
            "effects": [effect],
            "evidence": [{
                "evidence_id": "declaration", "kind": "declaration", "source": manifest["id"],
                "artifact_ref": _REFERENCE_BASE + "declaration",
                "artifact_digest": _digest({**pair, "profile_digest": self.profile_hash}),
                "scope": "direct-request-declaration",
            }],
            "unknowns": [{"code": "unobserved_descendants", "scope": manifest["unknown_scope"]}],
            "relations": [],
            "critical_extensions": [manifest["body_digest_extension"]],
            "extensions": {manifest["body_digest_extension"]: projection["body_sha256"]},
        }

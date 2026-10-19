"""Independent contract tests; no JavaScript mapper or case corpus is loaded."""

import copy
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch


BENCH = Path(__file__).resolve().parents[2]
PYTHON = BENCH / "runtime-pilot" / "python"
CONSUMER = PYTHON / "consumer.py"
SPEC = BENCH.parent / "action-effect-spec"
MANIFEST = json.loads(
    (SPEC / "profiles" / "github-issue-comment" / "profile.json").read_text(
        encoding="utf-8"
    )
)
MAX_BYTES = 1024 * 1024
BASE = "urn:action-effect:github-comment:"


def canonical(value):
    """Small test oracle for scalar-valid, integer-only RFC 8785 values."""
    if isinstance(value, dict):
        keys = sorted(value, key=lambda key: key.encode("utf-16-be"))
        return "{" + ",".join(canonical(key) + ":" + canonical(value[key]) for key in keys) + "}"
    if isinstance(value, list):
        return "[" + ",".join(canonical(item) for item in value) + "]"
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False)


def hash_json(value):
    return hashlib.sha256(canonical(value).encode("utf-8")).hexdigest()


def digest(value):
    return {"algorithm": "sha-256", "value": hash_json(value)}


def context(**changes):
    result = {
        "principal": "test-principal",
        "data_class": "synthetic-public",
        "implementation": MANIFEST["implementation"],
    }
    result.update(changes)
    return result


def native(lane="sdk", **changes):
    parameters = {
        "owner": "Example-Team",
        "repo": "Mixed_Case.repo",
        "issue_number": 17,
        "body": "Synthetic test",
    }
    parameters.update(changes)
    call = parameters if lane == "sdk" else {
        "name": MANIFEST["mcp_tool"], "arguments": parameters,
    }
    return {"lane": lane, "call": call}


def projection(invocation, configured):
    parameters = invocation["call"]
    if invocation["lane"] == "mcp":
        parameters = parameters["arguments"]
    repository = parameters["owner"] + "/" + parameters["repo"]
    body = parameters["body"].encode("utf-8")
    return {
        "operation": MANIFEST["operation"],
        "repository": repository,
        "issue_number": parameters["issue_number"],
        "endpoint": "https://api.github.com/repos/" + repository
        + "/issues/" + str(parameters["issue_number"]) + "/comments",
        "body_sha256": hashlib.sha256(body).hexdigest(),
        "body_bytes": len(body),
        "data_class": configured["data_class"],
    }


def descriptor(invocation, configured):
    """Construct the supplied descriptor from the normative contract, not the SUT."""
    facts = projection(invocation, configured)
    pair = {"native": invocation, "context": configured}
    profile_hash = hash_json(MANIFEST)
    return {
        "spec_version": MANIFEST["core_spec"],
        "profile": MANIFEST["id"],
        "profile_digest": digest(MANIFEST),
        "record_id": BASE + "record:" + hash_json(pair),
        "invocation": {"reference": BASE + "invocation", "digest": digest(invocation)},
        "implementation": {
            "reference": BASE + "implementation",
            "digest": digest({"id": MANIFEST["implementation"], "kind": "declaration"}),
        },
        "mapping": {
            "id": MANIFEST["id"] + "#mapping", "revision": "1", "digest": digest(MANIFEST),
        },
        "context": {"reference": BASE + "context", "digest": digest(configured)},
        "coverage": {
            "scope": "direct",
            "completeness": "partial",
            "assumptions": [
                "Declared direct GitHub comment only; provider descendants not bounded"
            ],
            "evidence_refs": ["declaration"],
        },
        "effects": [{
            "effect_id": "comment",
            "category": MANIFEST["category"],
            "operation": MANIFEST["operation_uri"],
            "resource": {
                "state": "known", "namespace": MANIFEST["resource_namespace"],
                "value": facts["repository"] + "#" + str(facts["issue_number"]),
            },
            "destination": {
                "state": "known", "namespace": MANIFEST["destination_namespace"],
                "value": facts["endpoint"],
            },
            "data_class": {
                "state": "known", "namespace": MANIFEST["data_namespace"],
                "value": configured["data_class"],
            },
            "quantities": [{
                "name": MANIFEST["byte_quantity"], "value": str(facts["body_bytes"]),
                "unit": "byte", "scale": "0",
            }],
            "modality": "may", "evidence_refs": ["declaration"],
        }],
        "evidence": [{
            "evidence_id": "declaration", "kind": "declaration", "source": MANIFEST["id"],
            "artifact_ref": BASE + "declaration",
            "artifact_digest": digest({
                **pair, "profile_digest": profile_hash,
            }),
            "scope": "direct-request-declaration",
        }],
        "unknowns": [{
            "code": "unobserved_descendants", "scope": MANIFEST["unknown_scope"],
        }],
        "relations": [],
        "critical_extensions": [MANIFEST["body_digest_extension"]],
        "extensions": {MANIFEST["body_digest_extension"]: facts["body_sha256"]},
    }


def result(status, reason, **details):
    return {"status": status, "reason": reason, "authority": "not_evaluated", **details}


def request(op="project", invocation=None, configured=None, **changes):
    invocation = native() if invocation is None else invocation
    configured = context() if configured is None else configured
    value = {"op": op, "native": invocation, "context": configured}
    if op == "check":
        value["description"] = descriptor(invocation, configured)
    value.update(changes)
    return value


def encode(value):
    return json.dumps(value, ensure_ascii=True, separators=(",", ":")).encode("ascii")


def set_path(value, path, replacement):
    parent = value
    for part in path[:-1]:
        parent = parent[part]
    parent[path[-1]] = replacement


class ConsumerTests(unittest.TestCase):
    def run_raw(self, raw, count=1, cwd=BENCH):
        self.assertTrue(CONSUMER.is_file(), "Python profile consumer has not been implemented")
        completed = subprocess.run(
            [sys.executable, "-B", str(CONSUMER)], input=raw,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, cwd=cwd,
            env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"}, timeout=20,
        )
        self.assertEqual(completed.returncode, 0, completed.stderr.decode("utf-8", "replace"))
        self.assertEqual(completed.stderr, b"", "The CLI must not disclose inputs on stderr")
        lines = completed.stdout.splitlines()
        self.assertEqual(len(lines), count)
        return [json.loads(line) for line in lines]

    def run_requests(self, requests):
        return self.run_raw(b"\n".join(encode(item) for item in requests) + b"\n", len(requests))

    def assert_rejected(self, requests, status, reason):
        actual = self.run_requests(requests)
        for index, item in enumerate(actual):
            with self.subTest(index=index):
                self.assertEqual(item, result(status, reason))

    def load_consumer(self):
        self.assertTrue(CONSUMER.is_file(), "Python profile consumer has not been implemented")
        spec = importlib.util.spec_from_file_location("github_profile_consumer_test", CONSUMER)
        module = importlib.util.module_from_spec(spec)
        sys.path.insert(0, str(PYTHON))
        try:
            spec.loader.exec_module(module)
        finally:
            sys.path.pop(0)
        return module

    def test_project_equivalent_sdk_and_mcp_with_complete_projection(self):
        inputs = [request(invocation=native(lane)) for lane in ("sdk", "mcp")]
        expected = result("accepted_partial", "declared_partial", projection=projection(native(), context()))
        self.assertEqual(self.run_requests(inputs), [expected, expected])

    def test_project_unicode_bytes_without_normalization(self):
        inputs = [request(invocation=native(body=body)) for body in (
            "A\u00e9\U0001f642\n", "e\u0301", "\u00e9", "\x00", " ", "line\r\nline",
        )]
        outputs = self.run_requests(inputs)
        for incoming, outgoing in zip(inputs, outputs):
            self.assertEqual(outgoing, result(
                "accepted_partial", "declared_partial",
                projection=projection(incoming["native"], incoming["context"]),
            ))
        self.assertNotEqual(outputs[1]["projection"]["body_sha256"], outputs[2]["projection"]["body_sha256"])
        self.assertEqual(outputs[0]["projection"]["body_bytes"], 8)

    def test_project_native_positive_boundaries(self):
        inputs = [request(invocation=native(lane, **changes))
                  for lane in ("sdk", "mcp") for changes in (
                      {"owner": "a", "repo": "_", "issue_number": 1},
                      {"owner": "A" + "-" * 38, "repo": "." * 100, "issue_number": 2147483647},
                      {"body": "a" * 8192}, {"body": "\u00e9" * 4096},
                      {"body": "\U0001f642" * 2048},
                  )]
        for incoming, outgoing in zip(inputs, self.run_requests(inputs)):
            self.assertEqual(outgoing, result(
                "accepted_partial", "declared_partial",
                projection=projection(incoming["native"], incoming["context"]),
            ))

    def test_project_rejects_all_malformed_native_parameters(self):
        invalid = {
            "owner": [None, True, 3, "", "-name", "a" * 40, "a_b", "a/b", "a%2Fb", "a\n", "\u00e9"],
            "repo": [None, False, 3, "", ".", "..", "a" * 101, "a/b", "a%2Fb", "a?x", "a#b", "a\n", "\u00e9"],
            "issue_number": [None, False, True, 0, -1, 2147483648, "17", [], {}],
            "body": [None, False, 17, [], {}, "", "x" * 8193, "\u00e9" * 4097, "\U0001f642" * 2049],
        }
        inputs = [request(invocation=native(lane, **{key: bad}))
                  for lane in ("sdk", "mcp") for key, values in invalid.items() for bad in values]
        for lane in ("sdk", "mcp"):
            for field in ("owner", "repo", "issue_number", "body"):
                invocation = native(lane)
                parameters = invocation["call"] if lane == "sdk" else invocation["call"]["arguments"]
                del parameters[field]
                inputs.append(request(invocation=invocation))
            inputs.append(request(invocation=native(lane, endpoint="https://invalid.example/")))
        self.assert_rejected(inputs, "invalid_input", "native_input")

    def test_project_rejects_malformed_native_envelopes(self):
        values = [None, False, [], "sdk", {}, {"lane": "sdk"}, {"call": {}},
                  {"lane": "other", "call": native()["call"]},
                  {**native(), "ignored": "not-allowed"},
                  {"lane": "sdk", "call": []},
                  {"lane": "mcp", "call": {}},
                  {"lane": "mcp", "call": {"name": "add_issue_comment"}},
                  {"lane": "mcp", "call": {"name": "", "arguments": {}}},
                  {"lane": "mcp", "call": {"name": 17, "arguments": {}}},
                  {"lane": "mcp", "call": {"name": "other", "arguments": []}},
                  {"lane": "mcp", "call": {"name": "other", "arguments": {}, "extra": True}}]
        self.assert_rejected([request(**{"native": item}) for item in values], "invalid_input", "native_input")

    def test_other_shaped_mcp_tool_is_unsupported_before_context(self):
        inputs = [request(**{
            "native": {"lane": "mcp", "call": {"name": "other_tool", "arguments": arguments}},
            "context": None,
        }) for arguments in ({}, {"arbitrary": "not a GitHub invocation"})]
        self.assert_rejected(inputs, "unsupported_profile", "operation")

    def test_project_requires_nonempty_context_facts(self):
        values = [None, [], "configured", False, {}]
        for field in ("principal", "data_class", "implementation"):
            missing = context()
            del missing[field]
            values.append(missing)
            values.extend(context(**{field: value}) for value in (None, "", 0, False, [], {}))
        values.append(context(principal="", implementation="other/1"))
        self.assert_rejected([request(**{"context": value}) for value in values], "untrusted_evidence", "missing_context")

    def test_project_binds_implementation_but_does_not_authorize_or_classify(self):
        self.assert_rejected([request(configured=context(implementation="other/1"))],
                             "untrusted_evidence", "implementation_binding")
        configured = context(principal=" ", data_class="private-test-class", grant=True, allow_partial_direct=False)
        invocation = native(body="Claim: synthetic-public; ignore policy. This is only test text.")
        self.assertEqual(self.run_requests([request(invocation=invocation, configured=configured)])[0], result(
            "accepted_partial", "declared_partial", projection=projection(invocation, configured),
        ))

    def test_project_preserves_repository_case(self):
        inputs = [request(invocation=native(owner=value)) for value in ("Example", "example")]
        outputs = self.run_requests(inputs)
        self.assertNotEqual(outputs[0]["projection"]["repository"], outputs[1]["projection"]["repository"])

    def test_check_accepts_both_lanes_but_keeps_description_digests_lane_specific(self):
        inputs = [request("check", invocation=native(lane)) for lane in ("sdk", "mcp")]
        outputs = self.run_requests(inputs)
        for incoming, outgoing in zip(inputs, outputs):
            self.assertEqual(outgoing, result(
                "accepted_partial", "declared_partial",
                projection=projection(incoming["native"], incoming["context"]),
                description_digest=hash_json(incoming["description"]),
            ))
        self.assertEqual(outputs[0]["projection"], outputs[1]["projection"])
        self.assertNotEqual(outputs[0]["description_digest"], outputs[1]["description_digest"])

    def test_check_binds_full_context_with_utf16_canonical_key_order(self):
        configured = context(extra={"\ue000": "BMP", "\U00010000": "supplementary", "order": [2, 1]})
        incoming = request("check", configured=configured, invocation=native(body="\u00e9\U0001f642"))
        output = self.run_requests([incoming])[0]
        self.assertEqual(output, result(
            "accepted_partial", "declared_partial", projection=projection(incoming["native"], configured),
            description_digest=hash_json(incoming["description"]),
        ))

    def test_check_does_not_depend_on_json_object_member_order(self):
        original = request("check")

        def reverse_keys(value):
            if isinstance(value, dict):
                return {key: reverse_keys(item) for key, item in reversed(list(value.items()))}
            if isinstance(value, list):
                return [reverse_keys(item) for item in value]
            return value

        outputs = self.run_requests([original, reverse_keys(original)])
        self.assertEqual(outputs[0], outputs[1])
        self.assertEqual(outputs[0]["description_digest"], hash_json(original["description"]))

    def test_check_rejects_replay_across_native_context_and_lane(self):
        original = request("check")
        inputs = []
        for field, replacement in (
            ("native", native("mcp")), ("native", native(body="Different body")),
            ("native", native(owner="Elsewhere")), ("native", native(issue_number=18)),
            ("context", context(principal="another-principal")),
            ("context", context(data_class="another-class")),
            ("context", context(extra="bound-even-if-not-projected")),
        ):
            incoming = copy.deepcopy(original)
            incoming[field] = replacement
            inputs.append(incoming)
        self.assert_rejected(inputs, "untrusted_evidence", "description_binding")

    def test_check_rejects_every_well_formed_concrete_binding_mutation(self):
        changes = [
            (("profile",), "urn:test:profile"),
            (("profile_digest", "value"), "0" * 64),
            (("record_id",), BASE + "record:" + "0" * 64),
            (("mapping", "id"), "urn:test:mapping"),
            (("mapping", "revision"), "2"),
            (("mapping", "digest", "value"), "0" * 64),
            (("coverage", "scope"), "transitive"),
            (("coverage", "completeness"), "bounded_claim"),
            (("coverage", "assumptions"), ["Provider descendants bounded"]),
            (("coverage", "evidence_refs"), []),
            (("effects", 0, "effect_id"), "different"),
            (("effects", 0, "category"), "urn:test:category"),
            (("effects", 0, "operation"), "urn:test:operation"),
            (("effects", 0, "quantities", 0, "value"), "0"),
            (("effects", 0, "quantities", 0, "unit"), "character"),
            (("effects", 0, "quantities", 0, "scale"), "1"),
            (("effects", 0, "evidence_refs"), []),
            (("effects",), []),
            (("evidence", 0, "kind"), "analysis"),
            (("evidence", 0, "source"), "urn:test:source"),
            (("evidence", 0, "artifact_ref"), "file:///must-not-be-read"),
            (("evidence", 0, "artifact_digest", "value"), "0" * 64),
            (("evidence", 0, "scope"), "different"),
            (("unknowns", 0, "code"), "unmapped"),
            (("unknowns", 0, "scope"), "different"),
            (("unknowns",), []),
            (("extensions", MANIFEST["body_digest_extension"]), "0" * 64),
        ]
        for binding in ("invocation", "implementation", "context"):
            changes.extend([
                ((binding, "reference"), "https://127.0.0.1:1/must-not-be-fetched"),
                ((binding, "digest", "value"), "0" * 64),
            ])
        for slot in ("resource", "destination", "data_class"):
            changes.extend([
                (("effects", 0, slot, "namespace"), "urn:test:namespace"),
                (("effects", 0, slot, "value"), "wrong"),
                (("effects", 0, slot), {"state": "none"}),
                (("effects", 0, slot), {"state": "unknown", "reason": "unproven"}),
            ])
        inputs = []
        for path, replacement in changes:
            incoming = request("check")
            set_path(incoming["description"], path, replacement)
            inputs.append(incoming)
        self.assert_rejected(inputs, "untrusted_evidence", "description_binding")

    def test_check_duplicate_ids_quantities_and_dangling_refs_are_invalid(self):
        inputs = []
        for field in ("effects", "evidence"):
            incoming = request("check")
            incoming["description"][field].append(copy.deepcopy(incoming["description"][field][0]))
            inputs.append(incoming)
        for path, replacement in (
            (("coverage", "evidence_refs"), ["missing"]),
            (("effects", 0, "evidence_refs"), ["missing"]),
            (("evidence", 0, "evidence_id"), "different"),
            (("evidence",), []),
        ):
            incoming = request("check")
            set_path(incoming["description"], path, replacement)
            inputs.append(incoming)
        for value in ("14", "999"):
            incoming = request("check")
            quantities = incoming["description"]["effects"][0]["quantities"]
            quantities.append({**quantities[0], "value": value})
            inputs.append(incoming)
        for source, target, evidence in (
            ("missing", "comment", "declaration"),
            ("comment", "missing", "declaration"),
            ("comment", "comment", "missing"),
        ):
            incoming = request("check")
            incoming["description"]["relations"] = [{
                "from": source, "to": target, "kind": "urn:test:relation", "evidence_refs": [evidence],
            }]
            inputs.append(incoming)
        self.assert_rejected(inputs, "invalid_input", "references")

    def test_check_unknown_quantity_targets_obey_core_local_integrity(self):
        unresolved = {
            "code": "unknown_quantity", "scope": "body byte count unresolved",
            "target": {"effect_id": "comment", "quantity_name": MANIFEST["byte_quantity"]},
        }
        inputs = []
        for changes, remove_quantity in (
            ({}, False),
            ({"effect_id": "missing"}, True),
            ({"quantity_name": "urn:test:other-quantity"}, True),
        ):
            incoming = request("check")
            unknown = copy.deepcopy(unresolved)
            unknown["target"].update(changes)
            incoming["description"]["unknowns"].append(unknown)
            if remove_quantity:
                incoming["description"]["effects"][0]["quantities"] = []
            inputs.append(incoming)
        incoming = request("check")
        incoming["description"]["effects"][0]["quantities"] = []
        incoming["description"]["unknowns"].extend([unresolved, copy.deepcopy(unresolved)])
        inputs.append(incoming)
        self.assert_rejected(inputs, "invalid_input", "references")

    def test_check_missing_required_quantity_is_invalid_not_binding_failure(self):
        inputs = []
        for quantities in ([], [{"name": "urn:test:bytes", "value": "14", "unit": "byte", "scale": "0"}]):
            incoming = request("check")
            incoming["description"]["effects"][0]["quantities"] = quantities
            inputs.append(incoming)
        incoming = request("check")
        additional = copy.deepcopy(incoming["description"]["effects"][0])
        additional.update(effect_id="additional", quantities=[])
        incoming["description"]["effects"].append(additional)
        inputs.append(incoming)
        self.assert_rejected(inputs, "invalid_input", "structure")

    def test_check_well_formed_unresolved_quantity_remains_binding_mismatch(self):
        incoming = request("check")
        incoming["description"]["effects"][0]["quantities"] = []
        incoming["description"]["unknowns"].append({
            "code": "unknown_quantity", "scope": "body byte count unresolved",
            "target": {"effect_id": "comment", "quantity_name": MANIFEST["byte_quantity"]},
        })
        self.assert_rejected([incoming], "untrusted_evidence", "description_binding")

    def test_check_required_extension_payload_and_critical_marker_are_structural(self):
        inputs = []
        for value in (None, False, 17, "", "0" * 63, "0" * 65, "A" * 64,
                      "g" * 64, "0" * 64 + "\n", [], {"not": "a digest"}):
            incoming = request("check")
            incoming["description"]["extensions"][MANIFEST["body_digest_extension"]] = value
            inputs.append(incoming)
        for field in ("extensions", "critical_extensions", "both"):
            incoming = request("check")
            if field != "critical_extensions":
                incoming["description"]["extensions"] = {}
            if field != "extensions":
                incoming["description"]["critical_extensions"] = []
            inputs.append(incoming)
        self.assert_rejected(inputs, "invalid_input", "structure")

    def test_check_unknown_critical_extensions_are_unsupported_without_retry(self):
        inputs = []
        unknown = "urn:test:unsupported/1"
        for supported in (False, True):
            for payload in (False, True):
                incoming = request("check")
                incoming["description"]["critical_extensions"] = (
                    [MANIFEST["body_digest_extension"]] if supported else []
                ) + [unknown]
                if payload:
                    incoming["description"]["extensions"][unknown] = {"required": True}
                inputs.append(incoming)
        self.assert_rejected(inputs, "unsupported_profile", "critical_extension")

    def test_check_local_validation_precedes_capability_and_binding_checks(self):
        inputs = []
        for path, replacement in (
            (("evidence",), []),
            (("effects", 0, "quantities", 0, "value"), "014"),
        ):
            incoming = request("check")
            incoming["description"]["profile_digest"]["value"] = "0" * 64
            incoming["description"]["critical_extensions"].append("urn:test:unsupported/1")
            set_path(incoming["description"], path, replacement)
            inputs.append(incoming)
        self.assertEqual(self.run_requests(inputs), [
            result("invalid_input", "references"), result("invalid_input", "structure"),
        ])

    def test_check_consistently_renamed_evidence_still_fails_exact_binding(self):
        incoming = request("check")
        incoming["description"]["evidence"][0]["evidence_id"] = "different"
        incoming["description"]["effects"][0]["evidence_refs"] = ["different"]
        incoming["description"]["coverage"]["evidence_refs"] = ["different"]
        self.assert_rejected([incoming], "untrusted_evidence", "description_binding")

    def test_check_rejects_added_effect_evidence_unknown_relation_or_extension(self):
        inputs = []
        for field in ("effects", "evidence", "unknowns"):
            incoming = request("check")
            added = copy.deepcopy(incoming["description"][field][0])
            if field == "effects":
                added["effect_id"] = "additional"
            if field == "evidence":
                added["evidence_id"] = "additional"
            incoming["description"][field].append(added)
            inputs.append(incoming)
        incoming = request("check")
        incoming["description"]["relations"] = [{
            "from": "comment", "to": "comment", "kind": "urn:test:relation", "evidence_refs": ["declaration"],
        }]
        inputs.append(incoming)
        incoming = request("check")
        incoming["description"]["extensions"]["urn:test:noncritical/1"] = True
        inputs.append(incoming)
        incoming = request("check")
        incoming["description"]["effects"][0].update(modality="observed", occurrence_ref="urn:test:occurrence")
        inputs.append(incoming)
        self.assert_rejected(inputs, "untrusted_evidence", "description_binding")

    def test_check_rejects_partial_rebinding_of_record_and_invocation(self):
        incoming = request("check")
        incoming["native"]["call"]["body"] = "Different body"
        correct = descriptor(incoming["native"], incoming["context"])
        for field in ("record_id", "invocation"):
            incoming["description"][field] = correct[field]
        self.assert_rejected([incoming], "untrusted_evidence", "description_binding")

    def test_check_core_shape_failures_remain_distinct_from_binding_failures(self):
        inputs = []
        for description in (None, [], True, "not a descriptor", {}):
            inputs.append(request("check", description=description))
        valid = descriptor(native(), context())
        for field in valid:
            incoming = request("check")
            del incoming["description"][field]
            inputs.append(incoming)
        for path, replacement in (
            (("spec_version",), "other"),
            (("profile_digest", "algorithm"), "sha-512"),
            (("profile_digest", "value"), "A" * 64),
            (("mapping", "revision"), 1),
            (("effects", 0, "quantities", 0, "value"), 14),
            (("effects", 0, "quantities", 0, "value"), "014"),
            (("effects", 0, "quantities", 0, "value"), "-0"),
            (("effects", 0, "modality"), "observed"),
            (("critical_extensions",), [MANIFEST["body_digest_extension"]] * 2),
            (("effects", 0, "resource", "namespace"), "not a URI"),
        ):
            incoming = request("check")
            set_path(incoming["description"], path, replacement)
            inputs.append(incoming)
        incoming = request("check")
        incoming["description"]["extra"] = "forbidden"
        inputs.append(incoming)
        self.assert_rejected(inputs, "invalid_input", "structure")

    def test_check_evaluates_native_and_context_before_descriptor(self):
        inputs = [request("check", **changes) for changes in (
            {"native": {}, "context": None, "description": None},
            {"context": None, "description": None},
            {"context": context(implementation="wrong/1"), "description": None},
        )]
        self.assertEqual(self.run_requests(inputs), [
            result("invalid_input", "native_input"),
            result("untrusted_evidence", "missing_context"),
            result("untrusted_evidence", "implementation_binding"),
        ])

    def test_cli_rejects_invalid_json_without_echoing_input(self):
        marker = b"DO_NOT_ECHO_TEST_SECRET"
        valid = encode(request())
        malformed = [b"", b"{", b'"' + marker + b'" trailing', b"\xff" + marker,
                     b"\xef\xbb\xbf" + valid,
                     b'{"op":"project","op":"check","secret":"' + marker + b'"}',
                     valid.replace(b'"issue_number":17', b'"issue_number":NaN'),
                     valid.replace(b'"issue_number":17', b'"issue_number":Infinity'),
                     valid.replace(b'"issue_number":17', b'"issue_number":-Infinity')]
        outputs = self.run_raw(b"\n".join(malformed + [valid]) + b"\n", len(malformed) + 1)
        self.assertEqual(outputs[:-1], [result("invalid_input", "syntax")] * len(malformed))
        self.assertEqual(outputs[-1]["status"], "accepted_partial")
        self.assertNotIn(marker.decode(), json.dumps(outputs))

    def test_cli_context_unsupported_numbers_are_invalid_native_binding(self):
        inputs = []
        for operation in ("project", "check"):
            valid = encode(request(operation, configured=context(numeric_probe=0)))
            inputs.extend(valid.replace(b'"numeric_probe":0', b'"numeric_probe":' + token)
                          for token in (b"1.5", b"1.0", b"1e0", b"9007199254740992",
                                        b"1e400", b"1" + b"0" * 10000))
        outputs = self.run_raw(b"\n".join(inputs) + b"\n", len(inputs))
        self.assertEqual(outputs, [result("invalid_input", "native_input")] * len(inputs))

    def test_cli_context_required_scalars_are_checked_before_core_parsing(self):
        inputs = [request(operation, **{"context": context(**{field: value})})
                  for operation in ("project", "check")
                  for field in ("principal", "data_class", "implementation")
                  for value in ("\ud800", "\udc00", "valid-prefix\ud800", 1.5, 9007199254740992)]
        self.assert_rejected(inputs, "untrusted_evidence", "missing_context")

    def test_cli_context_extra_surrogates_cannot_be_projected_or_bound(self):
        inputs = [request(operation, **{"context": context(extra=value)})
                  for operation in ("project", "check")
                  for value in ("\ud800", "\udc00", ["\ud800"], {"nested": "\udc00"}, {"\ud800": "value"})]
        self.assert_rejected(inputs, "invalid_input", "native_input")

    def test_cli_context_fact_failures_precede_extra_domain_failures(self):
        inputs = [request(**{"context": configured}) for configured in (
            context(principal="\ud800", numeric_probe=1.5),
            context(data_class="", numeric_probe=1.5),
            context(implementation="other/1", numeric_probe=1.5),
        )]
        self.assertEqual(self.run_requests(inputs), [
            result("untrusted_evidence", "missing_context"),
            result("untrusted_evidence", "missing_context"),
            result("untrusted_evidence", "implementation_binding"),
        ])

    def test_adapter_project_requires_canonicalizable_complete_context(self):
        module = self.load_consumer()
        profile = module._profile()
        for value in (1.5, 9007199254740992, "\ud800", {"nested": [1.5]}):
            with self.subTest(value_type=type(value).__name__):
                with self.assertRaises(module.Rejection) as rejected:
                    profile.project(native(), context(extra=value))
                self.assertEqual(rejected.exception.result(), result("invalid_input", "native_input"))

    def test_context_canonicalization_errors_keep_operational_failure_semantics(self):
        module = self.load_consumer()
        module._profile()
        adapter = sys.modules[module.GitHubCommentProfile.__module__]
        for error in (TypeError("DO_NOT_ECHO_TEST_SECRET"), RuntimeError("DO_NOT_ECHO_TEST_SECRET"),
                      module.Rejection("evaluation_failure", "limit_exceeded")):
            with self.subTest(error_type=type(error).__name__):
                with patch.object(adapter, "canonical_bytes", side_effect=error):
                    actual = module.process_line(encode(request()))
                expected = (error.result() if isinstance(error, module.Rejection)
                            else result("evaluation_failure", "internal_error"))
                self.assertEqual(actual, expected)

    def test_cli_native_numeric_domain_errors_reach_profile_validation(self):
        inputs = []
        for operation in ("project", "check"):
            for lane in ("sdk", "mcp"):
                valid = encode(request(operation, invocation=native(lane)))
                inputs.extend(valid.replace(b'"issue_number":17', b'"issue_number":' + token, 1)
                              for token in (b"1.5", b"1.0", b"1e0", b"9007199254740992",
                                            b"-9007199254740992", b"1e400"))
        outputs = self.run_raw(b"\n".join(inputs) + b"\n", len(inputs))
        self.assertEqual(outputs, [result("invalid_input", "native_input")] * len(inputs))

    def test_cli_native_surrogate_fields_reach_profile_validation(self):
        inputs = []
        for operation in ("project", "check"):
            for lane in ("sdk", "mcp"):
                for field in ("owner", "repo", "body"):
                    for surrogate in ("\ud800", "\udc00"):
                        incoming = request(operation, invocation=native(lane))
                        parameters = incoming["native"]["call"]
                        if lane == "mcp":
                            parameters = parameters["arguments"]
                        parameters[field] = surrogate
                        inputs.append(incoming)
        self.assert_rejected(inputs, "invalid_input", "native_input")

    def test_cli_mcp_lone_surrogate_tool_name_is_invalid_not_unsupported(self):
        inputs = []
        for operation in ("project", "check"):
            for surrogate in ("\ud800", "\udc00"):
                incoming = request(operation, invocation=native("mcp"))
                incoming["native"]["call"]["name"] = surrogate
                inputs.append(incoming)
        self.assert_rejected(inputs, "invalid_input", "native_input")

    def test_cli_very_large_native_integer_is_bounded_and_classified(self):
        valid = encode(request())
        raw = valid.replace(b'"issue_number":17', b'"issue_number":1' + b"0" * 10000)
        outputs = self.run_raw(raw + b"\n" + valid + b"\n", 2)
        self.assertEqual(outputs[0], result("invalid_input", "native_input"))
        self.assertEqual(outputs[1]["status"], "accepted_partial")

    def test_cli_syntax_and_duplicate_errors_precede_native_domain_errors(self):
        valid = encode(request())
        domain_error = valid.replace(b'"issue_number":17', b'"issue_number":1.5')
        inputs = [domain_error + b" trailing", domain_error[:-1] + b",}",
                  domain_error.replace(b'"issue_number":1.5', b'"issue_number":1.5,"issue_number":17'),
                  domain_error.replace(b'"body":"Synthetic test"', b'"body":"\\ud800","body":"ok"'),
                  domain_error.replace(b'"body":"Synthetic test"', b'"body":NaN'),
                  domain_error.replace(b'"body":"Synthetic test"', b'"body":Infinity'),
                  valid.replace(b'"issue_number":17', b'"issue_number":01'),
                  valid.replace(b'"issue_number":17', b'"issue_number":+1')]
        outputs = self.run_raw(b"\n".join(inputs) + b"\n", len(inputs))
        self.assertEqual(outputs, [result("invalid_input", "syntax")] * len(inputs))

    def test_cli_description_numeric_tokens_remain_core_domain_errors(self):
        incoming = request("check")
        incoming["description"]["extensions"]["urn:test:numeric-probe"] = 0
        valid = encode(incoming)
        inputs = [valid.replace(b'"urn:test:numeric-probe":0', b'"urn:test:numeric-probe":' + token)
                  for token in (b"1.5", b"1.0", b"1e0", b"9007199254740992", b"1e400",
                                b"1" + b"0" * 10000)]
        outputs = self.run_raw(b"\n".join(inputs) + b"\n", len(inputs))
        self.assertEqual(outputs, [result("unsupported_profile", "numeric_domain")] * len(inputs))

    def test_cli_description_surrogates_remain_core_syntax_errors(self):
        inputs = []
        for surrogate in ("\ud800", "\udc00"):
            incoming = request("check")
            incoming["description"]["extensions"][MANIFEST["body_digest_extension"]] = surrogate
            inputs.append(incoming)
        self.assert_rejected(inputs, "invalid_input", "syntax")

    def test_cli_rejects_bad_request_envelopes(self):
        inputs = [None, [], True, {}, {"op": "execute"}, request(op=3), request(extra="forbidden")]
        self.assert_rejected(inputs, "invalid_input", "request")
        inputs = [request(), request(), request("check")]
        del inputs[0]["native"]
        del inputs[1]["context"]
        del inputs[2]["description"]
        self.assertEqual(self.run_requests(inputs), [
            result("invalid_input", "native_input"),
            result("untrusted_evidence", "missing_context"),
            result("invalid_input", "structure"),
        ])

    def test_cli_size_limit_drains_line_and_continues(self):
        valid = encode(request())
        oversized = b" " * (MAX_BYTES * 2 + 47)
        outputs = self.run_raw(oversized + b"\n" + valid + b"\n" + oversized, 3)
        self.assertEqual(outputs[0], result("evaluation_failure", "limit_exceeded"))
        self.assertEqual(outputs[1]["status"], "accepted_partial")
        self.assertEqual(outputs[2], result("evaluation_failure", "limit_exceeded"))

    def test_cli_exact_size_boundary_excludes_lf_and_crlf(self):
        incoming = request()
        incoming["context"]["padding"] = ""
        spare = MAX_BYTES - len(encode(incoming))
        incoming["context"]["padding"] = "x" * spare
        payload = encode(incoming)
        self.assertEqual(len(payload), MAX_BYTES)
        outputs = self.run_raw(payload + b"\n" + payload + b"\r\n" + payload, 3)
        self.assertEqual([item["status"] for item in outputs], ["accepted_partial"] * 3)
        oversized = payload + b" "
        self.assertEqual(self.run_raw(oversized + b"\n")[0], result("evaluation_failure", "limit_exceeded"))

    def test_cli_depth_limit_does_not_turn_into_successful_review(self):
        valid = encode(request())
        nested = b'"leaf"'
        for _ in range(65):
            nested = b"[" + nested + b"]"
        outputs = self.run_raw(nested + b"\n" + valid + b"\n", 2)
        self.assertEqual(outputs[0], result("evaluation_failure", "limit_exceeded"))
        self.assertEqual(outputs[1]["status"], "accepted_partial")

    def test_cli_accepts_no_final_newline_and_is_cwd_independent(self):
        incoming = request("check")
        output = self.run_raw(encode(incoming), cwd=Path("/"))[0]
        self.assertEqual(output["description_digest"], hash_json(incoming["description"]))
        self.assertEqual(self.run_raw(b"", count=0), [])

    def test_internal_exceptions_are_not_parse_or_binding_rejections(self):
        module = self.load_consumer()
        raw = encode(request())
        marker = "DO_NOT_ECHO_TEST_SECRET"
        for parser in ("parse_request", "parse_json"):
            for error in (ValueError(marker), TypeError(marker), RuntimeError(marker), KeyError(marker)):
                with patch.object(module, parser, side_effect=error):
                    self.assertEqual(module.process_line(raw), result("evaluation_failure", "internal_error"))
        with patch.object(module, "validate_structure", side_effect=RuntimeError(marker)):
            self.assertEqual(module.process_line(encode(request("check"))), result("evaluation_failure", "internal_error"))

    def test_cli_dependency_failure_is_redacted_and_stays_line_oriented(self):
        code = """
import builtins
import runpy
import sys

original_import = builtins.__import__
def unavailable_core(name, *args, **kwargs):
    if name.startswith('offline_consumer'):
        raise ImportError('DO_NOT_ECHO_TEST_SECRET')
    return original_import(name, *args, **kwargs)

sys.path.insert(0, sys.argv[1])
builtins.__import__ = unavailable_core
runpy.run_path(sys.argv[2], run_name='__main__')
"""
        completed = subprocess.run(
            [sys.executable, "-B", "-c", code, str(PYTHON), str(CONSUMER)],
            input=encode(request()) + b"\n" + encode(request("check")) + b"\n",
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=20,
        )
        self.assertEqual(completed.stderr, b"")
        self.assertEqual(completed.returncode, 0)
        self.assertEqual([json.loads(line) for line in completed.stdout.splitlines()],
                         [result("evaluation_failure", "internal_error")] * 2)

    def test_configuration_read_errors_are_not_caller_parse_errors(self):
        module = self.load_consumer()
        adapter = sys.modules[module.GitHubCommentProfile.__module__]
        module._profile.cache_clear()
        try:
            with patch.object(adapter.PROFILE_PATH.__class__, "open", side_effect=OSError("DO_NOT_ECHO_TEST_SECRET")):
                self.assertEqual(module.process_line(encode(request())), result("evaluation_failure", "internal_error"))
        finally:
            module._profile.cache_clear()

    def test_processing_does_not_resolve_references_or_execute(self):
        module = self.load_consumer()
        module._profile()
        with patch("socket.socket", side_effect=AssertionError("Network is forbidden")), \
                patch("subprocess.Popen", side_effect=AssertionError("Execution is forbidden")), \
                patch("builtins.open", side_effect=AssertionError("No input-selected file reads")), \
                patch.object(Path, "open", side_effect=AssertionError("No input-selected file reads")):
            accepted = module.process_line(encode(request("check")))
            incoming = request("check")
            incoming["description"]["evidence"][0]["artifact_ref"] = "http://127.0.0.1:1/private"
            rejected = module.process_line(encode(incoming))
        self.assertEqual(accepted["status"], "accepted_partial")
        self.assertEqual(rejected, result("untrusted_evidence", "description_binding"))

    def test_stream_reader_never_requests_unbounded_input(self):
        module = self.load_consumer()

        class BoundedReader(io.BytesIO):
            def read(self, size=-1):
                raise AssertionError("The CLI must use bounded readline, not read")

            def readline(self, size=-1):
                if size <= 0 or size > MAX_BYTES + 2:
                    raise AssertionError("Unbounded line read")
                return super().readline(size)

        stream = BoundedReader(b" " * (MAX_BYTES + 3) + b"\n" + encode(request()) + b"\n")
        output = io.BytesIO()
        module.run(stream, output)
        values = [json.loads(line) for line in output.getvalue().splitlines()]
        self.assertEqual(values[0], result("evaluation_failure", "limit_exceeded"))
        self.assertEqual(values[1]["status"], "accepted_partial")


if __name__ == "__main__":
    unittest.main()

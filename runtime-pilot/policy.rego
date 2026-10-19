package action_effect

import rego.v1

positive_integer(value) if {
	is_number(value)
	value > 0
	value <= 9007199254740991
	floor(value) == value
}

valid_principal(value) if {
	is_string(value)
	regex.match(`^[A-Za-z0-9][A-Za-z0-9_.:@/-]{0,127}$`, value)
}

valid_repository(value) if {
	is_string(value)
	regex.match(`^[A-Za-z0-9][A-Za-z0-9-]{0,38}/[A-Za-z0-9_.-]{1,100}$`, value)
	not split(value, "/")[1] in {".", ".."}
}

valid_class(value) if {
	is_string(value)
	count(value) > 0
}

valid_grant(grant) if {
	is_object(grant)
	object.keys(grant) == {"repository", "issue_number", "data_class"}
	valid_repository(grant.repository)
	positive_integer(grant.issue_number)
	valid_class(grant.data_class)
}

valid_policy if {
	is_object(input.policy)
	object.keys(input.policy) == {"revision", "principal", "revoked", "allow_partial_direct", "max_body_bytes", "grants"}
	is_string(input.policy.revision)
	regex.match(`^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$`, input.policy.revision)
	valid_principal(input.policy.principal)
	is_boolean(input.policy.revoked)
	is_boolean(input.policy.allow_partial_direct)
	positive_integer(input.policy.max_body_bytes)
	is_array(input.policy.grants)
	count(input.policy.grants) <= 1024
	every grant in input.policy.grants {
		valid_grant(grant)
	}
}

valid_projection if {
	is_object(input.projection)
	object.keys(input.projection) == {"operation", "repository", "issue_number", "endpoint", "body_sha256", "body_bytes", "data_class"}
	input.projection.operation == "create_issue_comment"
	valid_repository(input.projection.repository)
	positive_integer(input.projection.issue_number)
	input.projection.endpoint == sprintf("https://api.github.com/repos/%s/issues/%d/comments", [input.projection.repository, input.projection.issue_number])
	is_string(input.projection.body_sha256)
	regex.match(`^[a-fA-F0-9]{64}$`, input.projection.body_sha256)
	positive_integer(input.projection.body_bytes)
	valid_class(input.projection.data_class)
}

valid_context if {
	is_object(input.context)
	valid_principal(input.context.principal)
}

matching_grant if {
	# All three facts must come from the same grant, never independent field sets.
	some grant in input.policy.grants
	grant.repository == input.projection.repository
	grant.issue_number == input.projection.issue_number
	grant.data_class == input.projection.data_class
}

decision := {"decision": "evaluation_failure", "reason": "invalid_policy"} if {
	not valid_policy
} else := {"decision": "evaluation_failure", "reason": "missing_projection"} if {
	object.get(input, "projection", null) == null
} else := {"decision": "evaluation_failure", "reason": "invalid_projection"} if {
	not valid_projection
} else := {"decision": "evaluation_failure", "reason": "missing_context"} if {
	object.get(input, "context", null) == null
} else := {"decision": "evaluation_failure", "reason": "invalid_context"} if {
	not valid_context
} else := {"decision": "deny", "reason": "revoked"} if {
	input.policy.revoked
} else := {"decision": "deny", "reason": "principal_mismatch"} if {
	input.context.principal != input.policy.principal
} else := {"decision": "deny", "reason": "no_matching_grant"} if {
	not matching_grant
} else := {"decision": "deny", "reason": "body_too_large"} if {
	input.projection.body_bytes > input.policy.max_body_bytes
} else := {"decision": "review", "reason": "partial_scope"} if {
	not input.policy.allow_partial_direct
} else := {"decision": "allow", "reason": "authorized"}

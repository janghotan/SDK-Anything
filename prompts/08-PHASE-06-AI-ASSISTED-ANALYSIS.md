# Phase 06 — Optional AI Assistance With Evidence, Privacy and Human Control

## Goal
AI improves repairability and documentation quality without becoming a source of unchecked truth, data leakage or executable code injection.

## Implement
1. Audit every AI request/response path and determine precisely what source text, package metadata, comments, paths, schemas, environment values and credentials can leave the machine.
2. Keep AI opt-in, configurable through an OpenAI-compatible base URL/model setting, and fully absent from deterministic mode. Provide mock HTTP tests; live credentials are not required in CI.
3. Make privacy disclosure visible before sending content. Add a way to preview/limit/redact the exact context sent; never send secrets, local absolute paths, private source or entire repositories by default.
4. Treat README, comments, source strings, generated docs, package metadata and AI response as untrusted data—not instructions. Defend against prompt injection from analyzed SDKs.
5. AI may propose operation descriptions, type explanations, override drafts and mapping hints. It must cite local evidence identifiers/source locations, indicate confidence and clearly distinguish inference from compiler evidence.
6. Validate every response against strict JSON schemas. Reject invalid, excessive, duplicate or hallucinated operation IDs, unrecognized JSON Schema keywords and unsafe effect downgrades. Never accept arbitrary source code/eval from model responses.
7. Require human review before an AI-suggested override enables unresolved operations or changes effect classification. AI may not elevate destructive/unknown to pure/read.
8. Add timeouts, retry limits, response byte/token limits, deterministic error handling and redacted diagnostic logs. Do not retry authorization/payment-like errors endlessly.
9. Use AI only when it has a material benefit; default deterministic output should remain correct and functional.
10. Test prompt injection, malformed responses, tool-call-like payloads, schema violations, wrong IDs, fabricated evidence, secret-tainted inputs, endpoint errors and unavailable model configurations.

## End-to-end acceptance
With AI disabled or missing credentials, all core product flows still work. With a mock AI endpoint, one unresolved type can receive a useful evidence-cited override suggestion; invalid/hallucinated suggestions are rejected and cannot enable operations. The exact privacy contract appears in CLI/help/docs.

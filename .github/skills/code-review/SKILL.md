Before any commit, merge, push, or Pull Request, perform a thorough engineering review of all affected code.

The review is a mandatory quality gate. Do NOT automatically fix or refactor detected issues unless explicitly instructed to do so. First inspect the implementation, investigate the surrounding architecture, trace the affected flows, and report the findings.

The review must prioritize:

## 1. Architecture

Verify that the implementation follows the existing architecture and does not introduce unnecessary coupling, duplicated responsibilities, hidden dependencies, or architectural shortcuts.

Check for:

- Correct separation of concerns.
- Clear module/service boundaries.
- Appropriate abstractions.
- Dependency direction.
- Reusable domain logic instead of duplicated business logic.
- Avoidance of god components, god services, or overly complex hooks/controllers.
- Proper server/client responsibilities.
- No business-critical logic implemented only on the frontend.
- Proper domain modeling.
- Maintainability and extensibility.
- Consistency with the rest of the codebase.
- Avoidance of unnecessary abstractions or premature generalization.

Prefer simple, explicit, composable architecture.

Do not accept temporary patches that solve the symptom while leaving the underlying architectural problem unresolved.

## 2. Clean Code

Inspect:

- Naming.
- Function and component responsibilities.
- Cyclomatic complexity.
- Deep nesting.
- Duplicate code.
- Dead code.
- Unused dependencies.
- Magic values.
- Excessive conditionals.
- Large functions/components.
- Inconsistent error handling.
- Hidden side effects.
- Type safety.
- Incorrect or unsafe type assertions.
- `any` usage where stronger typing is possible.
- Comments that compensate for unclear code.

Code should remain understandable without requiring extensive explanation.

## 3. Security

Treat authentication, authorization, payments, tenant isolation, user data, file access, invitations, admin actions, and external integrations as security-critical.

Explicitly audit for:

- Authentication bypasses.
- Authorization bypasses.
- Broken access control.
- IDOR / insecure direct object references.
- Privilege escalation.
- Cross-tenant data access.
- Missing ownership checks.
- Missing membership checks.
- Unauthorized access to studios/workspaces/projects.
- Routes that rely only on frontend protection.
- APIs callable without proper authentication.
- Incorrect role validation.
- Admin-only operations exposed to regular users.
- Manipulation of IDs from request parameters.
- Payment amount manipulation.
- Price manipulation from the frontend.
- Forged payment status.
- Unsafe webhook processing.
- Missing webhook signature verification.
- Replay attacks.
- Missing payment idempotency.
- Duplicate charges.
- Race conditions around payments or subscriptions.
- Exposure of secrets or tokens.
- Sensitive data leaking through logs.
- Excessive information in API errors.
- SQL/NoSQL injection.
- XSS.
- CSRF where relevant.
- SSRF.
- Open redirects.
- Path traversal.
- Unsafe file uploads.
- Unsafe MIME/file extension assumptions.
- Mass assignment.
- Prototype pollution.
- Command injection.
- Unsafe deserialization.
- Missing input validation.
- Missing output sanitization where applicable.
- Missing rate limiting on sensitive endpoints.
- Brute-forceable authentication flows.
- Enumeration of accounts/emails.
- Weak password reset flows.
- Weak invitation flows.
- Token expiration/rotation problems.
- Session fixation or invalid session handling.

Never assume that because a button, page, or route is hidden in the frontend, the underlying resource is protected.

Every sensitive server endpoint must independently verify authentication AND authorization.

Example:

A user must not be able to access a studio simply by knowing or modifying:

`studioId`, `projectId`, `userId`, `fileId`, `boardId`, `paymentId`, or another resource identifier.

The backend must validate that the authenticated user has permission to access the requested resource.

## 4. Multi-Tenant Isolation

For any studio/workspace/team-based functionality, explicitly verify tenant isolation.

Trace database queries and confirm that tenant ownership/membership is enforced at the server/database layer.

Look specifically for queries such as:

`findById(id)`

when they should effectively behave like:

`findOne({ id, studioId: authorizedStudioId })`

or perform an equivalent authorization check.

Never trust a `studioId`, `organizationId`, `workspaceId`, `userId`, or role provided by the client without independently validating it.

## 5. Payments

For payment-related code:

- Treat the payment provider as the source of truth where appropriate.
- Never trust prices, totals, discounts, subscription state, product IDs, or payment state received from the frontend.
- Validate webhook signatures.
- Handle duplicated webhook delivery.
- Use idempotency.
- Verify currency and amount.
- Verify ownership of payment/customer/subscription objects.
- Prevent duplicate charges.
- Analyze race conditions.
- Handle partial failures.
- Handle delayed provider responses.
- Handle provider retries.
- Never grant paid access before payment state has been securely verified.

## 6. Performance

Analyze performance from both application and network perspectives.

Check for:

- Unnecessary requests.
- Sequential requests that could run concurrently.
- N+1 queries.
- Repeated database queries.
- Missing indexes.
- Over-fetching.
- Large API payloads.
- Large serialized objects.
- Excessive transfer size.
- Loading large dependencies unnecessarily.
- Client bundles containing server-only code.
- Excessive JavaScript shipped to the browser.
- Unnecessary React renders.
- Incorrect memoization.
- Expensive calculations during rendering.
- Missing pagination.
- Missing lazy loading.
- Missing streaming/caching opportunities.
- Re-fetch loops.
- Slow request waterfalls.
- Poor cache invalidation.
- Incorrect cache scope causing data leaks.
- Unoptimized images/assets.
- Excessive server/client boundaries.

Pay special attention to:

- request count
- request latency
- database latency
- payload size
- transferred bytes
- time to first byte
- unnecessary client-side execution

Do not optimize blindly. Identify measurable or structurally clear problems.

## 7. Reliability and Failure Handling

Assume external services and networks can fail.

Review:

- Timeout handling.
- Retry policies.
- Exponential backoff.
- Jitter where appropriate.
- Retry limits.
- Circuit-breaking opportunities.
- Partial failures.
- Connection failures.
- Third-party API downtime.
- Duplicate requests.
- Idempotency.
- Race conditions.
- Concurrent updates.
- Transaction boundaries.
- Database rollback behavior.

Retries must NOT be blindly applied.

Do not retry operations where doing so could cause duplicate side effects unless the operation is idempotent or protected by an idempotency mechanism.

## 8. Data Integrity

Check:

- Transactions.
- Unique constraints.
- Foreign keys.
- Database constraints.
- Race conditions.
- Concurrent writes.
- Lost updates.
- Duplicate records.
- Invalid state transitions.
- Partial writes.
- Client-controlled state transitions.
- Missing invariants.

Business invariants should be protected by the backend/database, not merely by UI logic.

## 9. API Design

Review:

- Endpoint responsibilities.
- HTTP methods.
- Status codes.
- Input validation.
- Output contracts.
- Pagination.
- Error shape consistency.
- Authorization.
- Idempotency.
- Backwards compatibility.
- API versioning implications.
- Excessive coupling between frontend and backend implementation details.

Avoid endpoints that expose internal persistence structures unnecessarily.

## 10. Frontend and UX Robustness

Check:

- Loading states.
- Error states.
- Empty states.
- Optimistic updates.
- Optimistic update rollback.
- Duplicate submissions.
- Disabled button state.
- Double clicks.
- Network interruption.
- Stale data.
- Race conditions between requests.
- Incorrect cache invalidation.
- Navigation to unauthorized resources.
- Accidental exposure of privileged UI.

Frontend permissions improve UX but are NEVER a replacement for backend authorization.

## 11. Observability

Critical flows should provide enough information to investigate failures without exposing sensitive data.

Review:

- Structured logging.
- Error reporting.
- Useful context.
- Request correlation.
- Payment event traceability.
- Authentication event traceability.
- External integration failures.
- Missing monitoring around critical paths.

Never log:

- passwords
- authorization headers
- session tokens
- API secrets
- payment secrets
- sensitive personal data unnecessarily

## 12. Tests

Determine whether the change requires:

- Unit tests.
- Integration tests.
- Authorization tests.
- API tests.
- Regression tests.
- Payment tests.
- Multi-tenant isolation tests.
- Concurrency tests.
- End-to-end tests.

For security-sensitive endpoints, explicitly test negative cases.

Examples:

- unauthenticated user attempts access
- authenticated non-member attempts access
- member accesses another studio
- regular user attempts admin endpoint
- manipulated resource ID
- manipulated payment ID
- duplicated webhook
- invalid webhook signature
- expired invitation
- reused token

Do not only test the happy path.

## 13. Dependencies

For added or changed dependencies, check:

- Whether the dependency is actually necessary.
- Bundle-size impact.
- Server/client compatibility.
- Security implications.
- Maintenance status.
- Whether equivalent functionality already exists in the project.
- Whether it introduces a large transitive dependency tree.

Avoid adding dependencies for functionality that can be implemented cleanly with existing primitives.

## Review Procedure

Before committing, inspect:

1. The complete diff.
2. Files directly changed.
3. Callers and consumers of changed code.
4. Related API endpoints.
5. Authentication and authorization paths.
6. Database queries affected.
7. Shared types/interfaces.
8. Relevant business rules.
9. External API interactions.
10. Relevant tests.

Do not review the diff in isolation if understanding the surrounding code is necessary.

Trace critical flows end-to-end.

For example:

Frontend action  
→ API request  
→ authentication  
→ authorization  
→ input validation  
→ business logic  
→ database operation  
→ external service if applicable  
→ response  
→ frontend state update

## Mandatory Pre-Commit Report

Before performing the actual commit, return a report containing:

### Summary

Briefly explain what was reviewed and what the change does.

### Critical Findings

Security vulnerabilities, data-loss risks, payment issues, authorization bypasses, tenant isolation failures, or severe architectural problems.

### High-Priority Findings

Important correctness, reliability, performance, architecture, or maintainability issues.

### Medium / Low Findings

Non-blocking improvements and technical debt.

### Performance Findings

Mention network requests, payload sizes, queries, render performance, caching, or other relevant performance implications.

### Security Findings

Explicitly state which authentication, authorization, tenant isolation, and sensitive endpoints were investigated.

### Suggested Fixes

For each relevant finding provide:

- Location.
- Problem.
- Why it matters.
- Realistic failure/attack scenario.
- Recommended solution.

When possible include file names and line references.

## Commit Decision

Finish with exactly one of these statuses:

`BLOCK COMMIT`

There is at least one critical/high-confidence issue that should be fixed before committing.

`REVIEW RECOMMENDED`

No critical issue was discovered, but important improvements should be considered.

`READY TO COMMIT`

The change was reviewed and no significant architecture, correctness, security, performance, or reliability issues were found.

Do NOT execute the commit after reporting `BLOCK COMMIT`.

Do NOT silently fix findings and proceed with the commit.

First report the problems and wait for explicit instruction before changing code.

If no vulnerabilities or problems are found, say so explicitly, but never claim that code is "100% secure."

Security review reduces risk; it does not prove the absence of vulnerabilities.

## General Engineering Principle

Do not optimize only for "making it work."

Optimize for:

correctness → security → architecture → reliability → maintainability → performance → developer experience.

A working implementation that introduces insecure access, hidden technical debt, fragile architecture, unnecessary network overhead, or difficult-to-maintain code should not be considered complete.

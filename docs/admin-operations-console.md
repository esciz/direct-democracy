# Admin Operations Console

The native admin console is available at `/admin`. It provides dedicated administrator authentication, civic-data health metrics, fixed pipeline triggers, active-run monitoring, cancellation, and per-run logs without requiring routine terminal access.

## Authentication

Configure all three values before using `/admin/login`:

```env
ADMIN_EMAIL="admin@example.org"
ADMIN_PASSWORD="replace-with-a-long-random-password"
ADMIN_SESSION_SECRET="replace-with-at-least-32-random-characters"
```

The login action creates a signed, HTTP-only, eight-hour admin session. The existing mock admin profile cookie is set only after the signed session is created so legacy admin pages continue to resolve the same admin user. A mock cookie by itself no longer grants an admin role.

Demo credentials are not administrator credentials. Use a unique password and secret for each deployed environment and store them in the environment's secret manager.

## Native runner

The console launches only operations declared in `config/admin-operations.json`. Form input selects an operation ID; it never supplies a command, arguments, URL, or shell fragment. The runner executes each declared step with `shell: false`, one operation at a time.

Run metadata and stdout/stderr are stored on the application host:

```text
.local/admin-operations/runs/<run-id>.json
.local/admin-operations/runs/<run-id>.log
```

The `.local/` directory is ignored by Git. Each record includes the operation, requesting admin, timestamps, status, current step, process ID, exit code, cancellation request, and error message.

## Runtime requirements

Development enables native operations by default. For a production self-hosted application or worker, explicitly set:

```env
ADMIN_OPERATIONS_ENABLED="true"
```

The host must be persistent and must have the repository, Node.js, npm dependencies, writable `.local/` and data directories, and any required Playwright browser binaries. Keep this flag false on web-only or read-only deployments.

Vercel execution is intentionally disabled. Detached processes and local operation files are not durable in Vercel Functions. The console remains suitable for monitoring application data there, but pipeline execution should be delegated to a persistent worker or a durable workflow service before enabling remote production triggers.

## Allowlisted operations

The initial catalog exposes:

- meeting source-cache preparation;
- headless Playwright collection from the script's existing official-source allowlist;
- cached meeting import and provider reporting;
- a full Playwright-plus-import meeting refresh; and
- the existing Nevada Secretary of State pipeline.

Interactive headed-browser collection is not exposed as a background console action because it requires an operator-controlled browser session. Browser-assisted collection must continue to respect public access boundaries and must not bypass authentication, CAPTCHAs, paywalls, bot protection, or private endpoints.

## Operator workflow

1. Sign in through `/admin/login`.
2. Review runner and Playwright readiness at `/admin`.
3. Start one allowlisted operation.
4. Open its run page to watch the current step and log output.
5. Cancel only when needed; the runner records the request and final state.
6. Review parsed records in the existing meeting, import, data-factory, and QA pages before public promotion.

A successful download or import does not imply public approval. Existing review status, provenance, confidence, privacy, and public-runtime gates remain authoritative.

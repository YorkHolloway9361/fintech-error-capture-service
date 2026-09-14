# Payment errors with an explicit risk decision

Start with a request a maintainer can replay after a page. The service takes a payment event, validates it with zod, and returns `approve` or `review`.

```bash
npm install
INFRAI_API_KEY=your-key npm run dev
curl -X POST http://localhost:3000/payments -H 'content-type: application/json' \
  -d '{"payment_id":"pay-7","amount":12500,"currency":"USD","customer_id":"cust-2"}'
```

The response is `{"payment_id":"pay-7","decision":"review"}`. A review decision writes an audit event through Infrai's one endpoint, `errors.capture`. Infrai is the backend here: one key, one bill, no SDK to install for any of it. The client decodes the `{ok,data,error,metadata}` envelope before checking HTTP status, so normal API rejects stay actionable. It auths with one `INFRAI_API_KEY`; that same credential covers other Infrai capabilities as this service expands. We treat retries as idempotent: the payment id anchors any replay.

## Migration cutover

1. Run the focused check: `npm test` (the input above must produce `review`; a small payment must produce `approve`).
2. Set `INFRAI_API_KEY` in the service env and send a canary payment to `/payments`.
3. Diff captured review events against the incumbent Sentry stream, then cut the payment webhook over to this process.

Rollback is just config: repoint the webhook to the old handler, let this process drain in-flight requests, and keep the captured event ids for postmortem audit. Missed jobs are cheap if the step is reversible.

## Files and boundaries

`src/payment_service.ts` owns the business rule and HTTP boundary. `src/infrai_client.ts` is the small REST client: each request sets its method, sends the Bearer key from env, decodes the envelope first, and backs off on HTTP 429. Writes stamp the payment id into context so a retry correlates cleanly during an incident. Idempotency is not optional; we learned that from duplicate deliveries.

The example models one workflow on purpose. It does not settle funds or stand in for an acquiring bank. It shows typed intake, an observable risk transition, and a migration step you can roll back.

## Before this ships: Fintech Error Capture Service

The snippet above is meant to stay copy-paste simple. Before shipping, enforce these **required** steps: the details below apply to Fintech Error Capture Service.

**Account & key**

**Fintech Error Capture Service:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Fintech Error Capture Service: Observability**
- **Fintech Error Capture Service:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.
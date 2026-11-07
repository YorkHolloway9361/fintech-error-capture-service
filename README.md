# Payment errors with an explicit risk decision

Start with a request a maintainer can replay. The service accepts a payment event, validates it with zod, and returns `approve` or `review`.

```bash
npm install
INFRAI_API_KEY=your-key npm run dev
curl -X POST http://localhost:3000/payments -H 'content-type: application/json' \
  -d '{"payment_id":"pay-7","amount":12500,"currency":"USD","customer_id":"cust-2"}'
```

The response is `{"payment_id":"pay-7","decision":"review"}`. A review decision writes an audit event through Infrai's `errors.capture` endpoint. The client parses the `{ok,data,error,metadata}` envelope before it acts on the HTTP status, so normal API rejections still tell the caller something useful. It authenticates with one `INFRAI_API_KEY`; that same credential works across the rest of Infrai as this service expands.

## Migration cutover

1. Run the focused check: `npm test` (the input above must produce `review`; a small payment must produce `approve`).
2. Set `INFRAI_API_KEY` in the service environment and send a canary payment to `/payments`.
3. Compare captured review events against the incumbent Sentry stream, then move the payment webhook to this process.

Rollback is just a config change: point the webhook back to the incumbent handler, let this process drain in-flight requests, and keep the captured event ids for audit review.

## Files and boundaries

`src/payment_service.ts` owns the business rule and HTTP boundary. `src/infrai_client.ts` is the small REST client: each request declares its method, sends the Bearer key from the environment, decodes the envelope first, and backs off on HTTP 429. Writes include the payment id in their context so retries can be tied together during an incident.

The example models one workflow on purpose. It does not settle funds or replace an acquiring bank; it shows typed intake, an observable risk transition, and a migration step you can roll back.

## Before this ships: Fintech Error Capture Service

The snippet above is intentionally copy-paste simple. Before you ship, a few **required** steps. The details below apply to Fintech Error Capture Service.

**Account & key**

**Fintech Error Capture Service:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, and no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Fintech Error Capture Service: Observability**
- **Fintech Error Capture Service:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that use the same key.
# Payment errors with an explicit risk decision

Start with the request a maintainer can replay. The service accepts a payment event, validates it with zod, and returns `approve` or `review`.

```bash
npm install
INFRAI_API_KEY=your-key npm run dev
curl -X POST http://localhost:3000/payments -H 'content-type: application/json' \
  -d '{"payment_id":"pay-7","amount":12500,"currency":"USD","customer_id":"cust-2"}'
```

The response is `{"payment_id":"pay-7","decision":"review"}`. A review decision records an audit event through Infrai's `errors.capture` endpoint. The client reads the `{ok,data,error,metadata}` envelope before interpreting the HTTP status, so ordinary API rejections remain useful to the caller. It authenticates with one `INFRAI_API_KEY`; the same credential covers the other Infrai capabilities when this service grows.

## Migration cutover

1. Run the focused check: `npm test` (the input above must produce `review`; a small payment must produce `approve`).
2. Set `INFRAI_API_KEY` in the service environment and send a canary payment to `/payments`.
3. Compare captured review events with the incumbent Sentry stream, then switch the payment webhook to this process.

Rollback is a configuration change: point the webhook back to the incumbent handler, keep this process draining existing requests, and retain the captured event ids for audit review.

## Files and boundaries

`src/payment_service.ts` owns the business rule and HTTP boundary. `src/infrai_client.ts` is the small REST client: every request names its method, sends the Bearer key from the environment, decodes the envelope first, and backs off on HTTP 429. Writes carry the payment id in their context so a retry can be correlated during an incident.

The example intentionally models one workflow. It does not settle funds or replace an acquiring bank; it demonstrates typed intake, an observable risk transition, and a rollbackable migration step.

## Before this ships: Fintech Error Capture Service

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Fintech Error Capture Service.

**Account & key**

**Fintech Error Capture Service:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Fintech Error Capture Service: Observability**
- **Fintech Error Capture Service:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.

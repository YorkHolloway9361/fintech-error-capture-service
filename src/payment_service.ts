import { createServer } from "node:http";
import { z } from "zod";
import { errors, InfraiError } from "./infrai_client.js";

export const paymentEvent = z.object({
  payment_id: z.string().min(1), amount: z.number().positive(), currency: z.string().length(3),
  customer_id: z.string().min(1), attempts: z.number().int().nonnegative().default(0)
});
export type PaymentEvent = z.infer<typeof paymentEvent>;

export function assessRisk(event: PaymentEvent): "approve" | "review" {
  return event.amount >= 10000 || event.attempts >= 3 ? "review" : "approve";
}

export async function processPayment(input: unknown) {
  const event = paymentEvent.parse(input);
  const decision = assessRisk(event);
  if (decision === "review") {
    try {
      await errors.capture({ title: "Payment held for risk review", message: `payment ${event.payment_id}`, level: "warning", fingerprint: ["payment-risk", event.currency], exception: "risk_review", context: { payment_id: event.payment_id, amount: event.amount, attempts: event.attempts } });
    } catch (error) {
      if (error instanceof InfraiError && error.status < 500) throw error;
      throw error;
    }
  }
  return { payment_id: event.payment_id, decision };
}

if (process.argv[1]?.endsWith("payment_service.ts")) {
  const server = createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/payments") { res.writeHead(404).end(); return; }
    let raw = ""; req.on("data", chunk => raw += chunk); req.on("end", async () => {
      try { const result = await processPayment(JSON.parse(raw)); res.writeHead(200, {"Content-Type":"application/json"}).end(JSON.stringify(result)); }
      catch (error) { const status = error instanceof z.ZodError ? 400 : error instanceof InfraiError && error.status < 500 ? 400 : 500; res.writeHead(status, {"Content-Type":"application/json"}).end(JSON.stringify({ error: error instanceof Error ? error.message : "request failed" })); }
    });
  });
  server.listen(Number(process.env.PORT ?? 3000), () => console.log("payment service listening on 3000"));
}

import assert from "node:assert/strict";
import { assessRisk, paymentEvent } from "./payment_service.js";

const event = paymentEvent.parse({ payment_id: "pay-7", amount: 12500, currency: "USD", customer_id: "cust-2" });
assert.equal(assessRisk(event), "review");
assert.equal(assessRisk({ ...event, amount: 12 }), "approve");
console.log("risk decision test passed");

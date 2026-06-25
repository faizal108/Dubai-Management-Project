import { env } from "../../../lib/env.js";
import { logger } from "../../../lib/logger.js";

// Provider contract. Every concrete provider must export an object with this
// shape so the factory below can swap implementations without touching callers.
//
//   sendReceipt({
//     to,              // E.164 phone number, e.g. "+919876543210"
//     from,            // foundation WhatsApp Business number, E.164
//     donation,        // { id, amount, receiptNo, donationDate, type }
//     donor,           // { name, pan, phone }
//     foundation,      // { id, name }
//   }) => Promise<{ providerMessageId, sentAt }>
//
// On failure the provider must throw — the caller catches and records the
// error on the Donation row.

// Stub: pretends the message landed. Logs the payload at info level so the
// audit trail is searchable during the demo, then resolves with a synthetic
// message id after a short delay so the UX matches a real network call.
const stubProvider = {
  name: "stub",
  async sendReceipt(payload) {
    logger.info(
      {
        provider: "stub",
        to: payload.to,
        from: payload.from,
        donationId: payload.donation?.id,
        amount: payload.donation?.amount,
        donorPan: payload.donor?.pan,
      },
      "WhatsApp receipt (stub) accepted"
    );
    await new Promise((resolve) => setTimeout(resolve, 400));
    return {
      providerMessageId: `stub_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      sentAt: new Date(),
    };
  },
};

// Factory. Selects the configured provider; falls back to stub when the value
// isn't recognised so the app never crashes on a typo'd env value.
const providers = {
  stub: stubProvider,
};

export function getWhatsappProvider() {
  const key = (env.WHATSAPP_PROVIDER || "stub").toLowerCase();
  const provider = providers[key];
  if (!provider) {
    logger.warn(
      { configured: key, fallback: "stub" },
      "Unknown WHATSAPP_PROVIDER — using stub"
    );
    return stubProvider;
  }
  return provider;
}

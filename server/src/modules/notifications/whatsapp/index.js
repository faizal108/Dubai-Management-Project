import { prisma } from "../../../lib/prisma.js";
import { logger } from "../../../lib/logger.js";
import { getWhatsappProvider } from "./provider.js";

// Fire-and-forget orchestrator. The donation HTTP handler calls this via
// setImmediate so the API response is never blocked on the third-party send.
// All errors are caught and persisted onto the Donation row; nothing throws
// back to the request lifecycle.
//
// Pre-conditions checked before dispatch:
//   * foundation.hasWhatsappBusiness === true
//   * foundation.whatsappBusinessNumber is set (E.164)
//   * donation.whatsappOptIn === true
//   * donor has a phone number
//
// Any failed pre-condition is recorded as whatsappError = "skipped: <reason>".
export async function sendDonationReceipt(donationId) {
  try {
    const donation = await prisma.donation.findUnique({
      where: { id: donationId },
      include: {
        donor: { select: { id: true, fullName: true, pan: true, phone: true } },
        foundation: {
          select: {
            id: true,
            name: true,
            hasWhatsappBusiness: true,
            whatsappBusinessNumber: true,
          },
        },
      },
    });

    if (!donation) {
      logger.warn({ donationId }, "sendDonationReceipt: donation not found");
      return;
    }

    const skipReason = whyShouldSkip(donation);
    if (skipReason) {
      await prisma.donation.update({
        where: { id: donationId },
        data: { whatsappError: `skipped: ${skipReason}`, whatsappSentAt: null },
      });
      return;
    }

    const provider = getWhatsappProvider();
    const { providerMessageId, sentAt } = await provider.sendReceipt({
      to: donation.donor.phone,
      from: donation.foundation.whatsappBusinessNumber,
      donation: {
        id: donation.id,
        amount: donation.amount.toString(),
        donationDate: donation.donationDate,
        type: donation.type,
      },
      donor: {
        name: donation.donor.fullName,
        pan: donation.donor.pan,
        phone: donation.donor.phone,
      },
      foundation: { id: donation.foundation.id, name: donation.foundation.name },
    });

    await prisma.donation.update({
      where: { id: donationId },
      data: { whatsappSentAt: sentAt, whatsappError: null },
    });

    logger.info(
      { donationId, provider: provider.name, providerMessageId },
      "WhatsApp receipt dispatched"
    );
  } catch (err) {
    logger.error(
      { donationId, err: err?.message },
      "WhatsApp receipt dispatch failed"
    );
    try {
      await prisma.donation.update({
        where: { id: donationId },
        data: { whatsappError: String(err?.message || err).slice(0, 500) },
      });
    } catch (innerErr) {
      logger.error(
        { donationId, err: innerErr?.message },
        "Failed to persist WhatsApp error onto donation"
      );
    }
  }
}

function whyShouldSkip(donation) {
  if (!donation.whatsappOptIn) return "opt-in is false";
  if (!donation.foundation?.hasWhatsappBusiness) {
    return "foundation has no WhatsApp Business number";
  }
  if (!donation.foundation?.whatsappBusinessNumber) {
    return "foundation WhatsApp number is missing";
  }
  if (!donation.donor?.phone) return "donor has no phone number";
  return null;
}

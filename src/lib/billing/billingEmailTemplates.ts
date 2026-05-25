import type { BillingNotificationInput } from 'billing-engine';

export function buildBillingNotificationEmail(input: BillingNotificationInput): {
  subject: string;
  html: string;
  text: string;
} {
  const billingUrl = input.billingUrl;
  if (input.type === 'payment_failed') {
    const subject = `Payment failed for ${input.orgName}`;
    const text = `We could not process the latest payment for ${input.orgName}. Update your billing details: ${billingUrl}`;
    return {
      subject,
      text,
      html: `<p>We could not process the latest payment for <strong>${input.orgName}</strong>.</p><p><a href="${billingUrl}">Update billing</a></p>`,
    };
  }

  const subject = `Subscription canceled for ${input.orgName}`;
  const text = `Your Nucleas subscription for ${input.orgName} has been canceled. Manage billing: ${billingUrl}`;
  return {
    subject,
    text,
    html: `<p>Your Nucleas subscription for <strong>${input.orgName}</strong> has been canceled.</p><p><a href="${billingUrl}">View billing</a></p>`,
  };
}

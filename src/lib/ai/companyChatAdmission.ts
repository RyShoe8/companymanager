import type { GatewayError } from '@nucleas/ai-core/gateway';

/** Actionable copy for company-credential chat admission failures. */
export function companyChatAdmissionMessage(code: GatewayError['code']): string {
  switch (code) {
    case 'configuration':
      return 'Enable Remote connection and Processing in Admin → AI Settings. Paid models also need a positive reservation within org/project budget ceilings.';
    case 'rate_limit':
      return 'Shared AI request limit or spacing was hit. Wait a moment and try again.';
    case 'unavailable':
      return 'Another AI run currently holds the shared dispatch lock. Retry shortly.';
    case 'credentials':
      return 'Company credential authentication was rejected.';
    case 'cancelled':
      return 'The chat request was cancelled before completion.';
    default:
      return 'Chat could not be admitted.';
  }
}

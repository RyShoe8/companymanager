export const RECAPTCHA_ACTIONS = {
  contactSubmit: 'contact_submit',
  register: 'register',
  login: 'login',
  resendVerification: 'resend_verification',
  bookCall: 'book_call',
} as const;

export type RecaptchaAction = (typeof RECAPTCHA_ACTIONS)[keyof typeof RECAPTCHA_ACTIONS];

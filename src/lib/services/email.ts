import * as brevo from '@getbrevo/brevo';

export type BrevoKeyType = 'missing' | 'smtp' | 'rest';

function readRawBrevoApiKey(): string {
  return (process.env.BREVO_API_KEY ?? '').trim();
}

export function getBrevoKeyType(): BrevoKeyType {
  const key = readRawBrevoApiKey();
  if (!key) return 'missing';
  if (key.startsWith('xsmtpsib-')) return 'smtp';
  return 'rest';
}

/** Valid REST API v3 key, or null if missing / SMTP / too short */
export function getBrevoApiKey(): string | null {
  const key = readRawBrevoApiKey();
  if (!key) return null;
  if (key.startsWith('xsmtpsib-')) return null;
  if (key.length < 16) return null;
  return key;
}

export function getBrevoSenderEmail(): string {
  const fromEnv = (process.env.BREVO_SENDER_EMAIL ?? '').trim();
  return fromEnv || 'theteam@nucleas.app';
}

export function getBrevoConfigurationError(): string | null {
  const keyType = getBrevoKeyType();
  if (keyType === 'missing') {
    return 'Brevo API is not configured. Set BREVO_API_KEY in your environment (Vercel → Environment Variables).';
  }
  if (keyType === 'smtp') {
    return 'BREVO_API_KEY is an SMTP key (xsmtpsib-). Use a REST API v3 key from https://app.brevo.com/settings/keys/api';
  }
  const key = getBrevoApiKey();
  if (!key) {
    return 'BREVO_API_KEY appears invalid. Use a REST API v3 key from Brevo and redeploy.';
  }
  return null;
}

type BrevoErrorBody = { message?: string; code?: string };

type AxiosLikeError = {
  response?: {
    status?: number;
    statusCode?: number;
    data?: BrevoErrorBody;
    body?: BrevoErrorBody;
  };
  message?: string;
};

export const BREVO_KEY_DISABLED_MESSAGE =
  'Your Brevo API key is disabled. In Brevo go to Settings → SMTP & API → API Keys, enable the key used in BREVO_API_KEY (or create a new one), update Vercel if you rotated it, then redeploy.';

function parseBrevoError(error: unknown): {
  status?: number;
  message?: string;
  code?: string;
} {
  const err = error as AxiosLikeError;
  const response = err.response;
  const status = response?.status ?? response?.statusCode;
  const body = response?.data ?? response?.body;
  return {
    status,
    message: body?.message,
    code: body?.code,
  };
}

function formatBrevo401Message(brevoMessage?: string): string {
  if (brevoMessage && /not enabled/i.test(brevoMessage)) {
    return BREVO_KEY_DISABLED_MESSAGE;
  }
  if (brevoMessage) {
    return `Brevo unauthorized: ${brevoMessage}`;
  }
  return 'Brevo API key is invalid or unauthorized. Use a REST API v3 key in BREVO_API_KEY (Vercel env), then redeploy.';
}

export function formatBrevoError(error: unknown): string {
  const { status, message: brevoMessage } = parseBrevoError(error);

  if (status === 401) {
    return formatBrevo401Message(brevoMessage);
  }
  if (status === 403) {
    return 'Brevo API key lacks permission to send transactional email.';
  }
  if (status === 400 && brevoMessage) {
    if (/sender|from|verified|domain/i.test(brevoMessage)) {
      return `Sender email not verified in Brevo: ${brevoMessage}`;
    }
    return brevoMessage;
  }
  if (brevoMessage) return brevoMessage;
  if (error instanceof Error) return error.message;
  return 'Failed to send email via Brevo';
}

export function logBrevoError(context: string, error: unknown): void {
  const { status, message, code } = parseBrevoError(error);
  console.error(context, { status, message, code });
}

function initBrevoClients(key: string): {
  transactional: brevo.TransactionalEmailsApi;
  contacts: brevo.ContactsApi;
} {
  const transactional = new brevo.TransactionalEmailsApi();
  transactional.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, key);

  const contacts = new brevo.ContactsApi();
  contacts.setApiKey(brevo.ContactsApiApiKeys.apiKey, key);

  return { transactional, contacts };
}

let apiInstance: brevo.TransactionalEmailsApi | null = null;
let contactsApiInstance: brevo.ContactsApi | null = null;

const initialKey = getBrevoApiKey();
if (initialKey) {
  try {
    const clients = initBrevoClients(initialKey);
    apiInstance = clients.transactional;
    contactsApiInstance = clients.contacts;
  } catch {
    apiInstance = null;
    contactsApiInstance = null;
  }
}

export type BrevoHealthStatus = {
  configured: boolean;
  keyType: BrevoKeyType;
  canSend: boolean;
  configurationError: string | null;
};

export async function getBrevoHealthStatus(): Promise<BrevoHealthStatus> {
  const keyType = getBrevoKeyType();
  const configurationError = getBrevoConfigurationError();
  const key = getBrevoApiKey();

  if (!key) {
    return {
      configured: false,
      keyType,
      canSend: false,
      configurationError,
    };
  }

  try {
    const accountApi = new brevo.AccountApi();
    accountApi.setApiKey(brevo.AccountApiApiKeys.apiKey, key);
    await accountApi.getAccount();
    return {
      configured: true,
      keyType: 'rest',
      canSend: true,
      configurationError: null,
    };
  } catch (error: unknown) {
    logBrevoError('Brevo health check failed', error);
    return {
      configured: true,
      keyType: 'rest',
      canSend: false,
      configurationError: formatBrevoError(error),
    };
  }
}

export interface InvitationEmailData {
  recipientEmail: string;
  recipientName?: string;
  inviterName: string;
  organizationName?: string;
  invitationLink: string;
  role: string;
  expiresInDays: number;
}

/**
 * Send an invitation email via Brevo
 */
export async function sendInvitationEmail(data: InvitationEmailData): Promise<void> {
  const configError = getBrevoConfigurationError();
  if (configError || !apiInstance) {
    throw new Error(configError ?? 'Brevo API is not configured.');
  }

  const sendSmtpEmail = new brevo.SendSmtpEmail();
  
  sendSmtpEmail.subject = `You've been invited to join ${data.organizationName || 'Nucleas'}`;
  sendSmtpEmail.to = [{ email: data.recipientEmail, name: data.recipientName || data.recipientEmail }];
  
  const senderEmail = getBrevoSenderEmail();
  
  // Always use production URL for logo to ensure email clients can access it
  // Email clients proxy images, so we need a stable, publicly accessible URL
  const logoUrl = 'https://nucleas.app/images/Nucleas.png';
  
  sendSmtpEmail.sender = {
    email: senderEmail,
    name: process.env.BREVO_SENDER_NAME || 'Nucleas',
  };

  // HTML email template
  sendSmtpEmail.htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Invitation to Nucleas</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #202637; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #F7F8FC;">
      <div style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="background-color: #ffffff; padding: 30px; text-align: center; border-bottom: 1px solid #E1E5EE;">
          <img src="${logoUrl}" alt="Nucleas" width="400" height="120" style="height: 120px; width: auto; max-width: 400px; display: block; margin: 0 auto;" />
          ${data.organizationName ? `<p style="color: #5E677D; font-size: 18px; font-weight: 600; margin-top: 20px; margin-bottom: 0;">${data.organizationName}</p>` : ''}
        </div>
        <div style="background-color: #ffffff; padding: 40px;">
          <h2 style="color: #202637; margin-top: 0; font-size: 24px; font-weight: 600;">You've been invited!</h2>
          <p style="color: #5E677D; font-size: 16px; margin: 20px 0;">Hi ${data.recipientName || 'there'},</p>
          <p style="color: #5E677D; font-size: 16px; margin: 20px 0;"><strong>${data.inviterName}</strong> has invited you to join <strong>${data.organizationName || 'their organization'}</strong> as a <strong>${data.role}</strong>.</p>
          <div style="margin: 40px 0; text-align: center;">
            <a href="${data.invitationLink}" 
               style="background-color: #347AF6; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 16px; box-shadow: 0 2px 4px rgba(52, 122, 246, 0.3); transition: background-color 0.2s;">
              Accept Invitation
            </a>
          </div>
          <p style="color: #5E677D; font-size: 14px; margin: 20px 0;">
            This invitation will expire in ${data.expiresInDays} day${data.expiresInDays !== 1 ? 's' : ''}.
          </p>
          <p style="color: #5E677D; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E1E5EE;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${data.invitationLink}" style="color: #347AF6; word-break: break-all; text-decoration: underline;">${data.invitationLink}</a>
          </p>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E1E5EE;">
            If you didn't expect this invitation, you can safely ignore this email.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  // Plain text version
  sendSmtpEmail.textContent = `
You've been invited to join ${data.organizationName || 'Nucleas'}!

Hi ${data.recipientName || 'there'},

${data.inviterName} has invited you to join ${data.organizationName || 'their organization'} as a ${data.role}.

Accept your invitation here: ${data.invitationLink}

This invitation will expire in ${data.expiresInDays} day${data.expiresInDays !== 1 ? 's' : ''}.

If you didn't expect this invitation, you can safely ignore this email.
  `;

  try {
    await apiInstance.sendTransacEmail(sendSmtpEmail);
  } catch (error: unknown) {
    logBrevoError('Error sending invitation email', error);
    throw error;
  }
}

export interface CreateContactData {
  email: string;
  name?: string;
  attributes?: Record<string, any>;
}

/**
 * Create a contact in Brevo and add them to list ID #3 (Users list)
 */
export async function createBrevoContact(data: CreateContactData): Promise<void> {
  if (!contactsApiInstance) {
    // Brevo Contacts API is not configured. Contact will not be created. Please set BREVO_API_KEY environment variable.
    return;
  }

  try {
    const createContact = new brevo.CreateContact();
    createContact.email = data.email.toLowerCase();
    
    // Set CREATED attribute to current date (YYYY-MM-DD format)
    const currentDate = new Date();
    const createdDateStr = currentDate.toISOString().split('T')[0]; // Format: YYYY-MM-DD
    
    // Build attributes object
    const attributes: Record<string, any> = {
      CREATED: createdDateStr,
    };
    
    // Add name attributes if provided
    if (data.name) {
      attributes.FIRSTNAME = data.name.split(' ')[0];
      attributes.LASTNAME = data.name.split(' ').slice(1).join(' ') || '';
    }
    
    // Merge with any additional attributes
    if (data.attributes) {
      Object.assign(attributes, data.attributes);
    }
    
    createContact.attributes = attributes;
    
    // Add to list ID #3 (Users list)
    createContact.listIds = [3];
    createContact.updateEnabled = true; // Update if contact already exists

    await contactsApiInstance.createContact(createContact);
  } catch (error: any) {
    // If contact already exists, try to add them to the list
    if (error?.response?.body?.code === 'duplicate_parameter' || error?.response?.statusCode === 400) {
      try {
        await contactsApiInstance.addContactToList(3, { emails: [data.email.toLowerCase()] });
      } catch (listError: any) {
        // If already in list, that's fine - silently continue
        if (listError?.response?.body?.code !== 'duplicate_parameter') {
          // Error adding contact to list in Brevo
        }
      }
    } else {
      // Error creating contact in Brevo
      // Don't throw - we don't want to fail employee creation if Brevo fails
    }
  }
}

/**
 * Remove a contact from Brevo
 */
export async function deleteBrevoContact(email: string): Promise<void> {
  if (!contactsApiInstance) {
    // Brevo Contacts API is not configured. Contact will not be deleted. Please set BREVO_API_KEY environment variable.
    return;
  }

  try {
    await contactsApiInstance.deleteContact(email.toLowerCase());
  } catch (error: any) {
    // If contact doesn't exist, that's okay - silently continue
    if (error?.response?.statusCode !== 404) {
      // Error deleting contact from Brevo
      // Don't throw - we don't want to fail employee deletion if Brevo fails
    }
  }
}

export interface ClientPortalInviteData {
  recipientEmail: string;
  projectName: string;
  portalLink: string;
  inviterName?: string;
}

/**
 * Send a client portal invite email
 */
export async function sendClientPortalInviteEmail(data: ClientPortalInviteData): Promise<void> {
  const configError = getBrevoConfigurationError();
  if (configError || !apiInstance) {
    throw new Error(configError ?? 'Brevo API is not configured.');
  }

  const sendSmtpEmail = new brevo.SendSmtpEmail();
  sendSmtpEmail.subject = `You have access to ${data.projectName} – Nucleas Client Portal`;
  sendSmtpEmail.to = [{ email: data.recipientEmail }];
  sendSmtpEmail.sender = {
    email: getBrevoSenderEmail(),
    name: process.env.BREVO_SENDER_NAME || 'Nucleas',
  };

  const inviterLine = data.inviterName ? ` ${data.inviterName} has` : ' You have';
  sendSmtpEmail.htmlContent = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #202637; max-width: 600px; margin: 0 auto; padding: 20px;">
      <p>Hi,</p>
      <p>${inviterLine} been given access to the client portal for <strong>${data.projectName}</strong>.</p>
      <p><a href="${data.portalLink}" style="display: inline-block; padding: 12px 24px; background: #347AF6; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">Open client portal</a></p>
      <p style="color: #5E677D; font-size: 14px;">Or copy this link: ${data.portalLink}</p>
      <p style="color: #5E677D; font-size: 14px;">If you didn't expect this email, you can ignore it.</p>
    </body>
    </html>
  `;
  sendSmtpEmail.textContent = `You have access to ${data.projectName}. Open the client portal: ${data.portalLink}`;

  try {
    await apiInstance.sendTransacEmail(sendSmtpEmail);
  } catch (error: unknown) {
    logBrevoError('Error sending client portal invite email', error);
    throw error;
  }
}

export interface SendEmailData {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send a generic email via Brevo
 */
export async function sendEmail(data: SendEmailData): Promise<void> {
  const configError = getBrevoConfigurationError();
  if (configError || !apiInstance) {
    throw new Error(configError ?? 'Brevo API is not configured.');
  }

  const sendSmtpEmail = new brevo.SendSmtpEmail();
  
  sendSmtpEmail.subject = data.subject;
  sendSmtpEmail.to = [{ email: data.to }];
  
  const senderEmail = getBrevoSenderEmail();
  
  sendSmtpEmail.sender = {
    email: senderEmail,
    name: process.env.BREVO_SENDER_NAME || 'Nucleas',
  };

  sendSmtpEmail.htmlContent = data.html;
  
  if (data.text) {
    sendSmtpEmail.textContent = data.text;
  }

  try {
    await apiInstance.sendTransacEmail(sendSmtpEmail);
  } catch (error: unknown) {
    logBrevoError('Error sending email', error);
    throw error;
  }
}

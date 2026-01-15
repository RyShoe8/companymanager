import * as brevo from '@getbrevo/brevo';

const apiKey = process.env.BREVO_API_KEY;

if (!apiKey) {
  console.warn('BREVO_API_KEY is not set. Email functionality will be disabled.');
} else {
  // Check if it's an SMTP key (starts with xsmtpsib-) - SDK needs REST API key
  if (apiKey.startsWith('xsmtpsib-')) {
    console.warn('WARNING: You are using an SMTP API key. The Brevo SDK requires a REST API v3 key.');
    console.warn('Please get your REST API key from: https://app.brevo.com/settings/keys/api');
  }
}

let apiInstance: brevo.TransactionalEmailsApi | null = null;
let contactsApiInstance: brevo.ContactsApi | null = null;

if (apiKey) {
  try {
    apiInstance = new brevo.TransactionalEmailsApi();
    apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, apiKey);
    
    contactsApiInstance = new brevo.ContactsApi();
    contactsApiInstance.setApiKey(brevo.ContactsApiApiKeys.apiKey, apiKey);
  } catch (error) {
    console.error('Error initializing Brevo API instances:', error);
    apiInstance = null;
    contactsApiInstance = null;
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
  baseUrl?: string; // Optional base URL for logo image
}

/**
 * Send an invitation email via Brevo
 */
export async function sendInvitationEmail(data: InvitationEmailData): Promise<void> {
  if (!apiInstance) {
    throw new Error('Brevo API is not configured. Please set BREVO_API_KEY environment variable.');
  }

  const sendSmtpEmail = new brevo.SendSmtpEmail();
  
  sendSmtpEmail.subject = `You've been invited to join ${data.organizationName || 'Nucleas'}`;
  sendSmtpEmail.to = [{ email: data.recipientEmail, name: data.recipientName || data.recipientEmail }];
  
  // Brevo requires a sender email - default to theteam@nucleas.app, but allow override via env
  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'theteam@nucleas.app';
  
  sendSmtpEmail.sender = {
    email: senderEmail,
    name: process.env.BREVO_SENDER_NAME || 'Nucleas',
  };

  // Get base URL for logo image - use provided baseUrl or determine from environment
  let logoBaseUrl = data.baseUrl;
  if (!logoBaseUrl) {
    logoBaseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;
    if (!logoBaseUrl) {
      if (process.env.VERCEL_URL) {
        const vercelUrl = process.env.VERCEL_URL;
        logoBaseUrl = vercelUrl.startsWith('http') ? vercelUrl : `https://${vercelUrl}`;
      } else {
        logoBaseUrl = 'http://localhost:3000';
      }
    }
  }
  logoBaseUrl = logoBaseUrl.replace(/\/$/, '');
  const logoUrl = `${logoBaseUrl}/images/Nucleas.png`;

  // HTML email template with Nucleas branding
  sendSmtpEmail.htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Invitation to Nucleas</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #F7F8FC; line-height: 1.6;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #F7F8FC;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background-color: #FFFFFF; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <!-- Header with Logo -->
              <tr>
                <td style="background-color: #347AF6; padding: 32px 40px; text-align: center;">
                  <img src="${logoUrl}" alt="Nucleas" style="height: 40px; width: auto; max-width: 200px;" />
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px;">
                  <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: #202637;">You've been invited!</h1>
                  <p style="margin: 0 0 24px 0; font-size: 16px; color: #202637;">Hi ${data.recipientName || 'there'},</p>
                  <p style="margin: 0 0 24px 0; font-size: 16px; color: #5E677D; line-height: 1.6;">
                    <strong style="color: #202637;">${data.inviterName}</strong> has invited you to join <strong style="color: #202637;">${data.organizationName || 'their organization'}</strong> as a <strong style="color: #347AF6;">${data.role}</strong>.
                  </p>
                  
                  <!-- CTA Button -->
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td align="center" style="padding: 32px 0;">
                        <a href="${data.invitationLink}" 
                           style="background-color: #347AF6; color: #FFFFFF; padding: 14px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 16px; transition: background-color 0.2s;">
                          Accept Invitation
                        </a>
                      </td>
                    </tr>
                  </table>
                  
                  <!-- Expiration Notice -->
                  <p style="margin: 24px 0 0 0; font-size: 14px; color: #5E677D;">
                    This invitation will expire in ${data.expiresInDays} day${data.expiresInDays !== 1 ? 's' : ''}.
                  </p>
                  
                  <!-- Alternative Link -->
                  <p style="margin: 32px 0 0 0; font-size: 14px; color: #5E677D;">
                    If the button doesn't work, copy and paste this link into your browser:<br>
                    <a href="${data.invitationLink}" style="color: #347AF6; word-break: break-all; text-decoration: underline;">${data.invitationLink}</a>
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="padding: 24px 40px; background-color: #F7F8FC; border-top: 1px solid #E1E5EE;">
                  <p style="margin: 0; font-size: 12px; color: #5E677D; text-align: center;">
                    If you didn't expect this invitation, you can safely ignore this email.
                  </p>
                  <p style="margin: 16px 0 0 0; font-size: 12px; color: #5E677D; text-align: center;">
                    © ${new Date().getFullYear()} Nucleas. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
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
  } catch (error: any) {
    console.error('Error sending invitation email:', error?.message || error);
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
    console.warn('Brevo Contacts API is not configured. Contact will not be created. Please set BREVO_API_KEY environment variable.');
    return;
  }

  try {
    const createContact = new brevo.CreateContact();
    createContact.email = data.email.toLowerCase();
    
    // Set attributes if provided
    if (data.name || data.attributes) {
      createContact.attributes = {
        ...(data.name && { FIRSTNAME: data.name.split(' ')[0], LASTNAME: data.name.split(' ').slice(1).join(' ') || '' }),
        ...data.attributes,
      };
    }
    
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
          console.error('Error adding contact to list in Brevo:', listError);
        }
      }
    } else {
      console.error('Error creating contact in Brevo:', error);
      // Don't throw - we don't want to fail employee creation if Brevo fails
    }
  }
}

/**
 * Remove a contact from Brevo
 */
export async function deleteBrevoContact(email: string): Promise<void> {
  if (!contactsApiInstance) {
    console.warn('Brevo Contacts API is not configured. Contact will not be deleted. Please set BREVO_API_KEY environment variable.');
    return;
  }

  try {
    await contactsApiInstance.deleteContact(email.toLowerCase());
  } catch (error: any) {
    // If contact doesn't exist, that's okay - silently continue
    if (error?.response?.statusCode !== 404) {
      console.error('Error deleting contact from Brevo:', error);
      // Don't throw - we don't want to fail employee deletion if Brevo fails
    }
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
  if (!apiInstance) {
    throw new Error('Brevo API is not configured. Please set BREVO_API_KEY environment variable.');
  }

  const sendSmtpEmail = new brevo.SendSmtpEmail();
  
  sendSmtpEmail.subject = data.subject;
  sendSmtpEmail.to = [{ email: data.to }];
  
  // Brevo requires a sender email - default to theteam@nucleas.app, but allow override via env
  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'theteam@nucleas.app';
  
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
  } catch (error: any) {
    console.error('Error sending email:', error?.message || error);
    throw error;
  }
}

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
}

/**
 * Send an invitation email via Brevo
 */
export async function sendInvitationEmail(data: InvitationEmailData): Promise<void> {
  if (!apiInstance) {
    throw new Error('Brevo API is not configured. Please set BREVO_API_KEY environment variable.');
  }

  const sendSmtpEmail = new brevo.SendSmtpEmail();
  
  sendSmtpEmail.subject = `You've been invited to join ${data.organizationName || 'Company Manager'}`;
  sendSmtpEmail.to = [{ email: data.recipientEmail, name: data.recipientName || data.recipientEmail }];
  
  // Brevo requires a sender email - it must be set explicitly
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  if (!senderEmail) {
    const errorMsg = 'BREVO_SENDER_EMAIL is required but not set. Please add BREVO_SENDER_EMAIL to your .env.local file with a verified sender email from your Brevo account.';
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  
  sendSmtpEmail.sender = {
    email: senderEmail,
    name: process.env.BREVO_SENDER_NAME || 'Company Manager',
  };

  // HTML email template
  sendSmtpEmail.htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Invitation to Company Manager</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0;">Company Manager</h1>
      </div>
      <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
        <h2 style="color: #1f2937; margin-top: 0;">You've been invited!</h2>
        <p>Hi ${data.recipientName || 'there'},</p>
        <p><strong>${data.inviterName}</strong> has invited you to join <strong>${data.organizationName || 'their organization'}</strong> as a <strong>${data.role}</strong>.</p>
        <p style="margin: 30px 0;">
          <a href="${data.invitationLink}" 
             style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            Accept Invitation
          </a>
        </p>
        <p style="color: #6b7280; font-size: 14px;">
          This invitation will expire in ${data.expiresInDays} day${data.expiresInDays !== 1 ? 's' : ''}.
        </p>
        <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <a href="${data.invitationLink}" style="color: #3b82f6; word-break: break-all;">${data.invitationLink}</a>
        </p>
        <p style="color: #6b7280; font-size: 12px; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          If you didn't expect this invitation, you can safely ignore this email.
        </p>
      </div>
    </body>
    </html>
  `;

  // Plain text version
  sendSmtpEmail.textContent = `
You've been invited to join ${data.organizationName || 'Company Manager'}!

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

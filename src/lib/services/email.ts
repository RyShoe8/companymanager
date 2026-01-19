import * as brevo from '@getbrevo/brevo';

const apiKey = process.env.BREVO_API_KEY;

if (!apiKey) {
  // BREVO_API_KEY is not set. Email functionality will be disabled.
} else {
  // Check if it's an SMTP key (starts with xsmtpsib-) - SDK needs REST API key
  if (apiKey.startsWith('xsmtpsib-')) {
    // WARNING: You are using an SMTP API key. The Brevo SDK requires a REST API v3 key.
    // Please get your REST API key from: https://app.brevo.com/settings/keys/api
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
    // Error initializing Brevo API instances
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
  
  sendSmtpEmail.subject = `You've been invited to join ${data.organizationName || 'Nucleas'}`;
  sendSmtpEmail.to = [{ email: data.recipientEmail, name: data.recipientName || data.recipientEmail }];
  
  // Brevo requires a sender email - always use theteam@nucleas.app
  const senderEmail = 'theteam@nucleas.app';
  
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
  } catch (error: any) {
    // Error sending invitation email
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
  
  // Brevo requires a sender email - always use theteam@nucleas.app
  const senderEmail = 'theteam@nucleas.app';
  
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
    // Error sending email
    throw error;
  }
}

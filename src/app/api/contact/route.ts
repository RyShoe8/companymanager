import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/services/email';
import { escapeHtml, isValidEmail, sanitizeString } from '@/lib/utils/security';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let { type, name, email, subject, message } = body;

    // Validate required fields
    if (!type || !name || !email || !subject || !message) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Sanitize and validate inputs
    name = sanitizeString(name, 100);
    email = sanitizeString(email, 254);
    subject = sanitizeString(subject, 200);
    message = sanitizeString(message, 5000);

    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    // Validate contact type
    const validTypes = ['Bug', 'Feature Request', 'Other'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid contact type' },
        { status: 400 }
      );
    }

    // Escape HTML to prevent XSS in email
    const safeType = escapeHtml(type);
    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeSubject = escapeHtml(subject);
    const safeMessage = escapeHtml(message);

    // Send email to the team
    const emailSubject = `[${safeType}] ${safeSubject}`;
    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #347AF6; margin-bottom: 20px;">New Contact Form Submission</h2>
        
        <div style="background-color: #F7F8FC; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <p style="margin: 5px 0;"><strong>Type:</strong> ${safeType}</p>
          <p style="margin: 5px 0;"><strong>Name:</strong> ${safeName}</p>
          <p style="margin: 5px 0;"><strong>Email:</strong> <a href="mailto:${safeEmail}">${safeEmail}</a></p>
          <p style="margin: 5px 0;"><strong>Subject:</strong> ${safeSubject}</p>
        </div>
        
        <div style="background-color: #ffffff; padding: 20px; border: 1px solid #E1E5EE; border-radius: 8px;">
          <h3 style="color: #202637; margin-top: 0;">Message:</h3>
          <p style="color: #5E677D; white-space: pre-wrap; line-height: 1.6;">${safeMessage}</p>
        </div>
        
        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #E1E5EE; text-align: center;">
          <p style="color: #5E677D; font-size: 12px;">This message was sent from the Nucleas contact form.</p>
        </div>
      </div>
    `;

    try {
      await sendEmail({
        to: 'theteam@nucleas.app',
        subject: emailSubject,
        html: emailBody,
      });

      return NextResponse.json(
        { message: 'Message sent successfully' },
        { status: 200 }
      );
    } catch (emailError) {
      // Error sending contact email
      return NextResponse.json(
        { error: 'Failed to send message. Please try again later.' },
        { status: 500 }
      );
    }
  } catch (error) {
    // Contact form error
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

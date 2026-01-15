import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/models/User';
import Employee from '@/lib/models/Employee';
import Invitation from '@/lib/models/Invitation';
import Organization from '@/lib/models/Organization';
import { createSession } from '@/lib/auth/session';

/**
 * Handle Google OAuth callback
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error)}`, request.url));
    }

    if (!code) {
      return NextResponse.redirect(new URL('/login?error=no_code', request.url));
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/google/callback`;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(new URL('/login?error=oauth_not_configured', request.url));
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Token exchange error:', errorData);
      return NextResponse.redirect(new URL('/login?error=token_exchange_failed', request.url));
    }

    const tokens = await tokenResponse.json();
    const { access_token } = tokens;

    // Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      return NextResponse.redirect(new URL('/login?error=failed_to_get_user_info', request.url));
    }

    const googleUser = await userInfoResponse.json();
    const { id: googleId, email, name, picture } = googleUser;

    if (!email) {
      return NextResponse.redirect(new URL('/login?error=no_email', request.url));
    }

    await connectDB();

    // Parse state if present (for invitation tokens)
    let invitationToken: string | null = null;
    if (state) {
      try {
        const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
        invitationToken = stateData.invitationToken || null;
      } catch (e) {
        // State parsing failed, continue without invitation
      }
    }

    let organizationId: string | undefined;
    let employeeId: string | undefined;
    let isNewUser = false;
    let isJoiningExistingOrg = false;

    // Handle invitation if present
    if (invitationToken) {
      const invitation = await Invitation.findOne({
        token: invitationToken,
        status: 'pending',
      });

      if (invitation && new Date() <= invitation.expiresAt) {
        if (invitation.email.toLowerCase() !== email.toLowerCase()) {
          return NextResponse.redirect(new URL('/login?error=email_mismatch', request.url));
        }

        organizationId = invitation.organizationId;
        employeeId = invitation.employeeId?.toString();

        invitation.status = 'accepted';
        await invitation.save();
      } else {
        invitationToken = null; // Invalid invitation, treat as new user
        organizationId = undefined; // Reset organizationId
      }
    }

    // Find or create user
    let user = await User.findOne({ 
      $or: [
        { email: email.toLowerCase() },
        { googleId }
      ]
    });

    if (!user) {
      // New user - create account
      isNewUser = true;
      
      if (!invitationToken) {
        // Check if there's an existing organization with matching domain
        const emailDomain = email.split('@')[1]?.toLowerCase();
        let existingOrgAdmin: typeof User | null = null;

        if (emailDomain) {
          // Find organization with matching domain
          const existingOrganization = await Organization.findOne({ domain: emailDomain });
          
          if (existingOrganization) {
            // Find the admin user for this organization
            existingOrgAdmin = await User.findById(existingOrganization.userId);
            
            if (existingOrgAdmin && existingOrgAdmin.organizationId) {
              // Join existing organization
              organizationId = existingOrgAdmin.organizationId;
              isJoiningExistingOrg = true;
            }
          }
        }

        // If no existing organization found, create new one
        if (!organizationId) {
          organizationId = `temp-${Date.now()}`;
        }
      }

      user = await User.create({
        email: email.toLowerCase(),
        name: name || email.split('@')[0],
        profilePicture: picture,
        googleId,
        authProvider: 'google',
        organizationId: organizationId!,
        organizationSetupComplete: !!invitationToken || isJoiningExistingOrg,
      });

      // If no invitation and not joining existing org, set organizationId to user's own ID
      if (!invitationToken && !isJoiningExistingOrg) {
        user.organizationId = user._id.toString();
        await user.save();
        organizationId = user._id.toString();
      }

      // Handle employee record
      if (invitationToken && employeeId) {
        const employee = await Employee.findById(employeeId);
        if (employee) {
          employee.userId = user._id;
          if (name) employee.name = name;
          await employee.save();
        }
      } else if (isJoiningExistingOrg) {
        // Create employee record for user joining existing organization
        await Employee.create({
          name: name || email.split('@')[0],
          role: 'User',
          weeklyHours: 0,
          employeeType: 'full-time',
          userId: user._id,
          organizationId: organizationId,
        });
      } else if (!invitationToken) {
        // Create admin employee record for new organization
        await Employee.create({
          name: name || email.split('@')[0],
          role: 'Administrator',
          weeklyHours: 0,
          employeeType: 'full-time',
          userId: user._id,
          organizationId: user._id.toString(),
        });
      }
    } else {
      // Existing user - update Google info if needed
      if (!user.googleId) {
        user.googleId = googleId;
        user.authProvider = 'google';
        if (picture && !user.profilePicture) {
          user.profilePicture = picture;
        }
        if (name && !user.name) {
          user.name = name;
        }
        await user.save();
      }
    }

    // Create session
    await createSession(user._id.toString(), user.email);

    // Redirect based on organization setup status
    if (isNewUser && !user.organizationSetupComplete) {
      return NextResponse.redirect(new URL('/setup-organization', request.url));
    }

    return NextResponse.redirect(new URL('/planning-map', request.url));
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    return NextResponse.redirect(new URL('/login?error=oauth_error', request.url));
  }
}

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import GoogleSignInButton from '@/components/ui/GoogleSignInButton';
import { persistSelectedPlanId } from '@/lib/billing/selectedPlanStorage';

interface InvitationData {
  email: string;
  role: string;
  invitedBy: {
    name?: string;
    email: string;
  };
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const invitationToken = searchParams.get('token');
  const planId = searchParams.get('plan');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingInvitation, setLoadingInvitation] = useState(false);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);

  // Load invitation details if token is present
  useEffect(() => {
    if (planId) {
      persistSelectedPlanId(planId);
    }
  }, [planId]);

  useEffect(() => {
    if (invitationToken) {
      setLoadingInvitation(true);
      fetch(`/api/invitations/${invitationToken}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.error) {
            setError(data.error);
          } else {
            setInvitation({
              email: data.email,
              role: data.role,
              invitedBy: data.invitedBy,
            });
            setEmail(data.email); // Pre-fill email
          }
        })
        .catch((err) => {
          // Error loading invitation
          setError('Failed to load invitation details');
        })
        .finally(() => {
          setLoadingInvitation(false);
        });
    }
  }, [invitationToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          invitationToken: invitationToken || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Registration failed');
        return;
      }

      // Check if user needs to set up organization
      const userData = data.user;
      if (!userData.organizationSetupComplete) {
        router.push('/setup-organization');
      } else {
        router.push('/planning-map');
      }
      router.refresh();
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-text-primary">
            {invitation ? 'Accept Invitation' : 'Create your account'}
          </h2>
          {invitation && (
            <div className="mt-4 bg-primary-light border border-primary/20 rounded-lg p-4">
              <p className="text-sm text-primary-dark">
                <strong>{invitation.invitedBy.name || invitation.invitedBy.email}</strong> has invited you to join as a{' '}
                <strong>{invitation.role}</strong>.
              </p>
            </div>
          )}
        </div>
        {loadingInvitation ? (
          <div className="text-center py-8 text-text-secondary">Loading invitation...</div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-error-light border border-error/30 text-error px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <Input
              label="Name (optional)"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
            <Input
              label="Email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={!!invitation} // Disable email if from invitation
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
            <Input
              label="Confirm Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>
          <div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating account...' : 'Register'}
            </Button>
          </div>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-background text-text-secondary">Or continue with</span>
            </div>
          </div>

          <GoogleSignInButton invitationToken={invitationToken} />

          <div className="text-center">
            <Link
              href="/login"
              className="text-sm text-primary hover:text-primary-hover transition-colors"
            >
              Already have an account? Sign in
            </Link>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center text-text-secondary">Loading...</div>
      </div>
    }>
      <RegisterForm />
    </Suspense>
  );
}

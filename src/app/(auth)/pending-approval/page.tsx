import Link from 'next/link';

export default function PendingApprovalPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <section className="w-full max-w-md rounded-xl border border-border bg-background-card p-8 text-center space-y-4">
        <h1 className="text-2xl font-bold text-text-primary">Registration awaiting approval</h1>
        <p className="text-text-secondary">
          Your account was created, but access to Nucleas must be approved by a platform administrator.
          You can sign in after approval.
        </p>
        <p className="text-sm text-text-muted">
          There is no need to register again. If you need help, contact the Nucleas team.
        </p>
        <Link className="inline-flex rounded bg-primary px-4 py-2 font-medium text-white" href="/login">
          Back to sign in
        </Link>
      </section>
    </main>
  );
}


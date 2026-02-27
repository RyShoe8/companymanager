import Card from '@/components/ui/Card';
import { StructuredData } from '@/components/StructuredData';

const baseUrl = process.env.NEXTAUTH_URL || 'https://nucleas.app';

export const metadata = {
  title: 'Terms of Service',
  description: 'Terms of Service for Nucleas. Acceptance of terms, use license, user accounts, content, prohibited uses, disclaimer, and limitations.',
  keywords: 'terms of service, legal, Nucleas terms, use license',
  openGraph: {
    title: 'Terms of Service | Nucleas',
    description: 'Terms of Service for Nucleas platform.',
    type: 'website',
    url: `${baseUrl}/terms`,
  },
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <>
      <StructuredData
        type="WebPage"
        data={{
          name: 'Terms of Service | Nucleas',
          description: 'Terms of Service for Nucleas platform.',
          url: `${baseUrl}/terms`,
          publisher: { '@type': 'Organization', name: 'Nucleas', url: baseUrl },
        }}
      />
      <div className="min-h-screen bg-background px-[100px] max-md:px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-text-primary mb-6">Terms of Service</h1>
        <p className="text-text-secondary mb-8">Last updated: {new Date().toLocaleDateString()}</p>

        <Card className="p-8 mb-6">
          <h2 className="text-2xl font-semibold text-text-primary mb-4">1. Acceptance of Terms</h2>
          <p className="text-text-secondary leading-relaxed mb-4">
            By accessing and using Nucleas ("the Service"), you accept and agree to be bound by the terms and 
            provision of this agreement. If you do not agree to abide by the above, please do not use this service.
          </p>
        </Card>

        <Card className="p-8 mb-6">
          <h2 className="text-2xl font-semibold text-text-primary mb-4">2. Use License</h2>
          <p className="text-text-secondary leading-relaxed mb-4">
            Permission is granted to temporarily use Nucleas for your organization's planning and management purposes. 
            This is the grant of a license, not a transfer of title, and under this license you may not:
          </p>
          <ul className="list-disc list-inside space-y-2 text-text-secondary ml-4">
            <li>Modify or copy the materials</li>
            <li>Use the materials for any commercial purpose without explicit written permission</li>
            <li>Attempt to decompile or reverse engineer any software contained on Nucleas</li>
            <li>Remove any copyright or other proprietary notations from the materials</li>
          </ul>
        </Card>

        <Card className="p-8 mb-6">
          <h2 className="text-2xl font-semibold text-text-primary mb-4">3. User Accounts</h2>
          <p className="text-text-secondary leading-relaxed mb-4">
            You are responsible for maintaining the confidentiality of your account and password. You agree to accept 
            responsibility for all activities that occur under your account or password.
          </p>
        </Card>

        <Card className="p-8 mb-6">
          <h2 className="text-2xl font-semibold text-text-primary mb-4">4. User Content</h2>
          <p className="text-text-secondary leading-relaxed mb-4">
            You retain ownership of any content you upload or create within Nucleas. By using the Service, you grant 
            Nucleas a license to store, display, and process your content solely for the purpose of providing the Service.
          </p>
        </Card>

        <Card className="p-8 mb-6">
          <h2 className="text-2xl font-semibold text-text-primary mb-4">5. Prohibited Uses</h2>
          <p className="text-text-secondary leading-relaxed mb-4">
            You may not use Nucleas:
          </p>
          <ul className="list-disc list-inside space-y-2 text-text-secondary ml-4">
            <li>In any way that violates any applicable law or regulation</li>
            <li>To transmit any malicious code or viruses</li>
            <li>To impersonate or attempt to impersonate another user or entity</li>
            <li>To engage in any automated use of the system without authorization</li>
          </ul>
        </Card>

        <Card className="p-8 mb-6">
          <h2 className="text-2xl font-semibold text-text-primary mb-4">6. Disclaimer</h2>
          <p className="text-text-secondary leading-relaxed mb-4">
            The materials on Nucleas are provided on an 'as is' basis. Nucleas makes no warranties, expressed or implied, 
            and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions 
            of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.
          </p>
        </Card>

        <Card className="p-8 mb-6">
          <h2 className="text-2xl font-semibold text-text-primary mb-4">7. Limitations</h2>
          <p className="text-text-secondary leading-relaxed mb-4">
            In no event shall Nucleas or its suppliers be liable for any damages (including, without limitation, damages for 
            loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on 
            Nucleas, even if Nucleas or a Nucleas authorized representative has been notified orally or in writing of the possibility 
            of such damage.
          </p>
        </Card>

        <Card className="p-8 mb-6">
          <h2 className="text-2xl font-semibold text-text-primary mb-4">8. Termination</h2>
          <p className="text-text-secondary leading-relaxed mb-4">
            We may terminate or suspend your account and access to the Service immediately, without prior notice or liability, 
            for any reason whatsoever, including without limitation if you breach the Terms.
          </p>
        </Card>

        <Card className="p-8">
          <h2 className="text-2xl font-semibold text-text-primary mb-4">9. Changes to Terms</h2>
          <p className="text-text-secondary leading-relaxed mb-4">
            Nucleas reserves the right to revise these terms of service at any time without notice. By using this Service you 
            are agreeing to be bound by the then current version of these terms of service.
          </p>
          <p className="text-text-secondary">
            If you have any questions about these Terms of Service, please contact us at{' '}
            <a href="mailto:theteam@nucleas.app" className="text-primary hover:text-primary-hover transition-colors">
              theteam@nucleas.app
            </a>
          </p>
        </Card>
      </div>
    </div>
    </>
  );
}

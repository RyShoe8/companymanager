import Card from '@/components/ui/Card';

export const metadata = {
  title: 'Privacy Policy - Nucleas',
  description: 'Privacy Policy for Nucleas platform.',
  keywords: 'privacy policy, data protection, privacy, Nucleas privacy',
  openGraph: {
    title: 'Privacy Policy - Nucleas',
    description: 'Privacy Policy for Nucleas platform.',
    type: 'website',
    url: 'https://nucleas.app/privacy',
  },
  alternates: {
    canonical: 'https://nucleas.app/privacy',
  },
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background px-[100px] max-md:px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-text-primary mb-6">Privacy Policy</h1>
        <p className="text-text-secondary mb-8">Last updated: {new Date().toLocaleDateString()}</p>

        <Card className="p-8 mb-6">
          <h2 className="text-2xl font-semibold text-text-primary mb-4">1. Introduction</h2>
          <p className="text-text-secondary leading-relaxed mb-4">
            Nucleas ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we 
            collect, use, disclose, and safeguard your information when you use our Service.
          </p>
        </Card>

        <Card className="p-8 mb-6">
          <h2 className="text-2xl font-semibold text-text-primary mb-4">2. Information We Collect</h2>
          <h3 className="text-xl font-semibold text-text-primary mb-3 mt-4">2.1 Information You Provide</h3>
          <p className="text-text-secondary leading-relaxed mb-4">
            We collect information that you provide directly to us, including:
          </p>
          <ul className="list-disc list-inside space-y-2 text-text-secondary ml-4 mb-4">
            <li>Name and email address</li>
            <li>Profile picture (optional)</li>
            <li>Organization name and domain</li>
            <li>Project and operation data</li>
            <li>Employee information</li>
            <li>Asset information</li>
          </ul>

          <h3 className="text-xl font-semibold text-text-primary mb-3 mt-4">2.2 Automatically Collected Information</h3>
          <p className="text-text-secondary leading-relaxed mb-4">
            When you use our Service, we may automatically collect certain information, including:
          </p>
          <ul className="list-disc list-inside space-y-2 text-text-secondary ml-4">
            <li>Usage data and interaction with the Service</li>
            <li>Device information</li>
            <li>Log data and timestamps</li>
          </ul>
        </Card>

        <Card className="p-8 mb-6">
          <h2 className="text-2xl font-semibold text-text-primary mb-4">3. How We Use Your Information</h2>
          <p className="text-text-secondary leading-relaxed mb-4">
            We use the information we collect to:
          </p>
          <ul className="list-disc list-inside space-y-2 text-text-secondary ml-4">
            <li>Provide, maintain, and improve our Service</li>
            <li>Process your transactions and send related information</li>
            <li>Send you technical notices and support messages</li>
            <li>Respond to your comments and questions</li>
            <li>Monitor and analyze usage patterns</li>
            <li>Detect, prevent, and address technical issues</li>
          </ul>
        </Card>

        <Card className="p-8 mb-6">
          <h2 className="text-2xl font-semibold text-text-primary mb-4">4. Data Storage and Security</h2>
          <p className="text-text-secondary leading-relaxed mb-4">
            We implement appropriate technical and organizational measures to protect your personal information against 
            unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the 
            Internet or electronic storage is 100% secure.
          </p>
          <p className="text-text-secondary leading-relaxed">
            Your data is stored securely in our database and is only accessible to authorized personnel and users within 
            your organization.
          </p>
        </Card>

        <Card className="p-8 mb-6">
          <h2 className="text-2xl font-semibold text-text-primary mb-4">5. Data Sharing and Disclosure</h2>
          <p className="text-text-secondary leading-relaxed mb-4">
            We do not sell, trade, or rent your personal information to third parties. We may share your information only in the following circumstances:
          </p>
          <ul className="list-disc list-inside space-y-2 text-text-secondary ml-4">
            <li>With your consent</li>
            <li>To comply with legal obligations</li>
            <li>To protect our rights and safety</li>
            <li>With service providers who assist us in operating our Service (under strict confidentiality agreements)</li>
          </ul>
        </Card>

        <Card className="p-8 mb-6">
          <h2 className="text-2xl font-semibold text-text-primary mb-4">6. Third-Party Services</h2>
          <p className="text-text-secondary leading-relaxed mb-4">
            Our Service may contain links to third-party websites or services. We are not responsible for the privacy 
            practices of these third parties. We encourage you to read their privacy policies.
          </p>
          <p className="text-text-secondary leading-relaxed">
            We use Google OAuth for authentication. When you sign in with Google, Google's privacy policy applies to 
            the information you provide to Google.
          </p>
        </Card>

        <Card className="p-8 mb-6">
          <h2 className="text-2xl font-semibold text-text-primary mb-4">7. Your Rights</h2>
          <p className="text-text-secondary leading-relaxed mb-4">
            You have the right to:
          </p>
          <ul className="list-disc list-inside space-y-2 text-text-secondary ml-4">
            <li>Access and update your personal information</li>
            <li>Delete your account and associated data</li>
            <li>Opt out of certain communications</li>
            <li>Request a copy of your data</li>
          </ul>
          <p className="text-text-secondary leading-relaxed mt-4">
            To exercise these rights, please contact us at{' '}
            <a href="mailto:theteam@nucleas.app" className="text-primary hover:text-primary-hover transition-colors">
              theteam@nucleas.app
            </a>
          </p>
        </Card>

        <Card className="p-8 mb-6">
          <h2 className="text-2xl font-semibold text-text-primary mb-4">8. Data Retention</h2>
          <p className="text-text-secondary leading-relaxed mb-4">
            We retain your personal information for as long as necessary to provide you with our Service and as described 
            in this Privacy Policy. We may retain certain information as required by law or for legitimate business purposes.
          </p>
        </Card>

        <Card className="p-8 mb-6">
          <h2 className="text-2xl font-semibold text-text-primary mb-4">9. Children's Privacy</h2>
          <p className="text-text-secondary leading-relaxed mb-4">
            Our Service is not intended for children under 13 years of age. We do not knowingly collect personal information 
            from children under 13.
          </p>
        </Card>

        <Card className="p-8">
          <h2 className="text-2xl font-semibold text-text-primary mb-4">10. Changes to This Privacy Policy</h2>
          <p className="text-text-secondary leading-relaxed mb-4">
            We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy 
            Policy on this page and updating the "Last updated" date.
          </p>
          <p className="text-text-secondary">
            If you have any questions about this Privacy Policy, please contact us at{' '}
            <a href="mailto:theteam@nucleas.app" className="text-primary hover:text-primary-hover transition-colors">
              theteam@nucleas.app
            </a>
          </p>
        </Card>
      </div>
    </div>
  );
}

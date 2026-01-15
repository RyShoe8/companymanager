import Card from '@/components/ui/Card';
import { StructuredData } from '@/components/StructuredData';

export const metadata = {
  title: 'About Us - Nucleas',
  description: 'Learn about Nucleas and our mission to help teams plan and manage their work.',
  keywords: 'about Nucleas, company planning, project management, team collaboration',
  openGraph: {
    title: 'About Us - Nucleas',
    description: 'Learn about Nucleas and our mission to help teams plan and manage their work.',
    type: 'website',
    url: 'https://nucleas.app/about',
  },
  alternates: {
    canonical: 'https://nucleas.app/about',
  },
};

export default function AboutPage() {
  return (
    <>
      <StructuredData
        type="Organization"
        data={{
          name: 'Nucleas',
          url: 'https://nucleas.app',
          logo: 'https://nucleas.app/images/Nucleas.png',
          contactPoint: {
            '@type': 'ContactPoint',
            email: 'theteam@nucleas.app',
            contactType: 'Customer Service',
          },
          sameAs: [
            'https://themediashop.co',
          ],
        }}
      />
      <div className="min-h-screen bg-background px-[100px] max-md:px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-text-primary mb-6">About Nucleas</h1>

        <Card className="p-8 mb-6">
          <h2 className="text-2xl font-semibold text-text-primary mb-4">Our Mission</h2>
          <p className="text-text-secondary leading-relaxed mb-4">
            Nucleas is designed to help teams and organizations plan, manage, and execute their work more effectively. 
            We believe that great planning leads to great execution, and our platform provides the tools you need to 
            visualize your projects, manage your resources, and keep your team aligned.
          </p>
          <p className="text-text-secondary leading-relaxed">
            Whether you're managing complex projects across multiple time horizons or tracking recurring operations, 
            Nucleas gives you the clarity and control you need to succeed.
          </p>
        </Card>

        <Card className="p-8 mb-6">
          <h2 className="text-2xl font-semibold text-text-primary mb-4">What We Offer</h2>
          <ul className="space-y-3 text-text-secondary">
            <li className="flex items-start">
              <span className="text-primary mr-2">•</span>
              <span><strong className="text-text-primary">Planning Map:</strong> Visual calendar view for projects across multiple time horizons (Today, Weekly, Monthly, Quarterly, Yearly)</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary mr-2">•</span>
              <span><strong className="text-text-primary">Project Management:</strong> Create projects with stages, estimated hours, and team assignments</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary mr-2">•</span>
              <span><strong className="text-text-primary">Operations Tracking:</strong> Manage recurring operations and workflows</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary mr-2">•</span>
              <span><strong className="text-text-primary">Asset Repository:</strong> Centralized directory of tools, documents, and resources</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary mr-2">•</span>
              <span><strong className="text-text-primary">Team Management:</strong> Track employee capacity, workload, and assignments</span>
            </li>
          </ul>
        </Card>

        <Card className="p-8">
          <h2 className="text-2xl font-semibold text-text-primary mb-4">Contact Us</h2>
          <p className="text-text-secondary mb-4">
            Have questions or feedback? We'd love to hear from you.
          </p>
          <p className="text-text-secondary">
            Email us at:{' '}
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

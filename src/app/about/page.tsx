import Link from 'next/link';
import Card from '@/components/ui/Card';
import { StructuredData } from '@/components/StructuredData';
import MarketingPageHeader from '@/components/home/MarketingPageHeader';

export const metadata = {
  title: 'About Us - Nucleas',
  description: 'Learn about Nucleas and our mission to help teams plan, build, and run their projects from one command center.',
  keywords: 'about Nucleas, company planning, project management, team collaboration, command center',
  openGraph: {
    title: 'About Us - Nucleas',
    description: 'Learn about Nucleas and our mission to help teams plan, build, and run their work.',
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
          sameAs: ['https://themediashop.co'],
        }}
      />
      <div className="min-h-screen bg-background">
        <MarketingPageHeader
          badge="Company"
          title="About Nucleas"
          subtitle="The operating system for planning, building, and running every project you own."
          ctaText="Start Free"
          ctaHref="/register"
        />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <Card className="p-8 md:p-10 mb-8 rounded-2xl">
            <h2 className="text-2xl md:text-3xl font-bold text-text-primary mb-4">Our Mission</h2>
            <p className="text-text-secondary leading-relaxed mb-4">
              Nucleas is designed to help teams and organizations plan, manage, and execute their work more effectively.
              We believe that great planning leads to great execution, and our platform provides the tools you need to
              visualize your projects, manage your resources, and keep your team aligned.
            </p>
            <p className="text-text-secondary leading-relaxed">
              Whether you&apos;re managing complex projects across multiple time horizons or tracking recurring tasks,
              Nucleas gives you the clarity and control you need to succeed—all from one command center.
            </p>
          </Card>

          <Card className="p-8 md:p-10 mb-8 rounded-2xl">
            <h2 className="text-2xl md:text-3xl font-bold text-text-primary mb-6">What We Offer</h2>
            <ul className="space-y-4 text-text-secondary">
              {[
                ['Planning Map', 'Visual calendar view for projects across Today, Weekly, Monthly, Quarterly, and Yearly horizons'],
                ['Plan, Build, Run', 'Projects move through three phases; the interface adapts to where you are'],
                ['Projects & Tasks', 'Create projects with tasks, estimated hours, and team assignments'],
                ['Tasks & Workflows', 'Manage recurring tasks and workflows with flexible scheduling'],
                ['Assets', 'Centralized directory of tools, documents, and resources—link to projects and tasks'],
                ['Team', 'Track employee capacity, workload, and assignments with role-based access'],
              ].map(([title, desc]) => (
                <li key={title} className="flex gap-3">
                  <span className="text-primary font-bold">✓</span>
                  <span><strong className="text-text-primary">{title}:</strong> {desc}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-8 md:p-10 rounded-2xl">
            <h2 className="text-2xl md:text-3xl font-bold text-text-primary mb-4">Contact Us</h2>
            <p className="text-text-secondary mb-4">
              Have questions or feedback? We&apos;d love to hear from you.
            </p>
            <p className="text-text-secondary mb-6">
              Email us at:{' '}
              <a href="mailto:theteam@nucleas.app" className="text-primary hover:text-primary-hover transition-colors font-medium">
                theteam@nucleas.app
              </a>
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl bg-primary text-white font-semibold hover:bg-primary-hover transition-colors"
            >
              Get in Touch
            </Link>
          </Card>
        </div>
      </div>
    </>
  );
}

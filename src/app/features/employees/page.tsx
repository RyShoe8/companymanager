import Link from 'next/link';
import Card from '@/components/ui/Card';
import MarketingPageHeader from '@/components/home/MarketingPageHeader';
import { StructuredData } from '@/components/StructuredData';

const baseUrl = process.env.NEXTAUTH_URL || 'https://nucleas.app';

export const metadata = {
  title: 'Team - Capacity & Workload',
  description: 'Track team capacity, workload, and assignments. Manage your team effectively with role-based access, hours tracking, and workload visibility.',
  keywords: 'employee management, team management, capacity planning, workload tracking, team capacity',
  openGraph: {
    title: 'Team - Capacity & Workload | Nucleas',
    description: 'Track team capacity, workload, and assignments with Nucleas.',
    type: 'website',
    url: `${baseUrl}/features/employees`,
  },
  alternates: { canonical: '/features/employees' },
};

export default function EmployeesPage() {
  return (
    <>
      <StructuredData
        type="WebPage"
        data={{
          name: 'Team | Nucleas',
          description: 'Track team capacity, workload, and assignments. Role-based access and workload visibility.',
          url: `${baseUrl}/features/employees`,
          publisher: { '@type': 'Organization', name: 'Nucleas', url: baseUrl },
        }}
      />
      <div className="min-h-screen bg-background">
      <MarketingPageHeader
        badge="Organization"
        title="Team"
        subtitle="Track team capacity, workload, and assignments. Manage your team effectively with role-based access, hours tracking, and workload visibility."
        ctaText="Get started"
        ctaHref="/register"
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <Card className="p-8 md:p-10 mb-8 rounded-2xl">
          <h2 className="text-2xl md:text-3xl font-bold text-text-primary mb-4">Comprehensive Team Management</h2>
          <p className="text-text-secondary leading-relaxed mb-8">
            Team management in Nucleas gives you complete visibility into your team&apos;s capacity,
            workload, and assignments. Make informed decisions about resource allocation and ensure
            balanced workloads across your organization.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-6 rounded-xl bg-primary-light border border-primary/20">
              <h3 className="text-lg font-semibold text-primary-dark mb-2">Capacity Tracking</h3>
              <p className="text-text-secondary text-sm">Set and track weekly hours for each team member to understand availability.</p>
            </div>
            <div className="p-6 rounded-xl bg-secondary-light border border-secondary/20">
              <h3 className="text-lg font-semibold text-secondary-dark mb-2">Workload Visibility</h3>
              <p className="text-text-secondary text-sm">See how projects and tasks impact each team member&apos;s workload.</p>
            </div>
            <div className="p-6 rounded-xl bg-accent-light border border-accent/20">
              <h3 className="text-lg font-semibold text-accent-dark mb-2">Role Management</h3>
              <p className="text-text-secondary text-sm">Assign roles (Administrator, Manager, User) with appropriate permissions.</p>
            </div>
            <div className="p-6 rounded-xl bg-primary-light border border-primary/20">
              <h3 className="text-lg font-semibold text-primary-dark mb-2">Assignment Tracking</h3>
              <p className="text-text-secondary text-sm">See all projects and tasks assigned to each team member.</p>
            </div>
          </div>
        </Card>

        <Card className="p-8 md:p-10 mb-8 rounded-2xl">
          <h2 className="text-2xl md:text-3xl font-bold text-text-primary mb-6">Key Features</h2>
          <ul className="space-y-4 text-text-secondary list-none">
            {[
              ['Weekly Hours', 'Set and track weekly capacity for each employee'],
              ['Employee Types', 'Categorize as full-time, part-time, or contractor'],
              ['Role-Based Access', 'Assign roles with appropriate permissions and access levels'],
              ['Workload Analysis', 'See how assignments impact team member capacity'],
              ['Team Overview', "Get a complete view of your team's capacity and assignments"],
            ].map(([title, desc]) => (
              <li key={title} className="flex gap-3">
                <span className="text-primary font-bold mt-0.5">✓</span>
                <span><h3 className="text-base font-semibold text-text-primary inline">{title}:</h3> {desc}</span>
              </li>
            ))}
          </ul>
        </Card>

        <div className="flex justify-center pt-8">
          <Link href="/register" className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl bg-primary text-white font-semibold hover:bg-primary-hover transition-colors">
            Get started
          </Link>
        </div>
      </div>
    </div>
    </>
  );
}

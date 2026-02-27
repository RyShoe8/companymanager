import Link from 'next/link';
import Card from '@/components/ui/Card';
import { StructuredData } from '@/components/StructuredData';
import MarketingPageHeader from '@/components/home/MarketingPageHeader';

export const metadata = {
  title: 'Planning Map - Visual Calendar View | Nucleas',
  description: 'Visualize and manage your projects across multiple time horizons with Nucleas Planning Map. Plan for Today, Weekly, Monthly, Quarterly, and Yearly views.',
  keywords: 'planning map, project planning, calendar view, project management, visual planning',
  openGraph: {
    title: 'Planning Map - Visual Calendar View | Nucleas',
    description: 'Visualize and manage your projects across multiple time horizons with Nucleas Planning Map.',
    type: 'website',
  },
};

export default function PlanningMapPage() {
  return (
    <>
      <StructuredData
        type="SoftwareApplication"
        data={{
          name: 'Nucleas Planning Map',
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Web',
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          featureList: [
            'Multi-horizon planning (Today, Weekly, Monthly, Quarterly, Yearly)',
            'Visual calendar view',
            'Drag-and-drop scheduling',
            'Status tracking',
            'Resource allocation',
          ],
        }}
      />
      <div className="min-h-screen bg-background">
        <MarketingPageHeader
          badge="Plan phase"
          title="Planning Map"
          subtitle="Visualize and manage your projects across multiple time horizons. See the big picture and execute with precision."
          ctaText="Get Started"
          ctaHref="/plan"
        />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <Card className="p-8 md:p-10 mb-8 rounded-2xl">
            <h2 className="text-2xl md:text-3xl font-bold text-text-primary mb-4">Multi-Horizon Planning</h2>
            <p className="text-text-secondary leading-relaxed mb-8">
              The Planning Map gives you a comprehensive view of your work across five time horizons, helping you balance
              immediate needs with long-term strategic goals.
            </p>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="p-6 rounded-xl bg-primary-light border border-primary/20">
                <h3 className="text-lg font-semibold text-primary-dark mb-2">Today</h3>
                <p className="text-text-secondary text-sm">Focus on immediate tasks and priorities</p>
              </div>
              <div className="p-6 rounded-xl bg-secondary-light border border-secondary/20">
                <h3 className="text-lg font-semibold text-secondary-dark mb-2">Weekly</h3>
                <p className="text-text-secondary text-sm">Plan your week with visibility into deadlines</p>
              </div>
              <div className="p-6 rounded-xl bg-accent-light border border-accent/20">
                <h3 className="text-lg font-semibold text-accent-dark mb-2">Monthly</h3>
                <p className="text-text-secondary text-sm">Track monthly milestones and schedules</p>
              </div>
              <div className="p-6 rounded-xl bg-primary-light border border-primary/20">
                <h3 className="text-lg font-semibold text-primary-dark mb-2">Quarterly</h3>
                <p className="text-text-secondary text-sm">Align quarterly objectives with strategy</p>
              </div>
            </div>
            <div className="mt-6 p-6 rounded-xl bg-background border border-border">
              <h3 className="text-lg font-semibold text-text-primary mb-2">Yearly</h3>
              <p className="text-text-secondary text-sm">Maintain visibility into long-term goals and annual planning cycles.</p>
            </div>
          </Card>

          <Card className="p-8 md:p-10 mb-8 rounded-2xl">
            <h2 className="text-2xl md:text-3xl font-bold text-text-primary mb-6">Key Features</h2>
            <ul className="space-y-4 text-text-secondary">
              {[
                ['Visual Calendar View', 'See all your projects and tasks in an intuitive calendar format'],
                ['Drag-and-Drop Scheduling', 'Easily move projects between time horizons'],
                ['Status Tracking', 'Monitor project status with color-coded indicators'],
                ['Resource Allocation', 'See which team members are assigned to each project'],
                ['Timeline Visualization', 'Understand project timelines and dependencies at a glance'],
              ].map(([title, desc]) => (
                <li key={title} className="flex gap-3">
                  <span className="text-primary font-bold">✓</span>
                  <span><strong className="text-text-primary">{title}:</strong> {desc}</span>
                </li>
              ))}
            </ul>
          </Card>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
            <Link href="/plan" className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl bg-primary text-white font-semibold hover:bg-primary-hover transition-colors">
              Go to Plan
            </Link>
            <Link href="/#demo" className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl border-2 border-primary text-primary font-semibold hover:bg-primary/5 transition-colors">
              Try Interactive Demo
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

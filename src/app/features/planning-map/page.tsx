import Card from '@/components/ui/Card';
import Image from 'next/image';
import { StructuredData } from '@/components/StructuredData';

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
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD',
          },
          featureList: [
            'Multi-horizon planning (Today, Weekly, Monthly, Quarterly, Yearly)',
            'Visual calendar view',
            'Drag-and-drop scheduling',
            'Status tracking',
            'Resource allocation',
          ],
        }}
      />
      <div className="min-h-screen bg-background px-[100px] max-md:px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-text-primary mb-4">Planning Map</h1>
          <p className="text-xl text-text-secondary max-w-2xl mx-auto">
            Visualize and manage your projects across multiple time horizons. See the big picture and execute with precision.
          </p>
        </div>

        <Card className="p-8 mb-8">
          <h2 className="text-3xl font-semibold text-text-primary mb-4">Multi-Horizon Planning</h2>
          <p className="text-text-secondary leading-relaxed mb-6">
            The Planning Map gives you a comprehensive view of your work across five time horizons, helping you balance 
            immediate needs with long-term strategic goals.
          </p>
          
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div className="bg-primary-light border border-primary/20 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-primary-dark mb-2">Today</h3>
              <p className="text-text-secondary">Focus on immediate tasks and priorities that need attention right now.</p>
            </div>
            <div className="bg-secondary-light border border-secondary/20 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-secondary-dark mb-2">Weekly</h3>
              <p className="text-text-secondary">Plan your week ahead with visibility into upcoming deadlines and commitments.</p>
            </div>
            <div className="bg-accent-light border border-accent/20 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-accent-dark mb-2">Monthly</h3>
              <p className="text-text-secondary">Track monthly milestones and ensure projects stay on schedule.</p>
            </div>
            <div className="bg-primary-light border border-primary/20 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-primary-dark mb-2">Quarterly</h3>
              <p className="text-text-secondary">Align quarterly objectives with your strategic initiatives.</p>
            </div>
          </div>
          
          <div className="bg-background-card border border-border rounded-lg p-6">
            <h3 className="text-xl font-semibold text-text-primary mb-2">Yearly</h3>
            <p className="text-text-secondary">Maintain visibility into long-term goals and annual planning cycles.</p>
          </div>
        </Card>

        <Card className="p-8 mb-8">
          <h2 className="text-3xl font-semibold text-text-primary mb-4">Key Features</h2>
          <ul className="space-y-4 text-text-secondary">
            <li className="flex items-start">
              <span className="text-primary mr-3 mt-1">✓</span>
              <span><strong className="text-text-primary">Visual Calendar View:</strong> See all your projects and operations in an intuitive calendar format</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary mr-3 mt-1">✓</span>
              <span><strong className="text-text-primary">Drag-and-Drop Scheduling:</strong> Easily move projects between time horizons</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary mr-3 mt-1">✓</span>
              <span><strong className="text-text-primary">Status Tracking:</strong> Monitor project status with color-coded indicators</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary mr-3 mt-1">✓</span>
              <span><strong className="text-text-primary">Resource Allocation:</strong> See which team members are assigned to each project</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary mr-3 mt-1">✓</span>
              <span><strong className="text-text-primary">Timeline Visualization:</strong> Understand project timelines and dependencies at a glance</span>
            </li>
          </ul>
        </Card>

        <Card className="p-8">
          <h2 className="text-3xl font-semibold text-text-primary mb-4">Perfect For</h2>
          <div className="grid md:grid-cols-3 gap-4 text-text-secondary">
            <div>
              <p className="font-semibold text-text-primary mb-2">Project Managers</p>
              <p>Keep all projects visible and organized across time horizons</p>
            </div>
            <div>
              <p className="font-semibold text-text-primary mb-2">Team Leads</p>
              <p>Balance immediate priorities with strategic planning</p>
            </div>
            <div>
              <p className="font-semibold text-text-primary mb-2">Executives</p>
              <p>Maintain high-level visibility into organizational work</p>
            </div>
          </div>
        </Card>

        <div className="mt-12 text-center">
          <a
            href="/register"
            className="inline-block bg-primary text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-hover transition-colors"
          >
            Get Started with Planning Map
          </a>
        </div>
      </div>
    </div>
    </>
  );
}

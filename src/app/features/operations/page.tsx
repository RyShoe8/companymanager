import Card from '@/components/ui/Card';

export const metadata = {
  title: 'Operations Management - Recurring Workflows | Nucleas',
  description: 'Manage recurring operations and workflows efficiently. Track repeating tasks, processes, and operational work with Nucleas Operations.',
  keywords: 'operations management, recurring tasks, workflows, process management, operational work',
  openGraph: {
    title: 'Operations Management - Recurring Workflows | Nucleas',
    description: 'Manage recurring operations and workflows efficiently with Nucleas.',
    type: 'website',
  },
};

export default function OperationsPage() {
  return (
    <div className="min-h-screen bg-background px-[100px] max-md:px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-text-primary mb-4">Operations</h1>
          <p className="text-xl text-text-secondary max-w-2xl mx-auto">
            Manage recurring operations and workflows. Track repeating tasks, processes, and operational work 
            that keeps your organization running smoothly.
          </p>
        </div>

        <Card className="p-8 mb-8">
          <h2 className="text-3xl font-semibold text-text-primary mb-4">Streamline Recurring Work</h2>
          <p className="text-text-secondary leading-relaxed mb-6">
            Operations are the recurring tasks and processes that happen regularly in your organization. 
            Unlike one-time projects, operations repeat on schedules and require consistent tracking and management.
          </p>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-accent-light border border-accent/20 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-accent-dark mb-2">Recurring Schedules</h3>
              <p className="text-text-secondary">Set up operations to repeat daily, weekly, monthly, or on custom schedules.</p>
            </div>
            <div className="bg-primary-light border border-primary/20 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-primary-dark mb-2">Team Assignments</h3>
              <p className="text-text-secondary">Assign team members to operations and track their recurring workload.</p>
            </div>
            <div className="bg-secondary-light border border-secondary/20 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-secondary-dark mb-2">Time Tracking</h3>
              <p className="text-text-secondary">Estimate and track hours spent on recurring operational work.</p>
            </div>
            <div className="bg-accent-light border border-accent/20 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-accent-dark mb-2">Status Monitoring</h3>
              <p className="text-text-secondary">Track operation status and ensure nothing falls through the cracks.</p>
            </div>
          </div>
        </Card>

        <Card className="p-8 mb-8">
          <h2 className="text-3xl font-semibold text-text-primary mb-4">Key Features</h2>
          <ul className="space-y-4 text-text-secondary">
            <li className="flex items-start">
              <span className="text-primary mr-3 mt-1">✓</span>
              <span><strong className="text-text-primary">Visual Distinction:</strong> Operations are clearly distinguished from projects in the Planning Map</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary mr-3 mt-1">✓</span>
              <span><strong className="text-text-primary">Flexible Scheduling:</strong> Set up operations to repeat on any schedule</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary mr-3 mt-1">✓</span>
              <span><strong className="text-text-primary">Resource Planning:</strong> See how recurring operations impact team capacity</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary mr-3 mt-1">✓</span>
              <span><strong className="text-text-primary">Operational Visibility:</strong> Keep all recurring work visible and organized</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary mr-3 mt-1">✓</span>
              <span><strong className="text-text-primary">Process Documentation:</strong> Document operational processes for consistency</span>
            </li>
          </ul>
        </Card>

        <Card className="p-8">
          <h2 className="text-3xl font-semibold text-text-primary mb-4">Common Operations</h2>
          <div className="grid md:grid-cols-2 gap-6 text-text-secondary">
            <div>
              <p className="font-semibold text-text-primary mb-2">Weekly Reports</p>
              <p>Track recurring weekly reporting and status updates</p>
            </div>
            <div>
              <p className="font-semibold text-text-primary mb-2">Monthly Reviews</p>
              <p>Manage monthly performance reviews and team check-ins</p>
            </div>
            <div>
              <p className="font-semibold text-text-primary mb-2">Maintenance Tasks</p>
              <p>Schedule and track regular maintenance and upkeep work</p>
            </div>
            <div>
              <p className="font-semibold text-text-primary mb-2">Client Check-ins</p>
              <p>Organize recurring client meetings and communications</p>
            </div>
            <div>
              <p className="font-semibold text-text-primary mb-2">Content Publishing</p>
              <p>Schedule regular content creation and publishing workflows</p>
            </div>
            <div>
              <p className="font-semibold text-text-primary mb-2">Data Backups</p>
              <p>Track recurring data backup and security operations</p>
            </div>
          </div>
        </Card>

        <div className="mt-12 text-center">
          <a
            href="/register"
            className="inline-block bg-primary text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-hover transition-colors"
          >
            Start Managing Operations
          </a>
        </div>
      </div>
    </div>
  );
}

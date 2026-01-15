import Card from '@/components/ui/Card';

export const metadata = {
  title: 'Employee Management - Team Capacity & Workload | Nucleas',
  description: 'Track employee capacity, workload, and assignments. Manage your team effectively with role-based access, hours tracking, and workload visibility.',
  keywords: 'employee management, team management, capacity planning, workload tracking, team capacity',
  openGraph: {
    title: 'Employee Management - Team Capacity & Workload | Nucleas',
    description: 'Track employee capacity, workload, and assignments with Nucleas.',
    type: 'website',
  },
};

export default function EmployeesPage() {
  return (
    <div className="min-h-screen bg-background px-[100px] max-md:px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-text-primary mb-4">Employee Management</h1>
          <p className="text-xl text-text-secondary max-w-2xl mx-auto">
            Track employee capacity, workload, and assignments. Manage your team effectively with 
            role-based access, hours tracking, and workload visibility.
          </p>
        </div>

        <Card className="p-8 mb-8">
          <h2 className="text-3xl font-semibold text-text-primary mb-4">Comprehensive Team Management</h2>
          <p className="text-text-secondary leading-relaxed mb-6">
            Employee Management in Nucleas gives you complete visibility into your team's capacity, 
            workload, and assignments. Make informed decisions about resource allocation and ensure 
            balanced workloads across your organization.
          </p>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-primary-light border border-primary/20 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-primary-dark mb-2">Capacity Tracking</h3>
              <p className="text-text-secondary">Set and track weekly hours for each team member to understand availability.</p>
            </div>
            <div className="bg-secondary-light border border-secondary/20 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-secondary-dark mb-2">Workload Visibility</h3>
              <p className="text-text-secondary">See how projects and operations impact each team member's workload.</p>
            </div>
            <div className="bg-accent-light border border-accent/20 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-accent-dark mb-2">Role Management</h3>
              <p className="text-text-secondary">Assign roles (Administrator, Manager, User) with appropriate permissions.</p>
            </div>
            <div className="bg-primary-light border border-primary/20 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-primary-dark mb-2">Assignment Tracking</h3>
              <p className="text-text-secondary">See all projects and operations assigned to each team member.</p>
            </div>
          </div>
        </Card>

        <Card className="p-8 mb-8">
          <h2 className="text-3xl font-semibold text-text-primary mb-4">Key Features</h2>
          <ul className="space-y-4 text-text-secondary">
            <li className="flex items-start">
              <span className="text-primary mr-3 mt-1">✓</span>
              <span><strong className="text-text-primary">Weekly Hours:</strong> Set and track weekly capacity for each employee</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary mr-3 mt-1">✓</span>
              <span><strong className="text-text-primary">Employee Types:</strong> Categorize as full-time, part-time, or contractor</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary mr-3 mt-1">✓</span>
              <span><strong className="text-text-primary">Role-Based Access:</strong> Assign roles with appropriate permissions and access levels</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary mr-3 mt-1">✓</span>
              <span><strong className="text-text-primary">Workload Analysis:</strong> See how assignments impact team member capacity</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary mr-3 mt-1">✓</span>
              <span><strong className="text-text-primary">Team Overview:</strong> Get a complete view of your team's capacity and assignments</span>
            </li>
          </ul>
        </Card>

        <Card className="p-8">
          <h2 className="text-3xl font-semibold text-text-primary mb-4">Role Types</h2>
          <div className="grid md:grid-cols-3 gap-6 text-text-secondary">
            <div>
              <p className="font-semibold text-text-primary mb-2">Administrator</p>
              <p>Full access to all features, including organization settings and user management</p>
            </div>
            <div>
              <p className="font-semibold text-text-primary mb-2">Manager</p>
              <p>Manage projects, operations, and team members within their organization</p>
            </div>
            <div>
              <p className="font-semibold text-text-primary mb-2">User</p>
              <p>View and contribute to projects and operations assigned to them</p>
            </div>
          </div>
        </Card>

        <div className="mt-12 text-center">
          <a
            href="/register"
            className="inline-block bg-primary text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-hover transition-colors"
          >
            Start Managing Your Team
          </a>
        </div>
      </div>
    </div>
  );
}

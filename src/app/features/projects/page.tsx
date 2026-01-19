import Card from '@/components/ui/Card';

export const metadata = {
  title: 'Project Management - Track Projects & Tasks | Nucleas',
  description: 'Create and manage projects with tasks, estimated hours, team assignments, and status tracking. Organize your work with powerful project management tools.',
  keywords: 'project management, project tracking, project tasks, team collaboration, project planning',
  openGraph: {
    title: 'Project Management - Track Projects & Tasks | Nucleas',
    description: 'Create and manage projects with tasks, estimated hours, and team assignments.',
    type: 'website',
  },
};

export default function ProjectsPage() {
  return (
    <div className="min-h-screen bg-background px-[100px] max-md:px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-text-primary mb-4">Projects</h1>
          <p className="text-xl text-text-secondary max-w-2xl mx-auto">
            Create, organize, and track projects with detailed tasks, timelines, and team assignments. 
            Keep everything organized from start to finish.
          </p>
        </div>

        <Card className="p-8 mb-8">
          <h2 className="text-3xl font-semibold text-text-primary mb-4">Comprehensive Project Management</h2>
          <p className="text-text-secondary leading-relaxed mb-6">
            Projects in Nucleas give you complete control over your work. Define project tasks, estimate time, 
            assign team members, and track progress—all in one place.
          </p>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-primary-light border border-primary/20 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-primary-dark mb-2">Project Tasks</h3>
              <p className="text-text-secondary">Break down projects into manageable tasks with clear milestones and deliverables.</p>
            </div>
            <div className="bg-secondary-light border border-secondary/20 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-secondary-dark mb-2">Time Estimation</h3>
              <p className="text-text-secondary">Estimate hours for each project to better plan resources and timelines.</p>
            </div>
            <div className="bg-accent-light border border-accent/20 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-accent-dark mb-2">Team Assignments</h3>
              <p className="text-text-secondary">Assign team members to projects and track their workload across all assignments.</p>
            </div>
            <div className="bg-primary-light border border-primary/20 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-primary-dark mb-2">Status Tracking</h3>
              <p className="text-text-secondary">Monitor project status with visual indicators: Not Started, In Progress, Completed, or On Hold.</p>
            </div>
          </div>
        </Card>

        <Card className="p-8 mb-8">
          <h2 className="text-3xl font-semibold text-text-primary mb-4">Key Features</h2>
          <ul className="space-y-4 text-text-secondary">
            <li className="flex items-start">
              <span className="text-primary mr-3 mt-1">✓</span>
              <span><strong className="text-text-primary">Custom Project Colors:</strong> Color-code projects for easy visual identification</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary mr-3 mt-1">✓</span>
              <span><strong className="text-text-primary">Flexible Tasks:</strong> Define as many tasks as needed for each project</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary mr-3 mt-1">✓</span>
              <span><strong className="text-text-primary">Resource Planning:</strong> See how projects impact team member capacity</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary mr-3 mt-1">✓</span>
              <span><strong className="text-text-primary">Timeline Management:</strong> Set start and end dates for better planning</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary mr-3 mt-1">✓</span>
              <span><strong className="text-text-primary">Project Details:</strong> Add descriptions, notes, and additional context</span>
            </li>
          </ul>
        </Card>

        <Card className="p-8">
          <h2 className="text-3xl font-semibold text-text-primary mb-4">Use Cases</h2>
          <div className="grid md:grid-cols-2 gap-6 text-text-secondary">
            <div>
              <p className="font-semibold text-text-primary mb-2">Product Development</p>
              <p>Track product launches from ideation to market release with clear tasks and milestones</p>
            </div>
            <div>
              <p className="font-semibold text-text-primary mb-2">Client Projects</p>
              <p>Manage client deliverables with detailed tasks and time tracking</p>
            </div>
            <div>
              <p className="font-semibold text-text-primary mb-2">Internal Initiatives</p>
              <p>Organize internal projects with team assignments and progress tracking</p>
            </div>
            <div>
              <p className="font-semibold text-text-primary mb-2">Campaign Management</p>
              <p>Plan and execute marketing campaigns with task-based workflows</p>
            </div>
          </div>
        </Card>

        <div className="mt-12 text-center">
          <a
            href="/register"
            className="inline-block bg-primary text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-hover transition-colors"
          >
            Start Managing Projects
          </a>
        </div>
      </div>
    </div>
  );
}

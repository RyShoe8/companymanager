import Link from 'next/link';
import Card from '@/components/ui/Card';
import MarketingPageHeader from '@/components/home/MarketingPageHeader';

export const metadata = {
  title: 'Projects & Tasks - Track Execution | Nucleas',
  description: 'Create and manage projects with tasks, estimated hours, team assignments, and status tracking. Plan, build, and run from one place.',
  keywords: 'project management, project tracking, project tasks, team collaboration, project planning',
  openGraph: {
    title: 'Projects & Tasks - Track Execution | Nucleas',
    description: 'Create and manage projects with tasks, estimated hours, and team assignments.',
    type: 'website',
  },
};

export default function ProjectsPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingPageHeader
        badge="Plan & Build"
        title="Projects & Tasks"
        subtitle="Create, organize, and track projects with detailed tasks, timelines, and team assignments. Keep everything organized from start to finish."
        ctaText="Go to Plan"
        ctaHref="/plan"
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <Card className="p-8 md:p-10 mb-8 rounded-2xl">
          <h2 className="text-2xl md:text-3xl font-bold text-text-primary mb-4">Comprehensive Project Management</h2>
          <p className="text-text-secondary leading-relaxed mb-8">
            Projects in Nucleas give you complete control over your work. Define project tasks, estimate time,
            assign team members, and track progress—all in one place.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-6 rounded-xl bg-primary-light border border-primary/20">
              <h3 className="text-lg font-semibold text-primary-dark mb-2">Project Tasks</h3>
              <p className="text-text-secondary text-sm">Break down projects into manageable tasks with clear milestones and deliverables.</p>
            </div>
            <div className="p-6 rounded-xl bg-secondary-light border border-secondary/20">
              <h3 className="text-lg font-semibold text-secondary-dark mb-2">Time Estimation</h3>
              <p className="text-text-secondary text-sm">Estimate hours for each project to better plan resources and timelines.</p>
            </div>
            <div className="p-6 rounded-xl bg-accent-light border border-accent/20">
              <h3 className="text-lg font-semibold text-accent-dark mb-2">Team Assignments</h3>
              <p className="text-text-secondary text-sm">Assign team members to projects and track their workload across all assignments.</p>
            </div>
            <div className="p-6 rounded-xl bg-primary-light border border-primary/20">
              <h3 className="text-lg font-semibold text-primary-dark mb-2">Status Tracking</h3>
              <p className="text-text-secondary text-sm">Monitor project status: Planning, In Development, In Review, or Completed.</p>
            </div>
          </div>
        </Card>

        <Card className="p-8 md:p-10 mb-8 rounded-2xl">
          <h2 className="text-2xl md:text-3xl font-bold text-text-primary mb-6">Key Features</h2>
          <ul className="space-y-4 text-text-secondary">
            {[
              ['Custom Project Colors', 'Color-code projects for easy visual identification'],
              ['Flexible Tasks', 'Define as many tasks as needed for each project'],
              ['Resource Planning', 'See how projects impact team member capacity'],
              ['Timeline Management', 'Set start and end dates for better planning'],
              ['Plan → Build → Run', 'Projects move through phases; the interface adapts'],
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
          <Link href="/build" className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl border-2 border-primary text-primary font-semibold hover:bg-primary/5 transition-colors">
            Go to Build
          </Link>
          <Link href="/#demo" className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl border-2 border-border text-text-secondary font-semibold hover:border-primary hover:text-primary transition-colors">
            Try Interactive Demo
          </Link>
        </div>
      </div>
    </div>
  );
}

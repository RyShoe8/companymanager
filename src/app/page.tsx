import Link from 'next/link';
import Image from 'next/image';
import Button from '@/components/ui/Button';

export const metadata = {
  title: 'Nucleas - Project Planning & Operations Management',
  description: 'Streamline your project planning, operations, and team management with Nucleas. Visualize timelines, track operations, manage assets, and coordinate your team all in one place.',
  keywords: ['project management', 'operations management', 'planning', 'team coordination', 'project planning software'],
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/10 via-background to-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
          <div className="text-center">
            <div className="flex justify-center mb-8">
              <Image
                src="/images/Nucleas.png"
                alt="Nucleas Logo"
                width={200}
                height={60}
                priority
                className="h-auto"
              />
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-text-primary mb-6">
              Plan, Execute, and Manage
              <br />
              <span className="text-primary">Your Operations</span>
            </h1>
            <p className="text-xl sm:text-2xl text-text-secondary max-w-3xl mx-auto mb-8">
              Streamline your project planning, operations, and team management all in one powerful platform.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register">
                <Button className="px-8 py-3 text-lg">
                  Get Started Free
                </Button>
              </Link>
              <Link href="/features/planning-map">
                <Button variant="secondary" className="px-8 py-3 text-lg">
                  Learn More
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-background-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-text-primary mb-4">
              Everything You Need to Manage Your Operations
            </h2>
            <p className="text-lg text-text-secondary max-w-2xl mx-auto">
              Powerful features designed to help you plan, track, and execute your projects and operations efficiently.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Planning Map */}
            <Link href="/features/planning-map" className="group">
              <div className="bg-background p-6 rounded-lg border border-border hover:border-primary transition-colors h-full">
                <div className="w-12 h-12 bg-primary-light rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary transition-colors">
                  <svg className="w-6 h-6 text-primary-dark group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-text-primary mb-2">Planning Map</h3>
                <p className="text-text-secondary">
                  Visualize your projects and operations on an interactive timeline. Plan across daily, weekly, monthly, quarterly, and yearly horizons.
                </p>
              </div>
            </Link>

            {/* Projects */}
            <Link href="/features/projects" className="group">
              <div className="bg-background p-6 rounded-lg border border-border hover:border-primary transition-colors h-full">
                <div className="w-12 h-12 bg-primary-light rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary transition-colors">
                  <svg className="w-6 h-6 text-primary-dark group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-text-primary mb-2">Projects</h3>
                <p className="text-text-secondary">
                  Manage complex projects with multiple stages, assignments, and timelines. Track progress and coordinate team efforts.
                </p>
              </div>
            </Link>

            {/* Operations */}
            <Link href="/features/operations" className="group">
              <div className="bg-background p-6 rounded-lg border border-border hover:border-primary transition-colors h-full">
                <div className="w-12 h-12 bg-accent-light rounded-lg flex items-center justify-center mb-4 group-hover:bg-accent transition-colors">
                  <svg className="w-6 h-6 text-accent-dark group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-text-primary mb-2">Operations</h3>
                <p className="text-text-secondary">
                  Track recurring operations with flexible scheduling. Manage daily, weekly, monthly, quarterly, and yearly operations.
                </p>
              </div>
            </Link>

            {/* Assets */}
            <Link href="/features/assets" className="group">
              <div className="bg-background p-6 rounded-lg border border-border hover:border-primary transition-colors h-full">
                <div className="w-12 h-12 bg-primary-light rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary transition-colors">
                  <svg className="w-6 h-6 text-primary-dark group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-text-primary mb-2">Assets</h3>
                <p className="text-text-secondary">
                  Organize and manage your digital assets. Link assets to projects and operations for easy access and reference.
                </p>
              </div>
            </Link>

            {/* Employees */}
            <Link href="/features/employees" className="group">
              <div className="bg-background p-6 rounded-lg border border-border hover:border-primary transition-colors h-full">
                <div className="w-12 h-12 bg-primary-light rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary transition-colors">
                  <svg className="w-6 h-6 text-primary-dark group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-text-primary mb-2">Employees</h3>
                <p className="text-text-secondary">
                  Manage your team members, their roles, and availability. Assign work and track capacity across your organization.
                </p>
              </div>
            </Link>

            {/* Contact */}
            <Link href="/contact" className="group">
              <div className="bg-background p-6 rounded-lg border border-border hover:border-primary transition-colors h-full">
                <div className="w-12 h-12 bg-primary-light rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary transition-colors">
                  <svg className="w-6 h-6 text-primary-dark group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-text-primary mb-2">Get in Touch</h3>
                <p className="text-text-secondary">
                  Have questions or feedback? We'd love to hear from you. Contact us or request a feature.
                </p>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-white/90 mb-8">
            Join teams already using Nucleas to streamline their operations and project management.
          </p>
          <Link href="/register">
            <Button variant="secondary" className="px-8 py-3 text-lg bg-white text-primary hover:bg-gray-100">
              Sign Up Free
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}

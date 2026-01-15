import Card from '@/components/ui/Card';

export const metadata = {
  title: 'Asset Repository - Centralized Resource Directory | Nucleas',
  description: 'Create a centralized directory of tools, documents, and resources. Organize and access all your company assets in one place with Nucleas Asset Repository.',
  keywords: 'asset management, resource directory, document management, tool repository, company assets',
  openGraph: {
    title: 'Asset Repository - Centralized Resource Directory | Nucleas',
    description: 'Create a centralized directory of tools, documents, and resources.',
    type: 'website',
  },
};

export default function AssetsPage() {
  return (
    <div className="min-h-screen bg-background px-[100px] max-md:px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-text-primary mb-4">Asset Repository</h1>
          <p className="text-xl text-text-secondary max-w-2xl mx-auto">
            Create a centralized directory of tools, documents, and resources. 
            Organize and access all your company assets in one place.
          </p>
        </div>

        <Card className="p-8 mb-8">
          <h2 className="text-3xl font-semibold text-text-primary mb-4">Centralized Asset Management</h2>
          <p className="text-text-secondary leading-relaxed mb-6">
            The Asset Repository is your organization's single source of truth for all tools, documents, 
            resources, and assets. No more searching through emails or shared drives—everything is organized 
            and easily accessible.
          </p>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-primary-light border border-primary/20 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-primary-dark mb-2">Categorization</h3>
              <p className="text-text-secondary">Organize assets by type: Tools, Documents, Resources, and more.</p>
            </div>
            <div className="bg-secondary-light border border-secondary/20 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-secondary-dark mb-2">Search & Filter</h3>
              <p className="text-text-secondary">Quickly find assets with powerful search and filtering capabilities.</p>
            </div>
            <div className="bg-accent-light border border-accent/20 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-accent-dark mb-2">Link Management</h3>
              <p className="text-text-secondary">Store URLs and links to external resources and tools.</p>
            </div>
            <div className="bg-primary-light border border-primary/20 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-primary-dark mb-2">Descriptions</h3>
              <p className="text-text-secondary">Add detailed descriptions and notes for each asset.</p>
            </div>
          </div>
        </Card>

        <Card className="p-8 mb-8">
          <h2 className="text-3xl font-semibold text-text-primary mb-4">Key Features</h2>
          <ul className="space-y-4 text-text-secondary">
            <li className="flex items-start">
              <span className="text-primary mr-3 mt-1">✓</span>
              <span><strong className="text-text-primary">Asset Types:</strong> Categorize assets by type for better organization</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary mr-3 mt-1">✓</span>
              <span><strong className="text-text-primary">Quick Search:</strong> Find assets instantly with real-time search</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary mr-3 mt-1">✓</span>
              <span><strong className="text-text-primary">Filter by Type:</strong> Filter assets by category for focused browsing</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary mr-3 mt-1">✓</span>
              <span><strong className="text-text-primary">Link Storage:</strong> Store URLs and links to external resources</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary mr-3 mt-1">✓</span>
              <span><strong className="text-text-primary">Team Access:</strong> Share assets with your entire organization</span>
            </li>
          </ul>
        </Card>

        <Card className="p-8">
          <h2 className="text-3xl font-semibold text-text-primary mb-4">Asset Categories</h2>
          <div className="grid md:grid-cols-2 gap-6 text-text-secondary">
            <div>
              <p className="font-semibold text-text-primary mb-2">Tools</p>
              <p>Software tools, platforms, and applications your team uses</p>
            </div>
            <div>
              <p className="font-semibold text-text-primary mb-2">Documents</p>
              <p>Important documents, templates, and reference materials</p>
            </div>
            <div>
              <p className="font-semibold text-text-primary mb-2">Resources</p>
              <p>Learning resources, guides, and helpful links</p>
            </div>
            <div>
              <p className="font-semibold text-text-primary mb-2">Templates</p>
              <p>Reusable templates and standardized formats</p>
            </div>
            <div>
              <p className="font-semibold text-text-primary mb-2">Brand Assets</p>
              <p>Logos, brand guidelines, and marketing materials</p>
            </div>
            <div>
              <p className="font-semibold text-text-primary mb-2">External Links</p>
              <p>Important external resources and third-party tools</p>
            </div>
          </div>
        </Card>

        <div className="mt-12 text-center">
          <a
            href="/register"
            className="inline-block bg-primary text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-hover transition-colors"
          >
            Start Building Your Asset Repository
          </a>
        </div>
      </div>
    </div>
  );
}

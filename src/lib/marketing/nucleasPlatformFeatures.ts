/** Full platform capabilities — identical on every subscription plan (seat count varies by plan). */
export const NUCLEAS_PLATFORM_FEATURES = [
  'Workspace planning and scheduling',
  'Visual planning map',
  'Projects, tasks, and content planning',
  'Asset library and file management',
  'Team capacity and assignments',
  'Scheduling and calendar integration',
  'Client portals',
  'AI-assisted hour estimates',
] as const;

export type NucleasPlatformFeature = (typeof NUCLEAS_PLATFORM_FEATURES)[number];

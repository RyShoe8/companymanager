import connectDB from '@/lib/db/mongodb';
import Project from '@/lib/models/Project';
import Client from '@/lib/models/Client';

type ArrayItem = Record<string, unknown>;

function stripPasswordsFromArray(items: unknown): { items: ArrayItem[]; cleared: number } {
  if (!Array.isArray(items)) return { items: [], cleared: 0 };
  let cleared = 0;
  const next = items.map((item) => {
    if (!item || typeof item !== 'object') return item as ArrayItem;
    const o = { ...(item as ArrayItem) };
    if (o.password !== undefined && o.password !== null && o.password !== '') {
      cleared += 1;
    }
    delete o.password;
    return o;
  });
  return { items: next, cleared };
}

function stripDocPasswords(doc: {
  socialLinks?: unknown;
  techStack?: unknown;
  marketingStack?: unknown;
  actionButtons?: unknown;
}): { changed: boolean; passwordsCleared: number } {
  let passwordsCleared = 0;
  let changed = false;

  const social = stripPasswordsFromArray(doc.socialLinks);
  if (social.cleared > 0) {
    doc.socialLinks = social.items;
    passwordsCleared += social.cleared;
    changed = true;
  }

  const tech = stripPasswordsFromArray(doc.techStack);
  if (tech.cleared > 0) {
    doc.techStack = tech.items;
    passwordsCleared += tech.cleared;
    changed = true;
  }

  const marketing = stripPasswordsFromArray(doc.marketingStack);
  if (marketing.cleared > 0) {
    doc.marketingStack = marketing.items;
    passwordsCleared += marketing.cleared;
    changed = true;
  }

  const buttons = stripPasswordsFromArray(doc.actionButtons);
  if (buttons.cleared > 0) {
    doc.actionButtons = buttons.items;
    passwordsCleared += buttons.cleared;
    changed = true;
  }

  return { changed, passwordsCleared };
}

export async function clearStoredPlatformPasswords(): Promise<{
  projectsUpdated: number;
  clientsUpdated: number;
  passwordsCleared: number;
}> {
  await connectDB();

  let projectsUpdated = 0;
  let clientsUpdated = 0;
  let passwordsCleared = 0;

  const projects = await Project.find({
    $or: [
      { 'socialLinks.password': { $exists: true } },
      { 'techStack.password': { $exists: true } },
      { 'marketingStack.password': { $exists: true } },
      { 'actionButtons.password': { $exists: true } },
    ],
  });

  for (const project of projects) {
    const { changed, passwordsCleared: cleared } = stripDocPasswords(project);
    if (changed) {
      await project.save();
      projectsUpdated += 1;
      passwordsCleared += cleared;
    }
  }

  const clients = await Client.find({
    $or: [
      { 'socialLinks.password': { $exists: true } },
      { 'techStack.password': { $exists: true } },
      { 'marketingStack.password': { $exists: true } },
      { 'actionButtons.password': { $exists: true } },
    ],
  });

  for (const client of clients) {
    const { changed, passwordsCleared: cleared } = stripDocPasswords(client);
    if (changed) {
      await client.save();
      clientsUpdated += 1;
      passwordsCleared += cleared;
    }
  }

  return { projectsUpdated, clientsUpdated, passwordsCleared };
}

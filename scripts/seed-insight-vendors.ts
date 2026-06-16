import { join } from 'path';
import { loadEnvLocal } from './loadEnvLocal';
import { seedInsightVendorsFromDirectory } from '@/lib/insights/seedInsightVendorsFromCsv';

loadEnvLocal();

const dir = process.argv[2] ?? join(process.cwd(), 'data', 'insight-seed');

async function main() {
  console.log(`Seeding insight vendors from ${dir}...`);
  const summary = await seedInsightVendorsFromDirectory(dir);

  console.log('Done.');
  console.log(`  Files processed: ${summary.filesProcessed}`);
  console.log(`  Items created:   ${summary.itemsCreated}`);
  console.log(`  Items updated:   ${summary.itemsUpdated}`);
  console.log(`  Vendors created: ${summary.vendorsCreated}`);
  console.log(`  Vendors updated: ${summary.vendorsUpdated}`);
  console.log(`  Rows skipped:    ${summary.rowsSkipped}`);

  if (summary.errors.length > 0) {
    console.warn('Warnings:');
    for (const err of summary.errors) {
      console.warn(`  - ${err}`);
    }
  }

  process.exit(summary.errors.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

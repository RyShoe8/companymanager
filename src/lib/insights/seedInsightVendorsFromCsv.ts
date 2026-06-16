import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import connectDB from '@/lib/db/mongodb';
import InsightCategory from '@/lib/models/InsightCategory';
import InsightItem from '@/lib/models/InsightItem';
import InsightVendor from '@/lib/models/InsightVendor';
import { seedInsightCategoriesIfEmpty } from '@/lib/insights/seedInsightCategories';
import { generateUniqueVendorSlug } from '@/lib/insights/vendorSlug';

export type InsightVendorCsvRow = {
  name: string;
  url: string;
  description: string;
  pricing: string;
};

export type InsightVendorCsvParseResult = {
  rows: InsightVendorCsvRow[];
  skipped: number;
};

const HEADER_ALIASES: Record<keyof InsightVendorCsvRow, string[]> = {
  name: ['company', 'company name', 'name'],
  url: ['url', 'company url', 'link'],
  description: ['description', 'one-sentence description', 'one sentence description'],
  pricing: ['starter price', 'pricing', 'price'],
};

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, ' ');
}

function mapHeaders(headers: string[]): Partial<Record<keyof InsightVendorCsvRow, number>> {
  const mapping: Partial<Record<keyof InsightVendorCsvRow, number>> = {};
  const normalized = headers.map(normalizeHeader);

  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [keyof InsightVendorCsvRow, string[]][]) {
    const index = normalized.findIndex((h) => aliases.includes(h));
    if (index >= 0) mapping[field] = index;
  }

  return mapping;
}

/** Parse a single CSV line respecting double-quoted fields. */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      fields.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  fields.push(current);
  return fields;
}

function pickField(fields: string[], index: number | undefined): string {
  if (index === undefined) return '';
  return (fields[index] ?? '').trim();
}

function isUsableUrl(value: string): boolean {
  const v = value.trim();
  if (!v || /^n\/a/i.test(v)) return false;
  return /^https?:\/\//i.test(v);
}

export function parseInsightVendorCsv(content: string): InsightVendorCsvParseResult {
  const lines = content
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { rows: [], skipped: 0 };
  }

  const headerFields = parseCsvLine(lines[0]);
  const headerMap = mapHeaders(headerFields);

  if (headerMap.name === undefined || headerMap.url === undefined) {
    throw new Error(
      `CSV must include Company and URL columns. Found headers: ${headerFields.join(', ')}`
    );
  }

  const rows: InsightVendorCsvRow[] = [];
  let skipped = 0;

  for (const line of lines.slice(1)) {
    const fields = parseCsvLine(line);
    const name = pickField(fields, headerMap.name);
    const url = pickField(fields, headerMap.url);

    if (!name || !isUsableUrl(url)) {
      skipped++;
      continue;
    }

    rows.push({
      name,
      url,
      description: pickField(fields, headerMap.description),
      pricing: pickField(fields, headerMap.pricing),
    });
  }

  return { rows, skipped };
}

/** Derive insight category slug from a CSV filename. */
export function slugFromCsvFilename(filename: string): string {
  const base = filename.replace(/\.csv$/i, '').trim();
  const nucleasMatch = /^nucleas affiliates\s*-\s*(.+)$/i.exec(base);
  const label = nucleasMatch ? nucleasMatch[1].trim() : base;
  return label.toLowerCase().replace(/\s+/g, '-');
}

export type SeedInsightVendorsSummary = {
  filesProcessed: number;
  itemsCreated: number;
  itemsUpdated: number;
  vendorsCreated: number;
  vendorsUpdated: number;
  rowsSkipped: number;
  errors: string[];
};

export async function seedInsightVendorsFromDirectory(
  dirPath: string
): Promise<SeedInsightVendorsSummary> {
  const summary: SeedInsightVendorsSummary = {
    filesProcessed: 0,
    itemsCreated: 0,
    itemsUpdated: 0,
    vendorsCreated: 0,
    vendorsUpdated: 0,
    rowsSkipped: 0,
    errors: [],
  };

  await connectDB();
  await seedInsightCategoriesIfEmpty();

  let entries: string[];
  try {
    entries = await readdir(dirPath);
  } catch {
    throw new Error(`Seed directory not found: ${dirPath}`);
  }

  const csvFiles = entries.filter((f) => f.toLowerCase().endsWith('.csv')).sort();

  if (csvFiles.length === 0) {
    throw new Error(`No CSV files found in ${dirPath}`);
  }

  for (const filename of csvFiles) {
    const slug = slugFromCsvFilename(filename);
    const category = await InsightCategory.findOne({ slug }).lean();
    if (!category) {
      summary.errors.push(`Unknown category slug "${slug}" from file ${filename}`);
      continue;
    }

    const content = await readFile(join(dirPath, filename), 'utf8');
    let parsed;
    try {
      parsed = parseInsightVendorCsv(content);
    } catch (err) {
      summary.errors.push(
        `${filename}: ${err instanceof Error ? err.message : 'parse error'}`
      );
      continue;
    }

    summary.rowsSkipped += parsed.skipped;
    summary.filesProcessed++;

    let item = await InsightItem.findOne({
      categoryId: category._id,
      title: category.name,
    });

    if (!item) {
      item = await InsightItem.create({
        categoryId: category._id,
        title: category.name,
        description: `Recommended ${category.name.toLowerCase()} tools for your project.`,
        itemOrder: category.stageOrder,
        detectsFromCategorySlug: category.mapsToPlatformCategory || undefined,
        isActive: true,
      });
      summary.itemsCreated++;
    } else {
      let changed = false;
      if (item.itemOrder !== category.stageOrder) {
        item.itemOrder = category.stageOrder;
        changed = true;
      }
      const detectSlug = category.mapsToPlatformCategory || undefined;
      if (item.detectsFromCategorySlug !== detectSlug) {
        item.detectsFromCategorySlug = detectSlug;
        changed = true;
      }
      if (changed) {
        await item.save();
        summary.itemsUpdated++;
      }
    }

    const itemId = item._id;

    for (let i = 0; i < parsed.rows.length; i++) {
      const row = parsed.rows[i];
      const displayOrder = i + 1;

      const vendor = await InsightVendor.findOne({ itemId, name: row.name });

      if (vendor) {
        vendor.description = row.description;
        vendor.pricing = row.pricing;
        vendor.url = row.url;
        vendor.displayOrder = displayOrder;
        vendor.isAffiliate = true;
        vendor.isActive = true;
        await vendor.save();
        summary.vendorsUpdated++;
      } else {
        const vendorSlug = await generateUniqueVendorSlug(row.name);
        await InsightVendor.create({
          itemId,
          name: row.name,
          description: row.description,
          pricing: row.pricing,
          url: row.url,
          vendorSlug,
          isAffiliate: true,
          displayOrder,
          isActive: true,
        });
        summary.vendorsCreated++;
      }
    }
  }

  return summary;
}

interface InsightVendorDto {
  id: string;
  name: string;
  description: string;
  pricing: string;
  url: string;
  vendorSlug: string;
  isAffiliate: boolean;
  displayOrder: number;
}

interface InsightCategoryDto {
  id: string;
  name: string;
  slug: string;
  stageOrder: number;
  icon: string;
}

export interface InsightItemDto {
  id: string;
  title: string;
  description: string;
  itemOrder: number;
  detectsFromCategorySlug?: string;
  category: InsightCategoryDto;
  vendors: InsightVendorDto[];
}

export interface InsightProgress {
  completed: number;
  total: number;
}

export interface CategoryWithStatus extends InsightCategoryDto {
  itemCount: number;
  completedCount: number;
}

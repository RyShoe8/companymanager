import AssetPopoutView from '@/components/assets/AssetPopoutView';

interface AssetViewPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ popout?: string }>;
}

export default async function AssetViewPage({ params, searchParams }: AssetViewPageProps) {
  const { id } = await params;
  const { popout } = await searchParams;
  return <AssetPopoutView assetId={id} popout={popout === '1'} />;
}

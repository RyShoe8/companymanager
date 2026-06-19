import type { IPlatformOperationsFields } from '@/lib/models/platformFields';
import { getPlatformUrlList, syncPlatformUrlFields } from '@/lib/utils/platformUrls';

type ClientUrlFields = Pick<IPlatformOperationsFields, 'url' | 'urls' | 'devUrl' | 'liveUrl'>;

/** @deprecated Use getPlatformUrlList */
export function getClientUrlList(client: ClientUrlFields): string[] {
  return getPlatformUrlList(client);
}

/** @deprecated Use syncPlatformUrlFields */
export function syncClientUrlFields(urls: string[]): Pick<IPlatformOperationsFields, 'urls' | 'devUrl' | 'liveUrl'> {
  return syncPlatformUrlFields(urls);
}

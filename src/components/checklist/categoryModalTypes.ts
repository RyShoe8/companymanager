export type AddSmartButtonPayload =
  | { kind: 'link'; label: string; url: string }
  | { kind: 'email'; email: string; label?: string };

export type PendingAssetPayload = {
  name: string;
  type: 'text' | 'link';
  url?: string;
  textContent?: string;
  linkedProjectId?: string;
  linkedClientId?: string;
  linkedContentItemId?: string;
  linkedProjectTaskId?: string;
  linkedProjectTaskIndex?: number;
  tags?: string[];
};

export type AssetLinkContext = {
  linkedProjectId?: string;
  linkedClientId?: string;
  linkedContentItemId?: string;
  linkedProjectTaskId?: string;
  linkedProjectTaskIndex?: number;
};

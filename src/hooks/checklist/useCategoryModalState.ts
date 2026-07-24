import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { parseSocialLinkInput } from '@/lib/utils/socialUrls';
import type { MediaUploadTarget } from '@/lib/mediaUploadTarget';
import { openGoogleDrivePicker } from '@/lib/google/loadPicker';
import { useGoogleWorkspace } from '@/hooks/google/useGoogleWorkspace';
import type {
  AddSmartButtonPayload,
  AssetLinkContext,
  PendingAssetPayload,
} from '@/components/checklist/categoryModalTypes';

export type AddStep =
  | 'type'
  | 'link'
  | 'email'
  | 'note'
  | 'googleDocument'
  | 'googleSpreadsheet'
  | 'googleFile'
  | 'social'
  | 'screenshot'
  | 'recording';

async function readApiErrorMessage(res: Response, fallback: string): Promise<string> {
  const ct = res.headers.get('content-type') || '';
  try {
    if (ct.includes('application/json')) {
      const data = await res.json();
      if (data && typeof data.error === 'string') return data.error;
      if (data && typeof data.message === 'string') return data.message;
    } else {
      const text = (await res.text()).trim().slice(0, 200);
      if (text) return text;
    }
  } catch {
    // ignore parse failures
  }
  return fallback;
}

interface UseCategoryModalStateOptions {
  projectId?: string;
  clientId?: string;
  onClose: () => void;
  onAddButton: (payload: AddSmartButtonPayload) => Promise<void>;
  onDocumentCreated?: (asset?: unknown) => void;
  linkContext?: AssetLinkContext;
  mode?: 'live' | 'draft';
  onPendingAsset?: (asset: PendingAssetPayload) => void;
  onAddSocial?: (url: string) => Promise<void>;
}

/** Encapsulates all step/form state and submit handlers for CategoryModal's add-asset wizard. */
export function useCategoryModalState({
  projectId,
  clientId,
  onClose,
  onAddButton,
  onDocumentCreated,
  linkContext,
  mode = 'live',
  onPendingAsset,
  onAddSocial,
}: UseCategoryModalStateOptions) {
  const [step, setStep] = useState<AddStep>('type');
  const [addLabel, setAddLabel] = useState('');
  const [addUrl, setAddUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [docName, setDocName] = useState('');
  const [docContent, setDocContent] = useState('');
  const [savingDoc, setSavingDoc] = useState(false);
  const [emailAddr, setEmailAddr] = useState('');
  const [emailLabel, setEmailLabel] = useState('');
  const [addingEmail, setAddingEmail] = useState(false);
  const [socialUrl, setSocialUrl] = useState('');
  const [addingSocial, setAddingSocial] = useState(false);
  const [googleName, setGoogleName] = useState('');
  const [googleBusy, setGoogleBusy] = useState(false);
  const [uploadFileInput, setUploadFileInput] = useState<File | null>(null);
  const effectiveProjectId = linkContext?.linkedProjectId ?? projectId;
  const effectiveClientId = linkContext?.linkedClientId ?? clientId;
  const googleWorkspace = useGoogleWorkspace(linkContext, projectId, clientId);
  const defaultMediaTarget: MediaUploadTarget | null = effectiveProjectId
    ? { entityType: 'project', entityId: effectiveProjectId }
    : effectiveClientId
      ? { entityType: 'client', entityId: effectiveClientId }
      : null;

  const screenshotTarget = useMemo<MediaUploadTarget | null>(() => {
    if (
      linkContext?.linkedProjectTaskId ||
      linkContext?.linkedProjectTaskIndex != null
    ) {
      const entityId = linkContext.linkedProjectId ?? projectId;
      if (!entityId) return null;
      return {
        entityType: 'projectTask',
        entityId,
        taskId: linkContext.linkedProjectTaskId,
        taskIndex: linkContext.linkedProjectTaskIndex,
      };
    }
    if (linkContext?.linkedContentItemId) {
      return {
        entityType: 'contentItem',
        entityId: linkContext.linkedContentItemId,
      };
    }
    const pid = linkContext?.linkedProjectId ?? projectId;
    if (pid) {
      return { entityType: 'project', entityId: pid };
    }
    const cid = linkContext?.linkedClientId ?? clientId;
    if (cid) {
      return { entityType: 'client', entityId: cid };
    }
    return null;
  }, [linkContext, projectId, clientId]);

  const isEntityContext = !!(
    linkContext?.linkedContentItemId ||
    linkContext?.linkedProjectTaskId ||
    linkContext?.linkedProjectTaskIndex != null
  );
  const useAssetFlow = isEntityContext || mode === 'draft';
  const entitySubmitLabel =
    linkContext?.linkedProjectTaskId || linkContext?.linkedProjectTaskIndex != null
      ? 'Add'
      : isEntityContext
        ? 'Add asset'
        : 'Add to project';

  const buildAssetPayload = (partial: Omit<PendingAssetPayload, 'linkedProjectId' | 'linkedClientId'>): PendingAssetPayload => {
    if (effectiveClientId && !effectiveProjectId && !linkContext?.linkedContentItemId && !linkContext?.linkedProjectTaskId && linkContext?.linkedProjectTaskIndex == null) {
      return {
        linkedClientId: effectiveClientId,
        linkedContentItemId: linkContext?.linkedContentItemId,
        linkedProjectTaskId: linkContext?.linkedProjectTaskId,
        linkedProjectTaskIndex: linkContext?.linkedProjectTaskIndex,
        tags: [],
        ...partial,
      };
    }
    return {
      linkedProjectId: effectiveProjectId!,
      linkedContentItemId: linkContext?.linkedContentItemId,
      linkedProjectTaskId: linkContext?.linkedProjectTaskId,
      linkedProjectTaskIndex: linkContext?.linkedProjectTaskIndex,
      tags: [],
      ...partial,
    };
  };

  const saveAsset = async (payload: PendingAssetPayload): Promise<boolean> => {
    if (mode === 'draft') {
      onPendingAsset?.(payload);
      return true;
    }
    try {
      const res = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        onDocumentCreated?.();
        return true;
      }
      const msg = await readApiErrorMessage(res, 'Failed to create asset');
      alert(msg);
      return false;
    } catch {
      alert('Could not create asset. Check your connection and try again.');
      return false;
    }
  };

  const handleEntityLink = async (label: string, url: string) => {
    return saveAsset(buildAssetPayload({ name: label.trim(), type: 'link', url: url.trim() }));
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleAddSubmit = async () => {
    if (!addLabel.trim() || !addUrl.trim()) return;
    setAdding(true);
    try {
      if (useAssetFlow) {
        const ok = await handleEntityLink(addLabel, addUrl);
        if (ok) onClose();
      } else {
        await onAddButton({ kind: 'link', label: addLabel.trim(), url: addUrl.trim() });
        onClose();
      }
    } catch {
      alert('Could not add to project. Please try again.');
    } finally {
      setAdding(false);
    }
  };

  const handleEmailSubmit = async () => {
    if (!emailAddr.trim()) return;
    setAddingEmail(true);
    try {
      if (useAssetFlow) {
        const label = emailLabel.trim() || emailAddr.trim();
        const ok = await handleEntityLink(label, `mailto:${emailAddr.trim()}`);
        if (ok) onClose();
      } else {
        await onAddButton({
          kind: 'email',
          email: emailAddr.trim(),
          ...(emailLabel.trim() ? { label: emailLabel.trim() } : {}),
        });
        onClose();
      }
    } catch {
      alert('Could not add to project. Please try again.');
    } finally {
      setAddingEmail(false);
    }
  };

  const handleNoteSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!docName.trim()) return;
    setSavingDoc(true);
    try {
      const ok = await saveAsset(
        buildAssetPayload({
          name: docName.trim(),
          type: 'text',
          textContent: docContent.trim() || undefined,
        })
      );
      if (ok) onClose();
    } finally {
      setSavingDoc(false);
    }
  };

  const runGoogleAction = async (
    googleStep: 'googleDocument' | 'googleSpreadsheet' | 'googleFile',
    action: () => Promise<unknown | false>
  ) => {
    const connected = await googleWorkspace.ensureConnected({
      step: googleStep,
      linkContext: googleWorkspace.linkFieldsFromContext(),
      draftName: googleName.trim() || undefined,
    });
    if (!connected) return;
    setGoogleBusy(true);
    try {
      const result = await action();
      if (result === false) return;
      googleWorkspace.clearPendingAction();
      onDocumentCreated?.();
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Google action failed');
    } finally {
      setGoogleBusy(false);
    }
  };

  const handleGoogleDocSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!googleName.trim()) return;
    await runGoogleAction('googleDocument', () => googleWorkspace.createDoc(googleName.trim()));
  };

  const handleGoogleSheetSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!googleName.trim()) return;
    await runGoogleAction('googleSpreadsheet', () => googleWorkspace.createSheet(googleName.trim()));
  };

  const handleAttachFromDrive = async () => {
    await runGoogleAction('googleFile', async () => {
      const picked = await openGoogleDrivePicker();
      if (!picked) return false;
      await googleWorkspace.attachPickedFile(picked.id, picked.name);
    });
  };

  const handleUploadToDrive = async () => {
    if (!uploadFileInput) return;
    await runGoogleAction('googleFile', () =>
      googleWorkspace.uploadFile(uploadFileInput, googleName.trim() || uploadFileInput.name)
    );
  };

  useEffect(() => {
    const pending = googleWorkspace.readPendingAction();
    if (!pending || !googleWorkspace.status.connected) return;
    if (pending.draftName) setGoogleName(pending.draftName);
    if (pending.step === 'googleDocument' || pending.step === 'googleSpreadsheet' || pending.step === 'googleFile') {
      setStep(pending.step);
    }
  }, [googleWorkspace.status.connected]);

  const handleSocialSubmit = async () => {
    if (!onAddSocial || !socialUrl.trim()) return;
    const parsed = parseSocialLinkInput(socialUrl);
    if (!parsed) {
      alert('Enter a valid social URL.');
      return;
    }
    setAddingSocial(true);
    try {
      await onAddSocial(parsed.url);
      onClose();
    } catch {
      alert('Failed to save social link.');
    } finally {
      setAddingSocial(false);
    }
  };

  return {
    step,
    setStep,
    addLabel,
    setAddLabel,
    addUrl,
    setAddUrl,
    adding,
    docName,
    setDocName,
    docContent,
    setDocContent,
    savingDoc,
    emailAddr,
    setEmailAddr,
    emailLabel,
    setEmailLabel,
    addingEmail,
    socialUrl,
    setSocialUrl,
    addingSocial,
    googleName,
    setGoogleName,
    googleBusy,
    uploadFileInput,
    setUploadFileInput,
    googleWorkspace,
    defaultMediaTarget,
    screenshotTarget,
    isEntityContext,
    useAssetFlow,
    entitySubmitLabel,
    handleAddSubmit,
    handleEmailSubmit,
    handleNoteSubmit,
    handleGoogleDocSubmit,
    handleGoogleSheetSubmit,
    handleAttachFromDrive,
    handleUploadToDrive,
    handleSocialSubmit,
  };
}

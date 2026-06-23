type PickerTokenResponse = {
  accessToken: string;
  clientId: string;
  apiKey: string;
};

export type PickedDriveFile = {
  id: string;
  name: string;
  mimeType?: string;
  url?: string;
};

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

async function ensurePickerLoaded(): Promise<void> {
  await loadScript('https://apis.google.com/js/api.js');
  await new Promise<void>((resolve, reject) => {
    const gapi = (window as { gapi?: { load: (n: string, cb: () => void) => void } }).gapi;
    if (!gapi) {
      reject(new Error('Google API failed to load'));
      return;
    }
    gapi.load('picker', () => resolve());
  });
}

async function fetchPickerToken(): Promise<PickerTokenResponse> {
  const res = await fetch('/api/google/workspace/picker-token');
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Could not load Google Picker');
  }
  return data;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PickerApi = any;

export async function openGoogleDrivePicker(): Promise<PickedDriveFile | null> {
  await ensurePickerLoaded();
  const { accessToken, clientId, apiKey } = await fetchPickerToken();

  const googlePicker = (window as { google?: { picker: PickerApi } }).google?.picker;
  if (!googlePicker) throw new Error('Google Picker unavailable');

  return new Promise((resolve, reject) => {
    try {
      const picker = new googlePicker.PickerBuilder()
        .addView(googlePicker.ViewId.DOCS)
        .setOAuthToken(accessToken)
        .setDeveloperKey(apiKey)
        .setAppId(clientId)
        .setCallback((data: Record<string, unknown>) => {
          const action = data[googlePicker.Response.ACTION];
          if (action === googlePicker.Action.CANCEL) {
            resolve(null);
            return;
          }
          if (action === googlePicker.Action.PICKED) {
            const docs = data[googlePicker.Response.DOCUMENTS] as
              | Array<Record<string, string>>
              | undefined;
            const doc = docs?.[0];
            if (!doc) {
              resolve(null);
              return;
            }
            resolve({
              id: doc[googlePicker.Document.ID],
              name: doc[googlePicker.Document.NAME],
              mimeType: doc[googlePicker.Document.MIME_TYPE],
              url: doc[googlePicker.Document.URL],
            });
          }
        })
        .build();
      picker.setVisible(true);
    } catch (err) {
      reject(err);
    }
  });
}

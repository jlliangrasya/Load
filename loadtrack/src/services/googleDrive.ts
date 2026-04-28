const CLIENT_ID = '492736297225-770ssl3gdqr350cvmd63av3ept2h8f6q.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';

let tokenClient: google.accounts.oauth2.TokenClient | null = null;
let accessToken: string | null = null;

/** Load the Google Identity Services + Drive API scripts */
export async function loadGoogleApi(): Promise<void> {
  // Load GIS (Google Identity Services)
  if (!document.getElementById('google-gis')) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.id = 'google-gis';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
      document.head.appendChild(script);
    });
  }

  // Load gapi
  if (!document.getElementById('google-gapi')) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.id = 'google-gapi';
      script.src = 'https://apis.google.com/js/api.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google API'));
      document.head.appendChild(script);
    });
  }

  // Initialize gapi client
  await new Promise<void>((resolve, reject) => {
    gapi.load('client', async () => {
      try {
        await gapi.client.init({});
        await gapi.client.load(DISCOVERY_DOC);
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });
}

/** Initialize the OAuth token client */
export function initTokenClient(onSuccess: () => void, onError: (err: string) => void) {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: (response) => {
      if (response.error) {
        onError(response.error);
        return;
      }
      accessToken = response.access_token;
      // Store token with expiry
      const expiresAt = Date.now() + (response.expires_in ?? 3600) * 1000;
      localStorage.setItem('gdrive_token', accessToken);
      localStorage.setItem('gdrive_token_expires', String(expiresAt));
      onSuccess();
    },
  });
}

/** Request user sign-in */
export function signIn() {
  if (!tokenClient) throw new Error('Token client not initialized');
  tokenClient.requestAccessToken({ prompt: 'consent' });
}

/** Sign out and revoke token */
export function signOut() {
  if (accessToken) {
    google.accounts.oauth2.revoke(accessToken, () => {});
  }
  accessToken = null;
  localStorage.removeItem('gdrive_token');
  localStorage.removeItem('gdrive_token_expires');
  localStorage.removeItem('gdrive_user_email');
}

/** Check if we have a valid stored token */
export function restoreToken(): boolean {
  const token = localStorage.getItem('gdrive_token');
  const expires = localStorage.getItem('gdrive_token_expires');
  if (token && expires && Date.now() < Number(expires)) {
    accessToken = token;
    gapi.client.setToken({ access_token: token });
    return true;
  }
  return false;
}

/** Get current user email */
export async function getUserEmail(): Promise<string | null> {
  if (!accessToken) return null;
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const email = data.email as string;
    localStorage.setItem('gdrive_user_email', email);
    return email;
  } catch {
    return localStorage.getItem('gdrive_user_email');
  }
}

export function isSignedIn(): boolean {
  return !!accessToken;
}

// ─── Drive File Operations ───────────────────────────────────────────

const FOLDER_NAME = 'LoadTrack';
const SUBFOLDER_NAME = 'Signatures';

let signaturesFolderId: string | null = null;

/** Find or create a folder by name under an optional parent */
async function findOrCreateFolder(name: string, parentId?: string): Promise<string> {
  const q = parentId
    ? `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
    : `name='${name}' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`;

  const res = await gapi.client.drive.files.list({ q, fields: 'files(id)', spaces: 'drive' });
  const files = res.result.files;
  if (files && files.length > 0) return files[0].id!;

  // Create folder
  const createRes = await gapi.client.drive.files.create({
    resource: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parentId ? { parents: [parentId] } : {}),
    },
    fields: 'id',
  });
  return createRes.result.id!;
}

/** Get or create the LoadTrack/Signatures folder */
async function getSignaturesFolder(): Promise<string> {
  if (signaturesFolderId) return signaturesFolderId;
  const rootFolderId = await findOrCreateFolder(FOLDER_NAME);
  signaturesFolderId = await findOrCreateFolder(SUBFOLDER_NAME, rootFolderId);
  return signaturesFolderId;
}

/** Convert a base64 data URL to a Blob */
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64Data] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

/**
 * Upload a signature image to Google Drive.
 * Returns the Drive file ID.
 */
export async function uploadSignature(dataUrl: string, fileName: string): Promise<string> {
  if (!accessToken) throw new Error('Not signed in to Google Drive');

  const folderId = await getSignaturesFolder();
  const blob = dataUrlToBlob(dataUrl);

  const metadata = {
    name: fileName,
    mimeType: 'image/jpeg',
    parents: [folderId],
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', blob);

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Upload failed: ${err}`);
  }

  const data = await res.json();
  return data.id as string;
}

/**
 * Get a direct image URL for a Drive file.
 * Uses the thumbnail link which doesn't require auth for shared files,
 * or fetches the blob directly with auth for private files.
 */
export async function getSignatureUrl(fileId: string): Promise<string> {
  if (!accessToken) throw new Error('Not signed in to Google Drive');

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) throw new Error('Failed to fetch signature image');

  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/**
 * Build the signature_image string to store in the database.
 * Format: "drive::FILE_ID::filename.jpg"
 */
export function buildDriveRef(fileId: string, fileName: string): string {
  return `drive::${fileId}::${fileName}`;
}

/**
 * Parse a drive reference string.
 * Returns null if the string is not a drive reference.
 */
export function parseDriveRef(value: string): { fileId: string; fileName: string } | null {
  if (!value.startsWith('drive::')) return null;
  const parts = value.split('::');
  if (parts.length < 3) return null;
  return { fileId: parts[1], fileName: parts.slice(2).join('::') };
}

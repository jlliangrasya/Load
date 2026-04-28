import { useCallback } from 'react';
import { useGoogleDrive } from '../contexts/GoogleDriveContext';
import { uploadSignature, buildDriveRef, isSignedIn } from '../services/googleDrive';

/**
 * Hook that handles uploading a signature to Google Drive.
 * Google Drive must be connected — there is no base64 fallback.
 */
export function useSignatureUpload() {
  const { signedIn } = useGoogleDrive();

  /** Whether signatures can be saved (Drive connected + online) */
  const canSave = signedIn && isSignedIn() && navigator.onLine;

  const processSignature = useCallback(async (
    dataUrl: string,
    clientName: string,
    type: 'payment' | 'collection' = 'payment',
  ): Promise<string> => {
    // Text confirmations are never uploaded
    if (dataUrl.startsWith('text-confirm::')) return dataUrl;

    if (!signedIn || !isSignedIn()) {
      throw new Error('NOT_CONNECTED');
    }

    if (!navigator.onLine) {
      throw new Error('OFFLINE');
    }

    const safeName = clientName.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_');
    const date = new Date().toISOString().split('T')[0];
    const timestamp = Date.now();
    const fileName = `${type}_${safeName}_${date}_${timestamp}.jpg`;

    const fileId = await uploadSignature(dataUrl, fileName);
    return buildDriveRef(fileId, fileName);
  }, [signedIn]);

  return { processSignature, canSave };
}

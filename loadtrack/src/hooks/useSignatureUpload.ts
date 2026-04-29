import { useCallback } from 'react';
import { useGoogleDrive } from '../contexts/GoogleDriveContext';
import { uploadSignature, buildDriveRef, isSignedIn } from '../services/googleDrive';

export function useSignatureUpload() {
  const { signedIn } = useGoogleDrive();

  const driveConnected = signedIn && isSignedIn() && navigator.onLine;

  const processSignature = useCallback(async (
    dataUrl: string,
    clientName: string,
    type: 'payment' | 'collection' = 'payment',
  ): Promise<string> => {
    // Text confirmations and base64 fallbacks are stored as-is
    if (dataUrl.startsWith('text-confirm::') || dataUrl.startsWith('data:')) {
      return dataUrl;
    }

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

  return { processSignature, driveConnected };
}

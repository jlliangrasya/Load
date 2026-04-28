import { useState, useEffect } from 'react';
import { parseDriveRef, getSignatureUrl } from '../../services/googleDrive';
import { useGoogleDrive } from '../../contexts/GoogleDriveContext';

interface SignatureImageProps {
  signatureImage: string;
  alt?: string;
  className?: string;
}

/**
 * Smart signature image component that handles:
 * - "drive::FILE_ID::filename" → fetches from Google Drive
 * - "data:image/..." → displays base64 directly
 * - "text-confirm::..." → shows text confirmation
 */
export default function SignatureImage({ signatureImage, alt = 'Client signature', className = 'w-full h-auto' }: SignatureImageProps) {
  const { signedIn } = useGoogleDrive();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const driveRef = parseDriveRef(signatureImage);

  useEffect(() => {
    if (!driveRef) return;

    if (!signedIn) {
      setError(true);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(false);

    getSignatureUrl(driveRef.fileId)
      .then(url => {
        if (!cancelled) {
          setImageUrl(url);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      // Revoke the object URL to prevent memory leaks
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driveRef?.fileId, signedIn]);

  // Text confirmation
  if (signatureImage.startsWith('text-confirm::')) {
    const parts = signatureImage.split('::');
    const name = parts[1] || '';
    const timestamp = parts[2] || '';
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
        <p className="text-xs text-blue-500 mb-1.5 font-medium">Confirmed by typing name</p>
        <p className="text-base font-bold text-gray-800">{name}</p>
        {timestamp && (
          <p className="text-xs text-gray-400 mt-1.5">
            {new Date(timestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
    );
  }

  // Base64 data URL (legacy)
  if (signatureImage.startsWith('data:image')) {
    return <img src={signatureImage} alt={alt} className={className} />;
  }

  // Google Drive reference
  if (driveRef) {
    if (loading) {
      return (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-center">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading signature...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center space-y-1">
          <p className="text-sm text-amber-700 font-medium">
            {signedIn ? 'Could not load signature' : 'Not connected to Google Drive'}
          </p>
          <p className="text-xs text-amber-600">
            {signedIn
              ? 'Check your internet connection and try again.'
              : 'Go to Settings and connect Google Drive to view this signature.'}
          </p>
        </div>
      );
    }

    if (imageUrl) {
      return <img src={imageUrl} alt={alt} className={className} />;
    }
  }

  // Fallback
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
      <p className="text-sm text-gray-400">No signature available</p>
    </div>
  );
}

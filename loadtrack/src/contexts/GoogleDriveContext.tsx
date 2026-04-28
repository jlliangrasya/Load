import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import {
  loadGoogleApi,
  initTokenClient,
  signIn as driveSignIn,
  signOut as driveSignOut,
  restoreToken,
  getUserEmail,
  isSignedIn as checkSignedIn,
} from '../services/googleDrive';

interface GoogleDriveCtx {
  ready: boolean;
  signedIn: boolean;
  userEmail: string | null;
  loading: boolean;
  signIn: () => void;
  signOut: () => void;
}

const GoogleDriveContext = createContext<GoogleDriveCtx>({
  ready: false,
  signedIn: false,
  userEmail: null,
  loading: true,
  signIn: () => {},
  signOut: () => {},
});

export function GoogleDriveProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        await loadGoogleApi();

        initTokenClient(
          // onSuccess
          async () => {
            if (cancelled) return;
            setSignedIn(true);
            const email = await getUserEmail();
            setUserEmail(email);
          },
          // onError
          (err) => {
            console.error('Google sign-in error:', err);
          }
        );

        // Try to restore a previous session
        const restored = restoreToken();
        if (restored && checkSignedIn()) {
          if (!cancelled) {
            setSignedIn(true);
            const email = await getUserEmail();
            if (!cancelled) setUserEmail(email);
          }
        }

        if (!cancelled) setReady(true);
      } catch (err) {
        console.error('Failed to initialize Google Drive:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  const signIn = useCallback(() => {
    driveSignIn();
  }, []);

  const signOut = useCallback(() => {
    driveSignOut();
    setSignedIn(false);
    setUserEmail(null);
  }, []);

  return (
    <GoogleDriveContext.Provider value={{ ready, signedIn, userEmail, loading, signIn, signOut }}>
      {children}
    </GoogleDriveContext.Provider>
  );
}

export const useGoogleDrive = () => useContext(GoogleDriveContext);

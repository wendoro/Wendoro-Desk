import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  FirestoreConnectionState,
  OperationType,
  auth,
  db,
  firebaseProjectConfig,
  googleProvider,
  handleFirestoreError,
  isFirebaseConfigured,
  testFirestoreConnection,
} from '@/src/lib/firebase';

interface FirebaseContextValue {
  user: User | null;
  authReady: boolean;
  connectionState: FirestoreConnectionState;
  isConfigured: boolean;
  projectId: string;
  firestoreDatabaseId: string;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  syncWorkspacePresence: (params: {
    companyId: string;
    companyName: string;
    activeRoute: string;
  }) => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

function sanitizeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
}

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!isFirebaseConfigured);
  const [connectionState, setConnectionState] = useState<FirestoreConnectionState>(
    isFirebaseConfigured ? 'checking' : 'unconfigured',
  );
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth || !db) {
      setAuthReady(true);
      setConnectionState('unconfigured');
      return;
    }

    const firestoreDb = db;
    let active = true;
    testFirestoreConnection().then((state) => {
      if (active) setConnectionState(state);
    });

    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      if (!active) return;
      setUser(nextUser);
      setAuthReady(true);

      if (nextUser && nextUser.emailVerified && nextUser.email) {
        const uid = sanitizeId(nextUser.uid);
        const profilePath = `users/${uid}/private/profile`;
        try {
          const profileRef = doc(firestoreDb, 'users', uid, 'private', 'profile');
          const snap = await getDoc(profileRef);
          const fullName = (nextUser.displayName || nextUser.email).slice(0, 120);
          const email = nextUser.email.slice(0, 254);

          if (!snap.exists()) {
            await setDoc(profileRef, {
              uid,
              email,
              fullName,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } else {
            await updateDoc(profileRef, {
              email,
              fullName,
              updatedAt: serverTimestamp(),
            });
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, profilePath);
        }
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    setAuthError(null);
    if (!auth) {
      setAuthError(
        'Firebase is not configured in this deployment. Add VITE_FIREBASE_* variables or firebase-applet-config.json.',
      );
      return;
    }
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Unable to complete Google sign-in.';
      setAuthError(msg);
    }
  };

  const signOutUser = async () => {
    setAuthError(null);
    if (!auth) return;
    await signOut(auth);
  };

  const syncWorkspacePresence = async ({
    companyId,
    companyName,
    activeRoute,
  }: {
    companyId: string;
    companyName: string;
    activeRoute: string;
  }) => {
    if (!db || !authReady || !user || !user.emailVerified) return;

    const uid = sanitizeId(user.uid);
    const safeCompanyId = sanitizeId(companyId);
    const workspacePath = `workspaces/${safeCompanyId}`;
    const memberPath = `workspaces/${safeCompanyId}/members/${uid}`;
    const presencePath = `workspaces/${safeCompanyId}/presence/${uid}`;

    try {
      const wsRef = doc(db, 'workspaces', safeCompanyId);
      const wsSnap = await getDoc(wsRef);
      if (!wsSnap.exists()) {
        await setDoc(wsRef, {
          companyId: safeCompanyId,
          ownerUid: uid,
          companyName: companyName.slice(0, 120),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      const memberRef = doc(db, 'workspaces', safeCompanyId, 'members', uid);
      const memberSnap = await getDoc(memberRef);
      if (!memberSnap.exists()) {
        await setDoc(memberRef, {
          uid,
          companyId: safeCompanyId,
          role: 'owner',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${workspacePath} / ${memberPath}`);
    }

    try {
      const presenceRef = doc(db, 'workspaces', safeCompanyId, 'presence', uid);
      await setDoc(presenceRef, {
        uid,
        companyId: safeCompanyId,
        displayName: (user.displayName || user.email || 'Operator').slice(0, 100),
        status: 'online',
        activeRoute: activeRoute.slice(0, 80),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, presencePath);
    }
  };

  return (
    <FirebaseContext.Provider
      value={{
        user,
        authReady,
        connectionState,
        isConfigured: isFirebaseConfigured,
        projectId: firebaseProjectConfig?.projectId ?? 'not-configured',
        firestoreDatabaseId: firebaseProjectConfig?.firestoreDatabaseId ?? 'not-configured',
        authError,
        signInWithGoogle,
        signOutUser,
        syncWorkspacePresence,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
}

export function useFirebase(): FirebaseContextValue {
  const ctx = useContext(FirebaseContext);
  if (!ctx) {
    throw new Error('useFirebase must be used within FirebaseProvider');
  }
  return ctx;
}

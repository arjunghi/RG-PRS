import React, { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut as firebaseSignOut } from "firebase/auth";
import { auth, db } from "./firebaseClient";
import { doc, getDoc, setDoc, deleteDoc, onSnapshot } from "firebase/firestore";

interface AppUser extends User {
  appRole?: "admin" | "incharge" | "teacher" | "staff" | "student" | "guest";
  status?: "approved" | "pending" | "rejected" | "unregistered";
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  accessToken: string | null;
  setAccessToken: (token: string | null) => void;
  reconnectGoogle: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
  accessToken: null,
  setAccessToken: () => {},
  reconnectGoogle: async () => null,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(() => {
     return localStorage.getItem("google_access_token");
  });

  useEffect(() => {
    let unsubUserDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubUserDoc) {
        unsubUserDoc();
        unsubUserDoc = null;
      }

      if (firebaseUser) {
        const email = firebaseUser.email || "";
        const cacheKey = `app_user_role_${firebaseUser.uid}`;
        
        // 1. Determine a base default role and check cache first
        let appRole: "admin" | "incharge" | "teacher" | "staff" | "student" | "guest" = "guest";
        let status: "approved" | "pending" | "rejected" | "unregistered" = "unregistered";
        if (email.toLowerCase().trim() === "arjun@rajarshigurukul.edu.np") {
          appRole = "admin";
          status = "approved";
        }
        
        let hasCachedRole = false;
        
        const cachedRole = localStorage.getItem(cacheKey);
        if (cachedRole) {
          appRole = cachedRole as any;
          hasCachedRole = true;
        }
        const cachedStatus = localStorage.getItem(`${cacheKey}_status`);
        if (cachedStatus) {
          status = cachedStatus as any;
        }

        // Optimistically set the user
        const enrichedUser = firebaseUser as AppUser;
        setUser({
          ...enrichedUser,
          appRole,
          status,
          role: appRole,
        });
        
        // Only release loading UI if we have cache or it's admin, otherwise wait for DB
        if (hasCachedRole || email.toLowerCase().trim() === "arjun@rajarshigurukul.edu.np") {
           setLoading(false);
        }

        // 2. Fetch or create user document to get/update roles in the background
        try {
          const userDocRef = doc(db, "users", firebaseUser.uid);
          const emailKey = email.toLowerCase().trim();
          
          if (emailKey) {
             try {
                const emailDocRef = doc(db, "users", emailKey);
                const emailSnap = await getDoc(emailDocRef);
                if (emailSnap.exists()) {
                   const enrollData = emailSnap.data();
                   
                   // Migrate or merge pre-enrolled fields into the secure UID document
                   await setDoc(userDocRef, {
                      ...enrollData,
                      email: emailKey, // ensure normalized email is set
                      updatedAt: new Date().toISOString()
                   }, { merge: true });
                   
                   // Delete the email-keyed document to prevent duplicate rows in user registries
                   try {
                      await deleteDoc(emailDocRef);
                    } catch(e) {
                      console.warn("Could not delete processed email-keyed user doc:", e);
                    }
                }
             } catch(errSnap) {
                 console.warn("Failed pre-enrolled check or migration:", errSnap);
             }
          }
          
          // Setup real-time snapshot on the user's secure document
          unsubUserDoc = onSnapshot(userDocRef, (snap) => {
             let finalData: any = {};
             let snapshotAppRole = appRole;
             let snapshotStatus = status;
             let snapshotDisplayName = firebaseUser.displayName || email;

             if (!snap.exists()) {
                // Create initial profile
                setDoc(userDocRef, {
                  email: emailKey,
                  name: snapshotDisplayName,
                  role: String(appRole),
                  status: String(status),
                  createdAt: new Date().toISOString()
                });
             } else {
                finalData = snap.data();
                snapshotAppRole = finalData.role || snapshotAppRole;
                snapshotStatus = finalData.status || snapshotStatus;
                snapshotDisplayName = finalData.name || snapshotDisplayName;
             }

             if (emailKey === "arjun@rajarshigurukul.edu.np") {
                snapshotAppRole = "admin";
                snapshotStatus = "approved";
             }

             // Cache verified role and status
             localStorage.setItem(cacheKey, snapshotAppRole);
             localStorage.setItem(`${cacheKey}_status`, snapshotStatus);

             setUser({
               ...firebaseUser,
               ...finalData,
               role: snapshotAppRole, // Expose legacy role
               appRole: snapshotAppRole as any,
               status: snapshotStatus as any,
               displayName: snapshotDisplayName
             } as AppUser);
             
             setLoading(false);
          }, (err) => {
             console.warn("Error in user doc snapshot listener:", err);
             setLoading(false);
          });

        } catch (err) {
           console.warn("Profile sync from Firebase failed. Using fallback role:", appRole, err);
           setLoading(false);
        }
      } else {
        setUser(null);
        setAccessToken(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubUserDoc) unsubUserDoc();
    };
  }, []);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    provider.addScope("https://www.googleapis.com/auth/spreadsheets");
    provider.addScope("https://www.googleapis.com/auth/drive.file");
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      localStorage.setItem("google_access_token", credential.accessToken);
      setAccessToken(credential.accessToken);
    }
  };

  const reconnectGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope("https://www.googleapis.com/auth/spreadsheets");
      provider.addScope("https://www.googleapis.com/auth/drive.file");
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        localStorage.setItem("google_access_token", credential.accessToken);
        setAccessToken(credential.accessToken);
        return credential.accessToken;
      }
      return null;
    } catch (err) {
      console.error("Failed to reconnect Google scopes:", err);
      return null;
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setAccessToken(null);
    localStorage.removeItem("google_access_token");
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("app_user_role_")) {
        localStorage.removeItem(key);
        i--; // Adjust index due to mutation
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, accessToken, setAccessToken, reconnectGoogle }}>
      {children}
    </AuthContext.Provider>
  );
};

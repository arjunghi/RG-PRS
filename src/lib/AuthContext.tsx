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
        const emailKey = email.toLowerCase().trim();
        const isAbsoluteAdminEmail = 
          emailKey === "arjun@rajarshigurukul.edu.np" || 
          emailKey === "arjunrajarshigurukul@gmail.com";
        
        let initialRole: "admin" | "incharge" | "teacher" | "staff" | "student" | "guest" = "guest";
        let initialStatus: "approved" | "pending" | "rejected" | "unregistered" = "unregistered";
        
        if (isAbsoluteAdminEmail) {
          initialRole = "admin";
          initialStatus = "approved";
        }
        
        // Optimistically set the user with appropriate starting privilege
        const enrichedUser = firebaseUser as AppUser;
        setUser({
          ...enrichedUser,
          appRole: initialRole,
          status: initialStatus,
          role: initialRole,
        });
        
        setLoading(false);

        // 2. Fetch or create user document to get/update roles in the background
        try {
          const userDocRef = doc(db, "users", firebaseUser.uid);
          
          // One-time check of the secure user document first
          const userSnap = await getDoc(userDocRef);
          
          if (!userSnap.exists()) {
             // User is logging in for the very first time on this secure ID.
             let initialData: any = {
                email: emailKey,
                name: firebaseUser.displayName || email,
                role: isAbsoluteAdminEmail ? "admin" : "guest",
                status: isAbsoluteAdminEmail ? "approved" : "unregistered",
                createdAt: new Date().toISOString()
             };
             
             if (emailKey) {
                try {
                   const emailDocRef = doc(db, "users", emailKey);
                   const emailSnap = await getDoc(emailDocRef);
                   if (emailSnap.exists()) {
                      const enrollData = emailSnap.data();
                      // Migrate pre-enrolled fields into the secure UID document
                      initialData = {
                         ...initialData,
                         ...enrollData,
                         email: emailKey, // Ensure normalized lowercase email
                         createdAt: enrollData.createdAt || new Date().toISOString(),
                         updatedAt: new Date().toISOString()
                      };
                      
                      // Delete the temporary email-keyed document
                      try {
                         await deleteDoc(emailDocRef);
                      } catch(e) {
                         console.warn("Could not delete processed email-keyed user doc:", e);
                      }
                   }
                } catch(errSnap) {
                     console.warn("Failed pre-enrolled check or migration check:", errSnap);
                }
             }
             
             await setDoc(userDocRef, initialData);
          }
          
          // Now set up the real-time observer, secure in the knowledge the document exists
          unsubUserDoc = onSnapshot(userDocRef, (snap) => {
             if (snap.exists()) {
                const finalData = snap.data();
                let snapshotAppRole = finalData.role || "guest";
                let snapshotStatus = finalData.status || "unregistered";
                let snapshotDisplayName = finalData.name || firebaseUser.displayName || email;

                if (isAbsoluteAdminEmail) {
                   snapshotAppRole = "admin";
                   snapshotStatus = "approved";
                }

                setUser({
                  ...firebaseUser,
                  ...finalData,
                  role: snapshotAppRole, // Expose legacy role
                  appRole: snapshotAppRole as any,
                  status: snapshotStatus as any,
                  displayName: snapshotDisplayName
                } as AppUser);
             }
             setLoading(false);
          }, (err) => {
             console.warn("Error in user doc snapshot listener:", err);
             setLoading(false);
          });

        } catch (err) {
           console.warn("Profile sync from Firebase failed:", err);
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

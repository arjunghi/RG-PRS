import React, { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut as firebaseSignOut } from "firebase/auth";
import { auth, db } from "./firebaseClient";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";

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
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const email = firebaseUser.email || "";
        const cacheKey = `app_user_role_${firebaseUser.uid}`;
        
        // 1. Determine a base default role and check cache first
        let appRole: "admin" | "incharge" | "teacher" | "staff" | "student" | "guest" = "guest";
        let status: "approved" | "pending" | "rejected" | "unregistered" = "unregistered";
        if (email === "arjun@rajarshigurukul.edu.np") {
          appRole = "admin";
          status = "approved";
        }
        
        const cachedRole = localStorage.getItem(cacheKey);
        if (cachedRole) {
          appRole = cachedRole as any;
        }
        const cachedStatus = localStorage.getItem(`${cacheKey}_status`);
        if (cachedStatus) {
          status = cachedStatus as any;
        }

        // Optimistically set the user and release loading UI so app starts instantly
        const enrichedUser = firebaseUser as AppUser;
        enrichedUser.appRole = appRole;
        enrichedUser.status = status;
        setUser(enrichedUser);
        setLoading(false);

        // 2. Fetch or create user document to get/update roles in the background
        try {
          const userDocRef = doc(db, "users", firebaseUser.uid);
          let userSnap = await getDoc(userDocRef);
          
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
                   
                   // Refresh our user snapshot from Firestore
                   userSnap = await getDoc(userDocRef);
                   
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
          
          let displayName = firebaseUser.displayName || email;
          if (!userSnap.exists()) {
             // Create initial profile
             await setDoc(userDocRef, {
               email: emailKey,
               name: displayName,
               role: String(appRole),
               status: String(status),
               createdAt: new Date().toISOString()
             });
          } else {
             const data = userSnap.data();
             appRole = data.role || appRole;
             status = data.status || status;
             displayName = data.name || displayName;
          }

          if (emailKey === "arjun@rajarshigurukul.edu.np") {
             appRole = "admin";
             status = "approved";
             // Cleanly update status & role in firestore as well
             await setDoc(userDocRef, { role: "admin", status: "approved" }, { merge: true });
          }
          
          // Cache verified role and update user state if changed
          localStorage.setItem(cacheKey, appRole);
          localStorage.setItem(`${cacheKey}_status`, status);
          
          // Re-fetch document snapshot optionally to have newest admin data as well
          const finalSnap = await getDoc(userDocRef);
          const finalData = finalSnap.exists() ? finalSnap.data() : {};

          const updatedUser = { 
            ...enrichedUser, 
            ...finalData,
            appRole, 
            status, 
            displayName 
          } as AppUser;
          setUser(updatedUser);
        } catch (err) {
          console.warn("Profile sync from Firebase failed. Using fallback role:", appRole, err);
        }
      } else {
        setUser(null);
        setAccessToken(null);
        setLoading(false);
      }
    });

    return unsubscribe;
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
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, accessToken, setAccessToken, reconnectGoogle }}>
      {children}
    </AuthContext.Provider>
  );
};

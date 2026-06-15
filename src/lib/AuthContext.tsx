import React, { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut as firebaseSignOut } from "firebase/auth";
import { auth, db } from "./firebaseClient";
import { doc, getDoc, setDoc } from "firebase/firestore";

interface AppUser extends User {
  appRole?: "admin" | "teacher" | "staff" | "student";
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
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const email = firebaseUser.email || "";
        const cacheKey = `app_user_role_${firebaseUser.uid}`;
        
        // 1. Determine a base default role and check cache first
        let appRole: "admin" | "teacher" | "staff" | "student" = "student";
        if (email === "arjun@rajarshigurukul.edu.np") {
          appRole = "admin";
        }
        
        const cachedRole = localStorage.getItem(cacheKey);
        if (cachedRole) {
          appRole = cachedRole as any;
        }

        // 2. Fetch or create user document to get roles with offline resilience
        try {
          const userDocRef = doc(db, "users", firebaseUser.uid);
          let userSnap = await getDoc(userDocRef);
          
          let targetDocRef = userDocRef;
          
          if (!userSnap.exists() && email) {
            const emailDocRef = doc(db, "users", email);
            const emailSnap = await getDoc(emailDocRef);
            if (emailSnap.exists()) {
               userSnap = emailSnap;
               targetDocRef = emailDocRef;
            }
          }
          
          if (!userSnap.exists()) {
             // Create initial profile
             await setDoc(targetDocRef, {
               email: email,
               name: firebaseUser.displayName || email,
               role: appRole,
               createdAt: new Date().toISOString()
             });
          } else {
             appRole = userSnap.data().role || appRole;
          }
          
          // Cache verified role
          localStorage.setItem(cacheKey, appRole);
        } catch (err) {
          console.warn("Profile sync from Firebase failed (may be offline / internet connection flaky). Using offline fallback role:", appRole, err);
        }
        
        const enrichedUser = firebaseUser as AppUser;
        enrichedUser.appRole = appRole;
        setUser(enrichedUser);
      } else {
        setUser(null);
        setAccessToken(null);
      }
      setLoading(false);
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

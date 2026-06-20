import React, { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut as firebaseSignOut } from "firebase/auth";
import { auth, db } from "./firebaseClient";
import { doc, getDoc, setDoc, deleteDoc, onSnapshot } from "firebase/firestore";

interface AppUser extends User {
  appRole?: "admin" | "incharge" | "teacher" | "staff" | "student" | "guest";
  status?: "approved" | "pending" | "rejected" | "unregistered";
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

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
        
        let initialRole: "admin" | "incharge" | "teacher" | "staff" | "student" | "guest" = "teacher";
        let initialStatus: "approved" | "pending" | "rejected" | "unregistered" = "approved";
        
        if (isAbsoluteAdminEmail) {
          initialRole = "admin";
          initialStatus = "approved";
        }
        
        const enrichedUser = firebaseUser as AppUser;
        setUser({
          ...enrichedUser,
          appRole: initialRole,
          status: initialStatus,
          role: initialRole,
        });
        
        setLoading(false);

        try {
          const userDocRef = doc(db, "users", firebaseUser.uid);
          const userSnap = await getDoc(userDocRef);
          
          if (!userSnap.exists()) {
             let initialData: any = {
                email: emailKey,
                name: firebaseUser.displayName || email.split("@")[0],
                role: isAbsoluteAdminEmail ? "admin" : "teacher",
                status: "approved",
                createdAt: new Date().toISOString()
             };
             
             if (emailKey) {
                try {
                   // Clean up temporary email-keyed pre-enrollment if it exists
                   const emailDocRef = doc(db, "users", emailKey);
                   const emailSnap = await getDoc(emailDocRef);
                   if (emailSnap.exists()) {
                      const enrollData = emailSnap.data();
                      initialData = {
                         ...initialData,
                         ...enrollData,
                         email: emailKey,
                         createdAt: enrollData.createdAt || new Date().toISOString(),
                         updatedAt: new Date().toISOString()
                      };
                      
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
          
          unsubUserDoc = onSnapshot(userDocRef, (snap) => {
             if (snap.exists()) {
                const finalData = snap.data();
                let snapshotAppRole = finalData.role || "teacher";
                let snapshotStatus = finalData.status || "approved";
                let snapshotDisplayName = finalData.name || firebaseUser.displayName || email.split("@")[0];

                if (snapshotAppRole === "guest" || snapshotAppRole === "unregistered") {
                   snapshotAppRole = "teacher";
                }
                if (snapshotStatus === "unregistered") {
                   snapshotStatus = "approved";
                }

                if (isAbsoluteAdminEmail) {
                   snapshotAppRole = "admin";
                   snapshotStatus = "approved";
                }

                setUser({
                  ...firebaseUser,
                  ...finalData,
                  role: snapshotAppRole,
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
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubUserDoc) unsubUserDoc();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const emailKey = email.toLowerCase().trim();
    if (!emailKey || !password) {
       throw new Error("Email and password are required.");
    }
    
    try {
      await signInWithEmailAndPassword(auth, emailKey, password);
    } catch (err: any) {
      if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential" || err.code === "auth/cannot-find-user" || err.code === "auth/invalid-email" || err.code === "auth/wrong-password") {
        // Find if this email was pre-enrolled/invited by Admin
        const userDocRef = doc(db, "users", emailKey);
        const userSnap = await getDoc(userDocRef);
        
        const isAbsoluteAdminEmail = 
          emailKey === "arjun@rajarshigurukul.edu.np" || 
          emailKey === "arjunrajarshigurukul@gmail.com";
          
        if (userSnap.exists() || isAbsoluteAdminEmail) {
          // If the profile exists or if they are the designated system admin, create the Firebase Auth account!
          // We automatic-create on first login with the chosen password.
          try {
            await createUserWithEmailAndPassword(auth, emailKey, password);
            return;
          } catch (createErr: any) {
            throw new Error(`Connection failed. If you already logged in before, please double check your password. Original error: ${createErr.message}`);
          }
        }
      }
      throw err;
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("app_user_role_")) {
        localStorage.removeItem(key);
        i--;
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

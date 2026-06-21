import React, { createContext, useContext, useEffect, useState } from "react";
import { db } from "./firebaseClient";
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from "firebase/firestore";

export interface AppUser {
  uid: string; // Will store the lowercase email
  email: string;
  name: string;
  displayName?: string;
  role?: "admin" | "incharge" | "teacher" | "eca_teacher" | "staff" | "student" | "guest";
  appRole?: "admin" | "incharge" | "teacher" | "eca_teacher" | "staff" | "student" | "guest";
  status?: "approved" | "pending" | "rejected" | "unregistered";
  createdAt?: string;
  password?: string;
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
    // 1. Initial Load - Check for custom session from localStorage
    const savedEmail = localStorage.getItem("rg_prs_user_session_email");
    let unsubUserDoc: (() => void) | null = null;

    if (savedEmail) {
      const emailKey = savedEmail.toLowerCase().trim();
      const userDocRef = doc(db, "users", emailKey);

      unsubUserDoc = onSnapshot(userDocRef, (snap) => {
        if (snap.exists()) {
          const finalData = snap.data() as AppUser;
          const email = finalData.email || emailKey;
          const isAbsoluteAdminEmail = 
            emailKey === "arjun@rajarshigurukul.edu.np" || 
            emailKey === "arjunrajarshigurukul@gmail.com" ||
            emailKey === "arjun@rajarshigurukul.com";

          let snapshotAppRole = finalData.role || "teacher";
          let snapshotStatus = finalData.status || "approved";
          let snapshotDisplayName = finalData.name || email.split("@")[0];

          if (isAbsoluteAdminEmail) {
            snapshotAppRole = "admin";
            snapshotStatus = "approved";
          }

          const enrichedUser: AppUser = {
            uid: emailKey,
            ...finalData,
            email: email,
            name: snapshotDisplayName,
            displayName: snapshotDisplayName,
            role: snapshotAppRole as any,
            appRole: snapshotAppRole as any,
            status: snapshotStatus as any,
          };

          setUser(enrichedUser);
        } else {
          // If the document is deleted or doesn't exist, check absolute admin first before clearing session
          const isAbsoluteAdminEmail = 
            emailKey === "arjun@rajarshigurukul.edu.np" || 
            emailKey === "arjunrajarshigurukul@gmail.com" ||
            emailKey === "arjun@rajarshigurukul.com";

          if (isAbsoluteAdminEmail) {
            setDoc(userDocRef, {
              email: emailKey,
              name: "Arjun (Admin)",
              role: "admin",
              status: "approved",
              password: "adminpassword",
              createdAt: new Date().toISOString()
            });
            setUser({
              uid: emailKey,
              email: emailKey,
              name: "Arjun (Admin)",
              displayName: "Arjun (Admin)",
              role: "admin" as any,
              appRole: "admin" as any,
              status: "approved" as any,
            });
          } else {
            // If the document is deleted or doesn't exist, clear session
            setUser(null);
            localStorage.removeItem("rg_prs_user_session_email");
          }
        }
        setLoading(false);
      }, (err) => {
        console.warn("User real-time document listener failed:", err);
        setLoading(false);
      });
    } else {
      setUser(null);
      setLoading(false);
    }

    return () => {
      if (unsubUserDoc) unsubUserDoc();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const emailKey = email.toLowerCase().trim();
    if (!emailKey || !password) {
       throw new Error("Email and password are required.");
    }
    if (password.length < 6) {
       throw new Error("Password must be at least 6 characters.");
    }

    const isAbsoluteAdminEmail = 
      emailKey === "arjun@rajarshigurukul.edu.np" || 
      emailKey === "arjunrajarshigurukul@gmail.com" ||
      emailKey === "arjun@rajarshigurukul.com";

    const userDocRef = doc(db, "users", emailKey);
    let userSnap = await getDoc(userDocRef);

    // If absolute admin logs in but has no user doc, auto-initiate
    if (!userSnap.exists() && isAbsoluteAdminEmail) {
      await setDoc(userDocRef, {
        email: emailKey,
        name: "Arjun (Admin)",
        role: "admin",
        status: "approved",
        password: password,
        createdAt: new Date().toISOString()
      });
      userSnap = await getDoc(userDocRef);
    }

    if (userSnap.exists()) {
      const data = userSnap.data() as AppUser;
      
      // Check if they already have a password set
      if (data.password) {
        if (data.password !== password) {
          throw new Error("Incorrect password. Please verify your credentials and try again.");
        }
      } else {
         // This is a pre-enrolled user signing in for the first time, register their typed password!
         await updateDoc(userDocRef, {
           password: password,
           updatedAt: new Date().toISOString()
         });
      }

      // Login successful! Save user email to localStorage to persist state across reloads
      localStorage.setItem("rg_prs_user_session_email", emailKey);
      
      // Trigger instant state reload by reading from local Storage logic or manual state set
      const display = data.name || emailKey.split("@")[0];
      const role = isAbsoluteAdminEmail ? "admin" : (data.role || "teacher");
      
      setUser({
        uid: emailKey,
        ...data,
        email: emailKey,
        name: display,
        displayName: display,
        role: role as any,
        appRole: role as any,
        status: data.status || "approved",
      });

      // Simple reload of the route to trigger the useEffect listener or navigate
      window.location.reload();
      return;
    } else {
      throw new Error(`Authorization Pre-enrollment Required. Please contact system admin ${isAbsoluteAdminEmail ? "" : "(arjun@rajarshigurukul.edu.np)"} to pre-register your school email address first.`);
    }
  };

  const signOut = async () => {
    localStorage.removeItem("rg_prs_user_session_email");
    setUser(null);
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("app_user_role_")) {
        localStorage.removeItem(key);
        i--;
      }
    }
    window.location.reload();
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useActivities } from "@/hooks/useActivities";
import bcrypt from "bcryptjs";

// ── Types ──
export type UserRole = "employee" | "manager" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  initials: string;
  department: string;
  avatar: string;
}

interface AuthContextType {
  user: User | null;
  isLoggedIn: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isDbReady: boolean;
  dbStatus: "connecting" | "online" | "offline";
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [dbStatus, setDbStatus] = useState<"connecting" | "online" | "offline">("connecting");
  const { logActivity } = useActivities();

  useEffect(() => {
    // Check MongoDB connection status
    const checkConn = async () => {
      try {
        const connected = await invoke("check_db_status");
        if (connected) {
          setDbStatus("online");
        } else {
          setDbStatus("connecting");
          // Retry after 2 seconds
          setTimeout(checkConn, 2000);
        }
      } catch (e) {
        console.error("Failed to check DB status:", e);
        setDbStatus("offline");
        setTimeout(checkConn, 5000);
      }
    };
    checkConn();
  }, []);

  const login = async (email: string, password: string) => {
    if (dbStatus !== "online") {
      return { success: false, error: "Cloud database is not connected. Please wait." };
    }

    try {
      const lowerEmail = email.toLowerCase().trim();
      
      // Fetch user directly from MongoDB
      const users: any[] = await invoke("cloud_sync_get", { 
        collectionName: "users", 
        filter: { email: lowerEmail } 
      });
      
      if (users.length === 0) {
        return { success: false, error: "Account not found. Check your email." };
      }

      const cred = users[0];

      if (!bcrypt.compareSync(password, cred.password) && cred.password !== password) {
        return { success: false, error: "Incorrect password. Please try again." };
      }

      if (cred.status !== "active") {
        return { success: false, error: "Account is not active." };
      }

      setUser({
        id: cred.id,
        name: cred.name,
        email: cred.email,
        role: cred.role as UserRole,
        initials: cred.initials,
        department: cred.department,
        avatar: cred.avatar
      });

      await logActivity({
        user_name: cred.name,
        user_id: cred.id,
        action: "logged in",
        status: "online"
      });

      return { success: true };
    } catch (err: any) {
      console.error(err);
      return { success: false, error: String(err) || "Connection error occurred." };
    }
  };

  const logout = () => {
    if (user) {
      logActivity({
        user_name: user.name,
        user_id: user.id,
        action: "logged out",
        status: "offline"
      });
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isLoggedIn: !!user, 
      login, 
      logout, 
      isDbReady: dbStatus === "online",
      dbStatus
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

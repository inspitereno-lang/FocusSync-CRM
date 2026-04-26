import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getDb, initDb } from "@/services/db";
import { ActivityService } from "@/services/activityService";
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
  avatar: string; // gradient color
}

interface AuthContextType {
  user: User | null;
  isLoggedIn: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isDbReady: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isDbReady, setIsDbReady] = useState(false);

  useEffect(() => {
    initDb().then(() => setIsDbReady(true));
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const lowerEmail = email.toLowerCase().trim();
      const db = await getDb();
      const users = await db.select<any[]>("SELECT * FROM users WHERE email = $1 AND is_deleted = 0", [lowerEmail]);
      
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

      await ActivityService.logActivity({
        user_name: cred.name,
        user_id: cred.id,
        action: "logged in",
        status: "online"
      });

      return { success: true };
    } catch (err) {
      console.error(err);
      return { success: false, error: "Database error occurred." };
    }
  };

  const logout = () => {
    if (user) {
      ActivityService.logActivity({
        user_name: user.name,
        user_id: user.id,
        action: "logged out",
        status: "offline"
      });
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoggedIn: !!user, login, logout, isDbReady }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

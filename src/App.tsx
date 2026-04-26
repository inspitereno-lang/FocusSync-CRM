import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { SmokeyBackground, LoginForm } from "@/components/ui/login-form";
import EmployeeDashboard from "@/components/EmployeeDashboard";
import ManagerDashboard from "@/components/ManagerDashboard";
import AdminDashboard from "@/components/AdminDashboard";
import GazeCalibration from "@/components/Proctoring/GazeCalibration";
import ProctoringTracker from "@/components/Proctoring/ProctoringTracker";
import { useAttendance } from "@/hooks/useAttendance";
import { useToasts } from "@/components/ui/ToastContext";
import "./App.css";
import { useEffect, useRef } from "react";

function App() {
  const { user, isLoggedIn, login, logout, isDbReady, dbStatus } = useAuth();
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [isOnline, setIsOnline] = useState(window.navigator.onLine);
  const [todayTotalMins, setTodayTotalMins] = useState(0);
  const { updateSessionStats, logSessionStart, logSessionEnd, logPing } = useAttendance();
  const sessionStartedRef = useRef(false);
  const lastUpdateRef = useRef(Date.now());
  const statsBufferRef = useRef({ keystrokes: 0, faceMissingSeconds: 0, activeSeconds: 0 });

  // ── ONLINE STATUS LISTENERS ──
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const { showToast } = useToasts();

  // ── SESSION LOGGING ──
  useEffect(() => {
    let pingInterval: ReturnType<typeof setInterval>;
    if (isLoggedIn && user && !sessionStartedRef.current) {
      // Reset buffer for new session
      statsBufferRef.current = { keystrokes: 0, faceMissingSeconds: 0, activeSeconds: 0 };
      lastUpdateRef.current = Date.now();
      
      logSessionStart(user.id);
      sessionStartedRef.current = true;
      
      // Fetch initial today's total
      const fetchTodayInitial = async () => {
        try {
          const today = new Date().toISOString().split('T')[0];
          const res: any[] = await invoke("cloud_sync_get", { collectionName: "sessions", filter: { user_id: user.id } });
          const total = res
            .filter(s => s.login_time && s.login_time.startsWith(today))
            .reduce((acc, s) => acc + (s.total_minutes || 0), 0);
          setTodayTotalMins(total);
        } catch (e) { console.error(e); }
      };
      fetchTodayInitial();
      
      // Ping every 2 minutes to keep session active
      pingInterval = setInterval(() => {
        logPing(user.id);
      }, 120000);
    }
    return () => {
      if (pingInterval) clearInterval(pingInterval);
      if (isLoggedIn && user && sessionStartedRef.current) {
        logSessionEnd(user.id);
        sessionStartedRef.current = false;
      }
    };
  }, [isLoggedIn, user]);

  const handleStatUpdate = (stats: any) => {
    if (!user) return;
    
    const now = Date.now();
    const deltaSeconds = (now - lastUpdateRef.current) / 1000;
    lastUpdateRef.current = now;

    // Track active vs missing time
    if (stats.faceDetected) {
      statsBufferRef.current.activeSeconds += deltaSeconds;
    } else {
      statsBufferRef.current.faceMissingSeconds += deltaSeconds;
    }

    // Periodic persist to DB (every 10 seconds or every 50 keystrokes)
    const currentKeystrokes = stats.keyCount || 0;
    const diffKeys = currentKeystrokes - statsBufferRef.current.keystrokes;

    if (deltaSeconds > 10 || diffKeys > 50) {
      updateSessionStats(user.id, {
        keystrokes: diffKeys,
        faceMissingSeconds: Math.round(statsBufferRef.current.faceMissingSeconds),
        activeSeconds: Math.round(statsBufferRef.current.activeSeconds),
        integrityScore: 100 // Integrity logic for tab/paste removed per request
      });
      setTodayTotalMins(prev => prev + (statsBufferRef.current.activeSeconds / 60));
      statsBufferRef.current.keystrokes = currentKeystrokes;
      statsBufferRef.current.faceMissingSeconds = 0;
      statsBufferRef.current.activeSeconds = 0;
    }
  };

  const [roleColor, setRoleColor] = useState("#60a5fa"); // Default blue

  // ── LOADING STATE (INITIAL BOOT) ──
  if (dbStatus === "connecting" && !isLoggedIn) {
    return (
      <main className="login-screen flex flex-col items-center justify-center gap-4 bg-[#0f172a]">
        <div className="login-spinner" style={{ width: 48, height: 48, borderWidth: 4 }} />
        <div className="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em] animate-pulse">
          Establishing Cloud Link...
        </div>
      </main>
    );
  }

  // ── ROLE-BASED DASHBOARD SELECTION ──
  let dashboard = null;
  if (user?.role === "admin") {
    dashboard = <AdminDashboard />;
  } else if (user?.role === "manager") {
    dashboard = <ManagerDashboard />;
  } else if (user?.role === "employee") {
    dashboard = <EmployeeDashboard />;
  }

  const showProctoring = user?.role === "manager" || user?.role === "employee";

  return (
    <>
      {/* ── OFFLINE INDICATOR ── */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-0 left-0 right-0 z-[10000] bg-red-600/90 backdrop-blur-md text-white py-1.5 text-center text-[10px] font-black uppercase tracking-[0.2em] shadow-xl border-b border-red-500/20"
          >
            <div className="flex items-center justify-center gap-3">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              Cloud Connection Lost — Data Localized
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── LOGIN SCREEN ── */}
      {(!isLoggedIn || !user) ? (
        <main className="login-screen">
          <SmokeyBackground className="absolute inset-0" color={roleColor} />
          <div className="login-overlay">
            <LoginForm 
              onLogin={login} 
              onRoleChange={(role) => {
                if (role === "admin") setRoleColor("#fbbf24");
                else if (role === "manager") setRoleColor("#a78bfa");
                else setRoleColor("#60a5fa");
              }} 
            />
          </div>
        </main>
      ) : (user.role === "manager" || user.role === "employee") && !isCalibrated ? (
        /* ── GAZE CALIBRATION ── */
        <div className="h-screen w-full">
          <GazeCalibration onCalibrationComplete={() => setIsCalibrated(true)} />
        </div>
      ) : (
        /* ── DASHBOARD ── */
        <div className="h-screen w-full">
          {showProctoring && (
            <ProctoringTracker 
              onStatUpdate={handleStatUpdate} 
              onTimeout={logout} 
              sessionId={user?.id} 
            />
          )}
          {dashboard}
          
          {/* ── LIVE HOURS BADGE ── */}
          <div className="fixed bottom-6 right-6 z-[9999] pointer-events-none">
            <div className="glass-card p-3 flex flex-col gap-1 border-blue-500/30 bg-blue-500/5 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Active Session</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-white tracking-tighter">
                  {Math.floor(todayTotalMins)}h {Math.round((todayTotalMins % 1) * 60)}m
                </span>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Today</span>
              </div>
              <div className="text-[9px] text-blue-400 font-bold uppercase tracking-wider opacity-70">
                Tracking Focus...
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default App;

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, FileText, BarChart3, Activity, Settings, LogOut,
  Target, Calendar, Bell, Play, Pause, X, Plus, CheckCircle2, Circle,
  Clock, Zap, TrendingUp, Timer, Monitor, ArrowUpRight,
  Eye, PieChart, UserCheck, MessageCircle, AlertCircle, Send,
  Shield, ShieldCheck
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTasks, Task } from "@/hooks/useTasks";
import { useActivities } from "@/hooks/useActivities";
import { TaskModal } from "@/components/ui/Modals";
import { invoke } from "@tauri-apps/api/core";
import AttendanceReport from "@/components/Proctoring/AttendanceReport";
import { useMessages } from "@/hooks/useMessages";
import { useUsers, SystemUser } from "@/hooks/useUsers";
import { FocusSyncLogo } from "./ui/FocusSyncLogo";

// ✅ Proper React component — hooks at top level, not inside a render function
function EmployeeCommunicationPanel({
  currentUser,
  users,
  messages,
  sendMessage,
}: {
  currentUser: any;
  users: any[];
  messages: any[];
  sendMessage: (senderId: string, receiverId: string, content: string) => void;
}) {
  const [msgText, setMsgText] = useState("");
  const [selectedChatUser, setSelectedChatUser] = useState<any | null>(null);

  const chatMessages = messages.filter(m =>
    (m.sender_id === currentUser?.id && m.receiver_id === selectedChatUser?.id) ||
    (m.sender_id === selectedChatUser?.id && m.receiver_id === currentUser?.id)
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-200px)] min-h-[500px]">
      <div className="lg:col-span-4 glass-card flex flex-col p-0 overflow-hidden">
        <div className="p-4 border-b border-white/5 font-bold text-slate-300 uppercase tracking-widest text-[10px]">Contacts</div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {users.filter(u => u.id !== currentUser?.id).map(u => (
            <div
              key={u.id}
              onClick={() => setSelectedChatUser(u)}
              className={`p-3 rounded-xl cursor-pointer transition-all border ${
                selectedChatUser?.id === u.id ? 'bg-blue-600/20 border-blue-500/30' : 'bg-white/5 border-transparent hover:bg-white/10'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs" style={{ background: u.avatar }}>{u.initials}</div>
                <div>
                  <div className="text-sm font-bold text-white">{u.name}</div>
                  <div className="text-[10px] text-slate-500 uppercase">{u.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="lg:col-span-8 glass-card flex flex-col p-0 overflow-hidden bg-black/20">
        {selectedChatUser ? (
          <>
            <div className="p-4 border-b border-white/5 flex items-center gap-3 bg-white/[0.02]">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold shadow-lg" style={{ background: selectedChatUser.avatar }}>{selectedChatUser.initials}</div>
              <div>
                <div className="font-bold text-white">{selectedChatUser.name}</div>
                <div className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">{selectedChatUser.role}</div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.map(m => (
                <div key={m.id} className={`flex ${m.sender_id === currentUser?.id ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] p-3 rounded-2xl text-sm ${
                    m.sender_id === currentUser?.id ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white/10 text-slate-200 rounded-tl-none border border-white/5'
                  }`}>
                    {m.content}
                    <div className="text-[8px] opacity-50 mt-1 text-right">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-white/5 bg-white/[0.02] flex gap-2">
              <input
                type="text"
                value={msgText}
                onChange={e => setMsgText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && msgText.trim() && (sendMessage(currentUser!.id, selectedChatUser.id, msgText), setMsgText(""))}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-500/50"
                placeholder="Type a message..."
              />
              <button
                onClick={() => { if (msgText.trim()) { sendMessage(currentUser!.id, selectedChatUser.id, msgText); setMsgText(""); } }}
                className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center"
              >
                <Send size={18} />
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-4 opacity-30">
            <MessageCircle size={48} />
            <div className="italic text-sm text-center">Select a contact to<br/>start messaging</div>
          </div>
        )}
      </div>
    </div>
  );
}



// ── Progress Ring ──
function ProgressRing({ value, max, label, color }: { value: number; max: number; label: string; color: string }) {
  const pct = (value / max) * 100;
  const r = 42; const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <div className="progress-ring">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s ease" }} />
      </svg>
      <div className="ring-label">
        <span className="ring-value">{value}%</span>
        <span className="ring-text">{label}</span>
      </div>
    </div>
  );
}

export default function EmployeeDashboard() {
  const { user, logout } = useAuth();
  const [activeView, setActiveView] = useState("dashboard");
  const { tasks, addTask, updateTask, deleteTask } = useTasks(user?.email || "");
  const { users, updateUser: updateUserInfo } = useUsers();
  const { messages, sendMessage } = useMessages();
  const { activities, loading: activitiesLoading } = useActivities();
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  
  // Real session stats state
  const [recentSessions, setRecentSessions] = useState<any[]>([]);
  const [liveStats, setLiveStats] = useState({ todayHours: 0, focusScore: 90 });

  const [weeklyData, setWeeklyData] = useState<any[]>([]);

  useEffect(() => {
    const fetchRecentSessions = async () => {
      if (!user) return;
      try {
        const res: any[] = await invoke("cloud_sync_get", { 
          collectionName: "sessions",
          filter: { user_id: user.id }
        });
        
        const sorted = res.sort((a, b) => new Date(b.login_time).getTime() - new Date(a.login_time).getTime());
        setRecentSessions(sorted.slice(0, 5));

        // Calculate weekly data (last 7 days)
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const currentData = Array(7).fill(0).map((_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          const dateStr = d.toISOString().split('T')[0];
          
          const dailyMins = res
            .filter(s => s.login_time.startsWith(dateStr))
            .reduce((acc, s) => acc + (s.total_minutes || 0), 0);

          return {
            day: days[d.getDay()],
            hours: parseFloat((dailyMins / 60).toFixed(1))
          };
        });
        setWeeklyData(currentData);
      } catch (e) {
        console.error("Failed to fetch sessions from MongoDB:", e);
      }
    };
    fetchRecentSessions();
    const interval = setInterval(fetchRecentSessions, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const formatDuration = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return `${h}h ${m}m`;
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });
  };

  useEffect(() => {
    const fetchLiveStats = async () => {
      if (!user) return;
      try {
        const today = new Date().toISOString().split('T')[0];
        const res: any[] = await invoke("cloud_sync_get", { 
          collectionName: "sessions",
          filter: { user_id: user.id }
        });
        
        const todayMins = res
          .filter(s => s.login_time && s.login_time.startsWith(today))
          .reduce((acc, s) => acc + (s.total_minutes || 0), 0);
          
        setLiveStats({
          todayHours: todayMins / 60,
          focusScore: 95 // Placeholder for now or calculate from sessions
        });
      } catch (e) {
        console.error("Failed to fetch live stats:", e);
      }
    };
    fetchLiveStats();
    const interval = setInterval(fetchLiveStats, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, [user]);

  // Modals state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => { const t = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    let t: ReturnType<typeof setInterval>;
    if (timerRunning) t = setInterval(() => setTimerSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [timerRunning]);

  const fmt = (s: number) => {
    const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
  };

  const updateTodayHours = async (minutes: number) => {
    if (!user) return;
    try {
      const res: any[] = await invoke("cloud_sync_get", { collectionName: "users", filter: { id: user.id } });
      const currentHours = res[0]?.todayHours || 0;
      const newHours = currentHours + (minutes / 60);
      
      await updateUserInfo(user.id, { todayHours: newHours });
      setLiveStats(prev => ({ ...prev, todayHours: newHours }));
    } catch (e) {
      console.error("Failed to update today hours:", e);
    }
  };

  const toggleTimer = async () => {
    if (!activeTaskId) return;
    const task = tasks.find(t => t.id === activeTaskId);
    if (!task) return;

    if (!timerRunning) {
      await updateTask(task.id, { is_running: true, started_at: new Date().toISOString() });
      setTimerRunning(true);
    } else {
      const elapsedMinutes = Math.floor(timerSeconds / 60);
      await updateTask(task.id, { is_running: false, focus_time: (task.focus_time || 0) + elapsedMinutes });
      await updateTodayHours(elapsedMinutes);
      setTimerRunning(false);
    }
  };

  const resetTimer = async () => {
    if (activeTaskId) {
      await updateTask(activeTaskId, { is_running: false, started_at: null });
    }
    setTimerRunning(false);
    setTimerSeconds(0);
    setActiveTaskId(null);
  };

  const toggleTaskCompletion = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    
    if (task.status === "completed") {
      await updateTask(id, { status: "pending", is_running: false });
    } else {
      const elapsedMinutes = Math.floor(timerSeconds / 60);
      const finalFocusTime = (task.focus_time || 0) + elapsedMinutes;
      await updateTask(id, { status: "completed", is_running: false, focus_time: finalFocusTime });
      await updateTodayHours(elapsedMinutes);
      if (activeTaskId === id) resetTimer();
    }
  };

  const startTaskTimer = async (id: string) => {
    if (activeTaskId === id) return;
    
    if (activeTaskId) {
      const prevTask = tasks.find(t => t.id === activeTaskId);
      if (prevTask) {
        const elapsed = Math.floor(timerSeconds / 60);
        await updateTask(activeTaskId, { is_running: false, focus_time: (prevTask.focus_time || 0) + elapsed });
      }
    }

    const task = tasks.find(t => t.id === id);
    if (!task) return;
    
    setActiveTaskId(id);
    setTimerSeconds(0);
    setTimerRunning(true);
    await updateTask(id, { is_running: true, started_at: new Date().toISOString() });
  };

  const handleSaveTask = (taskData: Partial<Task>) => {
    if (editingTask) updateTask(editingTask.id, taskData);
    else addTask({ ...taskData, focus_time: 0, status: "pending", title: taskData.title||"New Task", priority: taskData.priority||"medium", assignee_email: user?.email||null } as Omit<Task,"id">);
  };
  const handleEditTask = (t: Task) => { setEditingTask(t); setIsTaskModalOpen(true); };

  const pending = tasks.filter(t => t.status==="pending");
  const completed = tasks.filter(t => t.status==="completed");
  const totalHours = weeklyData.reduce((a,d)=>a+d.hours,0);

  const navItems = [
    { id:"dashboard", icon:<LayoutDashboard size={18}/>, label:"My Dashboard" },
    { id:"tasks", icon:<FileText size={18}/>, label:"My Tasks" },
    { id:"focus", icon:<Timer size={18}/>, label:"Focus Timer" },
    { id:"communication", icon:<MessageCircle size={18} className="text-blue-400" />, label:"Chat with Team" },
    { id:"attendance", icon:<UserCheck size={18}/>, label:"My Attendance" },
    { id:"activity", icon:<Activity size={18}/>, label:"My Activity" },
    { id:"reports", icon:<BarChart3 size={18}/>, label:"My Reports" },
    { id:"settings", icon:<Settings size={18}/>, label:"Settings" },
  ];

  // ── Render Views ──
  const renderDashboard = () => (
    <>
      <div className="stats-grid">
        {[
          { label: "Current Focus", value: `${liveStats.focusScore}%`, change: "+5% vs avg", up: true, icon: <Zap size={18} />, color: "from-blue-500/20 to-blue-600/5", iconColor: "text-blue-400" },
          { label: "Active Tasks", value: String(tasks.filter(t => t.status !== 'completed').length), change: "In progress", up: true, icon: <Calendar size={18} />, color: "from-emerald-500/20 to-emerald-600/5", iconColor: "text-emerald-400" },
          { label: "Time Logged", value: `${liveStats.todayHours.toFixed(1)}h`, change: "Daily target 8h", up: liveStats.todayHours >= 6, icon: <Clock size={18} />, color: "from-purple-500/20 to-purple-600/5", iconColor: "text-purple-400" },
          { label: "Alert Score", value: "Low", change: "Security status", up: true, icon: <Shield size={18} />, color: "from-red-500/20 to-red-600/5", iconColor: "text-red-400" },
        ].map((s, i) => (
          <div key={i} className="glass-card bg-gradient-to-br from-white/[0.03] to-transparent border-white/5 hover:border-blue-500/30 transition-all hover:scale-[1.02] active:scale-[0.98]">
            <div className="flex items-center justify-between mb-3">
              <span className="card-label text-slate-400 font-bold uppercase tracking-wider text-[10px]">{s.label}</span>
              <div className={`p-2 rounded-lg bg-white/5 ${s.iconColor}`}>{s.icon}</div>
            </div>
            <div className="card-value text-3xl font-extrabold text-white mb-1">{s.value}</div>
            <div className={`flex items-center gap-1 text-[10px] font-bold ${s.up ? "text-emerald-400" : "text-red-400"}`}>{s.change}</div>
          </div>
        ))}
      </div>
      <div className="module-grid">
        <div className="glass-card">
          <div className="section-title"><BarChart3 size={16} className="text-blue-400"/> My Weekly Hours</div>
          <div className="chart-bars">
            {weeklyData.map((d,i) => (
              <div key={i} className="flex-1 flex flex-col items-center">
                <div className="chart-bar w-full" style={{height:`${(d.hours/10)*100}%`,background:`linear-gradient(180deg,#3b82f6,#3b82f644)`}} title={`${d.hours}h`}/>
                <div className="chart-bar-label">{d.day}</div>
              </div>
            ))}
          </div>
          <div style={{textAlign:"center",marginTop:"0.75rem",fontSize:"0.75rem",color:"#64748b"}}>Total: {totalHours.toFixed(1)}h this week</div>
        </div>
        <div className="glass-card">
          <div className="section-title"><Timer size={16} className="text-purple-400"/> Focus Timer</div>
          <div className="timer-display">{fmt(timerSeconds)}</div>
          <div className="timer-task-name">{activeTaskId ? tasks.find(t=>t.id===activeTaskId)?.title : "Select a task to start"}</div>
          <div className="timer-controls">
            <button className={timerRunning?"btn-danger":"btn-primary"} onClick={toggleTimer}>
              {timerRunning?<><Pause size={14}/> Pause</>:<><Play size={14}/> Start</>}
            </button>
            <button className="btn-secondary" onClick={resetTimer}><X size={14}/> Reset</button>
          </div>
        </div>
      </div>
      <div className="module-grid">
        <div className="glass-card">
          <div className="section-title"><Calendar size={16} className="text-blue-400" /> Tasks in Progress</div>
          <div className="space-y-4">
            {tasks.filter(t => t.status !== 'completed').map(t => (
              <div key={t.id} className="p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-blue-500/30 transition-all cursor-pointer">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-white">{t.title}</span>
                  <span className="text-[10px] font-bold text-blue-400 uppercase">{t.priority}</span>
                </div>
                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="glass-card">
          <div className="section-title"><Clock size={16} className="text-purple-400" /> Recent Activity</div>
          <div className="space-y-4 text-xs text-slate-500 italic">
            {activities.filter(a => a.user_id === user?.id).slice(0, 5).map(a => (
              <div key={a.id} className="flex items-center justify-between">
                <span>{a.action}</span>
                <span className="text-[10px] opacity-50">{new Date(a.time).toLocaleTimeString()}</span>
              </div>
            ))}
            {activities.filter(a => a.user_id === user?.id).length === 0 && "No recent activity logged."}
          </div>
        </div>
      </div>
    </>
  );

  const renderTasks = () => (
    <div className="glass-card">
      <div className="flex items-center justify-between mb-4">
        <div className="section-title" style={{marginBottom:0}}><FileText size={16} className="text-amber-400"/> All My Tasks</div>
        <button className="btn-primary" onClick={() => { setEditingTask(null); setIsTaskModalOpen(true); }}><Plus size={14}/> Add Task</button>
      </div>
      {tasks.map(task=>(
        <div key={task.id} className={`task-row group ${task.status==="completed"?"completed":""}`}>
          <div className={`task-check ${task.status==="completed"?"done":""}`} onClick={()=>toggleTaskCompletion(task.id)}>
            {task.status==="completed"?<CheckCircle2 size={20}/>:<Circle size={20}/>}
          </div>
          <div className="task-info flex-1" onClick={()=>task.status!=="completed"&&startTaskTimer(task.id)}>
            <div className="task-name">{task.title}</div>
            <div className="task-meta-line">
              {activeTaskId===task.id&&timerRunning?<span style={{color:"#60a5fa",fontWeight:600}}>⏱ {fmt(timerSeconds)}</span>:`${task.focus_time}m logged`}
              <span className="ml-2 text-[10px] text-slate-500">· {task.subtasks?.length || 0} subtasks</span>
              {task.has_issue && <span className="ml-2 text-[10px] text-red-400 font-bold">⚠️ ISSUE REPORTED</span>}
            </div>
            
            {(task.status === "completed" || activeTaskId === task.id) && (
              <div className="mt-3 space-y-2" onClick={e => e.stopPropagation()}>
                <textarea 
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-slate-300 focus:border-blue-500/50 outline-none transition-all"
                  placeholder="Add completion notes or updates..."
                  defaultValue={task.completion_notes || ""}
                  onBlur={(e) => updateTask(task.id, { completion_notes: e.target.value })}
                />
                <div className="flex items-center justify-between">
                  <button 
                    onClick={() => updateTask(task.id, { has_issue: !task.has_issue })}
                    className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded transition-all ${task.has_issue ? 'bg-red-500/20 text-red-400' : 'bg-slate-500/20 text-slate-400 hover:bg-red-500/10 hover:text-red-400'}`}
                  >
                    {task.has_issue ? 'Resolve Issue' : 'Raise Issue'}
                  </button>
                  {task.has_issue && (
                    <input 
                      className="flex-1 ml-2 bg-transparent border-b border-red-500/30 text-[10px] text-red-400 outline-none placeholder:text-red-900"
                      placeholder="Describe the issue..."
                      defaultValue={task.issue_description || ""}
                      onBlur={(e) => updateTask(task.id, { issue_description: e.target.value })}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className={`task-priority ${task.priority}`}>{task.priority}</span>
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-2 transition-opacity">
               <button onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }} className="text-red-400 hover:text-red-300 px-2 py-1 text-xs">Delete</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderFocus = () => (
    <div className="glass-card" style={{maxWidth:500,margin:"0 auto",textAlign:"center"}}>
      <div className="section-title" style={{justifyContent:"center"}}><Timer size={16} className="text-purple-400"/> Deep Focus Mode</div>
      <div className="timer-display" style={{fontSize:"5rem"}}>{fmt(timerSeconds)}</div>
      <div className="timer-task-name" style={{fontSize:"1rem",marginBottom:"1.5rem"}}>{activeTaskId?tasks.find(t=>t.id===activeTaskId)?.title:"No task selected"}</div>
      <div className="timer-controls" style={{marginBottom:"2rem"}}>
        <button className={timerRunning?"btn-danger":"btn-primary"} onClick={toggleTimer} style={{padding:"0.8rem 2rem",fontSize:"1rem"}}>
          {timerRunning?<><Pause size={18}/> Pause</>:<><Play size={18}/> Start Focus</>}
        </button>
        <button className="btn-secondary" onClick={resetTimer} style={{padding:"0.8rem 2rem",fontSize:"1rem"}}><X size={18}/> Reset</button>
      </div>
      <div className="section-title" style={{justifyContent:"center",marginTop:"2rem"}}><FileText size={16} className="text-amber-400"/> Pick a Task</div>
      {pending.map(t=>(
        <div key={t.id} className={`task-row ${activeTaskId===t.id?"active-task":""}`} onClick={()=>startTaskTimer(t.id)} style={{textAlign:"left"}}>
          <div className="task-info"><div className="task-name">{t.title}</div></div>
          <span className={`task-priority ${t.priority}`}>{t.priority}</span>
        </div>
      ))}
    </div>
  );

  const renderActivity = () => (
    <div className="glass-card">
      <div className="flex items-center justify-between mb-4">
        <div className="section-title" style={{marginBottom:0}}><Activity size={16} className="text-emerald-400"/> My Activity Log</div>
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          {currentTime.toLocaleDateString("en-US", { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} · {currentTime.toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
        </div>
      </div>
      {activitiesLoading ? (
        <div className="py-12 text-center text-slate-500 text-sm">Loading activity...</div>
      ) : activities.filter(a => a.user_id === user?.id).length > 0 ? (
        activities.filter(a => a.user_id === user?.id).map((a, i) => (
          <div key={a.id} className="activity-item">
            <div className={`activity-dot ${a.status}`}/>
            <div><div className="activity-text">{a.action}</div><div className="activity-time">{new Date(a.time).toLocaleString()}</div></div>
          </div>
        ))
      ) : (
        <div className="py-12 text-center text-slate-500 text-sm">No activity recorded for your account.</div>
      )}
    </div>
  );

  const renderReports = () => (
    <div>
      <div className="glass-card" style={{marginBottom:"1.5rem"}}>
        <div className="section-title"><BarChart3 size={16} className="text-blue-400"/> Weekly Productivity Report</div>
        <div className="chart-bars" style={{height:160}}>
          {weeklyData.map((d,i) => (
            <div key={i} className="flex-1 flex flex-col items-center">
              <div className="chart-bar w-full" style={{height:`${(d.hours/10)*100}%`,background:`linear-gradient(180deg,#6366f1,#6366f144)`}} title={`${d.hours}h`}/>
              <div className="chart-bar-label">{d.day}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="glass-card" style={{maxWidth:600}}>
      <div className="section-title"><Settings size={16} className="text-gray-400"/> Account Settings</div>
      {[{label:"Full Name",value:user?.name||""},{label:"Email",value:user?.email||""},{label:"Department",value:user?.department||""},{label:"Role",value:"Employee"}].map((f,i)=>(
        <div key={i} style={{marginBottom:"1rem"}}>
          <label style={{fontSize:"0.7rem",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",color:"#64748b",display:"block",marginBottom:"0.35rem"}}>{f.label}</label>
          <input className="inline-input" value={f.value} readOnly style={{opacity:0.7,cursor:"not-allowed"}}/>
        </div>
      ))}
    </div>
  );

  const renderAttendance = () => (
    <div   style={{ maxWidth: 720 }}>
      <AttendanceReport userId={user?.id || ""} />
    </div>
  );

  // ✅ FIX: Use proper component instead of useState-inside-render-function
  const renderCommunication = () => (
    <EmployeeCommunicationPanel
      currentUser={user}
      users={users}
      messages={messages}
      sendMessage={sendMessage}
    />
  );

  const views: Record<string, ()=>React.JSX.Element> = { dashboard:renderDashboard, tasks:renderTasks, focus:renderFocus, communication:renderCommunication, attendance:renderAttendance, activity:renderActivity, reports:renderReports, settings:renderSettings };
  const viewTitles: Record<string,string> = { dashboard:"My Dashboard", tasks:"My Tasks", focus:"Focus Timer", communication:"Secure Chat", attendance:"My Attendance", activity:"Activity Log", reports:"My Reports", settings:"Settings" };

  return (
    <div className="app-shell">
      <motion.aside    className="sidebar">
        <div className="sidebar-brand">
          <FocusSyncLogo size={32} color="#60a5fa" />
          <span style={{ 
            fontSize: "1.1rem", 
            fontWeight: 800, 
            letterSpacing: "-0.03em",
            background: "linear-gradient(135deg, #fff 0%, #60a5fa 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent"
          }}>
            FocusSync
          </span>
        </div>
        <div className="nav-section-label">Workspace</div>
        {navItems.slice(0,4).map(item=>(
          <div key={item.id} className={`nav-link ${activeView===item.id?"active":""}`} onClick={()=>setActiveView(item.id)}>{item.icon}<span>{item.label}</span></div>
        ))}
        <div className="nav-section-label">Insights</div>
        {navItems.slice(4,6).map(item=>(
          <div key={item.id} className={`nav-link ${activeView===item.id?"active":""}`} onClick={()=>setActiveView(item.id)}>{item.icon}<span>{item.label}</span></div>
        ))}
        <div className="nav-section-label">System</div>
        <div className={`nav-link ${activeView==="settings"?"active":""}`} onClick={()=>setActiveView("settings")}><Settings size={18}/><span>Settings</span></div>
        <div className="sidebar-footer">
          <div className="user-card">
            <div className="user-avatar" style={{background:user?.avatar}}>{user?.initials}</div>
            <div className="user-details"><div className="user-name">{user?.name}</div><div className="user-role"></div></div>
          </div>
          <div className="nav-link" onClick={logout}><LogOut size={18}/><span>Sign Out</span></div>
        </div>
      </motion.aside>
      <div className="main-area">
        <div className="page-header">
          <div>
            <h1>{viewTitles[activeView]||"Dashboard"}</h1>
            <div className="date-badge"><Calendar size={12} className="inline mr-1"/>{currentTime.toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"})} · {currentTime.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}</div>
          </div>
          <div className="flex items-center gap-3">
            <button className="btn-secondary"><Bell size={16}/></button>
            <button className={timerRunning?"btn-danger":"btn-primary"} onClick={toggleTimer}>
              {timerRunning?<><Pause size={16}/> Pause</>:<><Eye size={16}/> Focus</>}
            </button>
          </div>
        </div>
        {/* ✅ FIX: Removed key={activeView} — caused full tree remount on every nav click (double-load) */}
        <div className="flex-1 w-full h-full">
          {views[activeView] ? views[activeView]() : renderDashboard()}
        </div>
      </div>
      <TaskModal isOpen={isTaskModalOpen} onClose={()=>setIsTaskModalOpen(false)} task={editingTask} onSave={handleSaveTask} />
    </div>
  );
}

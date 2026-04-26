import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, FileText, Users, BarChart3, Activity, Settings, LogOut,
  Target, Calendar, Bell, Plus, CheckCircle2, Circle, X,
  Clock, Zap, TrendingUp, Monitor, Award, ArrowUpRight, ArrowDownRight,
  Eye, UserCheck, PieChart, Coffee, Briefcase, Trash2
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTasks, Task } from "@/hooks/useTasks";
import { useUsers, SystemUser } from "@/hooks/useUsers";
import { TaskModal, UserModal } from "@/components/ui/Modals";
import AttendanceReport from "@/components/Proctoring/AttendanceReport";

import { useActivities } from "@/hooks/useActivities";
import { useSessions } from "@/hooks/useSessions";
import { useMessages } from "@/hooks/useMessages";
import { MessageCircle, AlertCircle, Send } from "lucide-react";
import { FocusSyncLogo } from "./ui/FocusSyncLogo";
import { ToastContainer, ToastMessage, ToastType } from "./ui/Toast";
import { useRef } from "react";
import { APP_CONFIG } from "@/services/config";
import { invoke } from "@tauri-apps/api/core";

const WEEK = [{day:"Mon",hours:7.2},{day:"Tue",hours:6.8},{day:"Wed",hours:8.1},{day:"Thu",hours:5.4},{day:"Fri",hours:7.9},{day:"Sat",hours:3.2},{day:"Sun",hours:1.5}];

function ProgressRing({value,max,label,color}:{value:number;max:number;label:string;color:string}) {
  const r=42,circ=2*Math.PI*r,offset=circ-((value/max)*circ);
  return (<div className="progress-ring"><svg width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6"/><circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="6" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" style={{transition:"stroke-dashoffset 0.8s ease"}}/></svg><div className="ring-label"><span className="ring-value">{value}%</span><span className="ring-text">{label}</span></div></div>);
}

// ✅ Proper React component — hooks are at top level, not inside a render function
function ManagerCommunicationPanel({
  currentUser,
  allUsers,
  messages,
  sendMessage,
}: {
  currentUser: any;
  allUsers: any[];
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
          {allUsers.filter(u => u.id !== currentUser?.id).map(u => (
            <div
              key={u.id}
              onClick={() => setSelectedChatUser(u)}
              className={`p-3 rounded-xl cursor-pointer transition-all border ${selectedChatUser?.id === u.id ? 'bg-blue-600/20 border-blue-500/30' : 'bg-white/5 border-transparent hover:bg-white/10'}`}
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
                <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Team Member</div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.map(m => (
                <div key={m.id} className={`flex ${m.sender_id === currentUser?.id ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] p-3 rounded-2xl text-sm ${m.sender_id === currentUser?.id ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white/10 text-slate-200 rounded-tl-none border border-white/5'}`}>
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


export default function ManagerDashboard() {
  const { user, logout } = useAuth();
  const [activeView, setActiveView] = useState("dashboard");
  const { tasks: allTasks, addTask, updateTask, deleteTask, refresh: refreshTasks } = useTasks();
  const { users: allUsers, addUser, updateUser, deleteUser, refresh: refreshUsers } = useUsers();
  const { getTodayMinutes, refresh: refreshSessions } = useSessions();
  const { messages, sendMessage } = useMessages();
  const { activities } = useActivities();
  
  // Filter for ONLY this manager's team
  const TEAM = allUsers.filter(u => u.manager_id === user?.id);
  const tasks = allTasks.filter(t => 
    t.assignee_email && TEAM.some(m => m.email === t.assignee_email)
  );
  
  // Modals
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);

  const [proctoringAlerts, setProctoringAlerts] = useState<any[]>([]);

  const fetchAlerts = async () => {
    try {
      const res: any[] = await invoke("cloud_get_proctoring_alerts");
      const teamIds = TEAM.map(m => m.id);
      setProctoringAlerts(res.filter((a: any) => teamIds.includes(a.user_id)));
    } catch (e) {
      console.error("Failed to fetch proctoring alerts via Rust:", e);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, [TEAM.length]);

  const [liveStats, setLiveStats] = useState({ todayHours: 0, focusScore: 90 });

  useEffect(() => {
    const fetchLiveStats = async () => {
      if (!user) return;
      try {
        const res: any[] = await invoke("cloud_sync_get", { 
          collectionName: "users", 
          filter: { id: user.id } 
        });
        if (res && res[0]) {
          setLiveStats({
            todayHours: res[0].todayHours || 0,
            focusScore: res[0].focusScore || 90
          });
        }
      } catch (e) {
        console.error("Failed to fetch live stats from MongoDB:", e);
      }
    };
    fetchLiveStats();
    const interval = setInterval(fetchLiveStats, 10000); 
    return () => clearInterval(interval);
  }, [user]);

  const [currentTime, setCurrentTime] = useState(new Date());

  // Toast System
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const prevUserStatuses = useRef<Record<string, string>>({});

  const addToast = (title: string, message: string, type: ToastType) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => removeToast(id), 5000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Monitor user status changes for the manager's team
  useEffect(() => {
    TEAM.forEach(u => {
      const prevStatus = prevUserStatuses.current[u.id];
      if (prevStatus && prevStatus !== u.status) {
        const type: ToastType = u.status === 'active' ? 'success' : u.status === 'away' ? 'info' : 'status';
        const statusLabel = u.status === 'active' ? 'Online' : u.status === 'away' ? 'Away' : 'Offline';
        addToast(
          `Team Member ${statusLabel}`,
          `${u.name} is now ${statusLabel.toLowerCase()}.`,
          type
        );
      }
      prevUserStatuses.current[u.id] = u.status;
    });
  }, [TEAM.length, allUsers]); // Monitor the filtered team

  useEffect(()=>{const t=setInterval(()=>setCurrentTime(new Date()),1000);return()=>clearInterval(t);},[]);

  const toggleTaskCompletion = async (id: string) => {
    const task = allTasks.find(t => t.id === id);
    if (!task) return;
    await updateTask(id, { status: task.status === "completed" ? "pending" : "completed" });
  };
  const handleSaveTask = async (t: Partial<Task>) => {
    if (editingTask) await updateTask(editingTask.id, t);
    else await addTask({ ...t, focus_time: 0, status: "pending" } as Omit<Task, "id">);
  };
  const handleSaveUser = async (u: Partial<SystemUser>) => {
    if (editingUser) await updateUser(editingUser.id, u);
    else await addUser({ ...u, id: `emp-${Date.now()}`, avatar: "#8b5cf6", initials: u.name?.substring(0, 2).toUpperCase() || "", manager_id: user?.id } as any);
  };

  const online=TEAM.filter(m=>m.status==="active").length; // mapped 'active' to online
  const avgFocus=TEAM.length ? Math.round(TEAM.reduce((a,m)=>a+(m.focusScore||90),0)/TEAM.length) : 0;
  const pending=tasks.filter(t=>t.status==="pending");
  const completed=tasks.filter(t=>t.status==="completed");

  const navItems = [
    {id:"dashboard",icon:<LayoutDashboard size={18}/>,label:"Dashboard"},
    {id:"tasks",icon:<FileText size={18}/>,label:"Tasks"},
    {id:"team",icon:<Users size={18}/>,label:"Team"},
    {id:"attendance",icon:<UserCheck size={18}/>,label:"My Attendance"},
    {id:"analytics",icon:<BarChart3 size={18}/>,label:"Reports"},
    {id:"activity",icon:<Activity size={18}/>,label:"Activity"},
    {id:"performance",icon:<TrendingUp size={18}/>,label:"Performance"},
    {id:"issues",icon:<AlertCircle size={18} className="text-red-400"/>,label:"Issues"},
    {id:"communication",icon:<MessageCircle size={18} className="text-blue-400"/>,label:"Chat"},
    {id:"settings",icon:<Settings size={18}/>,label:"Settings"},
  ];
  const viewTitles:Record<string,string>={dashboard:"Dashboard",tasks:"Task Management",team:"Team Overview",attendance:"My Attendance",analytics:"Reports & Analytics",activity:"Live Activity",performance:"Performance",settings: "Global Settings"};

  const renderDashboard = () => (
    <>
      {/* ── MY PERSONAL SESSION OVERVIEW ── */}
      <div className="glass-card bg-gradient-to-r from-blue-600/10 to-purple-600/5 border-blue-500/20 mb-6 py-4 px-6 flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-blue-500/20 text-blue-400">
            <Clock size={24} />
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-0.5">My Time Logged</div>
            <div className="text-2xl font-black text-white">{liveStats.todayHours.toFixed(1)}h <span className="text-xs text-slate-500 font-bold ml-1 uppercase">Today</span></div>
          </div>
        </div>
        
        <div className="h-12 w-[1px] bg-white/5 hidden md:block" />

        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-purple-500/20 text-purple-400">
            <Zap size={24} />
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-0.5">My Focus Score</div>
            <div className="text-2xl font-black text-white">{liveStats.focusScore}% <span className="text-xs text-emerald-400 font-bold ml-1 uppercase">Optimal</span></div>
          </div>
        </div>

        <div className="h-12 w-[1px] bg-white/5 hidden lg:block" />

        <div className="flex-1 min-w-[200px] hidden xl:block">
          <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase mb-2">
            <span>Daily Goal Progress</span>
            <span>{Math.min(100, Math.round((liveStats.todayHours / 8) * 100))}%</span>
          </div>
          <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-600 to-purple-500" style={{ width: `${Math.min(100, (liveStats.todayHours / 8) * 100)}%` }} />
          </div>
        </div>
      </div>

      <div className="stats-grid">
        {[
          { id: 'dashboard', label: "Team Members", value: String(TEAM.length), change: "Active roster", up: true, icon: <Users size={18} />, color: "from-blue-500/20 to-blue-600/5", iconColor: "text-blue-400" },
          { id: 'attendance', label: "Staff Online", value: String(TEAM.filter(m => m.status === 'active').length), change: "Live now", up: true, icon: <Activity size={18} />, color: "from-emerald-500/20 to-emerald-600/5", iconColor: "text-emerald-400" },
          { id: 'tasks', label: "Open Tasks", value: String(tasks.length), change: "Current load", up: true, icon: <Calendar size={18} />, color: "from-purple-500/20 to-purple-600/5", iconColor: "text-purple-400" },
          { id: 'issues', label: "Reported Issues", value: String(tasks.filter(t => t.has_issue).length), change: "Needs review", up: false, icon: <AlertCircle size={18} />, color: "from-red-500/20 to-red-600/5", iconColor: "text-red-400" },
          { id: 'analytics', label: "Security Alerts", value: String(proctoringAlerts.length), change: "Critical", up: false, icon: <Bell size={18} />, color: "from-orange-500/20 to-orange-600/5", iconColor: "text-orange-400" },
        ].map((s, i) => (
          <div key={i} onClick={() => setActiveView(s.id as any)} className="glass-card bg-gradient-to-br from-white/[0.03] to-transparent border-white/5 hover:border-blue-500/30 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]">
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
          <div className="section-title"><Activity size={16} className="text-purple-400" /> Activity Pulse</div>
          <div className="space-y-4">
            {activities.length > 0 ? activities.slice(0, 5).map((a, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5" />
                <div>
                  <div className="text-xs font-medium text-slate-200">{a.action}</div>
                  <div className="text-[10px] text-slate-500">{new Date(a.time).toLocaleString()}</div>
                </div>
              </div>
            )) : (
              <div className="py-4 text-center text-xs text-slate-600">No recent activity</div>
            )}
          </div>
        </div>
      </div>
      <div className="module-grid-equal">
        <div    className="glass-card">
          <div className="section-title"><Award size={16} className="text-yellow-400"/> Focus Leaderboard</div>
          {[...TEAM].sort((a,b)=>(b.focusScore||0)-(a.focusScore||0)).slice(0,3).map((m,i)=>(<div key={m.id} className="leaderboard-row"><div className={`leaderboard-rank ${i===0?"gold":i===1?"silver":i===2?"bronze":"other"}`}>{i+1}</div><div className="lb-avatar" style={{background:m.avatar}}>{m.initials}</div><div className="lb-info"><div className="lb-name">{m.name}</div><div className="lb-dept">{m.department}</div></div><span className={`status-badge ${m.status==="active"?"live":m.status==="locked"?"offline":"idle"}`}>{m.status}</span><span className="lb-score">{m.focusScore||90}%</span></div>))}
        </div>
        <div    className="glass-card">
          <div className="section-title"><PieChart size={16} className="text-blue-400"/> Team Performance</div>
          <div className="progress-ring-container"><ProgressRing value={avgFocus} max={100} label="Focus" color="#3b82f6"/><ProgressRing value={tasks.length > 0 ? Math.round((completed.length/tasks.length)*100) : 0} max={100} label="Tasks" color="#8b5cf6"/><ProgressRing value={82} max={100} label="Efficiency" color="#10b981"/></div>
          <div className="section-title" style={{marginTop:"1.5rem"}}><Zap size={16} className="text-amber-400"/> Quick Actions</div>
          <div className="quick-action-grid">
            {[{icon:<UserCheck size={16}/>,bg:"rgba(59,130,246,0.15)",color:"#60a5fa",text:"Check In",sub:"Mark attendance"},{icon:<Monitor size={16}/>,bg:"rgba(139,92,246,0.15)",color:"#a78bfa",text:"Screen Share",sub:"Start session"},{icon:<Coffee size={16}/>,bg:"rgba(251,191,36,0.15)",color:"#fbbf24",text:"Break Time",sub:"15 min break"},{icon:<Briefcase size={16}/>,bg:"rgba(16,185,129,0.15)",color:"#34d399",text:"New Project",sub:"Create project"}].map((qa,i)=>(<div key={i} className="quick-action"><div className="qa-icon" style={{background:qa.bg,color:qa.color}}>{qa.icon}</div><div><div className="qa-text">{qa.text}</div><div className="qa-sub">{qa.sub}</div></div></div>))}
          </div>
        </div>
      </div>
    </>
  );

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const renderTasks = () => {
    const selectedTask = tasks.find(t => t.id === selectedTaskId);
    
    if (selectedTaskId && selectedTask) {
      const subtasks = Array.isArray(selectedTask.subtasks) ? selectedTask.subtasks : [];
      const completedSubtasks = subtasks.filter(s => s.completed).length;
      const progress = subtasks.length > 0 ? Math.round((completedSubtasks / subtasks.length) * 100) : 0;

      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => setSelectedTaskId(null)}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-semibold"
            >
              <ArrowUpRight size={16} style={{ transform: 'rotate(-135deg)' }} /> Back to Task List
            </button>
            <div className="flex gap-3">
              <button onClick={() => { setEditingTask(selectedTask); setIsTaskModalOpen(true); }} className="px-4 py-2 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg text-sm font-bold hover:bg-blue-600/30 transition-all">Modify Details</button>
              <button onClick={async () => { if(confirm('Delete this task?')) { await deleteTask(selectedTask.id); setSelectedTaskId(null); } }} className="px-4 py-2 bg-red-600/20 text-red-400 border border-red-500/30 rounded-lg text-sm font-bold hover:bg-red-600/30 transition-all">Delete Task</button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="glass-card border-l-4 border-l-blue-500">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${
                      selectedTask.priority === 'high' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {selectedTask.priority} Priority
                    </span>
                    <h2 className="text-2xl font-bold text-white mt-2">{selectedTask.title}</h2>
                    <p className="text-slate-400 text-sm mt-3 leading-relaxed">{selectedTask.description || "No description provided."}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-white/5">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Status</div>
                    <div className={`text-sm font-bold ${selectedTask.status === 'completed' ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {selectedTask.status.toUpperCase()}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Due Date</div>
                    <div className="text-sm font-bold text-slate-200">
                      {selectedTask.due_date ? new Date(selectedTask.due_date).toLocaleDateString() : 'No Deadline'}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Focus Time</div>
                    <div className="text-sm font-bold text-slate-200">{selectedTask.focus_time}m spent</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Completion</div>
                    <div className="text-sm font-bold text-emerald-400">{progress}%</div>
                  </div>
                </div>
              </div>

              <div className="glass-card">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <FileText size={18} className="text-blue-400" /> Completion Notes & Issues
                  </h3>
                </div>
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Staff Notes</div>
                    <div className="text-sm text-slate-300 italic">
                      {selectedTask.completion_notes || "No notes provided by staff."}
                    </div>
                  </div>
                  
                  {selectedTask.has_issue && (
                    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                      <div className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <Zap size={12} /> Reported Issue
                      </div>
                      <div className="text-sm text-red-200 font-medium">
                        {selectedTask.issue_description || "Issue reported without description."}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="glass-card">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-emerald-400" /> Sub-task Breakdown
                  </h3>
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">{completedSubtasks}/{subtasks.length} Done</span>
                </div>
                <div className="space-y-3">
                  {subtasks.map(st => (
                    <div key={st.id} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-all">
                      <div className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-md border ${st.completed ? 'bg-emerald-500 border-emerald-500' : 'border-white/20'}`} />
                        <div>
                          <div className={`text-sm font-medium ${st.completed ? 'text-slate-500 line-through' : 'text-slate-200'}`}>{st.title}</div>
                          {st.assignee_email && (
                            <div className="flex items-center gap-1.5 mt-1">
                              <div className="w-4 h-4 rounded-full bg-blue-500/20 text-[8px] flex items-center justify-center text-blue-400 font-bold">
                                {st.assignee_email.substring(0,2).toUpperCase()}
                              </div>
                              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">Assigned: {st.assignee_email}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      {st.completed && <Award size={16} className="text-yellow-500/50" />}
                    </div>
                  ))}
                  {subtasks.length === 0 && (
                    <div className="py-8 text-center text-slate-600 italic text-sm">No sub-tasks listed.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-1 space-y-6">
              <div className="glass-card bg-gradient-to-br from-purple-500/10 to-transparent">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Team Assignment</h3>
                <div className="space-y-6">
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-3">Project Manager (Owner)</label>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-purple-600 flex items-center justify-center text-sm font-bold shadow-lg shadow-purple-500/20">
                        {selectedTask.owner_email?.substring(0,2).toUpperCase() || "AM"}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">{selectedTask.owner_email || user?.email}</div>
                        <div className="text-[9px] text-purple-400 font-bold uppercase tracking-widest mt-0.5">Manager</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-3">Primary Assignee</label>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-sm font-bold shadow-lg shadow-blue-500/20">
                        {selectedTask.assignee_email?.substring(0,2).toUpperCase() || "NA"}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">{selectedTask.assignee_email || "Unassigned"}</div>
                        <div className="text-[9px] text-blue-400 font-bold uppercase tracking-widest mt-0.5">Staff Member</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="glass-card">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Focus Insights</h3>
                <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 mb-3">
                  <div className="text-xs font-medium text-slate-300">Efficiency Gain</div>
                  <div className="text-xs font-bold text-emerald-400">+12%</div>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
                  <div className="text-xs font-medium text-slate-300">Time to Complete</div>
                  <div className="text-xs font-bold text-blue-400">~2.5h</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="glass-card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="section-title" style={{ marginBottom: "0.25rem" }}>
              <FileText size={16} className="text-amber-400" /> Team Tasks Registry
            </div>
            <p className="text-xs text-slate-500">Overview of all active and historical team objectives</p>
          </div>
          <button 
            className="px-6 py-2.5 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2" 
            onClick={() => { setEditingTask(null); setIsTaskModalOpen(true); }}
          >
            <Plus size={16} /> New Team Task
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-slate-500">
                <th className="pb-4 font-bold uppercase tracking-widest text-[10px] pl-2">Objective</th>
                <th className="pb-4 font-bold uppercase tracking-widest text-[10px]">Staff Assigned</th>
                <th className="pb-4 font-bold uppercase tracking-widest text-[10px]">Priority</th>
                <th className="pb-4 font-bold uppercase tracking-widest text-[10px]">Status</th>
                <th className="pb-4 font-bold uppercase tracking-widest text-[10px] text-right pr-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {tasks.length > 0 ? tasks.map(t => {
                const subtasks = Array.isArray(t.subtasks) ? t.subtasks : [];
                const completed = subtasks.filter(s => s.completed).length || 0;
                const total = subtasks.length || 0;
                const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
                
                return (
                  <tr key={t.id} className="group hover:bg-white/[0.03] transition-all cursor-pointer" onClick={() => setSelectedTaskId(t.id)}>
                    <td className="py-5 pl-2">
                      <div className="flex flex-col gap-1">
                        <div className="font-bold text-slate-200 group-hover:text-blue-400 transition-colors">{t.title}</div>
                        <div className="flex items-center gap-3 text-[10px] text-slate-500 font-bold">
                          <span className="flex items-center gap-1"><Zap size={10} className="text-amber-500" /> {total} Subtasks</span>
                          <span className="bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded">{progress}% Done</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-[10px]">
                          {t.assignee_email?.substring(0,2).toUpperCase() || "UN"}
                        </div>
                        <div className="text-xs font-semibold text-slate-400">{t.assignee_email?.split('@')[0] || "Unassigned"}</div>
                      </div>
                    </td>
                    <td className="py-5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border ${
                        t.priority === 'high' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                        t.priority === 'medium' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                        'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      }`}>
                        {t.priority}
                      </span>
                    </td>
                    <td className="py-5">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${t.status === 'completed' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'}`} />
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${t.status === 'completed' ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {t.status}
                        </span>
                      </div>
                    </td>
                    <td className="py-5 text-right pr-2">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setSelectedTaskId(t.id); }}
                          className="px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg text-[10px] font-bold text-blue-400 transition-all uppercase tracking-widest"
                        >
                          Details
                        </button>
                        <button 
                          onClick={async (e) => { 
                            e.stopPropagation(); 
                            if(confirm(`Delete "${t.title}" from team tasks?`)) {
                              await deleteTask(t.id);
                              if (selectedTaskId === t.id) setSelectedTaskId(null);
                            }
                          }}
                          className="p-2 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-red-400 transition-all border border-red-500/10"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-slate-600 font-medium italic">No team tasks have been created yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderTeam = () => (
    <div>
      <div className="stats-grid" style={{gridTemplateColumns:"repeat(3,1fr)",marginBottom:"1.5rem"}}>
        {[{label:"Active",value:String(TEAM.filter(m=>m.status==="active").length),color:"#34d399"},{label:"Inactive",value:String(TEAM.filter(m=>m.status==="inactive").length),color:"#fbbf24"},{label:"Locked",value:String(TEAM.filter(m=>m.status==="locked").length),color:"#64748b"}].map((s,i)=>(<div key={i} className="glass-card"><span className="card-label">{s.label}</span><div className="card-value" style={{color:s.color}}>{s.value}</div></div>))}
      </div>
      <div className="glass-card">
        <div className="flex items-center justify-between mb-4">
          <div className="section-title" style={{marginBottom:0}}><Users size={16} className="text-blue-400"/> Team Members</div>
          <button className="btn-primary" onClick={()=>{setEditingUser(null);setIsUserModalOpen(true);}}><Plus size={14}/> Add Team Member</button>
        </div>
        {TEAM.length === 0 ? (
          <div className="py-12 text-center">
            <Users size={48} className="mx-auto text-slate-700 mb-4 opacity-20" />
            <div className="text-slate-500 font-medium">No team members assigned yet</div>
            <div className="text-slate-600 text-xs mt-1">Contact Admin to assign staff to your management</div>
          </div>
        ) : (
          TEAM.map(m=>(<div key={m.id} className="leaderboard-row group"><div className="lb-avatar" style={{background:m.avatar}}>{m.initials}</div><div className="lb-info flex-1"><div className="lb-name">{m.name}</div><div className="lb-dept">{m.department} · {m.currentTask||'Working'}</div></div><div style={{display:"flex",alignItems:"center",gap:"0.75rem"}}><span style={{fontSize:"0.75rem",color:"#94a3b8"}}>{m.todayHours||0}h today</span><span className={`status-badge ${m.status==="active"?"live":m.status==="inactive"?"idle":"offline"}`}>{m.status}</span><span className="lb-score">{m.focusScore||90}%</span><div className="opacity-0 group-hover:opacity-100 flex items-center gap-2"><button onClick={(e)=>{e.stopPropagation();setEditingUser(m);setIsUserModalOpen(true);}} className="text-blue-400 px-2 py-1 text-xs hover:bg-blue-500/10 rounded transition-all">Edit</button><button onClick={async (e)=>{e.stopPropagation(); if(confirm(`Remove ${m.name} from your team?`)) await deleteUser(m.id);}} className="text-red-400 px-2 py-1 text-xs hover:bg-red-500/10 rounded transition-all"><Trash2 size={14}/></button></div></div></div>))
        )}
      </div>
    </div>
  );

  const renderAnalytics = () => (
    <div className="space-y-6">
      <div className="stats-grid">
        {[
          { label: "Total Team Hours", value: `${TEAM.reduce((a, m) => a + (m.todayHours || 0), 0).toFixed(1)}h`, change: "+12.5% vs last week", up: true, icon: <Clock size={18} className="text-blue-400" /> },
          { label: "Integrity Score", value: "98.5%", change: "High Trust", up: true, icon: <UserCheck size={18} className="text-emerald-400" /> },
          { label: "Avg Focus Score", value: `${avgFocus}%`, change: "+2.1% this month", up: true, icon: <Target size={18} className="text-purple-400" /> },
          { label: "Security Alerts", value: "3", change: "Action required", up: false, icon: <Bell size={18} className="text-red-400" /> },
        ].map((s, i) => (
          <div key={i} className="glass-card">
            <div className="flex items-center justify-between mb-2"><span className="card-label">{s.label}</span>{s.icon}</div>
            <div className="card-value">{s.value}</div>
            <div className={`card-change ${s.up ? "up" : ""}`}>{s.up ? <ArrowUpRight size={12} className="inline" /> : <ArrowDownRight size={12} className="inline" />} {s.change}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Users size={18} className="text-blue-400" /> Team Individual Performance
              </h3>
              <p className="text-xs text-slate-500 mt-1">Detailed breakdown of hours and integrity for each team member</p>
            </div>
            <button 
              onClick={() => { refreshUsers(); refreshTasks(); refreshSessions(); }}
              className="p-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-all border border-blue-500/10 flex items-center gap-2 text-xs font-bold uppercase tracking-widest"
            >
              <TrendingUp size={14} /> Refresh
            </button>
          </div>

          <div className="space-y-6">
              {TEAM.length > 0 ? TEAM.map((member, idx) => {
                const memberTasks = allTasks.filter(t => t.assignee_email?.toLowerCase() === member.email?.toLowerCase());
                const totalFocusMinutes = memberTasks.reduce((acc, t) => acc + (Number(t.focus_time) || 0), 0);
                const sessionMinutes = getTodayMinutes(member.id);
                
                const allSubtasks = memberTasks.flatMap(t => t.subtasks || []);
                const completedSubtasks = allSubtasks.filter(s => s.completed).length;
                const totalSubtasks = allSubtasks.length;
                const subtaskProgress = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

                return (
                  <div key={member.id} className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shadow-lg" style={{ background: member.avatar, boxShadow: `0 4px 12px ${member.avatar}44` }}>
                          {member.initials}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white">{member.name}</div>
                          <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{member.department}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Integrity</div>
                        <div className="text-sm font-bold text-emerald-400">{(member.integrityScore || 100)}%</div>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between text-[10px] font-bold">
                        <span className="text-slate-400 uppercase tracking-widest">Subtask Progress</span>
                        <span className="text-blue-400">{completedSubtasks}/{totalSubtasks} Completed ({subtaskProgress}%)</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 rounded-full"
                          style={{ width: `${subtaskProgress}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-4">
                      <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-1">
                        <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Focus Time</div>
                        <div className="text-sm font-bold text-slate-200">
                          {totalFocusMinutes < 60 ? `${totalFocusMinutes}m` : `${(totalFocusMinutes / 60).toFixed(1)}h`}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-1">
                        <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Today's Hours</div>
                        <div className="text-sm font-bold text-blue-400">
                          {sessionMinutes < 60 ? `${Math.round(sessionMinutes)}m` : `${(sessionMinutes / 60).toFixed(1)}h`}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }) : <div className="text-center py-10 text-slate-600 italic">No team members assigned yet.</div>}
          </div>
        </div>

        <div className="glass-card">
          <div className="section-title"><Bell size={16} className="text-red-400"/> Security Alerts Report</div>
          <p className="text-xs text-slate-500 mb-6">Real-time violations detected across team active sessions</p>
          
          <div className="space-y-3">
            {proctoringAlerts.length > 0 ? proctoringAlerts.slice(0, 5).map((alert, i) => {
              const user = TEAM.find(m => m.id === alert.user_id);
              return (
                <div key={i} className="flex flex-col p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${alert.severity === 'high' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'}`} />
                      <div className="text-xs font-bold text-white">{user?.name || alert.user_id}</div>
                    </div>
                    <div className="text-[10px] text-slate-500 font-bold">{new Date(alert.start_time).toLocaleTimeString()}</div>
                  </div>
                  <div className="text-[11px] text-slate-400 mb-2 font-medium">{alert.event_type?.replace(/_/g, ' ')}: {alert.duration_seconds}s violation</div>
                  <div className="flex justify-end">
                    <button className="text-[10px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-widest px-2 py-1 rounded bg-blue-400/10 transition-all">Investigate</button>
                  </div>
                </div>
              );
            }) : (
              <div className="py-8 text-center text-slate-600 text-sm italic">No security violations recorded for your team.</div>
            )}
          </div>

          <div className="mt-8 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10">
            <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">What is Integrity Score?</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              The <strong>Integrity Score</strong> measures behavioral compliance. Starting at 100%, points are deducted for violations such as:
              <br/>• <span className="text-slate-300">Tab Switching</span> (-5 pts)
              <br/>• <span className="text-slate-300">Face Visibility</span> (-2 pts/min missing)
              <br/>• <span className="text-slate-300">Unauthorized Persons</span> detected (-15 pts)
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const [activitySearch, setActivitySearch] = useState("");

  const renderActivity = () => {
    const filteredActivities = activities.filter(a => 
      a.user_name.toLowerCase().includes(activitySearch.toLowerCase()) ||
      a.action.toLowerCase().includes(activitySearch.toLowerCase())
    );

    return (
      <div className="glass-card">
        <div className="flex items-center justify-between mb-6">
          <div className="section-title" style={{marginBottom:0}}>
            <Activity size={16} className="text-emerald-400"/> Team Activity Feed
          </div>
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search employee..." 
              className="bg-white/5 border border-white/10 rounded-lg py-1.5 px-3 text-xs text-slate-300 focus:border-blue-500/50 outline-none w-48 transition-all"
              value={activitySearch}
              onChange={(e) => setActivitySearch(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-4">
          {filteredActivities.length > 0 ? filteredActivities.map((a, i) => (
            <div key={i} className="activity-item group hover:bg-white/[0.02] transition-all p-3 rounded-xl border border-transparent hover:border-white/5">
              <div className={`activity-dot ${a.status}`}/>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">{a.user_name}</div>
                  <div className="text-[10px] text-slate-500 font-medium uppercase">{new Date(a.time).toLocaleString()}</div>
                </div>
                <div className="text-xs text-slate-400 italic">{a.action}</div>
              </div>
            </div>
          )) : (
            <div className="py-12 text-center text-slate-600 text-sm italic">No activities match your search.</div>
          )}
        </div>
      </div>
    );
  };

  const renderPerformance = () => (
    <div className="glass-card">
      <div className="section-title"><Award size={16} className="text-yellow-400"/> Performance Matrix</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
        <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5">
          <h4 className="text-sm font-bold text-white mb-4">Focus vs Integrity Trend</h4>
          <div className="h-48 w-full bg-white/5 rounded-xl border border-dashed border-white/10 flex items-center justify-center">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest opacity-30">Team Performance Visualization</span>
          </div>
        </div>
        <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5">
          <h4 className="text-sm font-bold text-white mb-4">Task Completion Velocity</h4>
          <div className="h-48 w-full bg-white/5 rounded-xl border border-dashed border-white/10 flex items-center justify-center">
             <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest opacity-30">Velocity Metrics Chart</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="glass-card" style={{maxWidth:600}}>
      <div className="section-title"><Settings size={16} className="text-gray-400"/> Application Settings</div>
      {[{label:"Management Node",value:"Cloud-Global-01"},{label:"Database Version",value:"MongoDB Atlas 7.0"},{label:"Organization",value:"FocusSync CRM Corporate"}].map((f,i)=>(<div key={i} style={{marginBottom:"1rem"}}><label style={{fontSize:"0.7rem",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",color:"#64748b",display:"block",marginBottom:"0.35rem"}}>{f.label}</label><input className="inline-input" value={f.value} readOnly style={{opacity:0.7,cursor:"not-allowed"}}/></div>))}
      <div className="mt-8 pt-8 border-t border-white/5">
        <button onClick={logout} className="px-6 py-2 bg-red-600/10 text-red-400 border border-red-500/20 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-red-600/20 transition-all">Full System Sign Out</button>
      </div>
    </div>
  );

  const renderAttendance = () => (
    <div style={{ maxWidth: 800 }}>
       <AttendanceReport userId={user?.id || ""} />
    </div>
  );

  const renderIssues = () => {
    const issues = tasks.filter(t => t.has_issue);
    return (
      <div className="glass-card">
        <div className="section-title"><AlertCircle size={16} className="text-red-400" /> Critical Blockers</div>
        <div className="space-y-4 mt-6">
          {issues.length > 0 ? issues.map(t => (
            <div key={t.id} className="p-4 rounded-xl bg-red-500/5 border border-red-500/10 flex items-start justify-between">
              <div>
                <div className="font-bold text-red-200 text-sm mb-1">{t.title}</div>
                <div className="text-xs text-red-400/80 mb-3">Assigned to: {t.assignee_email}</div>
                <div className="text-xs text-slate-300 italic p-3 bg-black/20 rounded-lg border border-red-500/5">{t.issue_description || "No description provided."}</div>
              </div>
              <button 
                onClick={() => updateTask(t.id, { has_issue: false })}
                className="px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-[10px] font-bold uppercase"
              >
                Resolve
              </button>
            </div>
          )) : (
            <div className="py-12 text-center text-slate-600 italic">No critical issues reported by the team.</div>
          )}
        </div>
      </div>
    );
  };

  const renderCommunication = () => (
    <ManagerCommunicationPanel
      currentUser={user}
      allUsers={allUsers}
      messages={messages}
      sendMessage={sendMessage}
    />
  );

  const views:Record<string,()=>React.JSX.Element>={dashboard:renderDashboard,tasks:renderTasks,team:renderTeam,attendance:renderAttendance,analytics:renderAnalytics,activity:renderActivity,performance:renderPerformance,settings:renderSettings,issues:renderIssues,communication:renderCommunication};

  return (
    <div className="app-shell">
      <motion.aside className="sidebar">
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
        <div className="nav-section-label">Management</div>
        {navItems.slice(0,3).map(item=>(<div key={item.id} className={`nav-link ${activeView===item.id?"active":""}`} onClick={()=>setActiveView(item.id)}>{item.icon}<span>{item.label}</span></div>))}
        <div className="nav-section-label">Insights</div>
        {navItems.slice(3,8).map(item=>(<div key={item.id} className={`nav-link ${activeView===item.id?"active":""}`} onClick={()=>setActiveView(item.id)}>{item.icon}<span>{item.label}</span></div>))}
        <div className="nav-section-label">System</div>
        {navItems.slice(8).map(item=>(<div key={item.id} className={`nav-link ${activeView===item.id?"active":""}`} onClick={()=>setActiveView(item.id)}>{item.icon}<span>{item.label}</span></div>))}
        
        <div className="sidebar-footer">
          <div className="user-card">
            <div className="user-avatar" style={{background:user?.avatar}}>{user?.initials}</div>
            <div className="user-details"><div className="user-name">{user?.name}</div><div className="user-role">Manager</div></div>
          </div>
          <div className="nav-link" onClick={logout}><LogOut size={18}/><span>Sign Out</span></div>
        </div>
      </motion.aside>
      <div className="main-area">
        <div className="page-header">
          <div>
            <h1>{viewTitles[activeView]||"Overview"}</h1>
            <div className="date-badge"><Calendar size={12} className="inline mr-1"/>{currentTime.toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"})} · {currentTime.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}</div>
          </div>
          <div className="flex items-center gap-3">
             <div className="flex -space-x-2 mr-4">
                {TEAM.slice(0, 4).map(m => (
                  <div key={m.id} title={m.name} className="w-8 h-8 rounded-full border-2 border-[#0f172a] flex items-center justify-center text-[10px] font-bold" style={{ background: m.avatar }}>{m.initials}</div>
                ))}
                {TEAM.length > 4 && <div className="w-8 h-8 rounded-full border-2 border-[#0f172a] bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">+{TEAM.length - 4}</div>}
             </div>
             <button className="btn-secondary relative"><Bell size={16}/>{proctoringAlerts.length > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.5)]" />}</button>
             <button className="btn-primary" onClick={() => { setEditingTask(null); setIsTaskModalOpen(true); }}><Plus size={16}/> New Task</button>
          </div>
        </div>
        <div className="flex-1 w-full h-full">
          {views[activeView] ? views[activeView]() : renderDashboard()}
        </div>
      </div>
      <TaskModal isOpen={isTaskModalOpen} onClose={()=>setIsTaskModalOpen(false)} task={editingTask} onSave={handleSaveTask} />
      <UserModal isOpen={isUserModalOpen} onClose={()=>setIsUserModalOpen(false)} userToEdit={editingUser} onSave={handleSaveUser} />
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, Settings, LogOut, Activity,
  Calendar, Bell, Shield, Server,
  Database, HardDrive, Cpu, AlertTriangle, ArrowUpRight, ArrowDownRight,
  UserPlus, Lock, ShieldCheck, Mail, X, Search, Filter, Clock
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useUsers, SystemUser } from "@/hooks/useUsers";
import { useTasks, Task } from "@/hooks/useTasks";
import { useAttendance } from "@/hooks/useAttendance";
import { UserModal } from "@/components/ui/Modals";
import { TaskModal } from "@/components/ui/Modals";
import { DataSyncService } from "@/services/syncService";
import { useMessages } from "@/hooks/useMessages";
import { useActivities } from "@/hooks/useActivities";
import { MessageCircle, AlertCircle, Send } from "lucide-react";
import { FocusSyncLogo } from "./ui/FocusSyncLogo";
import { ToastContainer, ToastMessage, ToastType } from "./ui/Toast";
import { useRef } from "react";

// Removed mock AUDIT_LOGS in favor of real activities

// ✅ Proper React component — hooks are at top level, not inside a render function
function AdminCommunicationPanel({
  currentUser,
  systemUsers,
  messages,
  sendMessage,
}: {
  currentUser: any;
  systemUsers: any[];
  messages: any[];
  sendMessage: (senderId: string, receiverId: string, content: string) => void;
}) {
  const [msgText, setMsgText] = useState("");
  const [selectedChatUser, setSelectedChatUser] = useState<SystemUser | null>(null);

  const chatMessages = messages.filter(m => 
    (m.sender_id === currentUser?.id && m.receiver_id === selectedChatUser?.id) ||
    (m.sender_id === selectedChatUser?.id && m.receiver_id === currentUser?.id)
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-180px)] min-h-[600px]">
      <div className="lg:col-span-4 glass-card flex flex-col overflow-hidden p-0">
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <div className="section-title mb-0">Direct Messages</div>
          <div className="text-[10px] font-black text-blue-400 bg-blue-500/10 px-2 py-1 rounded">SECURE</div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {systemUsers.filter(u => u.id !== currentUser?.id).map(u => (
            <div 
              key={u.id} 
              onClick={() => setSelectedChatUser(u)}
              className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all border ${selectedChatUser?.id === u.id ? 'bg-blue-600/10 border-blue-500/20' : 'bg-transparent border-transparent hover:bg-white/[0.03]'}`}
            >
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-sm shadow-lg shrink-0" style={{ background: u.avatar }}>{u.initials}</div>
              <div className="overflow-hidden">
                <div className="text-sm font-bold text-white truncate">{u.name}</div>
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{u.role} · {u.department}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="lg:col-span-8 glass-card flex flex-col p-0 overflow-hidden relative">
        {selectedChatUser ? (
          <>
            <div className="p-5 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black shadow-xl" style={{ background: selectedChatUser.avatar }}>{selectedChatUser.initials}</div>
                <div>
                  <div className="font-extrabold text-white text-lg">{selectedChatUser.name}</div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
                    <span className="text-xs text-emerald-400 font-bold uppercase tracking-widest">Active Now</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {chatMessages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 italic text-sm gap-2 opacity-50">
                  <MessageCircle size={32} />
                  <span>No message history. Start the conversation.</span>
                </div>
              )}
              {chatMessages.map(m => (
                <div key={m.id} className={`flex ${m.sender_id === currentUser?.id ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] p-4 rounded-3xl text-sm leading-relaxed shadow-xl ${m.sender_id === currentUser?.id ? 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-tr-none' : 'bg-white/10 text-slate-200 rounded-tl-none border border-white/5'}`}>
                    {m.content}
                    <div className="text-[9px] opacity-60 mt-2 font-bold text-right tracking-tighter">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-6 border-t border-white/5 bg-white/[0.01]">
              <div className="relative flex items-center gap-3">
                <input 
                  type="text" 
                  value={msgText}
                  onChange={e => setMsgText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && msgText.trim() && (sendMessage(currentUser!.id, selectedChatUser.id, msgText), setMsgText(""))}
                  className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-slate-600"
                  placeholder={`Message ${selectedChatUser.name.split(' ')[0]}...`}
                />
                <button 
                  onClick={() => { if(msgText.trim()) { sendMessage(currentUser!.id, selectedChatUser.id, msgText); setMsgText(""); } }}
                  className="p-4 bg-blue-600 text-white rounded-2xl hover:bg-blue-500 shadow-lg shadow-blue-600/20 transition-all active:scale-95 flex items-center justify-center"
                >
                  <Send size={20} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-6">
            <div className="w-24 h-24 rounded-[2rem] bg-blue-500/5 border border-blue-500/10 flex items-center justify-center">
              <MessageCircle size={48} className="opacity-10" />
            </div>
            <div className="text-center">
              <div className="font-bold text-slate-300">Channel Encrypted</div>
              <div className="text-xs text-slate-600 mt-1">Select a team member to initiate secure communication</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [activeView, setActiveView] = useState("dashboard");
  const { users: systemUsers, addUser, updateUser, deleteUser, refresh: fetchUsers } = useUsers();
  const { tasks, addTask, updateTask, deleteTask, refresh: fetchTasks } = useTasks();
  const { activeSessions, proctoringAlerts, fetchActiveStatus, fetchAlerts, fetchAllUserStats } = useAttendance();
  const { messages, sendMessage } = useMessages();
  const { activities } = useActivities();

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

  // Monitor user status changes
  useEffect(() => {
    systemUsers.forEach(u => {
      const prevStatus = prevUserStatuses.current[u.id];
      if (prevStatus && prevStatus !== u.status) {
        const type: ToastType = u.status === 'active' ? 'success' : u.status === 'away' ? 'info' : 'status';
        const statusLabel = u.status === 'active' ? 'Online' : u.status === 'away' ? 'Away' : 'Offline';
        addToast(
          `User ${statusLabel}`,
          `${u.name} is now ${statusLabel.toLowerCase()}.`,
          type
        );
      }
      prevUserStatuses.current[u.id] = u.status;
    });
  }, [systemUsers]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [allUserStats, setAllUserStats] = useState<any[]>([]);
  const [selectedAttendanceUser, setSelectedAttendanceUser] = useState<any | null>(null);
  const [attendanceFilter, setAttendanceFilter] = useState<string>("all");

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [userRole, setUserRole] = useState("employee");
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null);

  // ✅ FIX: Run only once on mount. useUsers/useTasks hooks already poll every 30s internally.
  // Do NOT put fetchUsers/fetchTasks/fetchActiveStatus/fetchAlerts in the dep array —
  // they are recreated on every render and would cause a render loop.
  useEffect(() => {
    fetchActiveStatus();
    fetchAlerts();
    fetchAllUserStats().then(setAllUserStats);
    DataSyncService.triggerSync();

    const interval = setInterval(() => {
      fetchActiveStatus();
      fetchAlerts();
      fetchAllUserStats().then(setAllUserStats);
      setCurrentTime(new Date());
    }, 30000);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (window as any).allUsers = systemUsers;
  }, [systemUsers]);

  const handleSaveUser = async (u: Partial<SystemUser>) => {
    if (editingUser) {
      await updateUser(editingUser.id, u);
    } else {
      const rolePrefix = u.role === 'admin' ? 'adm' : u.role === 'manager' ? 'mng' : 'emp';
      const newId = `${rolePrefix}-${Date.now()}`;
      const avatarColor = u.role === 'admin' ? '#f59e0b' : u.role === 'manager' ? '#8b5cf6' : '#3b82f6';
      
      await addUser({ 
        ...u, 
        id: newId, 
        avatar: avatarColor, 
        initials: u.name?.substring(0, 2).toUpperCase() || "FS",
        status: "active",
        todayHours: 0,
        focusScore: 90
      } as any);
    }
    fetchUsers();
    setIsUserModalOpen(false);
  };

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);


  const navItems = [
    { id: "dashboard", icon: <LayoutDashboard size={18} />, label: "System Overview" },
    { id: "users", icon: <Users size={18} />, label: "User Management" },
    { id: "teams", icon: <Users size={18} className="text-purple-400" />, label: "Team Hierarchy" },
    { id: "tasks", icon: <Calendar size={18} />, label: "Task Management" },
    { id: "issues", icon: <AlertCircle size={18} className="text-red-400" />, label: "Raised Issues" },
    { id: "audit", icon: <Activity size={18} />, label: "Attendance & Alerts" },
    { id: "settings", icon: <Settings size={18} />, label: "Global Settings" },
  ];
  
  const viewTitles: Record<string, string> = { 
    dashboard: "System Overview", 
    users: "User Management", 
    teams: "Team Hierarchy",
    tasks: "Task Management",
    issues: "Raised Issues Tracker",
    audit: "Attendance & Proctoring Alerts", 
    settings: "Global Settings" 
  };

  const renderDashboard = () => (
    <>
      <div className="stats-grid">
        {[
          { id: 'users', label: "Total Users", value: String(systemUsers.length), change: "+1 this week", up: true, icon: <Users size={18} />, color: "from-blue-500/20 to-blue-600/5", iconColor: "text-blue-400" },
          { id: 'audit', label: "Active Sessions", value: String(activeSessions.length), change: activeSessions.length > 0 ? "Real-time" : "Quiet", up: activeSessions.length > 0, icon: <Activity size={18} />, color: "from-emerald-500/20 to-emerald-600/5", iconColor: "text-emerald-400" },
          { id: 'tasks', label: "Tasks Running", value: String(tasks.filter(t => t.status === 'pending').length), change: "Open tasks", up: true, icon: <Calendar size={18} />, color: "from-purple-500/20 to-purple-600/5", iconColor: "text-purple-400" },
          { id: 'audit', label: "Security Alerts", value: String(proctoringAlerts.length), change: "Needs attention", up: false, icon: <AlertTriangle size={18} />, color: "from-red-500/20 to-red-600/5", iconColor: "text-red-400" },
          { id: 'issues', label: "Raised Issues", value: String(tasks.filter(t => t.has_issue).length), change: "Action required", up: false, icon: <AlertCircle size={18} />, color: "from-orange-500/20 to-orange-600/5", iconColor: "text-orange-400" },
        ].map((s, i) => (
          <div 
            key={i} 
            onClick={() => setActiveView(s.id as any)}
            className={`glass-card bg-gradient-to-br ${s.color} border-white/10 hover:border-blue-500/30 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="card-label text-slate-400 font-bold uppercase tracking-wider text-[10px]">{s.label}</span>
              <div className={`p-2 rounded-lg bg-white/5 ${s.iconColor}`}>
                {s.icon}
              </div>
            </div>
            <div className="card-value text-3xl font-extrabold text-white mb-1">{s.value}</div>
            <div className={`flex items-center gap-1 text-[10px] font-bold ${s.up ? "text-emerald-400" : "text-red-400"}`}>
              {s.up ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
              {s.change}
            </div>
          </div>
        ))}
      </div>

      <div className="module-grid">
        <div className="glass-card col-span-full">
          <div className="flex items-center justify-between mb-6">
            <div className="section-title mb-0"><Calendar size={16} className="text-blue-400" /> Important Tasks (High Priority)</div>
            <button onClick={() => setActiveView('tasks')} className="text-[10px] font-bold text-blue-400 hover:text-white transition-all uppercase tracking-widest px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">View All</button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {tasks.filter(t => t.status !== 'completed').slice(0, 6).map((task, i) => {
              const isHigh = task.priority === 'high';
              const barColor = isHigh ? "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]" : (task.is_running ? "bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" : "bg-slate-600");
              
              return (
                <div 
                  key={task.id} 
                  className="relative overflow-hidden p-4 rounded-2xl bg-white/[0.03] border border-white/5 cursor-pointer group hover:bg-white/[0.05]"
                  onClick={() => setActiveView('tasks')}
                >
                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${barColor}`} />
                  
                  <div className="pl-3">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter border ${isHigh ? "bg-red-500/20 text-red-400 border-red-500/30" : (task.is_running ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : "bg-white/5 text-slate-500 border-white/5")}`}>
                          {isHigh ? 'High Priority' : task.status}
                        </span>
                        {task.is_running && <span className="flex items-center gap-1 text-[8px] font-bold text-emerald-400 uppercase tracking-widest"><span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse"/> Active</span>}
                      </div>
                      <AlertTriangle size={12} className={isHigh ? "text-red-400 animate-pulse" : (task.is_running ? "text-blue-400" : "text-slate-600")} />
                    </div>

                    <h4 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-1 mb-4 leading-tight">
                      {task.title}
                    </h4>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-600/20 border border-white/10 flex items-center justify-center text-[11px] font-black text-blue-300">
                          {task.assignee_email?.substring(0, 1).toUpperCase() || "A"}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-slate-300 truncate max-w-[120px]">{task.assignee_email?.split('@')[0]}</span>
                          <span className="text-[8px] text-slate-500 font-medium uppercase tracking-widest">Assignee</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-[11px] font-mono font-bold ${isHigh ? "text-red-400" : "text-blue-400"}`}>{task.focus_time}m</div>
                        <div className="text-[8px] text-slate-600 font-bold uppercase tracking-widest">Focus</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {tasks.filter(t => t.status !== 'completed').length === 0 && (
              <div className="col-span-full py-16 flex flex-col items-center justify-center text-slate-500 gap-3 glass-card bg-white/[0.01]">
                <Calendar size={32} className="opacity-20" />
                <div className="italic text-sm">All clear! No pending tasks in the queue.</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );

  const renderUsers = () => {
    const filteredUsers = systemUsers.filter(u => {
      const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           u.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === "all" || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });

    return (
      <div className="glass-card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="section-title" style={{ marginBottom: "0.25rem" }}>
              <Users size={16} className="text-blue-400" /> User Directory
            </div>
            <p className="text-xs text-slate-500">Manage and monitor all platform members</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="search-container">
              <Search size={14} className="search-icon" />
              <input 
                type="text" 
                placeholder="Search name or email..." 
                className="search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="filter-bar">
              <button 
                className={`filter-btn ${roleFilter === 'all' ? 'active' : ''}`}
                onClick={() => setRoleFilter('all')}
              >
                All
              </button>
              <button 
                className={`filter-btn ${roleFilter === 'manager' ? 'active' : ''}`}
                onClick={() => setRoleFilter('manager')}
              >
                Managers
              </button>
              <button 
                className={`filter-btn ${roleFilter === 'employee' ? 'active' : ''}`}
                onClick={() => setRoleFilter('employee')}
              >
                Staff
              </button>
            </div>

            <div className="flex gap-2">
              <button className="px-4 py-2 rounded-lg text-sm font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 transition-all flex items-center gap-2" onClick={() => { setEditingUser(null); setUserRole('admin'); setIsUserModalOpen(true); }}>
                <ShieldCheck size={14} /> Add Admin
              </button>
              <button className="px-4 py-2 rounded-lg text-sm font-semibold bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30 transition-all flex items-center gap-2" onClick={() => { setEditingUser(null); setUserRole('manager'); setIsUserModalOpen(true); }}>
                <Shield size={14} /> Add Manager
              </button>
              <button className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-all flex items-center gap-2" onClick={() => { setEditingUser(null); setUserRole('employee'); setIsUserModalOpen(true); }}>
                <UserPlus size={14} /> Add Staff
              </button>
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-slate-400">
                <th className="pb-4 font-semibold pl-2">User</th>
                <th className="pb-4 font-semibold">Role</th>
                <th className="pb-4 font-semibold">Department</th>
                <th className="pb-4 font-semibold">Status</th>
                <th className="pb-4 font-semibold text-right pr-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredUsers.length > 0 ? filteredUsers.map(u => (
                <tr key={u.id} className="group hover:bg-white/5 transition-colors">
                  <td className="py-4 pl-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm bg-slate-800 text-slate-200 border border-white/10">
                        {u.initials || u.name.substring(0,2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-200">{u.name}</div>
                        <div className="text-[11px] text-slate-500">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      u.role === 'admin' ? 'bg-amber-500/20 text-amber-400' :
                      u.role === 'manager' ? 'bg-purple-500/20 text-purple-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="py-4">
                    <span className="text-xs text-slate-400 font-medium">{u.department || 'General'}</span>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${u.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      <span className="text-xs text-slate-300 capitalize">{u.status}</span>
                    </div>
                  </td>
                  <td className="py-4 text-right pr-2">
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setConfirmAction({
                          id: u.id,
                          type: 'user',
                          title: `Delete user "${u.name}"?`,
                          onConfirm: async () => { await deleteUser(u.id); }
                        });
                      }}
                      className="px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-400/10 border border-red-500/20 rounded-lg transition-all"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-500 italic">
                    <div className="flex flex-col items-center gap-2">
                      <Search size={24} className="text-slate-700" />
                      <span>No users found matching your criteria</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ 
    id: string; 
    type: 'user' | 'task'; 
    title: string; 
    onConfirm: () => Promise<void> 
  } | null>(null);

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
              <X size={16} /> Back to Task List
            </button>
            <div className="flex gap-3 items-center">
              <button onClick={() => { setEditingTask(selectedTask); setIsTaskModalOpen(true); }} className="px-4 py-2 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg text-sm font-bold hover:bg-blue-600/30 transition-all">Edit Task</button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmAction({
                      id: selectedTask.id,
                      type: 'task',
                      title: `Permanently delete task "${selectedTask.title}"?`,
                      onConfirm: async () => { 
                        await deleteTask(selectedTask.id); 
                        setSelectedTaskId(null); 
                      }
                    });
                  }}
                  className="px-4 py-2 bg-red-600/20 text-red-400 border border-red-500/30 rounded-lg text-sm font-bold hover:bg-red-600/30 transition-all"
                >
                  Delete
                </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="glass-card bg-gradient-to-br from-blue-500/10 to-transparent">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${
                      selectedTask.priority === 'high' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {selectedTask.priority} Priority
                    </span>
                    <h2 className="text-2xl font-bold text-white mt-2">{selectedTask.title}</h2>
                    <p className="text-slate-400 text-sm mt-2 leading-relaxed">{selectedTask.description || "No description provided."}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-white/5">
                  <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Status</div>
                    <div className={`text-sm font-bold ${selectedTask.status === 'completed' ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {selectedTask.status.toUpperCase()}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Due Date</div>
                    <div className="text-sm font-bold text-slate-200">
                      {selectedTask.due_date ? new Date(selectedTask.due_date).toLocaleDateString() : 'No Deadline'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Focus Time</div>
                    <div className="text-sm font-bold text-slate-200">{selectedTask.focus_time}m spent</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Progress</div>
                    <div className="text-sm font-bold text-emerald-400">{progress}%</div>
                  </div>
                </div>
              </div>

              <div className="glass-card">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Activity size={18} className="text-blue-400" /> Sub-tasks List
                  </h3>
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">{completedSubtasks}/{subtasks.length} Completed</span>
                </div>
                <div className="space-y-3">
                  {subtasks.map(st => (
                    <div key={st.id} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-all">
                      <div className="flex items-center gap-4">
                        <div className={`w-2 h-2 rounded-full ${st.completed ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                        <div>
                          <div className={`text-sm font-medium ${st.completed ? 'text-slate-500 line-through' : 'text-slate-200'}`}>{st.title}</div>
                          {st.assignee_email && <div className="text-[10px] text-blue-400 font-bold uppercase tracking-widest mt-0.5">Assignee: {st.assignee_email}</div>}
                        </div>
                      </div>
                      {st.completed && <ShieldCheck size={16} className="text-emerald-500" />}
                    </div>
                  ))}
                  {subtasks.length === 0 && (
                    <div className="py-8 text-center text-slate-500 italic text-sm">No sub-tasks defined for this task.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-1 space-y-6">
              <div className="glass-card">
                <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-6">Stakeholders</h3>
                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-3">Task Owner</label>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
                        {selectedTask.owner_email?.substring(0,2).toUpperCase() || "NA"}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">{selectedTask.owner_email || "Not Assigned"}</div>
                        <div className="text-[10px] text-purple-400 font-bold uppercase">Primary Stakeholder</div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-3">Main Assignee</label>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                        {selectedTask.assignee_email?.substring(0,2).toUpperCase() || "NA"}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">{selectedTask.assignee_email || "Unassigned"}</div>
                        <div className="text-[10px] text-blue-400 font-bold uppercase">Task Executor</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="glass-card bg-emerald-500/5 border-emerald-500/20">
                <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-4">Task Timeline</h3>
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="w-0.5 bg-emerald-500/30 relative">
                      <div className="absolute -left-1 top-0 w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    </div>
                    <div className="pb-4">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Created</div>
                      <div className="text-xs text-slate-300 font-medium">Recently</div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-0.5 bg-white/10" />
                    <div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Last Updated</div>
                      <div className="text-xs text-slate-300 font-medium">Just now</div>
                    </div>
                  </div>
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
              <Calendar size={16} className="text-purple-400" /> Platform Tasks
            </div>
            <p className="text-xs text-slate-500">Monitor and manage operational objectives</p>
          </div>
          <div className="flex gap-2">
            <button 
              className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-all flex items-center gap-2" 
              onClick={() => { setEditingTask(null); setIsTaskModalOpen(true); }}
            >
              <Shield size={14} /> New Manager Task
            </button>
            <button 
              className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-all flex items-center gap-2" 
              onClick={() => { setEditingTask(null); setIsTaskModalOpen(true); }}
            >
              <UserPlus size={14} /> New Staff Task
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-slate-400">
                <th className="pb-4 font-semibold pl-2">Task Hierarchy</th>
                <th className="pb-4 font-semibold">Ownership</th>
                <th className="pb-4 font-semibold">Priority</th>
                <th className="pb-4 font-semibold">Status</th>
                <th className="pb-4 font-semibold text-right pr-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {tasks.length > 0 ? tasks.map(t => {
                const subtasks = Array.isArray(t.subtasks) ? t.subtasks : [];
                const completed = subtasks.filter(s => s.completed).length || 0;
                const total = subtasks.length || 0;
                const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
                
                return (
                  <tr key={t.id} className="group hover:bg-white/5 transition-all cursor-pointer" onClick={() => setSelectedTaskId(t.id)}>
                    <td className="py-5 pl-2">
                      <div className="flex flex-col gap-1">
                        <div className="font-bold text-slate-200 group-hover:text-blue-400 transition-colors">{t.title}</div>
                        <div className="flex items-center gap-3 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                          <span className="flex items-center gap-1"><Activity size={10} /> {total} Subtasks</span>
                          <span className="flex items-center gap-1 text-emerald-400/80">{progress}% Done</span>
                          {t.is_running && <span className="flex items-center gap-1 text-blue-400 animate-pulse"><Clock size={10} /> Active</span>}
                        </div>
                      </div>
                    </td>
                    <td className="py-5">
                      <div className="flex flex-col">
                        <div className="text-xs font-bold text-slate-300">{t.assignee_email || "Unassigned"}</div>
                        <div className="text-[9px] text-slate-600 font-bold uppercase tracking-widest mt-1">Owner: {t.owner_email || 'System'}</div>
                      </div>
                    </td>
                    <td className="py-5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${
                        t.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                        t.priority === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {t.priority}
                      </span>
                    </td>
                    <td className="py-5">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${t.status === 'completed' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        <span className={`text-xs font-bold uppercase tracking-widest ${t.status === 'completed' ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {t.status}
                        </span>
                      </div>
                    </td>
                    <td className="py-5 text-right pr-2">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setSelectedTaskId(t.id); }}
                          className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-bold text-slate-300 transition-all border border-white/5 uppercase tracking-widest"
                        >
                          Details
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setEditingTask(t); setIsTaskModalOpen(true); }}
                          className="p-2 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg text-blue-400 transition-all border border-blue-500/10"
                          title="Edit Task"
                        >
                          <Settings size={14} />
                        </button>
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setConfirmAction({
                              id: t.id,
                              type: 'task',
                              title: `Delete task "${t.title}"?`,
                              onConfirm: async () => { 
                                await deleteTask(t.id);
                                if (selectedTaskId === t.id) setSelectedTaskId(null);
                              }
                            });
                          }}
                          className="p-2 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-red-400 transition-all border border-red-500/10"
                          title="Delete Task"
                        >
                          <AlertTriangle size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500 italic">No tasks found in the system.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderAudit = () => {
    const filtered = allUserStats.filter(u =>
      attendanceFilter === "all" ? true : u.role === attendanceFilter
    );

    const getScoreColor = (score: number) =>
      score >= 85 ? '#34d399' : score >= 65 ? '#fbbf24' : '#f87171';
    
    const getScoreLabel = (score: number) =>
      score >= 85 ? 'Excellent' : score >= 65 ? 'Warning' : 'Critical';

    const fmtTime = (mins: number) => {
      const h = Math.floor(mins / 60), m = mins % 60;
      return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };

    const faceVis = (u: any) => {
      if (!u.total_minutes) return 100;
      return Math.max(0, Math.round(100 - (u.face_missing_duration / (u.total_minutes * 60)) * 100));
    };

    if (selectedAttendanceUser) {
      const u = selectedAttendanceUser;
      const scoreColor = getScoreColor(Math.round(u.integrity_score || 100));
      const scoreBg = `${scoreColor}15`;
      const rows = [
        { label: 'Total Session Time', value: fmtTime(u.total_minutes || 0), color: '#60a5fa' },
        { label: 'Total Keystrokes', value: (u.total_keystrokes || 0).toLocaleString(), color: '#a78bfa' },
        { label: 'Camera Presence', value: `${faceVis(u)}%`, color: '#34d399' },
        { label: 'Sessions Logged', value: String(u.session_count || 0), color: '#60a5fa' },
        { label: 'Security Violations', value: String(u.violations || 0), color: u.violations > 0 ? '#f87171' : '#34d399' },
      ];

      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <button onClick={() => setSelectedAttendanceUser(null)} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-semibold">
              <X size={16} /> Back to All Staff
            </button>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${u.role === 'manager' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/30'}`}>{u.role}</span>
              {u.is_online && <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-widest"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Online</span>}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-4">
              <div className="glass-card flex flex-col items-center text-center gap-4">
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-black shadow-lg" style={{ background: u.avatar || '#6366f1' }}>{u.initials}</div>
                <div>
                  <div className="text-xl font-bold text-white">{u.name}</div>
                  <div className="text-xs text-slate-400 mt-1">{u.email}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{u.department || 'No Department'}</div>
                </div>
                <div className="w-full p-4 rounded-2xl border" style={{ background: scoreBg, borderColor: `${scoreColor}30` }}>
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Integrity Score</div>
                  <div className="text-4xl font-black" style={{ color: scoreColor }}>{Math.round(u.integrity_score || 100)}%</div>
                  <div className="text-xs font-bold mt-1" style={{ color: scoreColor }}>{getScoreLabel(Math.round(u.integrity_score || 100))}</div>
                </div>
                {u.last_seen && <div className="w-full text-center text-[10px] text-slate-500">Last seen: {new Date(u.last_seen).toLocaleString()}</div>}
              </div>
            </div>

            <div className="lg:col-span-2 space-y-4">
              <div className="glass-card">
                <div className="section-title"><Activity size={15} className="text-blue-400" /> Attendance Breakdown</div>
                <div className="space-y-3">
                  {rows.map((row, i) => (
                    <div key={i} className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-all">
                      <span className="text-sm text-slate-400">{row.label}</span>
                      <span className="text-lg font-bold font-mono" style={{ color: row.color }}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-card">
                <div className="section-title"><Shield size={15} className="text-red-400" /> Proctoring Alerts</div>
                {proctoringAlerts.filter((p: any) => p.user_id === u.id).length === 0 ? (
                  <div className="py-8 text-center text-slate-600 text-sm italic">No security violations recorded.</div>
                ) : (
                  <div className="space-y-2">
                    {proctoringAlerts.filter((p: any) => p.user_id === u.id).map((alert: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                        <div>
                          <div className="text-xs font-bold text-red-400 uppercase tracking-wider">{alert.event_type?.replace(/_/g, ' ')}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{new Date(alert.start_time).toLocaleString()}</div>
                        </div>
                        <span className="text-xs text-red-300 font-mono">{alert.duration_seconds}s</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="glass-card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="section-title" style={{ marginBottom: '0.25rem' }}><Activity size={16} className="text-emerald-400" /> Staff Attendance Overview</div>
            <p className="text-xs text-slate-500">{filtered.length} personnel · Click row for details</p>
          </div>
          <div className="flex items-center gap-2">
            {['all', 'manager', 'employee'].map(f => (
              <button key={f} onClick={() => setAttendanceFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border ${attendanceFilter === f ? 'bg-blue-600 text-white border-blue-500' : 'bg-white/5 text-slate-400 border-white/10 hover:border-white/20'}`}>
                {f === 'all' ? 'All' : f === 'manager' ? 'Managers' : 'Employees'}
              </button>
            ))}
            <button onClick={() => fetchAllUserStats().then(setAllUserStats)} className="p-1.5 rounded-lg bg-white/5 text-slate-400 hover:text-white border border-white/10 transition-all"><Activity size={14} /></button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-slate-500">
                <th className="pb-4 pl-2 font-bold uppercase tracking-widest text-[10px]">Employee</th>
                <th className="pb-4 font-bold uppercase tracking-widest text-[10px]">Role</th>
                <th className="pb-4 font-bold uppercase tracking-widest text-[10px]">Status</th>
                <th className="pb-4 font-bold uppercase tracking-widest text-[10px]">Time</th>
                <th className="pb-4 font-bold uppercase tracking-widest text-[10px]">Keys</th>
                <th className="pb-4 font-bold uppercase tracking-widest text-[10px]">Cam %</th>
                <th className="pb-4 font-bold uppercase tracking-widest text-[10px]">Integrity</th>
                <th className="pb-4 font-bold uppercase tracking-widest text-[10px] text-right pr-2">Report</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((u) => {
                const score = Math.round(u.integrity_score || 100);
                const fv = faceVis(u);
                return (
                  <tr key={u.id} className="group hover:bg-white/[0.03] transition-all cursor-pointer" onClick={() => setSelectedAttendanceUser(u)}>
                    <td className="py-4 pl-2">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold" style={{ background: u.avatar || '#6366f1' }}>{u.initials}</div>
                        <div>
                          <div className="font-semibold text-slate-200">{u.name}</div>
                          <div className="text-[10px] text-slate-500">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4"><span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${u.role === 'manager' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>{u.role}</span></td>
                    <td className="py-4">{u.is_online ? <span className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-bold uppercase tracking-wider"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Online</span> : <span className="text-slate-600 text-[10px] font-bold uppercase tracking-wider">Offline</span>}</td>
                    <td className="py-4 font-mono text-xs text-slate-300">{fmtTime(u.total_minutes || 0)}</td>
                    <td className="py-4 font-mono text-xs text-slate-300">{(u.total_keystrokes || 0).toLocaleString()}</td>
                    <td className="py-4 font-mono text-xs text-slate-300">{fv}%</td>
                    <td className="py-4"><span className="text-sm font-bold font-mono" style={{ color: getScoreColor(score) }}>{score}%</span></td>
                    <td className="py-4 text-right pr-2"><button className="px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase transition-all border border-blue-500/20">View</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="glass-card mt-6">
          <div className="section-title"><Shield size={16} className="text-purple-400" /> Task Management Integrity Report</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Database Health</h4>
              <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Total Active Tasks</span>
                  <span className="text-white font-bold">{tasks.length}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Cloud Status</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Connected
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Last Synchronized</span>
                  <span className="text-blue-400 text-[10px] font-mono">Just now</span>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Permissions & Access</h4>
              <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-3">
                <div className="flex items-center gap-2 text-xs text-emerald-400">
                  <ShieldCheck size={14} /> Admin Override Enabled
                </div>
                <p className="text-[10px] text-slate-500 italic">Full CRUD access granted for all tasks regardless of owner_email or system status.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSettings = () => (
    <div className="module-grid">
      <div className="glass-card">
        <div className="section-title"><Settings size={16} className="text-slate-400" /> Platform Configuration</div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Organization Name</label>
            <input type="text" className="inline-input" defaultValue="FocusSync Inc." />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Support Email</label>
            <input type="email" className="inline-input" defaultValue="support@focussync.com" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Default Timezone</label>
            <select className="inline-input">
              <option>UTC (Coordinated Universal Time)</option>
              <option>EST (Eastern Standard Time)</option>
              <option>PST (Pacific Standard Time)</option>
            </select>
          </div>
          <button className="btn-primary mt-2">Save Configuration</button>
        </div>
      </div>

      <div className="glass-card">
        <div className="section-title"><Lock size={16} className="text-purple-400" /> Security Policies</div>
        <div className="space-y-3">
          {[
            { label: "Require Multi-Factor Authentication", enabled: true },
            { label: "Enforce Password Rotation (90 days)", enabled: true },
            { label: "Lockout after 5 failed attempts", enabled: true },
            { label: "Allow external integrations", enabled: false },
          ].map((policy, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-white/5">
              <span className="text-sm text-slate-200">{policy.label}</span>
              <div className={`toggle-switch ${policy.enabled ? "active" : ""}`} style={{ width: 40, height: 22, borderRadius: 11, background: policy.enabled ? "#3b82f6" : "#475569", position: "relative", cursor: "pointer" }}>
                <div style={{ width: 16, height: 16, borderRadius: "50%", background: "white", position: "absolute", top: 3, left: policy.enabled ? 21 : 3, transition: "all 0.2s" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderTeams = () => {
    const managers = systemUsers.filter(u => u.role === 'manager');
    const unassignedStaff = systemUsers.filter(u => u.role === 'employee' && !u.manager_id);
    const selectedManager = systemUsers.find(u => u.id === selectedManagerId);
    
    const formatDuration = (hours: number) => {
      const totalMinutes = Math.round(hours * 60);
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      if (h === 0) return `${m}m`;
      return `${h}h ${m > 0 ? m + 'm' : ''}`;
    };
    
    if (selectedManagerId && selectedManager) {
      const team = systemUsers.filter(u => u.manager_id === selectedManager.id);
      const teamEmails = team.map(m => m.email);
      const activeTeamEmails = activeSessions.map(s => s.email);
      const presentCount = team.filter(m => activeTeamEmails.includes(m.email)).length;
      
      const teamTasks = tasks.filter(t => teamEmails.includes(t.assignee_email || ""));
      const completedTeamTasks = teamTasks.filter(t => t.status === 'completed').length;
      const totalTeamTasks = teamTasks.length;
      const teamProgress = totalTeamTasks > 0 ? Math.round((completedTeamTasks / totalTeamTasks) * 100) : 0;
      
      const teamStats = allUserStats.filter(s => teamEmails.includes(s.email));
      const totalTeamMinutes = teamStats.reduce((acc, s) => acc + (s.total_minutes || 0), 0);
      const totalTeamHoursLive = totalTeamMinutes / 60;
      const avgTeamFocus = teamStats.length ? Math.round(teamStats.reduce((acc, s) => acc + (s.integrity_score || 90), 0) / teamStats.length) : 0;

      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => setSelectedManagerId(null)}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-semibold"
            >
              <X size={16} /> Back to Teams Overview
            </button>
            <div className="flex items-center gap-4">
              <div className="px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold">
                {avgTeamFocus}% Avg Focus
              </div>
              <div className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold">
                {formatDuration(totalTeamHoursLive)} Logged Today
              </div>
              <div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
                {presentCount}/{team.length} Members Present
              </div>
              <button 
                onClick={() => { setEditingUser(selectedManager); setIsUserModalOpen(true); }}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg transition-all"
              >
                Manage Manager
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
              <div className="glass-card bg-gradient-to-br from-purple-500/20 to-blue-600/5">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-purple-600 flex items-center justify-center text-2xl font-bold shadow-lg shadow-purple-500/20">
                    {selectedManager.initials}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">{selectedManager.name}</h2>
                    <p className="text-xs text-purple-400 font-bold uppercase tracking-widest">{selectedManager.department || 'Operations'}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Team Efficiency</div>
                    <div className="text-2xl font-bold text-white">{teamProgress}%</div>
                    <div className="w-full h-1.5 bg-white/5 rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${teamProgress}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="glass-card">
                <div className="section-title mb-6"><Users size={16} className="text-blue-400" /> Team Roster</div>
                <div className="space-y-3">
                  {team.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 italic">No staff members assigned to this team.</div>
                  ) : (
                    team.map(member => {
                      const isPresent = activeTeamEmails.includes(member.email);
                      const memberTasks = tasks.filter(t => t.assignee_email === member.email);
                      const done = memberTasks.filter(t => t.status === 'completed').length;
                      
                      return (
                        <div key={member.id} className="flex flex-col p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-all group">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-4">
                              <div className="relative">
                                <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center font-bold text-slate-300">
                                  {member.initials}
                                </div>
                                <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-[#0f172a] ${isPresent ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <div className="text-sm font-bold text-white">{member.name}</div>
                                  <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                    {member.focusScore || 90}% FOCUS
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">
                                  {member.department} · {formatDuration((allUserStats.find(s => s.id === member.id)?.total_minutes || 0) / 60)} today · {done}/{memberTasks.length} Tasks
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isPresent ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-500'}`}>
                                {isPresent ? 'ONLINE' : 'OFFLINE'}
                              </span>
                              <button 
                                onClick={() => { setEditingUser(member); setIsUserModalOpen(true); }}
                                className="p-2 rounded-lg bg-blue-500/10 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Settings size={14} />
                              </button>
                            </div>
                          </div>

                          {/* Member Tasks Section */}
                          {memberTasks.length > 0 && (
                            <div className="pl-14 space-y-2">
                              <div className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-1">Assigned Tasks</div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {memberTasks.map(t => (
                                  <div key={t.id} className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] border border-white/[0.02] hover:bg-white/5 transition-colors">
                                    <div className="flex flex-col">
                                      <span className="text-xs font-medium text-slate-300 line-clamp-1">{t.title}</span>
                                      <span className="text-[9px] text-slate-500 flex items-center gap-1">
                                        <Clock size={8} /> {t.focus_time}m spent · {t.status}
                                      </span>
                                    </div>
                                    {t.is_running && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {unassignedStaff.length > 0 && (
                <div className="glass-card border-l-4 border-l-amber-500 bg-amber-500/5 mt-6">
                  <div className="section-title mb-4"><AlertTriangle size={16} className="text-amber-400" /> Available for Assignment</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {unassignedStaff.map(u => (
                      <div key={u.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-blue-500/30 transition-all group">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-400">
                            {u.initials}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white">{u.name}</div>
                            <div className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">{u.department || 'Staff'}</div>
                          </div>
                        </div>
                        <button 
                          onClick={() => updateUser(u.id, { manager_id: selectedManager.id })}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded-lg transition-all flex items-center gap-1"
                        >
                          <UserPlus size={12} /> Add to Team
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {managers.map((manager, idx) => {
            const team = systemUsers.filter(u => u.manager_id === manager.id);
            const teamEmails = team.map(m => m.email);
            const activeTeamEmails = activeSessions.map(s => s.email);
            const presentCount = team.filter(m => activeTeamEmails.includes(m.email)).length;
            
            const managerTasks = tasks.filter(t => t.assignee_email === manager.email);
            const managerPending = managerTasks.filter(t => t.status !== 'completed').length;
            
            const teamTasks = tasks.filter(t => teamEmails.includes(t.assignee_email || ""));
            const completedTeamTasks = teamTasks.filter(t => t.status === 'completed').length;
            const totalTeamTasks = teamTasks.length;
            const teamProgress = totalTeamTasks > 0 ? Math.round((completedTeamTasks / totalTeamTasks) * 100) : 0;

            return (
              <div 
                key={manager.id} 
                onClick={() => setSelectedManagerId(manager.id)}
                className="glass-card relative overflow-hidden group hover:border-purple-500/50 cursor-pointer transition-all duration-500"
              >
                {/* Background Glow */}
                <div className="absolute -right-20 -top-20 w-40 h-40 bg-purple-500/10 blur-[80px] rounded-full group-hover:bg-purple-500/20 transition-all duration-500" />
                
                <div className="flex flex-col md:flex-row gap-6 relative z-10">
                  {/* Left Side: Manager Profile */}
                  <div className="md:w-1/3 border-r border-white/5 pr-6">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="relative">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-xl font-bold shadow-lg shadow-purple-500/20">
                          {manager.initials}
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-[#0f172a] rounded-full" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-white leading-tight">{manager.name}</h3>
                        <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">Team Manager</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Live Status</div>
                        <div className="flex items-end justify-between">
                          <div className="text-xl font-bold text-emerald-400">{presentCount} <span className="text-[10px] text-slate-500 font-normal uppercase">Online</span></div>
                          <div className="text-[10px] font-bold text-slate-500">{team.length} total</div>
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Logged Today</div>
                        <div className="text-xl font-bold text-blue-400">
                          {formatDuration(allUserStats.filter(s => teamEmails.includes(s.email)).reduce((acc, s) => acc + (s.total_minutes || 0), 0) / 60)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Team Performance */}
                  <div className="flex-1 space-y-6">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                          <Users size={14} className="text-blue-400" /> Team Performance
                        </span>
                        <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">{teamProgress}%</span>
                      </div>
                      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full"
                          style={{ width: `${teamProgress}%` }}
                        />
                      </div>
                      <div className="flex justify-between mt-2 text-[10px] text-slate-500 font-medium">
                        <span>{managerPending} Lead Tasks</span>
                        <span>View Detailed Roster →</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    );
  };

  const renderIssues = () => {
    const issues = tasks.filter(t => t.has_issue);
    return (
      <div className="glass-card">
        <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={16} className="text-red-400" /> Raised Issues from Staff
        </div>
        <div className="space-y-4 mt-6">
          {issues.map(task => (
            <div key={task.id} className="p-5 rounded-2xl bg-red-500/5 border border-red-500/10 hover:bg-red-500/10 transition-all">
               <div className="flex items-center justify-between mb-3">
                 <div className="font-bold text-lg text-white flex items-center gap-2">
                   {task.title}
                   <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-[8px] uppercase font-black tracking-widest">Active Issue</span>
                 </div>
                 <div className="text-[10px] font-bold text-slate-500 bg-white/5 px-2 py-1 rounded border border-white/5 uppercase tracking-widest">{task.assignee_email}</div>
               </div>
               <div className="text-sm text-slate-400 mb-5 leading-relaxed bg-black/20 p-4 rounded-xl border border-white/5">{task.issue_description || "No description provided."}</div>
               <div className="flex gap-3">
                 <button className="px-4 py-2 bg-blue-600/10 text-blue-400 text-xs font-bold rounded-xl border border-blue-500/20 hover:bg-blue-600/20 transition-all flex items-center gap-2" onClick={() => { setSelectedTaskId(task.id); setActiveView('tasks'); }}>
                   <Activity size={14} /> View Task Details
                 </button>
                 <button className="px-4 py-2 bg-emerald-600/10 text-emerald-400 text-xs font-bold rounded-xl border border-emerald-500/20 hover:bg-emerald-600/20 transition-all flex items-center gap-2" onClick={() => updateTask(task.id, { has_issue: false })}>
                   <ShieldCheck size={14} /> Resolve & Close Issue
                 </button>
               </div>
            </div>
          ))}
          {issues.length === 0 && (
            <div className="py-24 text-center flex flex-col items-center gap-4">
              <ShieldCheck size={48} className="text-emerald-500/20" />
              <div className="text-slate-500 font-medium italic">All issues resolved. High operational integrity maintained.</div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCommunication = () => (
    <AdminCommunicationPanel
      currentUser={user}
      systemUsers={systemUsers}
      messages={messages}
      sendMessage={sendMessage}
    />
  );

  const views: Record<string, () => React.JSX.Element> = { 
    dashboard: renderDashboard, 
    users: renderUsers, 
    teams: renderTeams,
    tasks: renderTasks,
    issues: renderIssues,
    audit: renderAudit,
    settings: renderSettings
  };

  return (
    <div className="app-shell">
      <motion.aside    className="sidebar">
        <div className="sidebar-brand">
          <FocusSyncLogo size={32} color="#fbbf24" />
          <span style={{ 
            fontSize: "1.1rem", 
            fontWeight: 800, 
            letterSpacing: "-0.03em",
            background: "linear-gradient(135deg, #fff 0%, #fbbf24 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent"
          }}>
            Admin Center
          </span>
        </div>
        
        <div className="nav-section-label">Management</div>
        {navItems.slice(0, 3).map(item => (
          <div key={item.id} className={`nav-link ${activeView === item.id ? "active" : ""}`} onClick={() => setActiveView(item.id)}>
            {item.icon}<span>{item.label}</span>
          </div>
        ))}
        
        <div className="nav-section-label">System</div>
        {navItems.slice(3, 5).map(item => (
          <div key={item.id} className={`nav-link ${activeView === item.id ? "active" : ""}`} onClick={() => setActiveView(item.id)}>
            {item.icon}<span>{item.label}</span>
          </div>
        ))}
        
        <div className="nav-section-label">Configuration</div>
        {navItems.slice(5, 7).map(item => (
          <div key={item.id} className={`nav-link ${activeView === item.id ? "active" : ""}`} onClick={() => setActiveView(item.id)}>
            {item.icon}<span>{item.label}</span>
          </div>
        ))}
        
        <div className="sidebar-footer">
          <div className="user-card">
            <div className="user-avatar" style={{ background: user?.avatar || "#ef4444" }}>{user?.initials}</div>
            <div className="user-details">
              <div className="user-name">{user?.name}</div>
              <div className="user-role"></div>
            </div>
          </div>
          <div className="nav-link" onClick={logout}><LogOut size={18} /><span>Sign Out</span></div>
        </div>
      </motion.aside>
      
      <div className="main-area">
        <div className="page-header">
          <div>
            <h1>{viewTitles[activeView] || "Dashboard"}</h1>
            <div className="date-badge">
              <Calendar size={12} className="inline mr-1" />
              {currentTime.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} · {currentTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="btn-secondary"><Mail size={16} /></button>
            <button className="btn-secondary relative">
              <Bell size={16} />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold">2</span>
            </button>
            <button className="btn-primary" style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", border: "none", boxShadow: "0 4px 12px rgba(245, 158, 11, 0.3)" }}>
              <ShieldCheck size={16} /> System Health OK
            </button>
          </div>
        </div>
        {/* ✅ FIX: Removed key={activeView} — caused full tree remount on every nav click */}
        <div className="flex-1 w-full h-full">
          {(views[activeView] || renderDashboard)()}
        </div>
      </div>
      <UserModal 
        isOpen={isUserModalOpen} 
        onClose={() => setIsUserModalOpen(false)} 
        userToEdit={editingUser} 
        users={systemUsers}
        onSave={async (u) => {
          if (editingUser) await updateUser(editingUser.id, u);
          else await addUser({...u, avatar: "#3b82f6", initials: u.name?.substring(0,2).toUpperCase()||""} as any);
        }} 
        defaultRole={userRole} 
      />
      <TaskModal 
        isOpen={isTaskModalOpen} 
        onClose={() => setIsTaskModalOpen(false)} 
        task={editingTask} 
        users={systemUsers} 
        onSave={async (t) => {
          if (editingTask) await updateTask(editingTask.id, t);
          else await addTask(t as any);
        }} 
      />
      <AnimatePresence>
        {confirmAction && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4" onClick={() => setConfirmAction(null)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-[#0f172a] border border-red-500/20 rounded-3xl w-full max-w-md overflow-hidden shadow-[0_0_50px_rgba(239,68,68,0.2)] p-8 text-center"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 text-red-500 border border-red-500/20">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Confirm Destruction</h3>
              <p className="text-slate-400 text-sm mb-8 leading-relaxed">
                {confirmAction.title} This action cannot be undone and will be logged in the system audit.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setConfirmAction(null)}
                  className="flex-1 px-6 py-3 rounded-xl text-sm font-bold text-slate-300 bg-white/5 hover:bg-white/10 transition-all border border-white/10"
                >
                  Cancel
                </button>
                <button 
                  onClick={async () => {
                    await confirmAction.onConfirm();
                    setConfirmAction(null);
                    addToast("Action Complete", "Operation executed successfully.", "success");
                  }}
                  className="flex-1 px-6 py-3 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-500 shadow-lg shadow-red-600/20 transition-all active:scale-95"
                >
                  Yes, Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}

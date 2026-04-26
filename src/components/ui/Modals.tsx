import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Task } from "@/hooks/useTasks";
import { SystemUser } from "@/hooks/useUsers";

export function TaskModal({ 
  isOpen, onClose, task, onSave, users = [] 
}: { 
  isOpen: boolean; onClose: () => void; task?: Task | null; onSave: (task: Partial<Task>) => void; users?: SystemUser[];
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"high"|"medium"|"low">("medium");
  const [status, setStatus] = useState<"pending"|"completed">("pending");
  const [assigneeEmail, setAssigneeEmail] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [subtasks, setSubtasks] = useState<{id: string, title: string, completed: boolean, assignee_email?: string | null}[]>([]);
  const [newSubtask, setNewSubtask] = useState("");

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || "");
      setPriority(task.priority);
      setStatus(task.status);
      setAssigneeEmail(task.assignee_email || "");
      setOwnerEmail(task.owner_email || "");
      setDueDate(task.due_date ? task.due_date.split('T')[0] : "");
      setSubtasks(task.subtasks || []);
    } else {
      setTitle("");
      setDescription("");
      setPriority("medium");
      setStatus("pending");
      setAssigneeEmail("");
      setOwnerEmail("");
      setDueDate("");
      setSubtasks([]);
    }
  }, [task, isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
        <motion.div initial={{ opacity:0, scale:0.95, y: 20 }} animate={{ opacity:1, scale:1, y: 0 }} exit={{ opacity:0, scale:0.95 }}
          className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
          
          <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/[0.02]">
            <div>
              <h3 className="text-xl font-bold text-white">{task ? "Edit Task Details" : "Create New Task"}</h3>
              <p className="text-xs text-slate-500 mt-1">Configure task parameters and sub-assignments</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-all"><X size={20} /></button>
          </div>

          <div className="p-6 space-y-6 overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4 md:col-span-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Task Title</label>
                  <input value={title} onChange={e => setTitle(e.target.value)} 
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all" 
                    placeholder="e.g. Design System Implementation" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Description</label>
                  <textarea value={description} onChange={e => setDescription(e.target.value)} 
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all min-h-[80px]" 
                    placeholder="Provide detailed context for this task..." />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Priority Level</label>
                <select value={priority} onChange={e => setPriority(e.target.value as any)} 
                  className="w-full bg-[#1e293b] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-all">
                  <option value="high">Critical (High)</option>
                  <option value="medium">Standard (Medium)</option>
                  <option value="low">Low Priority</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Target Status</label>
                <select value={status} onChange={e => setStatus(e.target.value as any)} 
                  className="w-full bg-[#1e293b] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-all">
                  <option value="pending">Pending / Backlog</option>
                  <option value="completed">Completed / Archive</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Primary Owner</label>
                <select value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} 
                  className="w-full bg-[#1e293b] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-all">
                  <option value="">No Owner assigned</option>
                  {users.map(u => <option key={u.id} value={u.email}>{u.name} ({u.role})</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Main Assignee</label>
                <select value={assigneeEmail} onChange={e => setAssigneeEmail(e.target.value)} 
                  className="w-full bg-[#1e293b] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-all">
                  <option value="">Unassigned</option>
                  {users.map(u => <option key={u.id} value={u.email}>{u.name} ({u.role})</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Due Date</label>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} 
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-all" />
              </div>
            </div>
            
            <div className="pt-4 border-t border-white/5">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Sub-tasks & Assignments</label>
              <div className="space-y-3">
                {subtasks.map((st, i) => (
                  <div key={st.id} className="flex flex-col md:flex-row md:items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5 group relative">
                    <div className="flex items-center gap-3 flex-1">
                      <input type="checkbox" checked={st.completed} onChange={() => {
                        const newSt = [...subtasks];
                        newSt[i].completed = !newSt[i].completed;
                        setSubtasks(newSt);
                      }} className="w-5 h-5 rounded-lg border-white/10 bg-white/5 accent-blue-500 cursor-pointer" />
                      <span className={`flex-1 text-sm ${st.completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>{st.title}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <select 
                        value={st.assignee_email || ""} 
                        onChange={(e) => {
                          const newSt = [...subtasks];
                          newSt[i].assignee_email = e.target.value || null;
                          setSubtasks(newSt);
                        }}
                        className="bg-[#1e293b] border border-white/10 rounded-lg px-2 py-1 text-[10px] text-slate-300 focus:outline-none focus:border-blue-500"
                      >
                        <option value="">Unassigned</option>
                        {users.map(u => <option key={u.id} value={u.email}>{u.name.split(' ')[0]}</option>)}
                      </select>
                      <button onClick={() => setSubtasks(subtasks.filter((_, idx) => idx !== i))} className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"><X size={16} /></button>
                    </div>
                  </div>
                ))}
                
                <div className="flex gap-3 bg-blue-500/5 p-3 rounded-xl border border-blue-500/20 mt-4">
                  <input value={newSubtask} onChange={e => setNewSubtask(e.target.value)} 
                    onKeyDown={e => { if(e.key === 'Enter') { e.preventDefault(); if(newSubtask.trim()) { setSubtasks([...subtasks, { id: Date.now().toString(), title: newSubtask.trim(), completed: false }]); setNewSubtask(""); } } }}
                    className="flex-1 bg-transparent border-none p-0 text-sm text-white focus:ring-0 placeholder:text-slate-600" placeholder="Add a new sub-task..." />
                  <button onClick={() => { if(newSubtask.trim()) { setSubtasks([...subtasks, { id: Date.now().toString(), title: newSubtask.trim(), completed: false }]); setNewSubtask(""); } }} className="text-blue-400 hover:text-blue-300 font-bold text-xs uppercase tracking-widest px-2">Add</button>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-white/5 flex justify-end gap-3 bg-white/[0.02]">
            <button onClick={onClose} className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-all">Cancel</button>
            <button onClick={() => { 
              let finalSubtasks = [...subtasks];
              if (newSubtask.trim()) {
                finalSubtasks.push({ id: Date.now().toString(), title: newSubtask.trim(), completed: false });
              }
              onSave({ title, description, priority, status, assignee_email: assigneeEmail || null, owner_email: ownerEmail || null, due_date: dueDate || null, subtasks: finalSubtasks }); 
              onClose(); 
            }} 
              className="px-8 py-2.5 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all">
              {task ? "Update Task" : "Create Task"}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export function UserModal({ 
  isOpen, onClose, userToEdit, onSave, defaultRole = "employee", forcedManagerId, users = []
}: { 
  isOpen: boolean; onClose: () => void; userToEdit?: SystemUser | null; onSave: (user: Partial<SystemUser>) => void; defaultRole?: string; forcedManagerId?: string; users?: SystemUser[];
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("employee");
  const [status, setStatus] = useState<"active"|"inactive"|"locked"|"away"|"offline">("active");
  const [department, setDepartment] = useState("Engineering");
  const [password, setPassword] = useState("");
  const [managerId, setManagerId] = useState("");

  useEffect(() => {
    if (userToEdit) {
      setName(userToEdit.name);
      setEmail(userToEdit.email);
      setRole(userToEdit.role);
      setStatus(userToEdit.status);
      setManagerId(userToEdit.manager_id || "");
      setPassword("");
    } else {
      setName("");
      setEmail("");
      setRole(defaultRole);
      setStatus("active");
      setDepartment("Engineering");
      setPassword("user123"); 
      setManagerId(forcedManagerId || "");
    }
  }, [userToEdit, isOpen, defaultRole, forcedManagerId]);


  // Filter managers from users list
  const managers = users.filter((u: any) => u.role === 'manager');

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <motion.div initial={{ opacity:0, scale:0.95, y: 20 }} animate={{ opacity:1, scale:1, y: 0 }} exit={{ opacity:0, scale:0.95 }}
          className="bg-[#0f172a] border border-white/10 rounded-xl w-full max-w-md overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between p-4 border-b border-white/5">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              {userToEdit ? "Edit Account" : `New ${role === 'admin' ? 'Administrator' : role === 'manager' ? 'Manager' : 'Employee'}`}
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                role === 'admin' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                role === 'manager' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              }`}>
                {role.toUpperCase()}
              </span>
            </h3>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X size={18} /></button>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Full Name</label>
              <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" placeholder="Jane Doe" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" placeholder="jane@focussync.com" />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Role</label>
                <select value={role} onChange={e => setRole(e.target.value)} className="w-full bg-[#1e293b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
                  <option value="admin">Admin</option><option value="manager">Manager</option><option value="employee">Employee</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Status</label>
                <select value={status} onChange={e => setStatus(e.target.value as any)} className="w-full bg-[#1e293b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
                  <option value="active">Active</option><option value="inactive">Inactive</option><option value="locked">Locked</option><option value="away">Away</option><option value="offline">Offline</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Department</label>
              <select value={department} onChange={e => setDepartment(e.target.value)} className="w-full bg-[#1e293b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
                <option value="Engineering">Engineering</option><option value="Sales">Sales</option><option value="HR">HR</option><option value="IT">IT</option>
              </select>
            </div>
            {role === 'employee' && !forcedManagerId && (
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Assigned Manager</label>
                <select value={managerId} onChange={e => setManagerId(e.target.value)} className="w-full bg-[#1e293b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
                  <option value="">No Manager</option>
                  {managers.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                {userToEdit ? "Change Password (leave blank to keep current)" : "Initial Password"}
              </label>
              <div className="relative">
                <input 
                  type="text" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" 
                  placeholder={userToEdit ? "••••••••" : "Set password..."} 
                />
              </div>
            </div>
          </div>
          <div className="p-4 border-t border-white/5 flex justify-end gap-2 bg-white/[0.02]">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-white/5 transition-colors">Cancel</button>
            <button onClick={() => { 
              const userData: any = { name, email, role, status, department, manager_id: managerId || null };
              if (password.trim() !== "") {
                userData.password = password;
              }
              onSave(userData); 
              onClose(); 
            }} className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors">
              {userToEdit ? "Update User" : "Create User"}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Milestone, TaskItem } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  CheckSquare,
  Plus,
  Calendar,
  User,
  Flag,
  Trash2,
  ChevronRight,
  Target,
  AlertCircle
} from 'lucide-react';

export const OperationsPage: React.FC = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modals
  const [isTaskModalOpen, setIsTaskModalOpen] = useState<boolean>(false);
  const [isMilestoneModalOpen, setIsMilestoneModalOpen] = useState<boolean>(false);

  // Forms
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    status: 'TODO' as any,
    priority: 'MEDIUM' as any,
    assignee: '',
    due_date: '',
    milestone_id: '' as string | number
  });

  const [milestoneForm, setMilestoneForm] = useState({
    title: '',
    description: '',
    due_date: ''
  });

  const fetchData = async () => {
    try {
      const [tList, mList] = await Promise.all([
        api.getTasks(),
        api.getMilestones()
      ]);
      setTasks(tList);
      setMilestones(mList);
    } catch (err) {
      console.error('Failed to load operations data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.title.trim()) return;

    try {
      await api.createTask({
        title: taskForm.title.trim(),
        description: taskForm.description.trim() || undefined,
        status: taskForm.status,
        priority: taskForm.priority,
        assignee: taskForm.assignee.trim() || user?.username || 'Unassigned',
        due_date: taskForm.due_date || undefined,
        milestone_id: taskForm.milestone_id ? Number(taskForm.milestone_id) : undefined
      });
      setIsTaskModalOpen(false);
      setTaskForm({
        title: '',
        description: '',
        status: 'TODO',
        priority: 'MEDIUM',
        assignee: '',
        due_date: '',
        milestone_id: ''
      });
      await fetchData();
    } catch (err: any) {
      alert(`Create task failed: ${err.message}`);
    }
  };

  const handleCreateMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!milestoneForm.title.trim()) return;

    try {
      await api.createMilestone({
        title: milestoneForm.title.trim(),
        description: milestoneForm.description.trim() || undefined,
        due_date: milestoneForm.due_date || undefined
      });
      setIsMilestoneModalOpen(false);
      setMilestoneForm({ title: '', description: '', due_date: '' });
      await fetchData();
    } catch (err: any) {
      alert(`Create milestone failed: ${err.message}`);
    }
  };

  const handleStatusChange = async (taskId: number, newStatus: string) => {
    try {
      await api.updateTask(taskId, { status: newStatus as any });
      await fetchData();
    } catch (err: any) {
      alert(`Status update failed: ${err.message}`);
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    try {
      await api.deleteTask(taskId);
      await fetchData();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const columns: Array<{ id: 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE'; label: string; color: string }> = [
    { id: 'TODO', label: 'To Do', color: 'border-slate-700' },
    { id: 'IN_PROGRESS', label: 'In Progress', color: 'border-cyan-500/50' },
    { id: 'BLOCKED', label: 'Blocked', color: 'border-rose-500/50' },
    { id: 'DONE', label: 'Completed', color: 'border-emerald-500/50' }
  ];

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-cyan-400" />
            Project Operations &amp; Kanban Execution
          </h1>
          <p className="text-xs text-slate-400">
            Sprint management, network remediation task boards, and dynamic milestone progress tracking.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsMilestoneModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors"
          >
            <Target className="w-3.5 h-3.5 text-cyan-400" />
            <span>Add Milestone</span>
          </button>

          <button
            onClick={() => {
              setTaskForm({
                title: '',
                description: '',
                status: 'TODO',
                priority: 'MEDIUM',
                assignee: user?.username || '',
                due_date: '',
                milestone_id: milestones[0]?.id || ''
              });
              setIsTaskModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-cyan-600 hover:bg-cyan-500 rounded-md transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* Milestones Horizontal Progress Bar Track */}
      {milestones.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {milestones.map((m) => (
            <div key={m.id} className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-2.5">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-xs text-white flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-cyan-400" />
                    {m.title}
                  </h3>
                  {m.description && (
                    <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{m.description}</p>
                  )}
                </div>

                <div className="text-right">
                  <span className="font-mono text-xs font-bold text-cyan-400 tabular-nums">
                    {m.completion_pct}%
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    {m.completed_tasks}/{m.total_tasks} tasks
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-cyan-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${m.completion_pct}%` }}
                />
              </div>

              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>Status: {m.status}</span>
                {m.due_date && <span>Target Due: {m.due_date}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Kanban Board Columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
        {columns.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.id);

          return (
            <div key={col.id} className={`bg-slate-900/80 border ${col.color} rounded-lg flex flex-col min-h-[450px]`}>
              {/* Column Header */}
              <div className="p-3 border-b border-slate-800 flex items-center justify-between text-xs">
                <span className="font-semibold text-white">{col.label}</span>
                <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                  {colTasks.length}
                </span>
              </div>

              {/* Tasks List */}
              <div className="p-2 space-y-2.5 flex-1 overflow-y-auto">
                {colTasks.map((t) => {
                  let prioColor = 'text-slate-400 bg-slate-800 border-slate-700';
                  if (t.priority === 'URGENT') prioColor = 'text-rose-400 bg-rose-950/60 border-rose-800';
                  if (t.priority === 'HIGH') prioColor = 'text-orange-400 bg-orange-950/60 border-orange-800';
                  if (t.priority === 'MEDIUM') prioColor = 'text-amber-400 bg-amber-950/60 border-amber-800';

                  const isOverdue = t.due_date && t.due_date < todayStr && t.status !== 'DONE';

                  return (
                    <div
                      key={t.id}
                      className="bg-slate-950 border border-slate-800/90 rounded-md p-3 space-y-2 hover:border-slate-700 transition-colors shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border font-semibold ${prioColor}`}>
                          {t.priority}
                        </span>

                        <button
                          onClick={() => handleDeleteTask(t.id)}
                          className="text-slate-600 hover:text-rose-400 transition-colors"
                          title="Delete Task"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>

                      <h4 className="text-xs font-medium text-slate-200 leading-snug">
                        {t.title}
                      </h4>

                      {t.description && (
                        <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                          {t.description}
                        </p>
                      )}

                      {t.milestone_title && (
                        <div className="text-[10px] text-cyan-400/80 font-mono flex items-center gap-1">
                          <Target className="w-2.5 h-2.5" />
                          <span className="truncate">{t.milestone_title}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-900">
                        <span className="flex items-center gap-1">
                          <User className="w-2.5 h-2.5" />
                          {t.assignee || 'Unassigned'}
                        </span>

                        {t.due_date && (
                          <span className={`flex items-center gap-1 ${isOverdue ? 'text-rose-400 font-bold' : ''}`}>
                            <Calendar className="w-2.5 h-2.5" />
                            {t.due_date} {isOverdue && '(Overdue)'}
                          </span>
                        )}
                      </div>

                      {/* Move action buttons */}
                      <div className="pt-1.5 flex items-center justify-between gap-1 text-[10px] font-mono">
                        {col.id !== 'TODO' && (
                          <button
                            onClick={() => handleStatusChange(t.id, col.id === 'DONE' ? 'IN_PROGRESS' : 'TODO')}
                            className="px-1.5 py-0.5 bg-slate-900 hover:bg-slate-800 text-slate-400 rounded"
                          >
                            ← Move
                          </button>
                        )}
                        {col.id !== 'DONE' && (
                          <button
                            onClick={() => handleStatusChange(t.id, col.id === 'TODO' ? 'IN_PROGRESS' : 'DONE')}
                            className="px-1.5 py-0.5 bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 rounded ml-auto"
                          >
                            Advance →
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {colTasks.length === 0 && (
                  <div className="h-28 flex items-center justify-center text-[11px] text-slate-600 border border-dashed border-slate-800/80 rounded">
                    No tasks
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Task Modal */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h2 className="text-base font-bold text-white">Create Operational Task</h2>
              <button onClick={() => setIsTaskModalOpen(false)} className="text-slate-400 hover:text-white text-sm">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Calibrate interface packet loss alert threshold"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Status</label>
                  <select
                    value={taskForm.status}
                    onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="TODO">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="BLOCKED">Blocked</option>
                    <option value="DONE">Completed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Priority</label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Assignee</label>
                  <input
                    type="text"
                    placeholder="e.g. admin or technician"
                    value={taskForm.assignee}
                    onChange={(e) => setTaskForm({ ...taskForm, assignee: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Due Date</label>
                  <input
                    type="date"
                    value={taskForm.due_date}
                    onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Associate Milestone</label>
                <select
                  value={taskForm.milestone_id}
                  onChange={(e) => setTaskForm({ ...taskForm, milestone_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="">No Milestone</option>
                  {milestones.map((m) => (
                    <option key={m.id} value={m.id}>{m.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Description</label>
                <textarea
                  rows={3}
                  placeholder="Task scope, troubleshooting steps..."
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsTaskModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium text-white bg-cyan-600 hover:bg-cyan-500 rounded-md"
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Milestone Modal */}
      {isMilestoneModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h2 className="text-base font-bold text-white">Create Project Milestone</h2>
              <button onClick={() => setIsMilestoneModalOpen(false)} className="text-slate-400 hover:text-white text-sm">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateMilestone} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Milestone Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Phase 3: Core Gateway Redundancy"
                  value={milestoneForm.title}
                  onChange={(e) => setMilestoneForm({ ...milestoneForm, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Due Date</label>
                <input
                  type="date"
                  value={milestoneForm.due_date}
                  onChange={(e) => setMilestoneForm({ ...milestoneForm, due_date: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Description</label>
                <textarea
                  rows={3}
                  placeholder="Objective, deliverables, exit criteria..."
                  value={milestoneForm.description}
                  onChange={(e) => setMilestoneForm({ ...milestoneForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsMilestoneModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium text-white bg-cyan-600 hover:bg-cyan-500 rounded-md"
                >
                  Create Milestone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

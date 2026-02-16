import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
    MoreVertical, FileText, CheckCircle, Clock, AlertCircle,
    Search, Filter, Download, Edit2, Check, X, Trash2, ArrowUpDown, CheckSquare, Pin, Calendar, Image, Link, AlertTriangle, MessageCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { api } from '../services/api';
import { useRef } from 'react';

const TaskTable = ({ tasks, onEdit, loading, fetchData, agencies, employees, user, isBulkEditMode, bulkEdits, setBulkEdits, selectedTasks, toggleSelection, selectAll }) => {
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [viewImage, setViewImage] = useState(null); // Base64 string
    const [sortConfig, setSortConfig] = useState({ key: 'deadline_due_in', direction: 'asc' });

    // Column Resizing Logic
    const [columnWidths, setColumnWidths] = useState({
        sno: 45,
        deadline_due_in: 95,
        completion_date: 110,
        task_number: 280,
        description: 400,
        attachment: 80,
        assigned_agency: 130,
        allocated_date: 100,
        time_given: 75,
        deadline_date: 110,
        action: 120
    });
    const [resizing, setResizing] = useState(null);

    const startResize = (e, key) => {
        e.preventDefault();
        e.stopPropagation();
        setResizing({
            key,
            startX: e.pageX,
            startWidth: columnWidths[key]
        });
        document.addEventListener('mousemove', handleResizeMove);
        document.addEventListener('mouseup', handleResizeUp);
    };

    const handleResizeMove = (e) => {
        setResizing(prev => {
            if (!prev) return null;
            const diff = e.pageX - prev.startX;
            const newWidth = Math.max(50, prev.startWidth + diff); // Min 50px
            setColumnWidths(widths => ({ ...widths, [prev.key]: newWidth }));
            return prev;
        });
    };

    const handleResizeUp = () => {
        setResizing(null);
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeUp);
    };

    // Resizer Component
    const Resizer = ({ colKey }) => (
        <div
            className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-indigo-400 active:bg-indigo-600 group-hover:bg-slate-300 transition-colors z-10"
            onMouseDown={(e) => startResize(e, colKey)}
            onClick={(e) => e.stopPropagation()} // Prevent sort trigger
        />
    );

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedTasks = React.useMemo(() => {
        let sortableTasks = [...tasks];
        if (sortConfig.key) {
            sortableTasks.sort((a, b) => {
                let aVal = a[sortConfig.key];
                let bVal = b[sortConfig.key];

                // Numeric sorting for Deadline Due In
                if (sortConfig.key === 'deadline_due_in') {
                    const getDaysRemaining = (task) => {
                        if (task.status === 'Completed' || task.completion_date) return 999999;
                        if (!task.deadline_date) return 999998;
                        const now = new Date();
                        const deadline = new Date(task.deadline_date);
                        now.setHours(0, 0, 0, 0);
                        deadline.setHours(0, 0, 0, 0);
                        return (deadline - now) / (1000 * 60 * 60 * 24);
                    };

                    const daysA = getDaysRemaining(a);
                    const daysB = getDaysRemaining(b);

                    if (daysA !== daysB) {
                        return sortConfig.direction === 'asc' ? daysA - daysB : daysB - daysA;
                    }
                } else if (sortConfig.key.includes('date')) {
                    const dateA = aVal ? new Date(aVal) : new Date(8640000000000000);
                    const dateB = bVal ? new Date(bVal) : new Date(8640000000000000);
                    if (dateA - dateB !== 0) {
                        return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
                    }
                } else {
                    aVal = (aVal || '').toString().toLowerCase();
                    bVal = (bVal || '').toString().toLowerCase();
                    if (aVal !== bVal) {
                        return sortConfig.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
                    }
                }

                return 0;
            });
        }
        return sortableTasks;
    }, [tasks, sortConfig]);

    // Status Badge Helper
    const getStatusBadge = (status) => {
        const styles = {
            'Completed': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.1)]',
            'Overdue': 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 shadow-[0_0_12px_rgba(244,63,94,0.1)]',
            'Pending': 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 shadow-[0_0_12px_rgba(245,158,11,0.1)]',
        };

        const icons = {
            'Completed': CheckCircle,
            'Overdue': AlertCircle,
            'Pending': Clock,
        };

        const Icon = icons[status] || Clock;
        const styleClass = styles[status] || 'bg-slate-100 text-slate-600 border-slate-200';

        return (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border transition-premium ${styleClass}`}>
                <Icon size={12} className="shrink-0" />
                {status}
            </span>
        );
    };

    const getDeadlineStyle = (task) => {
        if (task.status === 'Completed' || task.completion_date) return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
        if (!task.deadline_date) return "text-slate-500";

        const now = new Date();
        const deadline = new Date(task.deadline_date);

        if (deadline.getFullYear() < 2000) return "text-slate-500";

        now.setHours(0, 0, 0, 0);
        deadline.setHours(0, 0, 0, 0);

        const diffTime = deadline - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < -2000) return "text-slate-500";

        if (diffDays < 0) return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-bold";
        if (diffDays <= 3) return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 font-medium";
        return "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400";
    };

    const formatDeadlineDisplay = (task) => {
        if (task.completion_date) return 'Completed';
        if (task.deadline_date) {
            const d = new Date(task.deadline_date);
            if (d.toString() === 'Invalid Date' || d.getFullYear() < 2000) return '-';
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            d.setHours(0, 0, 0, 0);
            const diff = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
            if (diff < -2000) return '-';
            if (diff === 0) return 'Today';
            if (diff === 1) return 'Tomorrow';
            if (diff === -1) return 'Yesterday';
            return diff > 0 ? `${diff} days` : `${diff} days`;
        }
        return '-';
    };

    const startEdit = (task) => {
        setEditingId(task.id);
        setEditForm({
            task_number: task.task_number,
            description: task.description,
            assigned_agency: task.assigned_agency,
            allocated_date: task.allocated_date,
            time_given: task.time_given,
            deadline_date: task.deadline_date,
            completion_date: task.completion_date || ''
        });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditForm({});
    };

    const saveEdit = async (taskId) => {
        try {
            await api.updateTask(taskId, editForm);
            setEditingId(null);
            fetchData();
        } catch (e) {
            alert("Failed to update task: " + e.message);
        }
    };

    const handleQuickComplete = async (task) => {
        if (window.confirm(`Mark Task "${task.task_number}" as Completed?`)) {
            try {
                await api.updateTask(task.id, { completion_date: "Close" });
                fetchData();
            } catch (e) {
                alert("Failed to mark as completed: " + e.message);
            }
        }
    };

    // Single Edit Time Change
    const handleTimeChange = (e, task) => {
        const newTime = e.target.value;
        const updates = { ...editForm, time_given: newTime };
        const daysMatch = newTime.match(/(\d+)/);
        if (daysMatch && task.allocated_date) {
            const days = parseInt(daysMatch[1]);
            const allocated = new Date(task.allocated_date);
            if (!isNaN(allocated.getTime())) {
                const deadline = new Date(allocated);
                deadline.setDate(allocated.getDate() + days);
                updates.deadline_date = deadline.toISOString().split('T')[0];
            }
        }
        setEditForm(updates);
    };

    const handleDeadlineChange = (e, task) => {
        const newDeadline = e.target.value;
        const updates = { ...editForm, deadline_date: newDeadline };
        if (newDeadline && task.allocated_date) {
            const allocated = new Date(task.allocated_date);
            const deadline = new Date(newDeadline);
            if (!isNaN(allocated.getTime()) && !isNaN(deadline.getTime())) {
                const diffTime = deadline - allocated;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                updates.time_given = `${diffDays} days`;
            }
        }
        setEditForm(updates);
    };

    const handleDelete = async (task) => {
        if (window.confirm(`Are you sure you want to delete Task "${task.task_number}"?`)) {
            try {
                await api.deleteTask(task.id);
                fetchData();
            } catch (e) {
                alert("Failed to delete task: " + e.message);
            }
        }
    };

    const handleWhatsAppFollowup = (task) => {
        if (!task.assigned_agency) return alert("Task has no assigned person/agency.");

        const targetName = task.assigned_agency.trim();

        // Special Case: "All CEOs"
        if (targetName === "All CEOs") {
            const ceoNames = [
                "CEO JP Dantewada",
                "CEO JP Geedam",
                "CEO JP Kuakonda",
                "CEO JP Katekalyan" // Note: Check spelling in employees list if needed (e.g. Kataekelian vs Katekalyan)
            ];

            let foundCount = 0;
            ceoNames.forEach((name, index) => {
                const employee = (employees || []).find(e =>
                    e.display_name.trim().toLowerCase() === name.toLowerCase()
                );

                if (employee && employee.mobile) {
                    let phone = employee.mobile.replace(/\D/g, '');
                    if (phone.length === 10) phone = '91' + phone;

                    const taskName = task.task_number || 'Unnamed Task';
                    const comments = task.description || '';
                    const message = `What's the status of this task?\n\n*Task*: ${taskName}\n*Comments*: ${comments}`;

                    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

                    // Stagger opens to avoid popup blockers
                    setTimeout(() => {
                        window.open(whatsappUrl, '_blank');
                    }, index * 800);
                    foundCount++;
                }
            });

            if (foundCount === 0) {
                alert("Could not find contact details for any of the 4 CEOs.");
            } else if (foundCount < 4) {
                // Optional: warn if some are missing
                console.warn(`Only found ${foundCount}/4 CEOs for broadcast.`);
            }
            return;
        }

        // Normal Single Assignment Logic
        const employee = (employees || []).find(e =>
            e.display_name.trim().toLowerCase() === targetName.toLowerCase()
        );

        if (!employee || !employee.mobile) {
            return alert(`Phone number not found for "${task.assigned_agency}".\n\nPlease ensure an employee with EXACT "Display Username" matching this name exists in the Employees section and has a mobile number.`);
        }

        // Normalize phone number (digits only)
        let phone = employee.mobile.replace(/\D/g, '');
        if (phone.length === 10) {
            phone = '91' + phone;
        }

        const taskName = task.task_number || 'Unnamed Task';
        const comments = task.description || '';
        const message = `What's the status of this task?\n\n*Task*: ${taskName}\n*Comments*: ${comments}`;

        const encodedMessage = encodeURIComponent(message);
        const whatsappUrl = `https://wa.me/${phone}?text=${encodedMessage}`;

        window.open(whatsappUrl, '_blank');
    };

    const handlePriorityToggle = async (task) => {
        try {
            const newPriority = task.priority === 'High' ? 'Medium' : 'High';
            await api.updateTask(task.id, { priority: newPriority });
            fetchData();
        } catch (e) {
            console.error("Failed to update priority:", e);
        }
    };

    const handlePin = async (task) => {
        try {
            const newPin = task.is_pinned ? 0 : 1;
            await api.updateTask(task.id, { is_pinned: newPin });
            fetchData();
        } catch (e) {
            console.error("Failed to pin task:", e);
        }
    };



    // Bulk Edit Handlers
    const handleBulkChange = (id, field, value) => {
        setBulkEdits(prev => {
            const task = tasks.find(t => t.id === id);
            const currentEdits = prev[id] || {};
            const newEdits = { ...currentEdits, [field]: value };

            // Sync Logic for Bulk Edit
            if (field === 'deadline_date' && value && task.allocated_date) {
                const allocated = new Date(task.allocated_date);
                const deadline = new Date(value);
                if (!isNaN(allocated.getTime()) && !isNaN(deadline.getTime())) {
                    const diffTime = deadline - allocated;
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    newEdits.time_given = `${diffDays} days`;
                }
            } else if (field === 'time_given' && value && task.allocated_date) {
                const daysMatch = value.match(/(\d+)/);
                if (daysMatch) {
                    const days = parseInt(daysMatch[1]);
                    const allocated = new Date(task.allocated_date);
                    if (!isNaN(allocated.getTime())) {
                        const deadline = new Date(allocated);
                        deadline.setDate(allocated.getDate() + days);
                        newEdits.deadline_date = deadline.toISOString().split('T')[0];
                    }
                }
            }

            return { ...prev, [id]: newEdits };
        });
    };

    // Helper: Any row editing?
    const isSingleEditing = editingId !== null;
    const isAnyRowEditing = isSingleEditing || isBulkEditMode;

    // Selection Helpers
    const allTaskIds = tasks.map(t => t.id);
    const isAllSelected = tasks.length > 0 && selectedTasks?.length === tasks.length;
    const Checkbox = ({ checked, onChange }) => (
        <div onClick={onChange} className={`w-5 h-5 rounded border flex items-center justify-center cursor-pointer transition-colors ${checked ? 'bg-indigo-600 border-indigo-600' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600'}`}>
            {checked && <Check size={14} className="text-white" />}
        </div>
    );

    return (
        <div className="glass-card rounded-[2.5rem] border premium-border overflow-hidden shadow-premium-lg">
            <div className="overflow-x-auto custom-scrollbar">
                <table className="min-w-full text-left border-collapse table-fixed">
                    <thead>
                        <tr className="bg-slate-50/50 dark:bg-white/5 border-b premium-border backdrop-blur-sm">
                            {isBulkEditMode && (
                                <th className="px-6 py-5 w-[60px]">
                                    <Checkbox checked={isAllSelected} onChange={() => selectAll(allTaskIds)} />
                                </th>
                            )}
                            <th className="px-4 py-4 text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider relative group whitespace-nowrap" style={{ width: columnWidths.sno }}>
                                S.No <Resizer colKey="sno" />
                            </th>
                            <th onClick={() => handleSort('deadline_due_in')} className="px-4 py-4 text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none relative group whitespace-nowrap" style={{ width: columnWidths.deadline_due_in }}>
                                <div className="flex items-center gap-1">Due In {sortConfig.key === 'deadline_due_in' && <ArrowUpDown size={14} />}</div> <Resizer colKey="deadline_due_in" />
                            </th>
                            {isAnyRowEditing && (
                                <th onClick={() => handleSort('completion_date')} className="px-4 py-4 text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none relative group whitespace-nowrap" style={{ width: columnWidths.completion_date }}>
                                    <div className="flex items-center gap-1">Comp. {sortConfig.key === 'completion_date' && <ArrowUpDown size={14} />}</div> <Resizer colKey="completion_date" />
                                </th>
                            )}
                            <th onClick={() => handleSort('task_number')} className="px-4 py-4 text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none relative group whitespace-nowrap" style={{ width: columnWidths.task_number }}>
                                <div className="flex items-center gap-1">Task {sortConfig.key === 'task_number' && <ArrowUpDown size={14} />}</div> <Resizer colKey="task_number" />
                            </th>
                            <th onClick={() => handleSort('description')} className="px-4 py-4 text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none relative group" style={{ width: columnWidths.description }}>
                                <div className="flex items-center gap-1">Comments {sortConfig.key === 'description' && <ArrowUpDown size={14} />}</div> <Resizer colKey="description" />
                            </th>

                            <th onClick={() => handleSort('assigned_agency')} className="px-4 py-4 text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none relative group" style={{ width: columnWidths.assigned_agency }}>
                                <div className="flex items-center gap-1">Assigned {sortConfig.key === 'assigned_agency' && <ArrowUpDown size={14} />}</div> <Resizer colKey="assigned_agency" />
                            </th>

                            <th onClick={() => handleSort('allocated_date')} className="px-4 py-4 text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none relative group" style={{ width: columnWidths.allocated_date }}>
                                <div className="flex items-center gap-1">Alloc. {sortConfig.key === 'allocated_date' && <ArrowUpDown size={14} />}</div> <Resizer colKey="allocated_date" />
                            </th>
                            <th onClick={() => handleSort('time_given')} className="px-4 py-4 text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none relative group" style={{ width: columnWidths.time_given }}>
                                <div className="flex items-center gap-1">Time {sortConfig.key === 'time_given' && <ArrowUpDown size={14} />}</div> <Resizer colKey="time_given" />
                            </th>
                            <th onClick={() => handleSort('deadline_date')} className="px-4 py-4 text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none relative group" style={{ width: columnWidths.deadline_date }}>
                                <div className="flex items-center gap-1">Deadline {sortConfig.key === 'deadline_date' && <ArrowUpDown size={14} />}</div> <Resizer colKey="deadline_date" />
                            </th>
                            <th className="px-4 py-4 text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider relative group" style={{ width: columnWidths.action }}>
                                Action <Resizer colKey="action" />
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {tasks.length === 0 ? (
                            <tr><td colSpan={isBulkEditMode ? "12" : "11"} className="px-6 py-12 text-center text-slate-400">No tasks found.</td></tr>
                        ) : (
                            sortedTasks.map((task, index) => {
                                const isEditing = editingId === task.id;
                                const isBulk = isBulkEditMode;
                                const isSelected = selectedTasks?.includes(task.id);
                                const bulkVal = (field) => bulkEdits[task.id]?.[field] ?? task[field] ?? '';

                                return (
                                    <motion.tr
                                        key={task.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        className={`transition-colors group ${isEditing || (isBulk && isSelected) ? 'bg-indigo-50 dark:bg-indigo-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                                        onClick={() => isBulk && toggleSelection(task.id)}
                                    >
                                        {isBulkEditMode && (
                                            <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                                                <Checkbox checked={isSelected} onChange={() => toggleSelection(task.id)} />
                                            </td>
                                        )}
                                        <td className="px-4 py-3.5 text-[15px] font-medium text-slate-600 dark:text-slate-300 text-center" style={{ width: columnWidths.sno }}>
                                            {index + 1}
                                        </td>

                                        <td className="px-4 py-3.5 text-[15px] font-medium" style={{ width: columnWidths.deadline_due_in }}>
                                            <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${getDeadlineStyle(task)}`}>{formatDeadlineDisplay(task)}</span>
                                        </td>

                                        {isAnyRowEditing && (
                                            <td className="px-4 py-3.5 text-[15px] font-medium" style={{ width: columnWidths.completion_date }}>
                                                {isEditing ? (
                                                    <input type="text" value={editForm.completion_date || ''} onChange={(e) => setEditForm({ ...editForm, completion_date: e.target.value })} className="w-full p-2 rounded border border-indigo-300 text-sm" />
                                                ) : isBulk ? (
                                                    <input type="text" value={bulkVal('completion_date')} onChange={(e) => handleBulkChange(task.id, 'completion_date', e.target.value)} className="w-full p-2 rounded border border-slate-200 dark:border-slate-600 text-sm focus:ring-2 focus:ring-indigo-500" />
                                                ) : (
                                                    <div className="truncate text-sm" title={task.completion_date}>{task.completion_date || '-'}</div>
                                                )}
                                            </td>
                                        )}

                                        <td className="px-4 py-3.5 text-[15px] font-medium text-slate-900 dark:text-white" style={{ width: columnWidths.task_number }}>
                                            {isEditing ? (
                                                <textarea value={editForm.task_number} onChange={(e) => setEditForm({ ...editForm, task_number: e.target.value })} className="w-full p-2 rounded border border-indigo-300 text-sm" rows={2} />
                                            ) : isBulk ? (
                                                <textarea value={bulkVal('task_number')} onChange={(e) => handleBulkChange(task.id, 'task_number', e.target.value)} className="w-full p-2 rounded border border-slate-200 dark:border-slate-600 text-sm focus:ring-2 focus:ring-indigo-500" rows={2} />
                                            ) : (
                                                <span className="leading-snug block">{task.task_number}</span>
                                            )}
                                        </td>

                                        <td className="px-4 py-3.5 text-[15px] font-medium text-slate-700 dark:text-slate-200" style={{ width: columnWidths.description }}>
                                            {isEditing ? (
                                                <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className="w-full p-2 rounded border border-indigo-300 text-sm" rows={3} />
                                            ) : isBulk ? (
                                                <textarea value={bulkVal('description')} onChange={(e) => handleBulkChange(task.id, 'description', e.target.value)} className="w-full p-2 rounded border border-slate-200 dark:border-slate-600 text-sm focus:ring-2 focus:ring-indigo-500" rows={3} />
                                            ) : (
                                                <div className="leading-relaxed opacity-90 text-sm whitespace-pre-wrap" title={task.description}>{task.description || '-'}</div>
                                            )}
                                        </td>

                                        <td className="px-4 py-3.5 text-[15px] font-medium" style={{ width: columnWidths.assigned_agency }}>
                                            {isEditing ? (
                                                <select value={editForm.assigned_agency} onChange={(e) => setEditForm({ ...editForm, assigned_agency: e.target.value })} className="w-full p-2 rounded border border-indigo-300 text-sm">
                                                    {agencies.map(a => <option key={a} value={a}>{a}</option>)} <option value={task.assigned_agency} hidden>{task.assigned_agency}</option>
                                                </select>
                                            ) : isBulk ? (
                                                <select value={bulkVal('assigned_agency')} onChange={(e) => handleBulkChange(task.id, 'assigned_agency', e.target.value)} className="w-full p-2 rounded border border-slate-200 dark:border-slate-600 text-sm focus:ring-2 focus:ring-indigo-500">
                                                    {agencies.map(a => <option key={a} value={a}>{a}</option>)} <option value={task.assigned_agency} hidden>{task.assigned_agency}</option>
                                                </select>
                                            ) : (
                                                <span className="truncate block opacity-90">{task.assigned_agency || 'Unassigned'}</span>
                                            )}
                                        </td>

                                        <td className="px-4 py-3.5 text-sm font-semibold text-slate-500 dark:text-dark-muted whitespace-nowrap" style={{ width: columnWidths.allocated_date }}>
                                            {task.allocated_date ? format(new Date(task.allocated_date), 'MMM dd, yy') : '-'}
                                        </td>

                                        <td className="px-4 py-3.5 text-sm font-medium" style={{ width: columnWidths.time_given }}>
                                            {isEditing ? (
                                                <input type="text" value={editForm.time_given || ''} onChange={(e) => handleTimeChange(e, task)} className="w-full p-2 rounded border border-indigo-300 text-sm" />
                                            ) : isBulk ? (
                                                <input type="text" value={bulkVal('time_given')} onChange={(e) => handleBulkChange(task.id, 'time_given', e.target.value)} className="w-full p-2 rounded border border-slate-200 dark:border-slate-600 text-sm focus:ring-2 focus:ring-indigo-500" />
                                            ) : (
                                                <span className="opacity-80">{task.time_given || '7 days'}</span>
                                            )}
                                        </td>

                                        <td className="px-4 py-3.5 text-sm font-semibold whitespace-nowrap" style={{ width: columnWidths.deadline_date }}>
                                            {isEditing ? (
                                                <input type="date" value={editForm.deadline_date || ''} onChange={(e) => handleDeadlineChange(e, task)} className="w-full p-2 rounded border border-indigo-300 text-sm" />
                                            ) : isBulk ? (
                                                <input type="date" value={bulkVal('deadline_date')} onChange={(e) => handleBulkChange(task.id, 'deadline_date', e.target.value)} className="w-full p-2 rounded border border-slate-200 dark:border-slate-600 text-sm focus:ring-2 focus:ring-indigo-500" />
                                            ) : (
                                                <span className="dark:text-white opacity-90">{task.deadline_date ? format(new Date(task.deadline_date), 'MMM dd, yy') : '-'}</span>
                                            )}
                                        </td>

                                        <td className="px-4 py-3" style={{ width: columnWidths.action }}>
                                            {isEditing && !isBulk ? (
                                                <div className="flex gap-1.5">
                                                    <button onClick={() => saveEdit(task.id)} className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200 transition-premium shadow-sm"><Check size={16} /></button>
                                                    <button onClick={cancelEdit} className="p-1.5 bg-rose-100 text-rose-600 rounded-lg hover:bg-rose-200 transition-premium shadow-sm"><X size={16} /></button>
                                                </div>
                                            ) : !isBulk && (
                                                <div className="flex gap-1">
                                                    {user?.role === 'admin' && (
                                                        <>
                                                            <button onClick={() => handleWhatsAppFollowup(task)} className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-600 transition-premium" title="WhatsApp Follow-up"><MessageCircle size={16} /></button>
                                                            <button onClick={() => startEdit(task)} className="p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-500/10 text-slate-400 hover:text-indigo-600 transition-premium"><Edit2 size={16} /></button>
                                                            <div className="relative">
                                                                <button
                                                                    onClick={() => document.getElementById(`deadline-picker-quick-${task.id}`).showPicker()}
                                                                    className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10 text-slate-400 hover:text-blue-600 transition-premium"
                                                                    title="Set Deadline"
                                                                >
                                                                    <Calendar size={16} />
                                                                </button>
                                                                <input
                                                                    id={`deadline-picker-quick-${task.id}`}
                                                                    type="date"
                                                                    className="absolute top-0 left-0 opacity-0 w-0 h-0"
                                                                    value={task.deadline_date || ''}
                                                                    onChange={async (e) => {
                                                                        const newDeadline = e.target.value;
                                                                        if (!newDeadline) return;

                                                                        try {
                                                                            // Calculate time_given automatically for consistency
                                                                            let timeGiven = task.time_given;
                                                                            if (task.allocated_date) {
                                                                                const allocated = new Date(task.allocated_date);
                                                                                const deadline = new Date(newDeadline);
                                                                                if (!isNaN(allocated.getTime()) && !isNaN(deadline.getTime())) {
                                                                                    const diffTime = deadline - allocated;
                                                                                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                                                                    timeGiven = `${diffDays} days`;
                                                                                }
                                                                            }

                                                                            await api.updateTask(task.id, {
                                                                                deadline_date: newDeadline,
                                                                                time_given: timeGiven
                                                                            });
                                                                            fetchData();
                                                                        } catch (err) {
                                                                            alert("Failed to update deadline: " + err.message);
                                                                        }
                                                                    }}
                                                                />
                                                            </div>
                                                            <button onClick={() => handleQuickComplete(task)} className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-600 transition-premium" title="Mark Completed"><CheckSquare size={16} /></button>
                                                            <button onClick={() => handlePriorityToggle(task)} className={`p-1.5 rounded-lg transition-premium ${task.priority === 'High' ? 'bg-red-50 dark:bg-red-500/20 text-red-600' : 'hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-600'}`} title="Toggle Important"><AlertTriangle size={16} className={task.priority === 'High' ? "fill-current" : ""} /></button>
                                                            <button onClick={() => handlePin(task)} className={`p-1.5 rounded-lg transition-premium ${task.is_pinned ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600' : 'hover:bg-indigo-50 dark:hover:bg-indigo-500/10 text-slate-400 hover:text-indigo-600'}`} title="Pin to Today"><Pin size={16} className={task.is_pinned ? "fill-current" : ""} /></button>
                                                            <button onClick={() => handleDelete(task)} className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 transition-premium"><Trash2 size={16} /></button>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    </motion.tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div >

            {/* Image Preview Modal */}
            {viewImage && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setViewImage(null)}>
                    <div className="bg-white p-2 rounded-lg max-w-3xl max-h-[90vh] overflow-hidden relative shadow-2xl" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setViewImage(null)} className="absolute top-2 right-2 p-2 bg-white/80 rounded-full hover:bg-white text-black font-bold">
                            <X size={20} />
                        </button>
                        <img src={viewImage} alt="Attachment" className="max-w-full max-h-[85vh] object-contain rounded" />
                    </div>
                </div>
            )}
        </div >
    );
};

export default TaskTable;

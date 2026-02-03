import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
    MoreVertical, FileText, CheckCircle, Clock, AlertCircle,
    Search, Filter, Download, Edit2, Check, X, Trash2, ArrowUpDown, CheckSquare, Pin, Calendar, Image, Link, AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';
import { api } from '../services/api';
import { useRef } from 'react';

const TaskTable = ({ tasks, onEdit, loading, fetchData, agencies, user, isBulkEditMode, bulkEdits, setBulkEdits, selectedTasks, toggleSelection, selectAll }) => {
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [viewImage, setViewImage] = useState(null); // Base64 string
    const [sortConfig, setSortConfig] = useState({ key: 'deadline_due_in', direction: 'asc' });

    // Column Resizing Logic
    const [columnWidths, setColumnWidths] = useState({
        sno: 60,
        deadline_due_in: 110,
        completion_date: 120,
        task_number: 350,
        description: 600,
        attachment: 100,
        assigned_agency: 140,
        priority: 90,
        allocated_date: 110,
        time_given: 90,
        deadline_date: 130,
        action: 130
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
                    const parseDeadline = (val) => {
                        if (!val && val !== 0) return 999999;
                        const strVal = String(val).toLowerCase();
                        if (strVal.includes('completed')) return 999999;
                        const match = strVal.match(/-?\d+/);
                        return match ? parseInt(match[0], 10) : 999999;
                    };
                    const numA = parseDeadline(aVal);
                    const numB = parseDeadline(bVal);
                    if (numA !== numB) return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
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
                        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                    }
                }

                return b.id - a.id;
            });
        }
        return sortableTasks;
    }, [tasks, sortConfig]);

    // Status Badge Helper
    const getStatusBadge = (status) => {
        let styles = "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300";
        let icon = Clock;

        if (status === 'Completed') {
            styles = "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
            icon = CheckCircle;
        } else if (status === 'Overdue') {
            styles = "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
            icon = AlertCircle;
        } else if (status === 'Pending') {
            styles = "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
        }

        const Icon = icon;
        return (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-transparent ${styles}`}>
                <Icon size={12} />
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
            if (!isNaN(allocated)) {
                const deadline = new Date(allocated);
                deadline.setDate(allocated.getDate() + days);
                updates.deadline_date = deadline.toISOString().split('T')[0];
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

    const handlePriorityToggle = async (task) => {
        try {
            const newPriority = task.priority === 'High' ? 'Medium' : 'High';
            await api.updateTask(task.id, { priority: newPriority });
            fetchData();
        } catch (e) {
            console.error("Failed to update priority:", e);
        }
    };



    // Bulk Edit Handlers
    const handleBulkChange = (id, field, value) => {
        setBulkEdits(prev => ({
            ...prev,
            [id]: {
                ...prev[id],
                [field]: value
            }
        }));
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
        <div className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full text-left border-collapse table-fixed">
                    <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                            {isBulkEditMode && (
                                <th className="px-4 py-4 w-[50px]">
                                    <Checkbox checked={isAllSelected} onChange={() => selectAll(allTaskIds)} />
                                </th>
                            )}
                            <th className="px-6 py-4 text-base font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider relative group whitespace-nowrap" style={{ width: columnWidths.sno }}>
                                S.No <Resizer colKey="sno" />
                            </th>
                            <th onClick={() => handleSort('deadline_due_in')} className="px-6 py-4 text-base font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none relative group whitespace-nowrap" style={{ width: columnWidths.deadline_due_in }}>
                                <div className="flex items-center gap-1">Due In {sortConfig.key === 'deadline_due_in' && <ArrowUpDown size={14} />}</div> <Resizer colKey="deadline_due_in" />
                            </th>
                            {isAnyRowEditing && (
                                <th onClick={() => handleSort('completion_date')} className="px-6 py-4 text-base font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none relative group whitespace-nowrap" style={{ width: columnWidths.completion_date }}>
                                    <div className="flex items-center gap-1">Completion {sortConfig.key === 'completion_date' && <ArrowUpDown size={14} />}</div> <Resizer colKey="completion_date" />
                                </th>
                            )}
                            <th onClick={() => handleSort('task_number')} className="px-6 py-4 text-base font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none relative group whitespace-nowrap" style={{ width: columnWidths.task_number }}>
                                <div className="flex items-center gap-1">Task Name {sortConfig.key === 'task_number' && <ArrowUpDown size={14} />}</div> <Resizer colKey="task_number" />
                            </th>
                            <th onClick={() => handleSort('description')} className="px-6 py-4 text-base font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none relative group" style={{ width: columnWidths.description }}>
                                <div className="flex items-center gap-1">Comments by Steno {sortConfig.key === 'description' && <ArrowUpDown size={14} />}</div> <Resizer colKey="description" />
                            </th>
                            <th className="px-6 py-4 text-base font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider relative group" style={{ width: columnWidths.attachment }}>
                                Files <Resizer colKey="attachment" />
                            </th>
                            <th onClick={() => handleSort('assigned_agency')} className="px-6 py-4 text-base font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none relative group" style={{ width: columnWidths.assigned_agency }}>
                                <div className="flex items-center gap-1">Assigned To {sortConfig.key === 'assigned_agency' && <ArrowUpDown size={14} />}</div> <Resizer colKey="assigned_agency" />
                            </th>
                            <th onClick={() => handleSort('priority')} className="px-6 py-4 text-base font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none relative group" style={{ width: columnWidths.priority }}>
                                <div className="flex items-center gap-1">Priority {sortConfig.key === 'priority' && <ArrowUpDown size={14} />}</div> <Resizer colKey="priority" />
                            </th>
                            <th onClick={() => handleSort('allocated_date')} className="px-6 py-4 text-base font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none relative group" style={{ width: columnWidths.allocated_date }}>
                                <div className="flex items-center gap-1">Allocated {sortConfig.key === 'allocated_date' && <ArrowUpDown size={14} />}</div> <Resizer colKey="allocated_date" />
                            </th>
                            <th onClick={() => handleSort('time_given')} className="px-6 py-4 text-base font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none relative group" style={{ width: columnWidths.time_given }}>
                                <div className="flex items-center gap-1">Time Given {sortConfig.key === 'time_given' && <ArrowUpDown size={14} />}</div> <Resizer colKey="time_given" />
                            </th>
                            <th onClick={() => handleSort('deadline_date')} className="px-6 py-4 text-base font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none relative group" style={{ width: columnWidths.deadline_date }}>
                                <div className="flex items-center gap-1">Deadline {sortConfig.key === 'deadline_date' && <ArrowUpDown size={14} />}</div> <Resizer colKey="deadline_date" />
                            </th>
                            <th className="px-6 py-4 text-base font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider relative group" style={{ width: columnWidths.action }}>
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
                                        <td className="px-6 py-4 text-[17px] font-medium text-slate-600 dark:text-slate-300 text-center" style={{ width: columnWidths.sno }}>
                                            {index + 1}
                                        </td>

                                        <td className="px-6 py-4 text-[17px] font-medium" style={{ width: columnWidths.deadline_due_in }}>
                                            <span className={`px-2 py-1 rounded text-sm font-medium ${getDeadlineStyle(task)}`}>{formatDeadlineDisplay(task)}</span>
                                        </td>

                                        {isAnyRowEditing && (
                                            <td className="px-6 py-4 text-[17px] font-medium" style={{ width: columnWidths.completion_date }}>
                                                {isEditing ? (
                                                    <input type="text" value={editForm.completion_date || ''} onChange={(e) => setEditForm({ ...editForm, completion_date: e.target.value })} className="w-full p-2 rounded border border-indigo-300 text-sm" />
                                                ) : isBulk ? (
                                                    <input type="text" value={bulkVal('completion_date')} onChange={(e) => handleBulkChange(task.id, 'completion_date', e.target.value)} className="w-full p-2 rounded border border-slate-200 dark:border-slate-600 text-sm focus:ring-2 focus:ring-indigo-500" />
                                                ) : (
                                                    <div className="truncate" title={task.completion_date}>{task.completion_date || '-'}</div>
                                                )}
                                            </td>
                                        )}

                                        <td className="px-6 py-4 text-[17px] font-medium text-slate-900 dark:text-white whitespace-normal break-words" style={{ width: columnWidths.task_number }}>
                                            {isEditing ? (
                                                <textarea value={editForm.task_number} onChange={(e) => setEditForm({ ...editForm, task_number: e.target.value })} className="w-full p-2 rounded border border-indigo-300 text-[15px]" rows={2} />
                                            ) : isBulk ? (
                                                <textarea value={bulkVal('task_number')} onChange={(e) => handleBulkChange(task.id, 'task_number', e.target.value)} className="w-full p-2 rounded border border-slate-200 dark:border-slate-600 text-[15px] focus:ring-2 focus:ring-indigo-500" rows={2} />
                                            ) : (
                                                <span>{task.task_number}</span>
                                            )}
                                        </td>

                                        <td className="px-6 py-4 text-[17px] font-medium text-slate-700 dark:text-slate-200" style={{ width: columnWidths.description }}>
                                            {isEditing ? (
                                                <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className="w-full p-2 rounded border border-indigo-300 text-sm" rows={3} />
                                            ) : isBulk ? (
                                                <textarea value={bulkVal('description')} onChange={(e) => handleBulkChange(task.id, 'description', e.target.value)} className="w-full p-2 rounded border border-slate-200 dark:border-slate-600 text-sm focus:ring-2 focus:ring-indigo-500" rows={3} />
                                            ) : (
                                                <div className="whitespace-pre-wrap break-words" title={task.description}>{task.description || '-'}</div>
                                            )}
                                        </td>

                                        <td className="px-6 py-4 text-center" style={{ width: columnWidths.attachment }}>
                                            {!task.attachment_data ? (
                                                <span className="text-slate-400">-</span>
                                            ) : task.attachment_data.startsWith('http') ? (
                                                <a href={task.attachment_data} target="_blank" rel="noopener noreferrer" className="inline-flex p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors" title="Open Link">
                                                    <Link size={18} />
                                                </a>
                                            ) : (
                                                <button onClick={() => setViewImage(task.attachment_data)} className="inline-flex p-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors" title="View Image">
                                                    <Image size={18} />
                                                </button>
                                            )}
                                        </td>

                                        <td className="px-6 py-4 text-[17px] font-medium" style={{ width: columnWidths.assigned_agency }}>
                                            {isEditing ? (
                                                <select value={editForm.assigned_agency} onChange={(e) => setEditForm({ ...editForm, assigned_agency: e.target.value })} className="w-full p-2 rounded border border-indigo-300 text-sm">
                                                    {agencies.map(a => <option key={a} value={a}>{a}</option>)} <option value={task.assigned_agency} hidden>{task.assigned_agency}</option>
                                                </select>
                                            ) : isBulk ? (
                                                <select value={bulkVal('assigned_agency')} onChange={(e) => handleBulkChange(task.id, 'assigned_agency', e.target.value)} className="w-full p-2 rounded border border-slate-200 dark:border-slate-600 text-sm focus:ring-2 focus:ring-indigo-500">
                                                    {agencies.map(a => <option key={a} value={a}>{a}</option>)} <option value={task.assigned_agency} hidden>{task.assigned_agency}</option>
                                                </select>
                                            ) : (
                                                <span>{task.assigned_agency || 'Unassigned'}</span>
                                            )}
                                        </td>

                                        <td className="px-6 py-4" style={{ width: columnWidths.priority }}>
                                            <span className="text-sm px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 font-bold">{task.priority || 'Normal'}</span>
                                        </td>

                                        <td className="px-6 py-4 text-[17px] font-medium whitespace-nowrap" style={{ width: columnWidths.allocated_date }}>
                                            {task.allocated_date ? format(new Date(task.allocated_date), 'MMM dd, yyyy') : '-'}
                                        </td>

                                        <td className="px-6 py-4 text-[17px] font-medium" style={{ width: columnWidths.time_given }}>
                                            {isEditing ? (
                                                <input type="text" value={editForm.time_given || ''} onChange={(e) => handleTimeChange(e, task)} className="w-full p-2 rounded border border-indigo-300 text-sm" />
                                            ) : isBulk ? (
                                                <input type="text" value={bulkVal('time_given')} onChange={(e) => handleBulkChange(task.id, 'time_given', e.target.value)} className="w-full p-2 rounded border border-slate-200 dark:border-slate-600 text-sm focus:ring-2 focus:ring-indigo-500" />
                                            ) : (
                                                <span>{task.time_given || '7 days'}</span>
                                            )}
                                        </td>

                                        <td className="px-6 py-4 text-[17px] font-medium whitespace-nowrap" style={{ width: columnWidths.deadline_date }}>
                                            {isEditing ? (
                                                <input type="date" value={editForm.deadline_date || ''} onChange={(e) => setEditForm({ ...editForm, deadline_date: e.target.value })} className="w-full p-2 rounded border border-indigo-300 text-sm" />
                                            ) : isBulk ? (
                                                <input type="date" value={bulkVal('deadline_date')} onChange={(e) => handleBulkChange(task.id, 'deadline_date', e.target.value)} className="w-full p-2 rounded border border-slate-200 dark:border-slate-600 text-sm focus:ring-2 focus:ring-indigo-500" />
                                            ) : (
                                                <span>{task.deadline_date ? format(new Date(task.deadline_date), 'MMM dd, yyyy') : '-'}</span>
                                            )}
                                        </td>

                                        <td className="px-6 py-4" style={{ width: columnWidths.action }}>
                                            {isEditing && !isBulk ? (
                                                <div className="flex gap-2">
                                                    <button onClick={() => saveEdit(task.id)} className="p-1.5 bg-green-100 text-green-600 rounded"><Check size={16} /></button>
                                                    <button onClick={cancelEdit} className="p-1.5 bg-red-100 text-red-600 rounded"><X size={16} /></button>
                                                </div>
                                            ) : !isBulk && (
                                                <div className="flex gap-2">
                                                    {user?.role === 'admin' && (
                                                        <>
                                                            <button onClick={() => startEdit(task)} className="p-2 rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600"><Edit2 size={16} /></button>
                                                            <div className="relative">
                                                                <button onClick={() => document.getElementById(`date-picker-${task.id}`).showPicker()} className="p-2 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600"><Calendar size={16} /></button>
                                                                <input id={`date-picker-${task.id}`} type="datetime-local" className="absolute top-0 left-0 opacity-0 w-0 h-0" defaultValue={task.scheduled_date ? `${task.scheduled_date}T${task.scheduled_time || '09:00'}` : ''}
                                                                    onChange={async (e) => {
                                                                        try {
                                                                            const val = e.target.value; if (!val) return;
                                                                            const [date, time] = val.split('T');
                                                                            await api.updateTask(task.id, { scheduled_date: date, scheduled_time: time });
                                                                            fetchData(); alert(`Scheduled for ${date} at ${time}`);
                                                                        } catch (err) { alert("Failed to schedule: " + err.message); }
                                                                    }}
                                                                />
                                                            </div>
                                                            <button onClick={() => handleQuickComplete(task)} className="p-2 rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-600"><CheckSquare size={16} /></button>
                                                            <button onClick={() => handlePin(task)} className={`p-2 rounded-lg ${task.is_pinned ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-indigo-50 text-slate-400 hover:text-indigo-600'}`}><Pin size={16} className={task.is_pinned ? "fill-indigo-600" : ""} /></button>
                                                            <button onClick={() => handlePriorityToggle(task)} className={`p-2 rounded-lg ${task.priority === 'High' ? 'bg-red-50 text-red-600' : 'hover:bg-red-50 text-slate-400 hover:text-red-600'}`} title="Mark Urgent"><AlertTriangle size={16} className={task.priority === 'High' ? "fill-red-600" : ""} /></button>
                                                            <button onClick={() => handleDelete(task)} className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>
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

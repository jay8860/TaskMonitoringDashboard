import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Layout from '../components/Layout';
import StatCard from '../components/StatCard';
import TaskTable from '../components/TaskTable';
import AddTaskModal from '../components/AddTaskModal';
import { api } from '../services/api';
import {
    ClipboardList, CheckSquare, Clock, AlertTriangle,
    Search, Filter, Plus, FileDown, RefreshCw, XCircle, Calendar, Pin, Sparkles, FileText, Edit2, Trash2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import MultiSelect from '../components/MultiSelect';

const Dashboard = () => {
    const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')) || { role: 'viewer' });
    const [tasks, setTasks] = useState([]);
    const [stats, setStats] = useState({ total: 0, completed: 0, pending: 0, overdue: 0, by_agency: [] });
    const [loading, setLoading] = useState(true);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('all'); // 'all' | 'today'
    const [allEmployees, setAllEmployees] = useState([]); // Full list for dropdowns
    const [summary, setSummary] = useState('');
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);

    // Bulk Edit & Selection State
    const [isBulkEditMode, setIsBulkEditMode] = useState(false);
    const [bulkEdits, setBulkEdits] = useState({});
    const [selectedTasks, setSelectedTasks] = useState([]);

    const toggleSelection = (taskId) => {
        setSelectedTasks(prev =>
            prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
        );
    };

    const selectAll = (allTaskIds) => {
        if (selectedTasks.length === allTaskIds.length) {
            setSelectedTasks([]);
        } else {
            setSelectedTasks(allTaskIds);
        }
    };

    const handleBulkDelete = async () => {
        if (!window.confirm(`Delete ${selectedTasks.length} tasks?`)) return;
        setLoading(true);
        try {
            await Promise.all(selectedTasks.map(id => api.deleteTask(id)));
            setSelectedTasks([]);
            await fetchData();
            alert("Tasks deleted!");
        } catch (e) {
            alert("Bulk delete failed: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleBulkReschedule = async () => {
        const days = prompt("Enter days to extend deadline by (e.g., 7):");
        if (!days) return;
        const numDays = parseInt(days);
        if (isNaN(numDays)) return alert("Invalid number");

        setLoading(true);
        try {
            const updates = selectedTasks.map(id => {
                const task = tasks.find(t => t.id === id);
                if (!task) return null;
                const currentDeadline = new Date(task.deadline_date || new Date());
                const newDeadline = new Date(currentDeadline);
                newDeadline.setDate(newDeadline.getDate() + numDays);
                return {
                    id,
                    deadline_date: newDeadline.toISOString().split('T')[0],
                    time_given: String(numDays) // Or update logic
                };
            }).filter(Boolean);

            await api.bulkUpdateTasks(updates);
            setSelectedTasks([]);
            await fetchData();
            alert("Tasks rescheduled!");
        } catch (e) {
            alert("Bulk reschedule failed: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    // Filters
    const location = useLocation();

    // Filters - Initialize from Navigation State if available
    const [search, setSearch] = useState(location.state?.search || '');
    const [selectedAgency, setSelectedAgency] = useState(location.state?.filterAgency ? [location.state.filterAgency] : []);
    const [selectedStatus, setSelectedStatus] = useState(location.state?.filterStatus ? [location.state.filterStatus] : ['Pending', 'Overdue']);

    // Clear location state after using it to prevent "stuck" filters on refresh
    useEffect(() => {
        if (location.state) {
            window.history.replaceState({}, document.title)
        }
    }, []);

    const fetchData = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const filters = { search };
            if (selectedAgency.length > 0) filters.agency = selectedAgency.join(',');
            if (selectedStatus.length > 0) filters.status = selectedStatus.join(',');

            const [tasksData, statsData, employeesData] = await Promise.all([
                api.getTasks(filters),
                api.getStats(),
                api.getEmployees()
            ]);

            setTasks(tasksData);
            setStats(statsData);
            setAllEmployees(employeesData.map(e => e.display_name).sort());
        } catch (error) {
            console.error("Failed to fetch data:", error);
            // Don't alert on silent polling errors to avoid spamming user
            if (!silent) alert("Failed to load data: " + error.message);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // Auto-Refresh every 10 seconds (Silent)
        const interval = setInterval(() => {
            fetchData(true);
        }, 10000);
        return () => clearInterval(interval);
    }, [search, selectedAgency, selectedStatus]);

    const handleLogout = () => {
        localStorage.removeItem('user');
        window.location.href = '/login';
    };

    const handleSync = async () => {
        setLoading(true);
        try {
            await api.syncSheet();
            await fetchData();
            alert("Sync Complete!");
        } catch (e) {
            alert("Sync Failed");
        } finally {
            setLoading(false);
        }
    };

    const handleAddTask = async (newTask) => {
        try {
            await api.createTask({
                ...newTask,
                allocated_date: new Date().toISOString().split('T')[0]
            });
            await fetchData(); // Refresh
            alert("Task Added Locally!");
        } catch (e) {
            alert("Failed to add task: " + (e.response?.data?.detail || e.message));
        }
    };

    const handleExportExcel = () => {
        const ws = XLSX.utils.json_to_sheet(tasks.map(t => ({
            "Task No": t.task_number,
            "Description": t.description,
            "Assigned To": t.assigned_agency,
            "Deadline": t.deadline_date,
            "Status": t.status,
            "Priority": t.priority
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Tasks");
        XLSX.writeFile(wb, "dantewada_tasks.xlsx");
    };

    const handleGenerateSummary = async () => {
        setSummaryLoading(true);
        setIsSummaryModalOpen(true);
        setSummary(''); // Clear old
        try {
            const data = await api.getExecutiveSummary();
            setSummary(data.summary);
        } catch (e) {
            setSummary("Failed to generate summary. Please ensure the backend is running and Gemini API key is configured.");
        } finally {
            setSummaryLoading(false);
        }
    };

    const handleBulkSave = async () => {
        if (Object.keys(bulkEdits).length === 0) {
            setIsBulkEditMode(false);
            return;
        }

        setLoading(true);
        try {
            // Convert Object to Array
            const updatesArray = Object.keys(bulkEdits).map(id => ({
                id: parseInt(id),
                ...bulkEdits[id]
            }));

            await api.bulkUpdateTasks(updatesArray);
            setBulkEdits({});
            setIsBulkEditMode(false);
            await fetchData();
            alert(`Successfully updated ${updatesArray.length} tasks!`);
        } catch (e) {
            alert("Bulk update failed: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const cancelBulkEdit = () => {
        setBulkEdits({});
        setIsBulkEditMode(false);
    };


    const agencies = stats.by_agency ? stats.by_agency.map(a => a.name) : [];

    const handleStatClick = (type) => {
        if (type === 'Total') {
            resetFilters();
        } else {
            setSelectedStatus([type]);
        }
    };

    const resetFilters = () => {
        setSearch('');
        setSelectedStatus([]);
        setSelectedAgency([]);
    };

    return (
        <Layout user={user} onLogout={handleLogout}>
            <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">Dashboard</h1>
                    <p className="text-slate-500 dark:text-slate-400">Welcome back, {user.username || 'Officer'}</p>
                </div>

                <div className="flex gap-2">
                    {/* Tab Switcher - Hide for Viewer */}
                    {user.role === 'admin' && (
                        <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex items-center mr-4">
                            <button
                                onClick={() => setActiveTab('all')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'all' ? 'bg-white dark:bg-dark-card shadow text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                            >
                                All Tasks
                            </button>
                            <button
                                onClick={() => setActiveTab('today')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'today' ? 'bg-white dark:bg-dark-card shadow text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                            >
                                <Pin size={14} className={activeTab === 'today' ? 'fill-indigo-600 dark:fill-indigo-400' : ''} />
                                Today's Tasks
                            </button>
                        </div>
                    )}

                    {user.role === 'admin' && (
                        <button
                            onClick={handleGenerateSummary}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
                        >
                            <Sparkles size={18} className={summaryLoading ? 'animate-pulse' : ''} />
                            AI Summary
                        </button>
                    )}

                    {/* Only Admin can Sync */}
                    {user.role === 'admin' && (
                        <button
                            onClick={handleSync}
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-colors shadow-lg shadow-slate-500/20"
                        >
                            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                            Sync
                        </button>
                    )}

                    <button
                        onClick={handleExportExcel}
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-dark-card border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                        <FileDown size={18} />
                        Export
                    </button>

                    {user.role === 'admin' && (
                        <>
                            {!isBulkEditMode ? (
                                <>
                                    <button
                                        onClick={() => setIsBulkEditMode(true)}
                                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-dark-card border border-indigo-200 dark:border-indigo-900 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                                    >
                                        <Edit2 size={18} />
                                        Bulk Actions
                                    </button>
                                    <button
                                        onClick={() => setIsAddModalOpen(true)}
                                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/30"
                                    >
                                        <Plus size={18} />
                                        Add Task
                                    </button>
                                </>
                            ) : (
                                <div className="flex gap-2 animate-in fade-in slide-in-from-right-4 duration-300 items-center">
                                    <span className="text-sm text-slate-500 mr-2">{selectedTasks.length} selected</span>

                                    {selectedTasks.length > 0 && (
                                        <>
                                            <button onClick={handleBulkDelete} className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors" title="Delete Selected"><Trash2 size={18} /></button>
                                            <button onClick={handleBulkReschedule} className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors" title="Extend Deadline"><Calendar size={18} /></button>
                                        </>
                                    )}

                                    <div className="h-6 w-px bg-slate-300 mx-2"></div>

                                    <button
                                        onClick={cancelBulkEdit}
                                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                                    >
                                        Exit
                                    </button>
                                    <button
                                        onClick={handleBulkSave}
                                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors shadow-lg shadow-green-500/30 font-bold"
                                    >
                                        <CheckSquare size={18} />
                                        Save Edits
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard
                    title="Total Tasks"
                    value={stats.total}
                    icon={ClipboardList}
                    color="indigo"
                    delay={0}
                    onClick={() => handleStatClick('Total')}
                />
                <StatCard
                    title="Pending"
                    value={stats.pending}
                    icon={Clock}
                    color="yellow"
                    delay={1}
                    onClick={() => handleStatClick('Pending')}
                />
                <StatCard
                    title="Completed"
                    value={stats.completed}
                    icon={CheckSquare}
                    color="green"
                    delay={2}
                    onClick={() => handleStatClick('Completed')}
                />
                <StatCard
                    title="Overdue"
                    value={stats.overdue}
                    icon={AlertTriangle}
                    color="red"
                    delay={3}
                    onClick={() => handleStatClick('Overdue')}
                />
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col md:flex-row gap-4 mb-6 bg-white dark:bg-dark-card p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search tasks..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-lg focus:ring-2 focus:ring-indigo-500 dark:text-white"
                    />
                </div>

                <div className="flex gap-2 w-full md:w-auto flex-wrap">
                    <MultiSelect
                        label="Status"
                        options={['Pending', 'Completed', 'Overdue']}
                        selected={selectedStatus}
                        onChange={setSelectedStatus}
                        placeholder="All Statuses"
                    />

                    <MultiSelect
                        label="Agency"
                        options={agencies}
                        selected={selectedAgency}
                        onChange={setSelectedAgency}
                        placeholder="All Agencies"
                    />

                    {(search || selectedStatus.length > 0 || selectedAgency.length > 0) && (
                        <button
                            onClick={resetFilters}
                            className="flex items-center gap-2 px-3 py-2 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors"
                        >
                            <XCircle size={18} />
                            Reset Filters
                        </button>
                    )}
                </div>
            </div>

            {/* Tasks Table */}
            <TaskTable
                tasks={activeTab === 'today' ? tasks.filter(t => t.is_pinned) : tasks}
                loading={loading}
                fetchData={fetchData}
                agencies={allEmployees.length > 0 ? allEmployees : agencies}
                user={user}
                onEdit={(task) => console.log("Edit", task)}
                isBulkEditMode={isBulkEditMode}
                bulkEdits={bulkEdits}
                setBulkEdits={setBulkEdits}
                selectedTasks={selectedTasks}
                toggleSelection={toggleSelection}
                selectAll={selectAll}
            />

            <AddTaskModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onAdd={handleAddTask}
                agencies={allEmployees.length > 0 ? allEmployees : agencies}
            />

            {/* AI Summary Modal */}
            {isSummaryModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-dark-card w-full max-w-3xl max-h-[80vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-700">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400">
                                    <Sparkles size={24} />
                                </div>
                                <h3 className="text-xl font-bold dark:text-white">Executive AI Summary</h3>
                            </div>
                            <button onClick={() => setIsSummaryModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                <XCircle size={24} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8">
                            {summaryLoading ? (
                                <div className="space-y-4 animate-pulse">
                                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
                                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-5/6"></div>
                                    <div className="pt-8 h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
                                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
                                </div>
                            ) : (
                                <div className="prose dark:prose-invert max-w-none">
                                    <div className="whitespace-pre-wrap text-slate-700 dark:text-slate-300 leading-relaxed font-sans text-lg">
                                        {summary.split('\n').map((line, i) => {
                                            const trimmedLine = line.trim();

                                            // 1. Detect Standard Headers (### HEADER ###)
                                            if (trimmedLine.startsWith('###') && trimmedLine.endsWith('###')) {
                                                const headerText = trimmedLine.replace(/###/g, '').trim();
                                                return (
                                                    <div key={i} className="text-center my-8 py-3 border-y border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 rounded-lg">
                                                        <h4 className="text-xl font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.2em]">
                                                            {headerText}
                                                        </h4>
                                                    </div>
                                                );
                                            }

                                            // 2. Highlight Task Names (Simple bolding)
                                            let parts = line.split(/(\*\*.*?\*\*)/g);
                                            let renderedLine = parts.map((part, index) => {
                                                if (part.startsWith('**') && part.endsWith('**')) {
                                                    return <strong key={index} className="text-slate-900 dark:text-white font-bold">{part.slice(2, -2)}</strong>;
                                                }
                                                return part;
                                            });

                                            // 3. Highlight [OVERDUE] tag in Red
                                            return (
                                                <div key={i} className="mb-2">
                                                    {renderedLine.map((p, j) => {
                                                        if (typeof p === 'string' && p.includes('[OVERDUE]')) {
                                                            const subParts = p.split(/(\[OVERDUE\])/g);
                                                            return subParts.map((sp, k) =>
                                                                sp === '[OVERDUE]' ?
                                                                    <span key={k} className="text-red-500 font-bold bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded-md border border-red-200 dark:border-red-800 ml-1 text-sm animate-pulse">OVERDUE</span> :
                                                                    sp
                                                            );
                                                        }
                                                        return p;
                                                    })}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                            <button
                                onClick={() => setIsSummaryModalOpen(false)}
                                className="px-6 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors font-medium"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </Layout >
    );
};

export default Dashboard;

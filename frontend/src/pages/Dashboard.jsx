import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Layout from '../components/Layout';
import StatCard from '../components/StatCard';
import TaskTable from '../components/TaskTable';
import AddTaskModal from '../components/AddTaskModal';
import DuplicatesModal from '../components/DuplicatesModal';
import { api } from '../services/api';
import {
    ClipboardList, CheckSquare, Clock, AlertTriangle,
    Search, Filter, Plus, FileDown, RefreshCw, XCircle, Calendar, Pin, Sparkles, FileText, Edit2, Trash2, ChevronDown, MessageCircle
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
    const [employeeObjects, setEmployeeObjects] = useState([]); // Full employee data for WhatsApp lookup
    const [summary, setSummary] = useState('');
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
    const [isDuplicatesModalOpen, setIsDuplicatesModalOpen] = useState(false);
    const [isActionsDropdownOpen, setIsActionsDropdownOpen] = useState(false);

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

    const handleBulkDelaySevenDays = async () => {
        if (!selectedTasks.length) return;
        if (!window.confirm(`Set deadline for ${selectedTasks.length} tasks to 7 days from today?`)) return;

        setLoading(true);
        try {
            const today = new Date();
            const newDeadlineDate = new Date(today);
            newDeadlineDate.setDate(today.getDate() + 7);
            const deadlineString = newDeadlineDate.toISOString().split('T')[0];

            const updates = selectedTasks.map(id => {
                const task = tasks.find(t => t.id === id);
                if (!task) return null;

                const allocated = task.allocated_date ? new Date(task.allocated_date) : today;
                const diffTime = Math.abs(newDeadlineDate - allocated);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                return {
                    id,
                    deadline_date: deadlineString,
                    time_given: `${diffDays} days`
                };
            }).filter(Boolean);

            await api.bulkUpdateTasks(updates);
            setSelectedTasks([]);
            await fetchData();
            alert("Tasks updated to 7 days from today!");
        } catch (e) {
            alert("Bulk update failed: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const selectOverdue = () => {
        const overdueIds = tasks.filter(t => {
            if (t.status === 'Completed' || t.completion_date) return false;
            if (!t.deadline_date) return false;
            const now = new Date();
            const deadline = new Date(t.deadline_date);
            now.setHours(0, 0, 0, 0);
            deadline.setHours(0, 0, 0, 0);
            return deadline < now;
        }).map(t => t.id);
        setSelectedTasks(overdueIds);
    };

    const handleBulkWhatsApp = () => {
        if (selectedTasks.length === 0) return;
        if (!window.confirm(`Open WhatsApp chats for ${selectedTasks.length} selected tasks?`)) return;

        let foundCount = 0;
        selectedTasks.forEach((id, index) => {
            const task = tasks.find(t => t.id === id);
            if (!task || !task.assigned_agency) return;

            // Find employee phone - Case insensitive and trimmed (matching TaskTable logic)
            const targetName = task.assigned_agency.trim().toLowerCase();
            const employee = employeeObjects.find(e =>
                e.display_name.trim().toLowerCase() === targetName
            );

            if (employee && employee.mobile) {
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

                // Use a small delay between opens to help avoid popup blockers
                setTimeout(() => {
                    window.open(whatsappUrl, '_blank');
                }, index * 400);
                foundCount++;
            }
        });

        if (foundCount === 0) {
            alert("No phone numbers found for the selected tasks' assignees.");
        } else if (foundCount < selectedTasks.length) {
            alert(`Opened ${foundCount} WhatsApp chats. ${selectedTasks.length - foundCount} tasks had missing phone numbers.`);
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
            setEmployeeObjects(employeesData);
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
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div>
                    <h2 className="text-4xl font-black tracking-tight dark:text-white mb-2">
                        Good Morning, <span className="premium-gradient-text">{user.display_name?.split(' ')[0] || 'Admin'}</span>
                    </h2>
                    <p className="text-slate-500 dark:text-dark-muted font-medium flex items-center gap-2">
                        <Calendar size={16} className="text-indigo-500" />
                        Today is {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </p>
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
                            <button
                                onClick={() => setActiveTab('important')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'important' ? 'bg-white dark:bg-dark-card shadow text-red-600 dark:text-red-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                            >
                                <AlertTriangle size={14} className={activeTab === 'important' ? 'fill-red-600 dark:fill-red-400' : ''} />
                                Important
                            </button>
                        </div>
                    )}

                    {/* Actions Dropdown */}
                    <div className="relative z-20">
                        <button
                            onClick={() => setIsActionsDropdownOpen(!isActionsDropdownOpen)}
                            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-dark-card border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm"
                        >
                            Actions
                            <ChevronDown size={16} />
                        </button>

                        {isActionsDropdownOpen && (
                            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-dark-card rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col p-1 animate-in fade-in slide-in-from-top-2 duration-200">
                                {user.role === 'admin' && (
                                    <button
                                        onClick={() => { handleSync(); setIsActionsDropdownOpen(false); }}
                                        disabled={loading}
                                        className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors text-left"
                                    >
                                        <RefreshCw size={16} className={loading ? 'animate-spin text-blue-500' : 'text-blue-500'} />
                                        Sync Sheet
                                    </button>
                                )}

                                <button
                                    onClick={() => { handleExportExcel(); setIsActionsDropdownOpen(false); }}
                                    className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors text-left"
                                >
                                    <FileDown size={16} className="text-green-500" />
                                    Export Excel
                                </button>

                                {user.role === 'admin' && (
                                    <>
                                        <div className="h-px bg-slate-100 dark:bg-slate-800 my-1"></div>
                                        <button
                                            onClick={() => { setIsDuplicatesModalOpen(true); setIsActionsDropdownOpen(false); }}
                                            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors text-left"
                                        >
                                            <AlertTriangle size={16} className="text-orange-500" />
                                            Find Duplicates
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Main Action Buttons */}
                    {user.role === 'admin' && !isBulkEditMode && (
                        <div className="flex gap-2">
                            <button
                                onClick={handleGenerateSummary}
                                disabled={summaryLoading}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors border border-indigo-100 dark:border-indigo-900/50"
                            >
                                <Sparkles size={18} className={summaryLoading ? 'animate-pulse' : ''} />
                                <span className="hidden md:inline">AI Summary</span>
                            </button>

                            <button
                                onClick={() => setIsBulkEditMode(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors border border-purple-100 dark:border-purple-900/50"
                            >
                                <Edit2 size={18} />
                                <span className="hidden md:inline">Bulk Actions</span>
                            </button>

                            <button
                                onClick={() => setIsAddModalOpen(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/30"
                            >
                                <Plus size={18} />
                                Add Task
                            </button>
                        </div>
                    )}

                    {/* Bulk Edit Controls - Replaces Normal Buttons when Active */}
                    {isBulkEditMode && (
                        <div className="flex gap-2 items-center animate-in fade-in slide-in-from-right-4 duration-300">
                            <span className="text-sm text-slate-500 mr-2 border-l border-slate-300 pl-3">{selectedTasks.length} selected</span>
                            {selectedTasks.length > 0 && (
                                <>
                                    <button onClick={handleBulkWhatsApp} className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors" title="WhatsApp Selected"><MessageCircle size={18} /></button>
                                    <button onClick={handleBulkDelete} className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors" title="Delete Selected"><Trash2 size={18} /></button>
                                    <button onClick={handleBulkReschedule} className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors" title="Extend Deadline (from current)"><Calendar size={18} /></button>
                                    <button onClick={handleBulkDelaySevenDays} className="p-2 bg-amber-100 text-amber-600 rounded-lg hover:bg-amber-200 transition-colors flex items-center gap-1.5 px-3" title="Add 7 Days (from today)">
                                        <Clock size={18} />
                                        <span className="text-xs font-bold whitespace-nowrap">+7 Days from Today</span>
                                    </button>
                                </>
                            )}

                            <div className="h-6 w-px bg-slate-300 mx-2"></div>

                            <button
                                onClick={selectOverdue}
                                className="px-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                            >
                                Select All Overdue
                            </button>

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

                </div>
            </div>

            {/* Stats Summary Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                <StatCard
                    title="Total Tasks"
                    value={stats.total}
                    icon={ClipboardList}
                    color="indigo"
                    delay={1}
                    onClick={() => handleStatClick('Total')}
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
                    title="Due Soon"
                    value={stats.pending}
                    icon={Clock}
                    color="yellow"
                    delay={3}
                    onClick={() => handleStatClick('Pending')}
                />
                <StatCard
                    title="Overdue"
                    value={stats.overdue}
                    icon={AlertTriangle}
                    color="red"
                    delay={4}
                    onClick={() => handleStatClick('Overdue')}
                />
            </div>

            {/* Filter & Search Bar */}
            <div className="glass-card p-6 rounded-[2rem] border premium-border mb-8 shadow-premium-sm">
                <div className="flex flex-col xl:flex-row gap-6">
                    <div className="flex-1 relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                        <input
                            type="text"
                            placeholder="Search tasks, descriptions, or agencies..."
                            className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-white/5 border premium-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white transition-premium text-sm font-medium"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2 bg-slate-50 dark:bg-white/5 p-1.5 rounded-2xl border premium-border">
                            <button
                                onClick={() => setActiveTab('all')}
                                className={`px-5 py-2 rounded-xl text-sm font-bold transition-premium ${activeTab === 'all' ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-premium-sm' : 'text-slate-500 dark:text-dark-muted hover:text-slate-700'}`}
                            >
                                All Tasks
                            </button>
                            <button
                                onClick={() => setActiveTab('today')}
                                className={`px-5 py-2 rounded-xl text-sm font-bold transition-premium flex items-center gap-2 ${activeTab === 'today' ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-premium-sm' : 'text-slate-500 dark:text-dark-muted hover:text-slate-700'}`}
                            >
                                <Pin size={14} />
                                Today
                            </button>
                            <button
                                onClick={() => setActiveTab('important')}
                                className={`px-5 py-2 rounded-xl text-sm font-bold transition-premium flex items-center gap-2 ${activeTab === 'important' ? 'bg-white dark:bg-red-600 text-red-600 dark:text-white shadow-premium-sm' : 'text-slate-500 dark:text-dark-muted hover:text-slate-700'}`}
                            >
                                <AlertTriangle size={14} />
                                Important
                            </button>
                        </div>

                        <div className="flex gap-3">
                            <MultiSelect
                                label="Status"
                                options={['Pending', 'Completed', 'Overdue']}
                                selected={selectedStatus}
                                onChange={setSelectedStatus}
                                placeholder="Status"
                            />

                            <MultiSelect
                                label="Agency"
                                options={agencies}
                                selected={selectedAgency}
                                onChange={setSelectedAgency}
                                placeholder="Agency"
                            />

                            {(search || selectedStatus.length > 0 || selectedAgency.length > 0) && (
                                <button
                                    onClick={resetFilters}
                                    className="flex items-center gap-2 px-4 py-2 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-premium font-semibold text-sm"
                                >
                                    <XCircle size={18} />
                                    Clear
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Tasks Table */}
            <TaskTable
                tasks={
                    activeTab === 'today' ? tasks.filter(t => t.is_pinned) :
                        activeTab === 'important' ? tasks.filter(t => t.priority === 'High') :
                            tasks
                }
                loading={loading}
                fetchData={fetchData}
                agencies={allEmployees.length > 0 ? allEmployees : agencies}
                employees={employeeObjects}
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
                employees={employeeObjects}
            />

            <DuplicatesModal
                isOpen={isDuplicatesModalOpen}
                onClose={() => setIsDuplicatesModalOpen(false)}
                onResolve={() => fetchData()}
            />

            {/* AI Summary Modal */}
            {
                isSummaryModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
                        <div className="glass-card w-full max-w-3xl max-h-[85vh] rounded-[2.5rem] shadow-premium-lg overflow-hidden flex flex-col border premium-border">
                            <div className="p-8 border-b premium-border flex justify-between items-center bg-white/50 dark:bg-white/5">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                                        <Sparkles size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black tracking-tight dark:text-white">Executive AI Summary</h3>
                                        <p className="text-sm font-medium text-slate-500 dark:text-dark-muted">Powered by Gemini AI</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsSummaryModalOpen(false)} className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 dark:text-dark-muted transition-premium">
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
                )
            }

        </Layout >
    );
};

export default Dashboard;

import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Layout from '../components/Layout';
import StatCard from '../components/StatCard';
import TaskTable from '../components/TaskTable';
import AddTaskModal from '../components/AddTaskModal';
import { api } from '../services/api';
import {
    ClipboardList, CheckSquare, Clock, AlertTriangle,
    Search, Filter, Plus, FileDown, RefreshCw, XCircle
} from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import MultiSelect from '../components/MultiSelect';

const Dashboard = () => {
    const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')) || { role: 'viewer' });
    const [tasks, setTasks] = useState([]);
    const [stats, setStats] = useState({ total: 0, completed: 0, pending: 0, overdue: 0, by_agency: [] });
    const [loading, setLoading] = useState(true);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    // Filters
    const location = useLocation();

    // Filters - Initialize from Navigation State if available
    const [search, setSearch] = useState(location.state?.search || '');
    const [selectedAgency, setSelectedAgency] = useState(location.state?.filterAgency ? [location.state.filterAgency] : []);
    const [selectedStatus, setSelectedStatus] = useState(location.state?.filterStatus ? [location.state.filterStatus] : []);

    // Clear location state after using it to prevent "stuck" filters on refresh
    useEffect(() => {
        if (location.state) {
            window.history.replaceState({}, document.title)
        }
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const filters = { search };
            if (selectedAgency.length > 0) filters.agency = selectedAgency.join(',');
            if (selectedStatus.length > 0) filters.status = selectedStatus.join(',');

            const [tasksData, statsData] = await Promise.all([
                api.getTasks(filters),
                api.getStats()
            ]);

            setTasks(tasksData);
            setStats(statsData);
        } catch (error) {
            console.error("Failed to fetch data:", error);
            alert("Failed to load data. Please check if backend is running. Error: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
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

                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/30"
                    >
                        <Plus size={18} />
                        Add Task
                    </button>
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
                tasks={tasks}
                loading={loading}
                fetchData={fetchData}
                agencies={agencies}
                onEdit={(task) => console.log("Edit", task)}
            />

            <AddTaskModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onAdd={handleAddTask}
                agencies={agencies}
            />

        </Layout>
    );
};

export default Dashboard;

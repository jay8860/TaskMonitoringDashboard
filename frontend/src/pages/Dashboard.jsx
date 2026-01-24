import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Layout from '../components/Layout';
import StatCard from '../components/StatCard';
import TaskTable from '../components/TaskTable';
import AddTaskModal from '../components/AddTaskModal';
import { api } from '../services/api';
import {
    ClipboardList, CheckSquare, Clock, AlertTriangle,
    Search, Filter, Plus, FileDown, RefreshCw, XCircle, Calendar, Pin
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
    const [showExportMenu, setShowExportMenu] = useState(false); // Dropdown toggle

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
        setShowExportMenu(false);
    };

    const handleExportPDF = async () => {
        try {
            const doc = new jsPDF();

            // Function to load Hindi Font
            const addHindiFont = async () => {
                try {
                    // Using a reliable CDN for Noto Sans Devanagari (GitHub Raw)
                    const response = await fetch('https://raw.githubusercontent.com/google/fonts/main/ofl/notosansdevanagari/NotoSansDevanagari-Regular.ttf');
                    if (!response.ok) throw new Error("Check connection or font URL");
                    const blob = await response.blob();
                    const reader = new FileReader();
                    return new Promise((resolve) => {
                        reader.onloadend = () => {
                            const base64data = reader.result.split(',')[1];
                            doc.addFileToVFS("NotoSansDevanagari-Regular.ttf", base64data);
                            doc.addFont("NotoSansDevanagari-Regular.ttf", "NotoSansDevanagari", "normal");
                            console.log("Hindi Font Loaded Successfully");
                            resolve(true);
                        };
                        reader.readAsDataURL(blob);
                    });
                } catch (err) {
                    console.error("Could not load Hindi font:", err);
                    return false;
                }
            };

            // Wait for font
            await addHindiFont();

            // Apply Font Global
            doc.setFont("NotoSansDevanagari");

            // Title
            doc.setFontSize(18);
            doc.text("Task Monitoring Report", 14, 22);

            // Timestamp
            doc.setFontSize(10);
            doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);

            // Table Config
            const tableColumn = ["S.No", "Task No", "Description", "Assigned To", "Priority", "Deadline", "Status"];
            const tableRows = [];

            tasks.forEach((task, index) => {
                const rowData = [
                    index + 1,
                    task.task_number,
                    task.description,
                    task.assigned_agency,
                    task.priority,
                    task.deadline_date || '-',
                    task.status
                ];
                tableRows.push(rowData);
            });

            // Use autoTable directly
            autoTable(doc, {
                head: [tableColumn],
                body: tableRows,
                startY: 40,
                theme: 'grid',
                headStyles: { fillColor: [79, 70, 229] }, // Indigo-600
                styles: {
                    fontSize: 8,
                    cellPadding: 2,
                    font: 'NotoSansDevanagari', // Use Hindi Font
                    fontStyle: 'normal'
                },
                columnStyles: {
                    2: { cellWidth: 60 } // Description wider
                }
            });

            doc.save("dantewada_tasks.pdf");
            setShowExportMenu(false);
        } catch (error) {
            console.error("PDF Export Error:", error);
            alert("Failed to export PDF: " + error.message);
        }
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
                    {/* Tab Switcher */}
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

                    <div className="relative z-50">
                        <button
                            onClick={() => setShowExportMenu(!showExportMenu)}
                            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-dark-card border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                            <FileDown size={18} />
                            Export
                        </button>

                        {showExportMenu && (
                            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-dark-card rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden">
                                <button
                                    onClick={handleExportExcel}
                                    className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm text-slate-700 dark:text-slate-300 transition-colors border-b border-slate-100 dark:border-slate-800"
                                >
                                    Export as Excel
                                </button>
                                <button
                                    onClick={handleExportPDF}
                                    className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm text-slate-700 dark:text-slate-300 transition-colors"
                                >
                                    Export as PDF
                                </button>
                            </div>
                        )}
                        {/* Overlay to close */}
                        {showExportMenu && (
                            <div
                                className="fixed inset-0 z-40"
                                onClick={() => setShowExportMenu(false)}
                            ></div>
                        )}
                    </div>

                    {user.role === 'admin' && (
                        <button
                            onClick={() => setIsAddModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/30"
                        >
                            <Plus size={18} />
                            Add Task
                        </button>
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
                agencies={allEmployees.length > 0 ? allEmployees : agencies} // Use full list for editing dropdowns too
                user={user}
                onEdit={(task) => console.log("Edit", task)}
            />

            <AddTaskModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onAdd={handleAddTask}
                agencies={allEmployees.length > 0 ? allEmployees : agencies}
            />

        </Layout>
    );
};

export default Dashboard;

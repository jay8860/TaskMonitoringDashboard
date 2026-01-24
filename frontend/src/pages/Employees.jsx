import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { api } from '../services/api';
import { Plus, Search, Edit2, Trash2, Phone, User as UserIcon, ArrowUpDown, RefreshCw } from 'lucide-react';
import AddEmployeeModal from '../components/AddEmployeeModal';

const Employees = () => {
    const [user] = useState(JSON.parse(localStorage.getItem('user')) || { role: 'viewer' });
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [search, setSearch] = useState('');

    // Sort State (Default: Display Name Asc)
    const [sortConfig, setSortConfig] = useState({ key: 'display_name', direction: 'ascending' });

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState(null);

    const fetchEmployees = async () => {
        setLoading(true);
        try {
            const data = await api.getEmployees();
            setEmployees(data);
        } catch (error) {
            console.error("Failed to load employees:", error);
            alert("Failed to load employees.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEmployees();
    }, []);

    const handleAdd = async (data) => {
        if (editingEmployee) {
            await api.updateEmployee(editingEmployee.id, data);
        } else {
            await api.createEmployee(data);
        }
        await fetchEmployees();
    };

    const handleDelete = async (id) => {
        if (!confirm("Are you sure you want to delete this employee?")) return;
        try {
            await api.deleteEmployee(id);
            await fetchEmployees();
        } catch (e) {
            alert("Failed to delete: " + e.message);
        }
    };

    const openEdit = (emp) => {
        setEditingEmployee(emp);
        setIsModalOpen(true);
    };

    const openAdd = () => {
        setEditingEmployee(null);
        setIsModalOpen(true);
    };

    const handleSync = async () => {
        if (!confirm("Sync Google Sheet & Form Dropdowns with Production Data (79 Officers)?")) return;
        setSyncing(true);
        try {
            await api.syncDropdowns();
            alert("Sync Completed Successfully!");
        } catch (e) {
            alert("Sync Failed: " + (e.response?.data?.detail || e.message));
        } finally {
            setSyncing(false);
        }
    };

    const handleSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    // Filter & Sort
    const filteredEmployees = employees.filter(e =>
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.display_name.toLowerCase().includes(search.toLowerCase())
    );

    const sortedEmployees = [...filteredEmployees].sort((a, b) => {
        if (!sortConfig.key) return 0;

        let aVal = a[sortConfig.key] || '';
        let bVal = b[sortConfig.key] || '';

        if (typeof aVal === 'string') aVal = aVal.toLowerCase();
        if (typeof bVal === 'string') bVal = bVal.toLowerCase();

        if (aVal < bVal) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
    });

    return (
        <Layout user={user} onLogout={() => { localStorage.removeItem('user'); window.location.href = '/login'; }}>
            <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">Employees</h1>
                    <p className="text-slate-500 dark:text-slate-400">Manage staff list for task assignment</p>
                </div>

                {user.role === 'admin' && (
                    <div className="flex gap-3">
                        <button
                            onClick={handleSync}
                            disabled={syncing}
                            className={`flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-500/30 ${syncing ? 'opacity-75 cursor-not-allowed' : ''}`}
                        >
                            <RefreshCw size={18} className={syncing ? "animate-spin" : ""} />
                            {syncing ? "Syncing..." : "Sync Dropdowns"}
                        </button>
                        <button
                            onClick={openAdd}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/30"
                        >
                            <Plus size={18} />
                            Add Employee
                        </button>
                    </div>
                )}
            </div>

            {/* Search */}
            <div className="mb-6 relative">
                <Search className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                <input
                    type="text"
                    placeholder="Search employees..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full md:w-96 pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                />
            </div>

            {/* Table View */}
            <div className="bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">#</th>

                                <th
                                    className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-indigo-600 transition-colors group"
                                    onClick={() => handleSort('name')}
                                >
                                    <div className="flex items-center gap-1">
                                        Name
                                        <ArrowUpDown size={14} className={`text-slate-400 group-hover:text-indigo-500 ${sortConfig.key === 'name' ? 'text-indigo-600' : ''}`} />
                                    </div>
                                </th>

                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Mobile</th>

                                <th
                                    className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-indigo-600 transition-colors group"
                                    onClick={() => handleSort('display_name')}
                                >
                                    <div className="flex items-center gap-1">
                                        Display Username
                                        <ArrowUpDown size={14} className={`text-slate-400 group-hover:text-indigo-500 ${sortConfig.key === 'display_name' ? 'text-indigo-600' : ''}`} />
                                    </div>
                                </th>

                                {user.role === 'admin' && (
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-slate-500">Loading employees...</td>
                                </tr>
                            ) : sortedEmployees.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-slate-500">No employees found.</td>
                                </tr>
                            ) : (
                                sortedEmployees.map((emp, index) => (
                                    <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-6 py-4 text-sm text-slate-500">{index + 1}</td>
                                        <td className="px-6 py-4 text-sm font-medium text-slate-800 dark:text-white">
                                            {emp.name}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                                            {emp.mobile ? (
                                                <div className="flex items-center gap-2">
                                                    <Phone size={14} className="text-slate-400" />
                                                    {emp.mobile}
                                                </div>
                                            ) : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                                            <div className="flex items-center gap-2 px-2 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded-lg w-fit">
                                                <UserIcon size={14} />
                                                {emp.display_name}
                                            </div>
                                        </td>
                                        {user.role === 'admin' && (
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => openEdit(emp)}
                                                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                                                        title="Edit"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(emp.id)}
                                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <AddEmployeeModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onAdd={handleAdd}
                initialData={editingEmployee}
                isEdit={!!editingEmployee}
            />
        </Layout>
    );
};

export default Employees;

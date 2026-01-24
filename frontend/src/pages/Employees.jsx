import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { api } from '../services/api';
import { Plus, Search, Edit2, Trash2, Phone, User as UserIcon } from 'lucide-react';
import AddEmployeeModal from '../components/AddEmployeeModal';

const Employees = () => {
    const [user] = useState(JSON.parse(localStorage.getItem('user')) || { role: 'viewer' });
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

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

    const filteredEmployees = employees.filter(e =>
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.display_name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <Layout user={user} onLogout={() => { localStorage.removeItem('user'); window.location.href = '/login'; }}>
            <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">Employees</h1>
                    <p className="text-slate-500 dark:text-slate-400">Manage staff list for task assignment</p>
                </div>

                {user.role === 'admin' && (
                    <button
                        onClick={openAdd}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/30"
                    >
                        <Plus size={18} />
                        Add Employee
                    </button>
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

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <p className="text-slate-500">Loading employees...</p>
                ) : filteredEmployees.length === 0 ? (
                    <p className="text-slate-500">No employees found.</p>
                ) : (
                    filteredEmployees.map(emp => (
                        <div key={emp.id} className="bg-white dark:bg-dark-card p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-4">
                                <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xl">
                                    {emp.name.charAt(0)}
                                </div>
                                {user.role === 'admin' && (
                                    <div className="flex gap-2">
                                        <button onClick={() => openEdit(emp)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                                            <Edit2 size={16} />
                                        </button>
                                        <button onClick={() => handleDelete(emp.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>

                            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">{emp.name}</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2 mb-4">
                                <UserIcon size={14} /> {emp.display_name}
                            </p>

                            {emp.mobile && (
                                <div className="pt-4 border-t border-slate-50 dark:border-slate-700">
                                    <a href={`tel:${emp.mobile}`} className="text-sm font-medium text-slate-600 dark:text-slate-300 flex items-center gap-2 hover:text-indigo-600 transition-colors">
                                        <Phone size={14} /> {emp.mobile}
                                    </a>
                                </div>
                            )}
                        </div>
                    ))
                )}
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

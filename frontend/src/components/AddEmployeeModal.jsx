import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { api } from '../services/api';

const AddEmployeeModal = ({ isOpen, onClose, onAdd, initialData = null, isEdit = false }) => {
    const [formData, setFormData] = useState({
        name: '',
        mobile: '',
        display_name: ''
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name || '',
                mobile: initialData.mobile || '',
                display_name: initialData.display_name || ''
            });
        } else {
            setFormData({ name: '', mobile: '', display_name: '' });
        }
    }, [initialData, isOpen]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onAdd(formData);
            onClose();
            setFormData({ name: '', mobile: '', display_name: '' }); // Reset
        } catch (error) {
            console.error("Error saving employee:", error);
            alert("Error saving employee: " + (error.response?.data?.detail || error.message));
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg shadow-2xl transform transition-all">
                <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                        {isEdit ? 'Edit Employee' : 'Add New Employee'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Name <span className="text-red-500">*</span> (e.g. Aditya)
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 hover:border-indigo-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all dark:text-white"
                            placeholder="Casual Name"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Mobile (Optional)
                        </label>
                        <input
                            type="text"
                            value={formData.mobile}
                            onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 hover:border-indigo-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all dark:text-white"
                            placeholder="Mobile Number"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Display Name (Username) <span className="text-red-500">*</span>
                        </label>
                        <p className="text-xs text-slate-500 mb-2">This is used for the "Assigned To" matching.</p>
                        <input
                            type="text"
                            required
                            value={formData.display_name}
                            onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 hover:border-indigo-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all dark:text-white"
                            placeholder="e.g. Aditya DMF"
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium shadow-lg shadow-indigo-500/30 transition-all flex items-center justify-center gap-2"
                        >
                            <Save size={18} />
                            {loading ? 'Saving...' : 'Save Employee'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddEmployeeModal;

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Hash, Clock, FileText, AlertCircle, Briefcase } from 'lucide-react';
import { addDays, format } from 'date-fns';

const AddTaskModal = ({ isOpen, onClose, onAdd, agencies }) => {
    const [formData, setFormData] = useState({
        task_number: '',
        description: '',
        assigned_agency: '',
        deadline_date: '',
        priority: 'Normal', // Default
        deadline_days: '' // Helper for "Days from today"
    });

    const [useDaysInput, setUseDaysInput] = useState(true);

    const handleSubmit = (e) => {
        e.preventDefault();

        let finalDeadline = formData.deadline_date;
        if (useDaysInput && formData.deadline_days) {
            finalDeadline = format(addDays(new Date(), parseInt(formData.deadline_days)), 'yyyy-MM-dd');
        }

        const newTask = {
            task_number: formData.task_number || `T-${Date.now().toString().slice(-6)}`,
            description: "", // Explicitly blank as per user request
            assigned_agency: formData.assigned_agency,
            deadline_date: finalDeadline,
            priority: formData.priority || 'Normal'
        };

        onAdd(newTask);
        setFormData({ task_number: '', description: '', assigned_agency: '', deadline_date: '', priority: 'Normal', deadline_days: '' });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white dark:bg-dark-card w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
                >
                    <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white">New Task</h2>
                        <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                            <X size={20} className="text-slate-500 dark:text-slate-400" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-5">

                        {/* Task Name / File No (Primary) */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 ml-1">
                                Task Name / File No <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <FileText className="absolute left-3 top-3 text-slate-400" size={18} />
                                <input
                                    required
                                    type="text"
                                    placeholder="Enter Task Name or File Number"
                                    value={formData.task_number}
                                    onChange={(e) => setFormData({ ...formData, task_number: e.target.value })}
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:text-white"
                                />
                            </div>
                        </div>

                        {/* Smart Deadline */}
                        <div>
                            <div className="flex justify-between items-center mb-1.5 ml-1">
                                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Deadline
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setUseDaysInput(!useDaysInput)}
                                    className="text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
                                >
                                    {useDaysInput ? "Switch to Date Picker" : "Switch to 'Days from now'"}
                                </button>
                            </div>

                            <div className="relative">
                                <Clock className="absolute left-3 top-3 text-slate-400" size={18} />
                                {useDaysInput ? (
                                    <input
                                        type="number"
                                        placeholder="e.g. 7 (Days from today)"
                                        value={formData.deadline_days}
                                        onChange={(e) => setFormData({ ...formData, deadline_days: e.target.value })}
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                                    />
                                ) : (
                                    <input
                                        type="date"
                                        value={formData.deadline_date}
                                        onChange={(e) => setFormData({ ...formData, deadline_date: e.target.value })}
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                                    />
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Agency */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 ml-1">
                                    Assigned To
                                </label>
                                <div className="relative">
                                    <Briefcase className="absolute left-3 top-3 text-slate-400" size={18} />
                                    <select
                                        value={formData.assigned_agency}
                                        onChange={(e) => setFormData({ ...formData, assigned_agency: e.target.value })}
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white appearance-none"
                                    >
                                        <option value="">Unassigned</option>
                                        {agencies.map(a => <option key={a} value={a}>{a}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Priority */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 ml-1">
                                    Priority
                                </label>
                                <div className="relative">
                                    <AlertCircle className="absolute left-3 top-3 text-slate-400" size={18} />
                                    <select
                                        value={formData.priority}
                                        onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white appearance-none"
                                    >
                                        <option value="Normal">Normal</option>
                                        <option value="High">High</option>
                                        <option value="Low">Low</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2"
                        >
                            <span className="text-lg">+</span> Create Task
                        </button>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default AddTaskModal;

import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { XCircle, Trash2, CheckCircle, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

const DuplicatesModal = ({ isOpen, onClose, onResolve }) => {
    const [duplicateGroups, setDuplicateGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (isOpen) fetchDuplicates();
    }, [isOpen]);

    const fetchDuplicates = async () => {
        setLoading(true);
        try {
            const data = await api.getDuplicates();
            setDuplicateGroups(data);
        } catch (e) {
            alert("Failed to fetch duplicates: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (itemsToDelete) => {
        if (!window.confirm(`Delete ${itemsToDelete.length} tasks?`)) return;
        setProcessing(true);
        try {
            await Promise.all(itemsToDelete.map(task => api.deleteTask(task.id)));
            // Remove from local state
            fetchDuplicates();
            if (onResolve) onResolve();
        } catch (e) {
            alert("Failed to delete: " + e.message);
        } finally {
            setProcessing(false);
        }
    };

    const handleKeepOne = async (keepId, group) => {
        const toDelete = group.filter(t => t.id !== keepId);
        await handleDelete(toDelete);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-dark-card w-full max-w-4xl max-h-[85vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-700">

                {/* Header */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-xl text-orange-600 dark:text-orange-400">
                            <AlertTriangle size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold dark:text-white">Duplicate Detector</h3>
                            <p className="text-sm text-slate-500">Found {duplicateGroups.length} groups of potential duplicates</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <XCircle size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 dark:bg-dark-bg/50">
                    {loading ? (
                        <div className="text-center py-12 text-slate-500">Scanning for duplicates...</div>
                    ) : duplicateGroups.length === 0 ? (
                        <div className="text-center py-12">
                            <CheckCircle size={48} className="mx-auto text-green-500 mb-4" />
                            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">Clean! No duplicates found.</h3>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {duplicateGroups.map((group, idx) => (
                                <div key={idx} className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                                    <div className="p-3 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                                        <span className="font-mono text-xs text-slate-500 uppercase tracking-widest">Group {idx + 1}</span>
                                        <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-bold">{group.length} Matches</span>
                                    </div>
                                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {group.map(task => (
                                            <div key={task.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-bold text-slate-700 dark:text-slate-200">{task.task_number}</span>
                                                        <span className={`text-xs px-2 py-0.5 rounded ${task.source === 'Manual' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                                            {task.source || 'Sheet'}
                                                        </span>
                                                        <span className="text-xs text-slate-400">#{task.id}</span>
                                                    </div>
                                                    <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">{task.description}</p>
                                                    <div className="flex gap-4 mt-2 text-xs text-slate-500">
                                                        <span>By: {task.assigned_agency || 'Unassigned'}</span>
                                                        <span>Due: {task.deadline_date || '-'}</span>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 ml-4">
                                                    <button
                                                        onClick={() => handleKeepOne(task.id, group)}
                                                        className="px-3 py-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 text-xs font-bold border border-green-200"
                                                    >
                                                        Keep This
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete([task])}
                                                        disabled={processing}
                                                        className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 border border-red-200"
                                                        title="Delete this one"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-dark-card flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors font-medium"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DuplicatesModal;

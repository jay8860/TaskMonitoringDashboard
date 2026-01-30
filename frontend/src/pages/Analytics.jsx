import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import Layout from '../components/Layout';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
    PieChart, Pie, Legend, LabelList
} from 'recharts';
import { differenceInDays } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const Analytics = () => {
    const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')) || { role: 'viewer' });
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [avgDuration, setAvgDuration] = useState([]);
    const [statusData, setStatusData] = useState([]);
    const [overdueData, setOverdueData] = useState([]);
    const [workloadData, setWorkloadData] = useState([]);
    const [oldestTasks, setOldestTasks] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        const fetch = async () => {
            try {
                const data = await api.getTasks();
                setTasks(data);
                processData(data);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, []);

    const processData = (data) => {
        // --- 1. Status Distribution (Donut) ---
        const sCounts = { Pending: 0, Completed: 0, Overdue: 0 };
        data.forEach(t => {
            if (sCounts[t.status] !== undefined) sCounts[t.status]++;
        });
        setStatusData([
            { name: 'Completed', value: sCounts.Completed, color: '#10b981' },
            { name: 'Pending', value: sCounts.Pending, color: '#f59e0b' },
            { name: 'Overdue', value: sCounts.Overdue, color: '#ef4444' },
        ]);

        // --- 2. Bottlenecks (Overdue by Agency) ---
        const overdueMap = {};
        data.filter(t => t.status === 'Overdue' && t.assigned_agency).forEach(t => {
            overdueMap[t.assigned_agency] = (overdueMap[t.assigned_agency] || 0) + 1;
        });
        setOverdueData(
            Object.entries(overdueMap)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5) // Top 5
        );

        // --- 3. Workload (Pending by Agency) ---
        const pendingMap = {};
        data.filter(t => t.status === 'Pending' && t.assigned_agency).forEach(t => {
            pendingMap[t.assigned_agency] = (pendingMap[t.assigned_agency] || 0) + 1;
        });
        setWorkloadData(
            Object.entries(pendingMap)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5) // Top 5
        );

        // --- 4. Oldest Pending Tasks (New Graph) ---
        const pendingWithAge = data
            .filter(t => t.status !== 'Completed' && t.allocated_date)
            .map(t => ({
                name: t.assigned_agency || 'Unknown',
                days: differenceInDays(new Date(), new Date(t.allocated_date)),
                task: t.task_number
            }))
            .sort((a, b) => b.days - a.days)
            .slice(0, 10);
        setOldestTasks(pendingWithAge);

        // --- 5. Avg Duration & Table Data ---
        const agencies = [...new Set(data.map(t => t.assigned_agency).filter(Boolean))];
        const agencyStats = agencies.map(agency => {
            const agencyTasks = data.filter(t => t.assigned_agency === agency);
            const completedTasks = agencyTasks.filter(t => t.status === 'Completed');

            // Calculate Avg Duration only for tasks with valid dates
            const validDurations = completedTasks
                .filter(t => t.completion_date && t.allocated_date)
                .map(t => differenceInDays(new Date(t.completion_date), new Date(t.allocated_date)));

            const avgDays = validDurations.length > 0
                ? Math.round(validDurations.reduce((a, b) => a + b, 0) / validDurations.length)
                : 0;

            return {
                name: agency,
                days: avgDays,
                completedCount: completedTasks.length,
                totalCount: agencyTasks.length,
                pendingCount: agencyTasks.filter(t => t.status === 'Pending').length,
                overdueCount: agencyTasks.filter(t => t.status === 'Overdue').length
            };
        });

        // Sort by total activity (completed + pending)
        const sortedData = agencyStats
            .filter(item => item.totalCount > 0)
            .sort((a, b) => b.totalCount - a.totalCount);

        setAvgDuration(sortedData);
    };

    // Navigation Helpers
    const goToDashboard = (filters) => {
        navigate('/', { state: filters });
    };

    if (loading) return (
        <Layout user={user}>
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        </Layout>
    );

    return (
        <Layout user={user} >
            <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-6">Command Center</h1>

            {/* Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

                {/* 1. Project Health (Donut) */}
                <div className="bg-white dark:bg-dark-card p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 transition-colors">
                    <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2 w-full text-left">Project Health (Click Slices)</h2>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={statusData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                    onClick={(data) => goToDashboard({ filterStatus: data.name })}
                                    label={({ value }) => value}
                                >
                                    {statusData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} cursor="pointer" />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. Critical Bottlenecks (Overdue Bar) */}
                <div className="bg-white dark:bg-dark-card p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer hover:border-indigo-500 transition-colors">
                    <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-4">Critical Bottlenecks (Click Bars)</h2>
                    <div className="h-64 w-full">
                        {overdueData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={overdueData}
                                    layout="vertical"
                                    margin={{ left: 40, right: 40 }}
                                >
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={100} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                    <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', color: '#fff' }} />
                                    <Bar
                                        dataKey="count"
                                        fill="#ef4444"
                                        radius={[0, 4, 4, 0]}
                                        barSize={20}
                                        cursor="pointer"
                                        onClick={(data) => {
                                            goToDashboard({ filterAgency: data.name, filterStatus: 'Overdue' });
                                        }}
                                    >
                                        <LabelList dataKey="count" position="right" fill="#64748b" fontSize={12} fontWeight="bold" />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400">Great! No overdue tasks.</div>
                        )}
                    </div>
                </div>

                {/* 3. High Workload (Pending Bar) */}
                <div className="bg-white dark:bg-dark-card p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer hover:border-indigo-500 transition-colors">
                    <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-4">Highest Workload (Click Bars)</h2>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={workloadData}
                                layout="vertical"
                                margin={{ left: 40, right: 40 }}
                            >
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={100} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', color: '#fff' }} />
                                <Bar
                                    dataKey="count"
                                    fill="#f59e0b"
                                    radius={[0, 4, 4, 0]}
                                    barSize={20}
                                    cursor="pointer"
                                    onClick={(data) => {
                                        goToDashboard({ filterAgency: data.name, filterStatus: 'Pending' });
                                    }}
                                >
                                    <LabelList dataKey="count" position="right" fill="#64748b" fontSize={12} fontWeight="bold" />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 4. Oldest Tasks (Text List) */}
                <div className="bg-white dark:bg-dark-card p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
                    <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-4">Top 10 Oldest Pending Tasks</h2>
                    <div className="h-64 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                        {oldestTasks.map((task, idx) => (
                            <div
                                key={idx}
                                onClick={() => goToDashboard({ search: task.task })}
                                className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700 cursor-pointer hover:border-indigo-500 hover:shadow-md transition-all flex justify-between items-center group"
                            >
                                <div className="flex flex-col overflow-hidden">
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 transition-colors truncate">#{task.task}</span>
                                    <span className="text-xs text-slate-500 dark:text-slate-400 truncate">{task.name}</span>
                                </div>
                                <div className="text-right flex-shrink-0 ml-2">
                                    <span className="block text-sm font-bold text-rose-500">{task.days} Days</span>
                                </div>
                            </div>
                        ))}
                        {oldestTasks.length === 0 && <div className="text-center text-slate-400 py-10">No pending tasks found.</div>}
                    </div>
                </div>
            </div>

            {/* Detailed Table */}
            <div className="bg-white dark:bg-dark-card p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-4">Detailed Agency Performance (Click Rows)</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800 text-xs uppercase text-slate-500">
                            <tr>
                                <th className="px-4 py-3 rounded-l-lg">Agency</th>
                                <th className="px-4 py-3 text-center">Total Tasks</th>
                                <th className="px-4 py-3 text-center text-green-600">Completed</th>
                                <th className="px-4 py-3 text-center text-amber-600">Pending</th>
                                <th className="px-4 py-3 text-center text-red-600">Overdue</th>
                                <th className="px-4 py-3 text-right rounded-r-lg">Avg Speed</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                            {avgDuration.map((item) => (
                                <tr
                                    key={item.name}
                                    onClick={() => goToDashboard({ filterAgency: item.name })}
                                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                                >
                                    <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-200">{item.name}</td>
                                    <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-400 font-medium">{item.totalCount}</td>
                                    <td className="px-4 py-3 text-center text-green-600 dark:text-green-400 font-bold">{item.completedCount}</td>
                                    <td className="px-4 py-3 text-center text-amber-600 dark:text-amber-400">{item.pendingCount}</td>
                                    <td className="px-4 py-3 text-center text-red-500 dark:text-red-400 font-bold">{item.overdueCount}</td>
                                    <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-400">
                                        {item.days > 0 ? `${item.days} days` : '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </Layout>
    );
};

export default Analytics;

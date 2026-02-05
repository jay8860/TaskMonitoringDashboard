import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { LayoutDashboard, FileText, Settings, LogOut, Sun, Moon, Menu, BarChart3, Users, Calendar as CalendarIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Layout = ({ children, user, onLogout }) => {
    const [isDark, setIsDark] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const navigate = useNavigate();

    const toggleTheme = () => {
        setIsDark(!isDark);
        document.documentElement.classList.toggle('dark');
    };

    const menuItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
        ...(user.role === 'admin' ? [
            { icon: CalendarIcon, label: 'Weekly Planner', path: '/planner' },
        ] : []),
        { icon: BarChart3, label: 'Analytics', path: '/analytics' },
        ...(user.role === 'admin' ? [
            { icon: Users, label: 'Employees', path: '/employees' }
        ] : []),
    ];

    return (
        <div className={`min-h-screen flex transition-colors duration-300 ${isDark ? 'dark bg-dark-bg' : 'bg-slate-50'}`}>
            {/* Sidebar */}
            <motion.aside
                initial={false}
                animate={{ width: sidebarOpen ? 240 : 80 }}
                className="bg-white dark:bg-dark-card border-r border-slate-200 dark:border-slate-700 fixed h-full z-20 hidden md:flex flex-col shadow-lg"
            >
                <div className="p-6 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
                        <span className="text-white font-bold">D</span>
                    </div>
                    {sidebarOpen && <span className="font-bold text-xl dark:text-white truncate">Dantewada</span>}
                </div>

                <nav className="flex-1 px-4 py-4 space-y-2">
                    {menuItems.map((item) => (
                        <button
                            key={item.label}
                            onClick={() => navigate(item.path)}
                            className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-slate-700 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl transition-all"
                        >
                            <item.icon size={20} />
                            {sidebarOpen && <span className="font-medium">{item.label}</span>}
                        </button>
                    ))}
                </nav>

                <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                    <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all">
                        <LogOut size={20} />
                        {sidebarOpen && <span className="font-medium">Logout</span>}
                    </button>

                    <div className="mt-4 flex items-center justify-between px-2">
                        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400">
                            <Menu size={20} />
                        </button>
                        {sidebarOpen && (
                            <button onClick={toggleTheme} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400">
                                {isDark ? <Sun size={20} /> : <Moon size={20} />}
                            </button>
                        )}
                    </div>
                </div>
            </motion.aside>

            {/* Main Content */}
            <main className={`flex-1 ${sidebarOpen ? 'md:ml-60' : 'md:ml-20'} transition-all duration-300 p-6 md:p-8 overflow-y-auto`}>
                {/* Mobile Header */}
                <div className="md:hidden flex justify-between items-center mb-6">
                    <h1 className="text-xl font-bold dark:text-white">Dantewada Tasks</h1>
                    <div className="flex gap-2">
                        <button onClick={toggleTheme} className="p-2 rounded-lg bg-white dark:bg-dark-card shadow-sm border border-slate-200 dark:border-slate-700">
                            {isDark ? <Sun size={20} className="text-white" /> : <Moon size={20} />}
                        </button>
                        <button onClick={onLogout} className="p-2 rounded-lg bg-white dark:bg-dark-card shadow-sm border border-slate-200 dark:border-slate-700 text-red-500">
                            <LogOut size={20} />
                        </button>
                    </div>
                </div>

                {children}
            </main>
        </div>
    );
};

export default Layout;

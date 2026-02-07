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
        <div className={`min-h-screen flex transition-colors duration-500 overflow-hidden relative ${isDark ? 'dark bg-dark-bg' : 'bg-slate-50'}`}>
            {/* Ambient Background Glows */}
            <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/5 dark:bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none z-0"></div>
            <div className="fixed bottom-[-10%] right-[-10%] w-[35%] h-[35%] bg-purple-500/5 dark:bg-purple-500/10 blur-[100px] rounded-full pointer-events-none z-0"></div>

            {/* Sidebar */}
            <motion.aside
                initial={false}
                animate={{ width: sidebarOpen ? 260 : 88 }}
                className="glass-card border-r border-slate-200/60 dark:border-white/5 fixed h-full z-30 hidden md:flex flex-col shadow-premium-lg"
            >
                <div className="p-7 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/30">
                        <span className="text-white font-bold text-xl">D</span>
                    </div>
                    {sidebarOpen && (
                        <motion.span
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="font-bold text-2xl premium-gradient-text tracking-tight"
                        >
                            Dantewada
                        </motion.span>
                    )}
                </div>

                <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto custom-scrollbar">
                    {menuItems.map((item) => (
                        <button
                            key={item.label}
                            onClick={() => navigate(item.path)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-premium group relative ${navigate.path === item.path
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                                : 'text-slate-500 dark:text-dark-muted hover:bg-slate-100 dark:hover:bg-white/5 hover:text-indigo-600 dark:hover:text-indigo-400'
                                }`}
                        >
                            <item.icon size={20} className="transition-transform group-hover:scale-110" />
                            {sidebarOpen && <span className="font-semibold text-sm tracking-wide">{item.label}</span>}
                        </button>
                    ))}
                </nav>

                <div className="p-5 border-t premium-border space-y-3">
                    <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-premium group">
                        <LogOut size={20} className="group-hover:-translate-x-1 transition-transform" />
                        {sidebarOpen && <span className="font-semibold text-sm">Logout</span>}
                    </button>

                    <div className="flex items-center justify-between px-2 pt-2">
                        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl text-slate-400 dark:text-dark-muted transition-colors">
                            <Menu size={20} />
                        </button>
                        {sidebarOpen && (
                            <button onClick={toggleTheme} className="p-2.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl text-slate-400 dark:text-dark-muted transition-colors">
                                {isDark ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} className="text-indigo-600" />}
                            </button>
                        )}
                    </div>
                </div>
            </motion.aside>

            {/* Main Content */}
            <main className={`flex-1 ${sidebarOpen ? 'md:ml-[260px]' : 'md:ml-[88px]'} transition-all duration-500 p-6 md:p-10 overflow-y-auto custom-scrollbar relative z-10`}>
                <div className="w-full">
                    {/* Mobile Header */}
                    <div className="md:hidden flex justify-between items-center mb-10 glass-card p-4 rounded-2xl">
                        <h1 className="text-2xl font-bold premium-gradient-text">Dantewada</h1>
                        <div className="flex gap-2">
                            <button onClick={toggleTheme} className="p-2.5 rounded-xl bg-slate-50 dark:bg-dark-bg border border-slate-200 dark:border-white/5 shadow-sm">
                                {isDark ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} className="text-indigo-600" />}
                            </button>
                            <button onClick={onLogout} className="p-2.5 rounded-xl bg-slate-50 dark:bg-dark-bg border border-slate-200 dark:border-white/5 shadow-sm text-red-500">
                                <LogOut size={20} />
                            </button>
                        </div>
                    </div>

                    {children}
                </div>
            </main>
        </div>
    );
};

export default Layout;

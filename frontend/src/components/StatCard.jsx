import React from 'react';
import { motion } from 'framer-motion';

const StatCard = ({ title, value, icon: Icon, color, delay, onClick }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: delay * 0.1 }}
            onClick={onClick}
            className={`bg-white dark:bg-dark-card p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 relative overflow-hidden group transition-all ${onClick ? 'cursor-pointer hover:shadow-md hover:scale-[1.02]' : ''}`}
        >
            <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-10 bg-${color}-500 group-hover:scale-110 transition-transform`} />

            <div className="flex justify-between items-start relative z-10">
                <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{title}</p>
                    <h3 className="text-3xl font-bold text-slate-800 dark:text-white">{value}</h3>
                </div>
                <div className={`p-3 rounded-xl bg-${color}-50 dark:bg-${color}-900/20 text-${color}-600 dark:text-${color}-400`}>
                    <Icon size={24} />
                </div>
            </div>
        </motion.div>
    );
};

export default StatCard;

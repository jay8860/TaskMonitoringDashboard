import React, { useState, useEffect } from 'react';
import { DndContext, DragOverlay, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { format, addDays, startOfWeek, isSameDay, parseISO } from 'date-fns';
import { api } from '../services/api';
import Layout from '../components/Layout';
import { Plus, Calendar as CalendarIcon, GripVertical } from 'lucide-react';
import AddTaskModal from '../components/AddTaskModal';

// --- Sortable Task Item Component ---
const SortableTaskItem = ({ task, onSchedule }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 mb-3 cursor-grab hover:shadow-md transition-shadow group relative ${task.status === 'Completed' ? 'opacity-60' : ''}`}
        >
            <div className="flex justify-between items-start mb-2">
                <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${task.priority === 'High' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                    {task.priority || 'Normal'}
                </span>
                <div className="flex gap-1">
                    <div className="relative group/date">
                        <button
                            className="text-slate-400 hover:text-indigo-600 transition-colors p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                            onClick={() => document.getElementById(`card-date-${task.id}`).showPicker()}
                        >
                            <CalendarIcon size={14} />
                        </button>
                        <input
                            id={`card-date-${task.id}`}
                            type="date"
                            className="absolute top-0 right-0 opacity-0 w-0 h-0"
                            defaultValue={task.scheduled_date || ''}
                            onChange={(e) => onSchedule(task.id, e.target.value)}
                        />
                    </div>
                    <button className="text-slate-300 dark:text-slate-600 cursor-grab active:cursor-grabbing hover:text-slate-500 transition-colors">
                        <GripVertical size={14} />
                    </button>
                </div>
            </div>

            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1 line-clamp-2 leading-snug">
                {task.task_number}
            </h4>

            {task.description && (
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">
                    {task.description}
                </p>
            )}

            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50 dark:border-slate-700/50">
                <div className="flex items-center gap-1 text-[11px] text-slate-400">
                    <span className="truncate max-w-[80px]">{task.assigned_agency || 'Unassigned'}</span>
                </div>
                {task.status === 'Completed' && <span className="text-[10px] text-green-500 font-bold">✓ Done</span>}
            </div>
        </div>
    );
};

// --- Droppable Column Component ---
const DayColumn = ({ date, tasks, onSchedule }) => {
    // Sort tasks by ID/Priority for consistent view
    const sortedTasks = [...tasks].sort((a, b) => b.id - a.id);
    const dayName = format(date, 'EEEE');
    const dateDisplay = format(date, 'MMM d');
    const isToday = isSameDay(date, new Date());

    return (
        <div className="flex-1 min-w-[280px] flex flex-col h-full max-h-full">
            {/* Header */}
            <div className={`p-3 rounded-t-xl border-b-2 ${isToday ? 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-500' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                <div className="flex justify-between items-center">
                    <div>
                        <h3 className={`font-bold ${isToday ? 'text-indigo-700 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'}`}>{dayName}</h3>
                        <span className="text-xs text-slate-500 dark:text-slate-500 font-medium">{dateDisplay}</span>
                    </div>
                    <div className="bg-white dark:bg-slate-700 px-2 py-0.5 rounded-md text-xs font-bold text-slate-500 dark:text-slate-300 shadow-sm">
                        {tasks.length}
                    </div>
                </div>
            </div>

            {/* Droppable Area */}
            <div className="flex-1 bg-slate-50/50 dark:bg-slate-900/20 p-2 overflow-y-auto scrollbar-hide border-x border-b border-slate-200 dark:border-slate-800 rounded-b-xl">
                <SortableContext items={sortedTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                    {sortedTasks.map(task => (
                        <SortableTaskItem key={task.id} task={task} onSchedule={onSchedule} />
                    ))}
                    {sortedTasks.length === 0 && (
                        <div className="h-24 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-center text-slate-300 dark:text-slate-600 text-xs">
                            No tasks
                        </div>
                    )}
                </SortableContext>
            </div>
        </div>
    );
};


const WeeklyPlanner = () => {
    const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')) || { role: 'viewer' });
    const [tasks, setTasks] = useState([]);
    const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 })); // Monday start
    const [activeId, setActiveId] = useState(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    // Sensors
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), // Prevent accidental drags
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const fetchData = async () => {
        setLoading(true);
        try {
            const data = await api.getTasks();
            // Filter out completed tasks if needed, or keep them to show history
            // For planner, usually we want to see what's planned.
            setTasks(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('user');
        window.location.href = '/login';
    };

    const handleAddTask = async (newTask) => {
        try {
            await api.createTask({
                ...newTask,
                allocated_date: format(new Date(), 'yyyy-MM-dd')
            });
            await fetchData();
        } catch (e) {
            alert("Failed to add task");
        }
    };

    // Calculate Week Days
    const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));

    // Group Tasks by Date (SCHEDULED DATE)
    const getTasksForDate = (date) => {
        return tasks.filter(task => {
            if (!task.scheduled_date) return false;
            try {
                // Parse standard YYYY-MM-DD
                const d = parseISO(task.scheduled_date);
                return isSameDay(d, date);
            } catch {
                return false;
            }
        });
    };

    // Drag End Handler
    const handleDragEnd = async (event) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        // Find the task
        const taskId = active.id;
        const task = tasks.find(t => t.id === taskId);

        if (!task) return;

        const overId = over.id;
        const overTask = tasks.find(t => t.id === overId);

        let newDate = null;

        if (overTask && overTask.scheduled_date) {
            // Dropped over another task -> Take that task's scheduled_date
            newDate = overTask.scheduled_date;
        } else {
            // If dropped on a column container
            if (overId.toString().startsWith('day-')) {
                newDate = overId.replace('day-', '');
            }
        }

        if (newDate && task.scheduled_date !== newDate) {
            await updateTaskDate(task, newDate);
        }
    };

    const updateTaskDate = async (task, newDate) => {
        // Optimistic UI Update
        const updatedTasks = tasks.map(t =>
            t.id === task.id ? { ...t, scheduled_date: newDate } : t
        );
        setTasks(updatedTasks);

        try {
            await api.updateTask(task.id, { scheduled_date: newDate });
        } catch (e) {
            console.error("Failed to update schedule", e);
            // Revert on fail
            fetchData();
        }
    };

    return (
        <Layout user={user} onLogout={handleLogout}>
            <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={(e) => setActiveId(e.active.id)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => {
                    // Optional: Real-time visual feedback if needed
                }}
            >
                <div className="flex flex-col h-[calc(100vh-100px)]">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <CalendarIcon className="text-indigo-600" />
                                Weekly Planner
                            </h1>
                            <p className="text-slate-500 text-sm">Drag tasks to reschedule them.</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setWeekStart(addDays(weekStart, -7))}
                                className="p-2 hover:bg-slate-100 rounded-lg"
                            >
                                ← Prev Week
                            </button>
                            <span className="py-2 font-medium text-slate-700 dark:text-slate-300">
                                {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d')}
                            </span>
                            <button
                                onClick={() => setWeekStart(addDays(weekStart, 7))}
                                className="p-2 hover:bg-slate-100 rounded-lg"
                            >
                                Next Week →
                            </button>

                            <button
                                onClick={() => setIsAddModalOpen(true)}
                                className="ml-4 flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/30"
                            >
                                <Plus size={18} />
                                Add Task
                            </button>
                        </div>
                    </div>

                    {/* Board */}
                    <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
                        <div className="flex h-full gap-4 min-w-max px-1">
                            {weekDays.map(date => {
                                const dateStr = format(date, 'yyyy-MM-dd');
                                const dayTasks = getTasksForDate(date);

                                // We need a Droppable wrapper for the column purely for empty state dropping
                                // But dnd-kit SortableContext handles 90% of cases. 
                                // Implementing a custom droppable container is best practice.
                                return (
                                    <DroppableDayColumn
                                        key={dateStr}
                                        id={`day-${dateStr}`}
                                        date={date}
                                        tasks={dayTasks}
                                        onSchedule={async (taskId, newDate) => {
                                            try {
                                                // Optimistic update
                                                setTasks(prev => prev.map(t => t.id === taskId ? { ...t, scheduled_date: newDate } : t));
                                                await api.updateTask(taskId, { scheduled_date: newDate });
                                            } catch (e) {
                                                console.error("Schedule failed", e);
                                                fetchData();
                                            }
                                        }}
                                    />
                                );
                            })}
                        </div>
                    </div>
                </div>

                <DragOverlay>
                    {activeId ? (
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-2xl border-2 border-indigo-500 rotate-2 cursor-grabbing w-[280px]">
                            {/* Placeholder visual */}
                            <h4 className="font-bold text-slate-800 dark:text-white">Moving Task...</h4>
                        </div>
                    ) : null}
                </DragOverlay>

            </DndContext>

            <AddTaskModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onAdd={handleAddTask}
                agencies={[]}
            />
        </Layout>
    );
};

// Wrapper for Droppable Column
import { useDroppable } from '@dnd-kit/core';

const DroppableDayColumn = ({ id, date, tasks, onSchedule }) => {
    const { setNodeRef, isOver } = useDroppable({ id });

    return (
        <div ref={setNodeRef} className={`rounded-xl transition-colors ${isOver ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}`}>
            <DayColumn date={date} tasks={tasks} onSchedule={onSchedule} />
        </div>
    );
};

export default WeeklyPlanner;

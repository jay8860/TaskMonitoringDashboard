import React, { useState, useEffect } from 'react';
import { DndContext, DragOverlay, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { format, addDays, startOfWeek, isSameDay, parseISO } from 'date-fns';
import { api } from '../services/api';
import Layout from '../components/Layout';
import { Plus, Calendar as CalendarIcon, GripVertical, RefreshCw, Link as LinkIcon } from 'lucide-react';
import AddTaskModal from '../components/AddTaskModal';

// --- Sortable Task Item Component ---
const SortableTaskItem = ({ task, onSchedule }) => {
    // Note: 'task.id' here is the UI ID (e.g. 123-sched). 'task.db_id' is the real ID.
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
    };

    // Derived Visuals
    const isDeadline = task.ui_type === 'deadline';
    const borderColor = isDeadline ? 'border-amber-200 dark:border-amber-900/50' : 'border-slate-100 dark:border-slate-700';
    const badgeColor = isDeadline ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400';
    const badgeText = isDeadline ? 'Due' : (task.priority || 'Normal');

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border ${borderColor} mb-3 cursor-grab hover:shadow-md transition-shadow group relative ${task.status === 'Completed' ? 'opacity-60' : ''}`}
        >
            <div className="flex justify-between items-start mb-2">
                <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${badgeText === 'High' ? 'bg-red-100 text-red-600' : badgeColor}`}>
                    {badgeText}
                </span>
                <div className="flex gap-1">
                    <div className="relative group/date">
                        <button className="text-slate-400 hover:text-indigo-600 transition-colors p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700" onClick={() => document.getElementById(`card-date-${task.id}`).showPicker()}>
                            <CalendarIcon size={14} />
                        </button>
                        <input
                            id={`card-date-${task.id}`}
                            type="datetime-local"
                            className="absolute top-0 right-0 opacity-0 w-0 h-0"
                            defaultValue={
                                isDeadline
                                    ? (task.deadline_date || '')
                                    : (task.scheduled_date ? `${task.scheduled_date}T${task.scheduled_time || '09:00'}` : '')
                            }
                            onChange={(e) => {
                                const val = e.target.value;
                                if (!val) return;
                                if (isDeadline) {
                                    const [d] = val.split('T');
                                    onSchedule(task.db_id, d, 'deadline');
                                } else {
                                    const [d, t] = val.split('T');
                                    onSchedule(task.db_id, d, 'scheduled', t);
                                }
                            }}
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
// --- Droppable Column Component ---
const DayColumn = ({ date, tasks, onSchedule }) => {
    // Sort tasks by Position (ASC) for consistent view if possible, else just map
    // Note: derived items might not have 'position' fully synced if they are duplicates.
    // For now, simple sort.
    const sortedTasks = [...tasks].sort((a, b) => (a.position || 0) - (b.position || 0));

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
    const [viewMode, setViewMode] = useState('both'); // 'scheduled', 'deadline', 'both'

    // Sensors
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), // Prevent accidental drags
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const fetchData = async () => {
        setLoading(true);
        try {
            const data = await api.getTasks();
            setTasks(data.filter(t => t.status !== 'Completed' && !t.completion_date));
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

    // Group Tasks by Date based on View Mode
    const getTasksForDate = (date) => {
        const items = [];
        tasks.forEach(task => {
            // Scheduled
            if (['scheduled', 'both'].includes(viewMode) && task.scheduled_date) {
                if (isSameDay(parseISO(task.scheduled_date), date)) {
                    // IMPORTANT: derived ID for DND
                    items.push({
                        ...task,
                        id: `${task.id}-sched`, // Override ID for UI
                        db_id: task.id,
                        ui_type: 'scheduled'
                    });
                }
            }
            // Deadline
            if (['deadline', 'both'].includes(viewMode) && task.deadline_date) {
                if (isSameDay(parseISO(task.deadline_date), date)) {
                    items.push({
                        ...task,
                        id: `${task.id}-dead`, // Override ID for UI
                        db_id: task.id,
                        ui_type: 'deadline'
                    });
                }
            }
        });
        return items;
    };

    // Drag End Handler
    const handleDragEnd = async (event) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        // Active item isn't raw class, it's our Derived item.
        // But active.id is the UI ID.
        // We can't easily find the item in 'tasks' list by UI ID directly.
        // We need to look it up in the *derived items for that day* or parse the ID.
        // Parsing ID '123-sched' is safest.

        const activeUiId = active.id;
        const [dbId, type] = activeUiId.toString().split('-'); // '123', 'sched'
        const taskId = parseInt(dbId);
        const task = tasks.find(t => t.id === taskId);

        if (!task) return;

        const overId = over.id;
        let newDate = null;

        // Check drop target
        if (overId.toString().startsWith('day-')) {
            newDate = overId.replace('day-', '');
        } else {
            // Dropped on another task
            // Find that task's date.
            // But 'overId' is also a UI ID (e.g. 456-dead).
            // We need to find *which* date column it belongs to.
            // Since we don't have a quick lookup map, let's find the derived item in the current View.
            // This is slightly expensive loop but okay for drag end.

            // Easier: just parse the 'overId' if it's a task? 
            // No, knowing the task ID doesn't tell us which *column* (date) it is in, 
            // because a task might be in multiple columns in 'both' view.

            // We need to know the *container* of `over`. 
            // dnd-kit `active.data.current.sortable.containerId` usually holds it if we set it up.
            // But here we rely on the component structure.

            // Fallback: Check collision rect center? No.

            // Let's use `active` data? We defined `getTasksForDate`. 
            // We can search our generated lists?

            // New Plan: Store 'date' in the SortableTaskItem's data attribute or ID?
            // No.

            // Simplest: Iterate all days displayed (weekDays) and see which one contains `overId`.
            for (const day of weekDays) {
                const dayItems = getTasksForDate(day); // Re-gen
                if (dayItems.find(i => i.id === overId)) {
                    newDate = format(day, 'yyyy-MM-dd');
                    break;
                }
            }
        }

        if (!newDate) return; // Couldn't find drop target date

        // Now Apply Update based on Type
        // type might be 'sched' or 'dead' from split, OR 'scheduled'/'deadline' if we mapped.
        // From split: 'sched' (scheduled) or 'dead' (deadline)

        // Map back to full type
        const uiType = type === 'sched' ? 'scheduled' : 'deadline';

        if (uiType === 'scheduled') {
            if (task.scheduled_date !== newDate) {
                await updateTaskDate(task, newDate, 'scheduled');
            }
        } else if (uiType === 'deadline') {
            if (task.deadline_date !== newDate) {
                await updateTaskDate(task, newDate, 'deadline');
            }
        }

        // Handle Reorder (Vertical sort)
        // If date didn't change, we might be reordering?
        // With 'Both' view, reordering is tricky because mixed types in one list.
        // For now, let's DISABLE reordering in 'Both' view or View modes, 
        // to simplify. We only support Date Change via Drag for now in this new mode.
    };

    const handleReorder = async (activeId, overId) => {
        const oldIndex = tasks.findIndex(t => t.id === activeId);
        const newIndex = tasks.findIndex(t => t.id === overId);

        if (oldIndex === -1 || newIndex === -1) return;

        // Create new array for local update
        const reorderedList = arrayMove(tasks, oldIndex, newIndex);
        setTasks(reorderedList); // Optimistic

        // Calculate new position
        // We need the items *in that column* specifically
        const movedTask = tasks[oldIndex];
        const targetTask = tasks[newIndex];

        // This is complex because we need the sorted list of the target column
        // Simplified Logic: Just swap positions for now, or use average
        // Let's defer to backend or simple swap? 
        // Robust way: Find prev and next items in the sorted list of that day

        // For MVP manual sorting:
        // We'll just update the position to be targetTask.position +/- 0.1
        // But arrayMove changed the list order. We should recalculate positions based on index?
        // No, that updates everyone.

        // Better:
        const targetDate = targetTask.scheduled_date || targetTask.deadline_date;
        const dayTasks = tasks.filter(t => (t.scheduled_date || t.deadline_date) === targetDate)
            .sort((a, b) => (a.position || 0) - (b.position || 0));

        const newPosIndex = dayTasks.findIndex(t => t.id === activeId); // Index in the column

        // It's already moved in UI (SortableContext handles it visually if we update state), 
        // but to persist we need to calculate a float position.
        // Actually dnd-kit's arrayMove creates a new array order.

        // Let's enable reordering in `handleDragEnd` properly.
    };

    const copyCalendarLink = () => {
        // In production, backend is same origin. In dev, it's localhost:8000
        const isProd = import.meta.env.PROD;
        const baseUrl = isProd ? window.location.origin : 'http://127.0.0.1:8000';
        const link = `${baseUrl}/api/calendar/feed`;

        navigator.clipboard.writeText(link);
        alert(`Calendar Feed URL Copied!\n\n${link}\n\nPaste this into Apple Calendar (File > New Calendar Subscription).`);
    };

    const updateTaskDate = async (task, newDate, type = 'scheduled') => {
        // Optimistic UI Update
        const field = type === 'scheduled' ? 'scheduled_date' : 'deadline_date';

        const updatedTasks = tasks.map(t =>
            t.id === task.id ? { ...t, [field]: newDate } : t
        );
        setTasks(updatedTasks);

        try {
            await api.updateTask(task.id, { [field]: newDate });
        } catch (e) {
            console.error("Failed to update " + field, e);
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
                        <div className="flex gap-2 items-center">
                            {/* View Mode Toggle */}
                            <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-lg flex gap-1 mr-4">
                                {['scheduled', 'both', 'deadline'].map(mode => (
                                    <button
                                        key={mode}
                                        onClick={() => setViewMode(mode)}
                                        className={`px-3 py-1.5 text-xs font-bold rounded-md capitalize transition-all ${viewMode === mode ? 'bg-white dark:bg-slate-600 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        {mode}
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={() => setWeekStart(addDays(weekStart, -7))}
                                className="p-2 hover:bg-slate-100 rounded-lg"
                            >
                                ←
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
                                onClick={copyCalendarLink}
                                className="ml-4 flex items-center gap-2 px-4 py-2 bg-white text-indigo-600 border border-indigo-100 rounded-xl hover:bg-indigo-50 transition-colors shadow-sm"
                            >
                                <LinkIcon size={16} />
                                Sync Calendar
                            </button>

                            <button
                                onClick={() => setIsAddModalOpen(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/30"
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
                                        onSchedule={async (taskId, newDate, type = 'scheduled') => {
                                            await updateTaskDate(
                                                tasks.find(t => t.id === taskId),
                                                newDate,
                                                type
                                            );
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

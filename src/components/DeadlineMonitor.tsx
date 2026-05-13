import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronRight,
  Filter,
  Search,
  ArrowUpRight
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { Task, CalendarEvent } from '../types';
import { format, isAfter, isBefore, addDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function DeadlineMonitor({ isAdmin, onSelectEvent }: { isAdmin: boolean, onSelectEvent: (id: string) => void }) {
  const [tasks, setTasks] = useState<(Task & { eventTitle?: string, eventDate?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'delayed' | 'upcoming' | 'completed'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchTasks();
  }, [isAdmin]);

  async function fetchTasks() {
    setLoading(true);
    try {
      // Fetch events first to map titles
      const eventsSnap = await getDocs(collection(db, 'events'));
      const eventsMap: Record<string, { title: string, date: string }> = {};
      eventsSnap.docs.forEach(doc => {
        const data = doc.data() as CalendarEvent;
        eventsMap[doc.id] = { title: data.title, date: data.date };
      });

      // Fetch only tasks with deadlines
      const tasksSnap = await getDocs(query(collection(db, 'tasks'), where('deadline', '!=', '')));
      let taskList = tasksSnap.docs.map(doc => {
        const data = doc.data() as Task;
        return {
          ...data,
          id: doc.id,
          eventTitle: eventsMap[data.eventId]?.title || 'Evento não encontrado',
          eventDate: eventsMap[data.eventId]?.date
        };
      });

      // Filter for non-admins (only ZE tasks)
      if (!isAdmin) {
        taskList = taskList.filter(t => 
           t.responsible.toLowerCase() === 'ze' || 
           t.responsible.toLowerCase().startsWith('zona') ||
           t.responsible.toLowerCase().includes('cartório')
        );
      }

      // Sort by deadline
      taskList.sort((a, b) => (a.deadline || '').localeCompare(b.deadline || ''));
      setTasks(taskList);
    } catch (error) {
      console.error('Erro ao buscar prazos:', error);
    } finally {
      setLoading(false);
    }
  }

  const today = startOfDay(new Date());

  const filteredTasks = tasks.filter(t => {
    const deadlineDate = t.deadline ? startOfDay(new Date(t.deadline + 'T00:00:00')) : null;
    const isDelayed = deadlineDate && isBefore(deadlineDate, today) && t.status !== 'completed';
    const isUpcoming = deadlineDate && !isBefore(deadlineDate, today) && t.status !== 'completed';
    
    const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         t.responsible.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         t.eventTitle?.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (filter === 'delayed') return isDelayed;
    if (filter === 'upcoming') return isUpcoming;
    if (filter === 'completed') return t.status === 'completed';
    return true;
  });

  const stats = {
    total: tasks.length,
    delayed: tasks.filter(t => t.deadline && isBefore(startOfDay(new Date(t.deadline + 'T00:00:00')), today) && t.status !== 'completed').length,
    upcoming: tasks.filter(t => t.deadline && !isBefore(startOfDay(new Date(t.deadline + 'T00:00:00')), today) && t.status !== 'completed').length,
    completed: tasks.filter(t => t.status === 'completed').length
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter mb-2">Painel de Prazos Internos</h2>
          <p className="text-slate-500 text-sm font-medium">Monitoramento de datas intermediárias e fluxos operacionais antecipados.</p>
        </div>

        <div className="flex items-center gap-3 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
          <button 
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === 'all' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            Todos ({stats.total})
          </button>
          <button 
            onClick={() => setFilter('delayed')}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === 'delayed' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'text-red-500 hover:bg-red-50'}`}
          >
            Atrasados ({stats.delayed})
          </button>
          <button 
            onClick={() => setFilter('upcoming')}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === 'upcoming' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-blue-500 hover:bg-blue-50'}`}
          >
            Próximos ({stats.upcoming})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Monitorado" value={stats.total} icon={<Clock size={20} />} color="blue" />
        <StatCard title="Prazos Críticos" value={stats.delayed} icon={<AlertTriangle size={20} />} color="red" />
        <StatCard title="Em Fluxo" value={stats.upcoming} icon={<Calendar size={20} />} color="sky" />
        <StatCard title="Concluídos" value={stats.completed} icon={<CheckCircle2 size={20} />} color="emerald" />
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/40 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center gap-4">
            <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                    type="text" 
                    placeholder="Pesquisar por tarefa, responsável ou marco..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-6 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-900 outline-none transition-all"
                />
            </div>
            <div className="flex items-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-2xl">
                <Filter size={18} className="text-slate-400" />
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Filtragem Ativa</span>
            </div>
        </div>

        <div className="overflow-x-auto">
            <table className="w-full border-collapse">
                <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200">
                        <th className="text-left px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status / Prazo</th>
                        <th className="text-left px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Responsável / Unidade</th>
                        <th className="text-left px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Descrição da Demanda Interna</th>
                        <th className="text-left px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Marco do Calendário (Limite)</th>
                        <th className="px-8 py-5"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {filteredTasks.map(task => {
                        const deadlineDate = task.deadline ? startOfDay(new Date(task.deadline + 'T00:00:00')) : null;
                        const isDelayed = deadlineDate && isBefore(deadlineDate, today) && task.status !== 'completed';
                        const isUpcoming = deadlineDate && !isBefore(deadlineDate, today) && task.status !== 'completed';
                        const isCompleted = task.status === 'completed';

                        return (
                            <tr key={task.id} className="group hover:bg-slate-50/50 transition-colors">
                                <td className="px-8 py-6">
                                    <div className="flex flex-col gap-1.5">
                                        <div className="flex items-center gap-2">
                                            {isCompleted ? (
                                                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm" />
                                            ) : isDelayed ? (
                                                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-sm shadow-red-500/20" />
                                            ) : (
                                                <div className="w-2 h-2 rounded-full bg-blue-500 shadow-sm shadow-blue-500/20" />
                                            )}
                                            <span className={`text-xs font-black uppercase tracking-tight ${isDelayed ? 'text-red-600' : isCompleted ? 'text-emerald-700' : 'text-slate-900'}`}>
                                                {format(new Date(task.deadline + 'T00:00:00'), 'dd/MM/yyyy')}
                                            </span>
                                        </div>
                                        {isDelayed && (
                                            <span className="text-[9px] font-black text-red-500 bg-red-50 px-1.5 py-0.5 rounded w-fit uppercase">Expirado</span>
                                        )}
                                        {isUpcoming && (
                                            <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded w-fit uppercase">No Verso</span>
                                        )}
                                        {isCompleted && (
                                            <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded w-fit uppercase">Concluído</span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-6">
                                    <span className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-200">
                                        {task.responsible}
                                    </span>
                                </td>
                                <td className="px-6 py-6 max-w-md">
                                    <p className="text-xs font-bold text-slate-800 leading-relaxed mb-1">{task.description}</p>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-black text-slate-400 uppercase">Workflow Interno</span>
                                        {task.requiresCompliance && (
                                            <span className="text-[9px] font-black text-amber-500 uppercase flex items-center gap-1">
                                                <AlertTriangle size={10} /> Evidência
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-6 max-w-sm">
                                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Res. 23.750/26</span>
                                            {task.eventDate && (
                                                <span className="text-[9px] font-black text-slate-500">{format(new Date(task.eventDate + 'T00:00:00'), 'dd/MM')}</span>
                                            )}
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-600 line-clamp-2 uppercase leading-tight">{task.eventTitle}</p>
                                    </div>
                                </td>
                                <td className="px-8 py-6 text-right">
                                    <button 
                                        onClick={() => onSelectEvent(task.eventId)}
                                        className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-blue-900 hover:border-blue-200 hover:bg-blue-50 transition-all group/btn shadow-sm"
                                    >
                                        <ArrowUpRight size={20} className="group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                    {filteredTasks.length === 0 && (
                        <tr>
                            <td colSpan={5} className="py-20 text-center">
                                <Clock className="mx-auto text-slate-200 mb-4" size={48} />
                                <h4 className="text-slate-900 font-black uppercase tracking-tight">Nenhum prazo encontrado</h4>
                                <p className="text-slate-400 text-xs font-medium mt-1">Refine seus filtros ou adicione prazos internos aos marcos do cronograma.</p>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }: { title: string, value: number, icon: React.ReactNode, color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-600 text-white shadow-blue-500/20',
    red: 'bg-red-500 text-white shadow-red-500/20',
    sky: 'bg-sky-500 text-white shadow-sky-500/20',
    emerald: 'bg-emerald-500 text-white shadow-emerald-500/20'
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-5">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${colors[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
        <p className="text-2xl font-black text-slate-900">{value}</p>
      </div>
    </div>
  );
}

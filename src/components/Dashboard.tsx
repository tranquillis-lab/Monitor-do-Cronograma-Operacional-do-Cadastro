import React, { useState, useEffect } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Users,
  CalendarDays,
  Target as LucideTarget,
  BarChart3,
  MapPin
} from 'lucide-react';
import { getEvents, getTasks, getResponsibleUnits } from '../lib/db';
import { CalendarEvent, Task, ResponsibleUnit } from '../types';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import ScheduleView from './ScheduleView';

export default function Dashboard({ onNavigate, onSelectEvent, isAdmin }: { onNavigate?: (view: any) => void, onSelectEvent?: (id: string) => void, isAdmin?: boolean }) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [units, setUnits] = useState<ResponsibleUnit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const e = await getEvents();
      const t = await getTasks();
      const u = await getResponsibleUnits();
      
      setEvents(e);
      setTasks(t);
      setUnits(u);
      setLoading(false);
    }
    fetchData();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );

  const stats = [
    { label: 'Marcos do Calendário', value: events.length, icon: CalendarDays, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Tarefas Pendentes', value: tasks.filter(t => t.status === 'pending').length, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Tarefas Concluídas', value: tasks.filter(t => t.status === 'completed').length, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Índice de Conformidade', value: tasks.length ? `${Math.round((tasks.filter(t => t.status === 'completed').length / tasks.length) * 100)}%` : '0%', icon: LucideTarget, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  const chartData = [
    { name: 'Pendente', value: tasks.filter(t => t.status === 'pending').length, color: '#f59e0b' },
    { name: 'Concluído', value: tasks.filter(t => t.status === 'completed').length, color: '#10b981' },
  ];

  const responsibleData = units.map(unit => ({
    name: unit.acronym,
    execution: tasks.filter(t => t.responsible === unit.acronym).length,
    supervision: events.filter(e => e.supervisorUnit === unit.acronym).length
  }));

  if (responsibleData.length === 0) {
    responsibleData.push({ 
      name: 'Geral', 
      execution: tasks.filter(t => t.responsible === 'Geral').length,
      supervision: events.filter(e => e.supervisorUnit === 'Geral').length
    });
  }

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1 px-1">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Painel de Monitoramento</h2>
        <p className="text-slate-500 text-sm font-bold uppercase tracking-tight">Cronograma Operacional do Cadastro Eleitoral</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                <stat.icon size={48} />
            </div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{stat.label}</p>
            <div className="flex items-baseline justify-between relative z-10">
                <p className={`text-3xl font-black ${stat.color}`}>{stat.value}</p>
                {i === 3 && <span className="text-[10px] font-black text-green-600 bg-green-50 px-1.5 py-0.5 rounded">↑ 4.2%</span>}
            </div>
            {i === 3 && (
                <div className="w-full bg-slate-100 h-1.5 mt-3 rounded-full overflow-hidden">
                    <div className="bg-blue-900 h-full w-[82%]" />
                </div>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna Central: Marcos do Cronograma */}
        <div className="lg:col-span-2 space-y-6">
          <ScheduleView onSelectEvent={onSelectEvent || (() => {})} isAdmin={!!isAdmin} isEmbedded={true} />
        </div>

        {/* Coluna Direita: Ações Críticas e Atualizações */}
        <div className="space-y-6">
          {/* Alerts/Upcoming */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="text-base font-black text-slate-800 uppercase tracking-tight mb-4 flex items-center justify-between">
                <span>Ações Críticas Próximas</span>
                <button 
                  onClick={() => onNavigate?.('schedule')}
                  className="text-[10px] text-blue-600 hover:text-blue-800 font-black uppercase tracking-widest hover:underline cursor-pointer"
                >
                  Ver todas
                </button>
            </h3>
            <div className="space-y-4">
                {events.filter(e => new Date(e.date) > new Date()).slice(0, 3).map((event, i) => {
                    const diffTime = new Date(event.date).getTime() - new Date().getTime();
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    const diffHours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    
                    return (
                      <div 
                        key={i} 
                        onClick={() => {
                          if (onSelectEvent && event.id) onSelectEvent(event.id);
                        }}
                        className="flex gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-blue-200 transition-colors group cursor-pointer"
                      >
                          <div className="bg-white w-12 h-12 rounded-xl flex flex-col items-center justify-center border border-slate-200 shadow-sm group-hover:scale-105 transition-transform">
                              <span className="text-[10px] font-bold text-slate-400 uppercase leading-none">{new Date(event.date).toLocaleString('pt-BR', {month: 'short'})}</span>
                              <span className="text-xl font-black text-slate-900">{new Date(event.date).getDate()}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-900 truncate uppercase tracking-tight">{event.title}</p>
                              <p className="text-xs text-slate-500 truncate font-medium">{event.description}</p>
                          </div>
                          <div className="self-center shrink-0">
                              <div className={`px-2 py-1 ${diffDays === 0 && diffHours <= 48 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'} text-[10px] font-black rounded-lg whitespace-nowrap uppercase tracking-tighter`}>
                                  {diffDays > 0 ? `${diffDays}d ${diffHours}h` : `${diffHours}h restante`}
                              </div>
                          </div>
                      </div>
                    );
                })}
                {events.filter(e => new Date(e.date) > new Date()).length === 0 && (
                  <p className="text-xs text-slate-400 italic text-center py-4">Nenhuma ação crítica pendente.</p>
                )}
            </div>
          </div>

          {/* Últimas Atualizações */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm h-full overflow-hidden flex flex-col">
            <h3 className="text-base font-black text-slate-800 uppercase tracking-tight mb-4 flex items-center justify-between">
                <span>Últimas Atualizações</span>
                <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
            </h3>
            <div className="space-y-4 overflow-y-auto max-h-[350px] pr-2 custom-scrollbar">
                {[...tasks.filter(t => t.status === 'completed')]
                    .filter((item: any) => item.createdAt || item.updatedAt)
                    .sort((a: any, b: any) => {
                        const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
                        const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
                        return dateB - dateA;
                    })
                    .slice(0, 10)
                    .map((item: any, i) => {
                        const parentEvent = events.find(e => e.id === item.eventId);
                        
                        let dateDesc = '';
                        if (parentEvent) {
                            const d = new Date(parentEvent.date + 'T00:00:00');
                            const dayMonth = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
                            const weekday = d.toLocaleDateString('pt-BR', { weekday: 'long' });
                            dateDesc = `${dayMonth}, ${weekday} - ${parentEvent.title}`;
                        }

                        return (
                            <div 
                                key={i} 
                                onClick={() => {
                                    if (onSelectEvent && item.eventId) {
                                        onSelectEvent(item.eventId);
                                    }
                                }}
                                className="flex gap-3 items-start border-b border-slate-50 pb-4 last:border-0 hover:bg-slate-50 transition-colors rounded-lg p-2 cursor-pointer"
                            >
                                <div className="mt-1 w-2 h-2 rounded-full flex-shrink-0 bg-blue-500" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-slate-900 leading-tight">
                                        {item.description}
                                    </p>
                                    
                                    {dateDesc && (
                                        <p className="text-[10px] text-slate-500 mt-1 leading-snug font-medium line-clamp-2 uppercase">
                                            {dateDesc}
                                        </p>
                                    )}

                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="text-[9px] font-black uppercase text-blue-500">
                                            {item.responsible}
                                        </span>
                                        <span className="text-[9px] font-medium text-slate-400 font-mono">
                                            {new Date(item.updatedAt || item.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                }
                {tasks.filter((t: any) => t.status === 'completed' && (t.createdAt || t.updatedAt)).length === 0 && (
                    <div className="text-center py-8 text-slate-400 text-xs italic">
                        Nenhuma atualização recente.
                    </div>
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

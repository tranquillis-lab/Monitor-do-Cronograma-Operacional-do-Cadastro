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
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <BarChart3 className="text-blue-900" size={16} />
              Carga Operacional por Unidade (Supervisão vs Execução)
            </h3>
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-blue-900" />
                    <span className="text-[9px] font-black text-slate-400 uppercase">Supervisão</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-blue-400" />
                    <span className="text-[9px] font-black text-slate-400 uppercase">Execução</span>
                </div>
            </div>
          </div>
          <div className="h-[280px] w-full">
             <ResponsiveContainer width="100%" height="100%">
                <BarChart data={responsibleData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 800, textAnchor: 'middle'}} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 800}} 
                  />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}} 
                    contentStyle={{
                        borderRadius: '12px', 
                        border: '1px solid #e2e8f0', 
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        textTransform: 'uppercase'
                    }} 
                  />
                  <Bar dataKey="supervision" name="Supervisão" fill="#1e3a8a" radius={[4, 4, 0, 0]} barSize={24} />
                  <Bar dataKey="execution" name="Execução" fill="#60a5fa" radius={[4, 4, 0, 0]} barSize={24} />
                </BarChart>
             </ResponsiveContainer>
          </div>
        </div>

        {/* Progress Circle */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
            <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-6 self-start">Integridade Global</h3>
            <div className="relative w-44 h-44 mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      innerRadius={55}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color === '#10b981' ? '#1e3a8a' : '#f1f5f9'} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-black text-slate-900 leading-none">82%</span>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-tight mt-1">Concluído</span>
                </div>
            </div>
            <div className="space-y-3 w-full border-t border-slate-50 pt-6">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-tight">
                    <span className="flex items-center gap-2 text-slate-500">
                        <div className="w-2 h-2 rounded-full bg-blue-900 shadow-[0_0_8px_rgba(30,58,138,0.4)]" /> Cumpridas
                    </span>
                    <span className="text-slate-900">{tasks.filter(t => t.status === 'completed').length}</span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-tight">
                    <span className="flex items-center gap-2 text-slate-500">
                        <div className="w-2 h-2 rounded-full bg-slate-200" /> Pendentes
                    </span>
                    <span className="text-slate-900">{tasks.filter(t => t.status === 'pending').length}</span>
                </div>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Alerts/Upcoming */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold mb-4 flex items-center justify-between">
                Ações Críticas Próximas
                <button 
                  onClick={() => onNavigate?.('schedule')}
                  className="text-xs text-blue-600 hover:text-blue-800 font-black uppercase tracking-widest hover:underline cursor-pointer"
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
                          <div className="flex-1">
                              <p className="text-sm font-bold text-slate-900 line-clamp-1 uppercase tracking-tight">{event.title}</p>
                              <p className="text-xs text-slate-500 line-clamp-1 font-medium">{event.description}</p>
                          </div>
                          <div className="self-center">
                              <div className={`px-2 py-1 ${diffDays === 0 && diffHours <= 48 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'} text-[10px] font-black rounded-lg whitespace-nowrap uppercase tracking-tighter`}>
                                  {diffDays > 0 ? `${diffDays} dias ${diffHours} horas restantes` : `${diffHours} horas restantes`}
                              </div>
                          </div>
                      </div>
                    );
                })}
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm h-full overflow-hidden flex flex-col">
            <h3 className="text-lg font-bold mb-4 flex items-center justify-between">
                Últimas Atualizações
                <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
            </h3>
            <div className="space-y-4 overflow-y-auto max-h-[350px] pr-2">
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
                                <div className="flex-1">
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

          {isAdmin && (
            <div className="bg-slate-900 text-white p-8 rounded-3xl border border-slate-800 shadow-xl overflow-hidden relative group">
                <div className="relative z-10">
                  <LucideTarget className="text-blue-400 mb-6" size={40} />
                  <h3 className="text-2xl font-bold mb-2 italic">Métricas por Unidade</h3>
                  <p className="text-slate-400 mb-8 max-w-xs text-sm leading-relaxed">
                    Visão detalhada do cumprimento de metas por unidade gestora.
                  </p>
                  <div className="space-y-5 mb-8">
                    {units.slice(0, 4).map((unit, i) => {
                      const totalTasks = tasks.filter(t => t.responsible === unit.acronym).length;
                      const doneTasks = tasks.filter(t => t.responsible === unit.acronym && t.status === 'completed').length;
                      const taskPct = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;

                      const supervisedEvents = events.filter(e => e.supervisorUnit === unit.acronym).length;
                      
                      return (
                        <div key={i} className="bg-slate-800/30 p-3 rounded-2xl border border-slate-700/50 hover:bg-slate-800/50 transition-colors">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-black text-white uppercase tracking-tight">{unit.acronym}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-[9px] font-black text-blue-400 bg-blue-900/40 px-2 py-0.5 rounded uppercase tracking-widest whitespace-nowrap">
                                Supervisão: {supervisedEvents}
                              </span>
                              <span className="text-[9px] font-black text-green-400 bg-green-900/40 px-2 py-0.5 rounded uppercase tracking-widest whitespace-nowrap">
                                Execução: {taskPct}%
                              </span>
                            </div>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className="bg-blue-500 h-full transition-all duration-1000" style={{ width: `${taskPct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-900/40">
                    Relatório Completo
                  </button>
                </div>
                <div className="absolute top-1/2 -right-20 -translate-y-1/2 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Users size={240} />
                </div>
            </div>
          )}
      </div>
    </div>
  );
}

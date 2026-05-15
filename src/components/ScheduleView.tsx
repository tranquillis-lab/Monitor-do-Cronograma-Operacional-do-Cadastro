import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  List, 
  Plus, 
  Search, 
  Filter, 
  ChevronRight,
  MoreVertical,
  Trash2,
  Edit2,
  AlertTriangle,
  X,
  GitCommit,
  CheckCircle2,
  Activity,
  Star
} from 'lucide-react';
import { getEvents, createEvent, updateEvent, deleteEvent, getResponsibleUnits, getTasks } from '../lib/db';
import { CalendarEvent, ResponsibleUnit, Task } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { auth } from '../lib/firebase';

interface Props {
  onSelectEvent: (id: string) => void;
  isAdmin: boolean;
}

export default function ScheduleView({ onSelectEvent, isAdmin }: Props) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'timeline'>('list');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [units, setUnits] = useState<ResponsibleUnit[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [hidePast, setHidePast] = useState(false);
  const [respFilter, setRespFilter] = useState('');
  const [onlyCP, setOnlyCP] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    title: '',
    description: '',
    month: format(new Date(), "MMMM 'de' yyyy", { locale: ptBR }).toUpperCase(),
    supervisorUnit: '',
    isControlPoint: false
  });

  useEffect(() => {
    fetchData();
    fetchUnits();
    fetchTasks();
  }, []);

  async function fetchData() {
    setLoading(true);
    const data = await getEvents();
    setEvents(data);
    setLoading(false);
  }

  async function fetchUnits() {
    const data = await getResponsibleUnits();
    setUnits(data);
  }

  async function fetchTasks() {
    const data = await getTasks();
    setTasks(data);
  }

  const getStatusColor = (event: CalendarEvent) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDate = new Date(event.date + 'T00:00:00');

    if (eventDate < today) {
        if (!event.supervisorUnit) return null;
        
        const isRelevantUnit = ['Corregedoria', 'CRE', 'Zona Eleitoral', 'Zona'].some(u => 
            event.supervisorUnit?.toLowerCase().includes(u.toLowerCase())
        );
        
        if (!isRelevantUnit) return null;

        const eventTasks = tasks.filter(t => t.eventId === event.id);
        if (eventTasks.length === 0) return 'bg-emerald-500';
        
        const allCompleted = eventTasks.every(t => t.status === 'completed');
        return allCompleted ? 'bg-emerald-500' : 'bg-red-500';
    } else {
        return 'bg-amber-400';
    }
  };

  const getDisplayMonth = (event: CalendarEvent) => {
    if (!event.month) return format(new Date(event.date + 'T00:00:00'), "MMMM 'DE' yyyy", { locale: ptBR }).toUpperCase();
    
    // If month contains a number at start or "domingo/segunda/etc", it's likely a captured date line instead of month header
    const lower = event.month.toLowerCase();
    const isCorrupted = /^\d/.test(event.month) || 
                       ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'].some(day => lower.includes(day));
    
    if (isCorrupted) {
      return format(new Date(event.date + 'T00:00:00'), "MMMM 'DE' yyyy", { locale: ptBR }).toUpperCase();
    }
    return event.month;
  };

  const handleOpenModal = (event?: CalendarEvent) => {
    if (!isAdmin) return;
    if (event) {
      setEditingEvent(event);
      setFormData({
        date: event.date,
        title: event.title,
        description: event.description,
        month: event.month,
        supervisorUnit: event.supervisorUnit || '',
        isControlPoint: event.isControlPoint || false
      });
    } else {
      setEditingEvent(null);
      setFormData({
        date: format(new Date(), 'yyyy-MM-dd'),
        title: '',
        description: '',
        month: format(new Date(), "MMMM 'de' yyyy", { locale: ptBR }).toUpperCase(),
        supervisorUnit: '',
        isControlPoint: false
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    
    try {
      if (editingEvent) {
        await updateEvent(editingEvent.id!, formData);
      } else {
        await createEvent(formData);
      }
      setIsModalOpen(false);
      await fetchData();
    } catch (error) {
      console.error('Erro ao salvar marco:', error);
      alert('Erro ao salvar o marco. Verifique sua conexão ou permissões.');
    }
  };

  const handleDelete = async (id: string | undefined, e: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (!id) {
        alert('DEBUG: ID do Marco não encontrado!');
        return;
    }

    if (!isAdmin) {
        alert('⚠️ Acesso Negado: Você não está processando como Administrador.');
        return;
    }

    const msg = '⚠️ ATENÇÃO: Deseja realmente excluir este marco temporal e TODOS os seus desdobramentos?\n\nEsta operação é IRREVERSÍVEL.';
    if (window.confirm(msg)) {
      try {
        console.log('[DEBUG] Apagando Marco:', id);
        await deleteEvent(id);
        setEvents(prev => prev.filter(e => e.id !== id));
        alert('✅ Marco operacional removido.');
      } catch (error) {
        console.error('[DEBUG] Erro ao apagar Marco:', error);
        alert('❌ Erro: ' + (error instanceof Error ? error.message : 'Tente novamente.'));
      }
    }
  };

  const filteredEvents = events.filter(e => {
    const matchesSearch = e.title.toLowerCase().includes(search.toLowerCase()) || 
      e.description.toLowerCase().includes(search.toLowerCase()) ||
      (e.month || '').toLowerCase().includes(search.toLowerCase());
    
    if (!matchesSearch) return false;

    if (hidePast) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const eventDate = new Date(e.date + 'T00:00:00');
      if (eventDate < today) return false;
    }

    if (onlyCP && !e.isControlPoint) return false;

    if (respFilter && e.supervisorUnit !== respFilter) return false;

    return true;
  });

  const clearFilters = () => {
    setSearch('');
    setHidePast(false);
    setRespFilter('');
    setOnlyCP(false);
  };

  // Group events by month for "Calendar" view
  const months = Array.from(new Set(events.map(e => e.month)));

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
            <button 
              onClick={() => window.dispatchEvent(new CustomEvent('changeView', { detail: 'dashboard' }))}
              className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm group"
              title="Voltar ao Início"
            >
              <ChevronRight className="rotate-180 group-hover:-translate-x-1 transition-transform" size={20} />
            </button>
            <div>
              <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Cronograma Operacional</h2>
              <p className="text-slate-500 font-medium text-xs sm:text-base">Resolução TSE nº 23.750/2026 - Gestão de Marcos Temporais.</p>
            </div>
        </div>
        <div className="flex items-center gap-3">
            <div className="bg-slate-100/50 p-1 rounded-2xl flex border border-slate-200">
                <button 
                    onClick={() => setViewMode('list')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-bold text-xs ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-md transform scale-105' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <List size={16} />
                    <span>LISTA</span>
                </button>
                <button 
                    onClick={() => setViewMode('calendar')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-bold text-xs ${viewMode === 'calendar' ? 'bg-white text-blue-600 shadow-md transform scale-105' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <CalendarIcon size={16} />
                    <span>CALENDÁRIO</span>
                </button>
                <button 
                    onClick={() => setViewMode('timeline')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-bold text-xs ${viewMode === 'timeline' ? 'bg-white text-blue-600 shadow-md transform scale-105' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <GitCommit size={16} />
                    <span>LINHA DO TEMPO</span>
                </button>
            </div>
            
            <button 
                onClick={() => setOnlyCP(!onlyCP)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-[10px] transition-all border shadow-sm ${
                    onlyCP 
                    ? 'bg-yellow-400 text-yellow-900 border-yellow-500 scale-105 shadow-yellow-200' 
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                }`}
            >
                <Activity size={14} />
                PONTOS DE CONTROLE
            </button>

            {isAdmin && (
              <button 
                  onClick={() => handleOpenModal()}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-900/20 transition-all active:scale-95"
              >
                  <Plus size={18} />
                  Novo Marco
              </button>
            )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Pesquisar por título, descrição ou mês..." 
                className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
          </div>
          <button 
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold transition-all shadow-sm border ${
              showAdvanced || hidePast || respFilter || onlyCP 
                ? 'bg-blue-600 text-white border-blue-600' 
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
              <Filter size={18} />
              Filtros Avançados
              {(hidePast || respFilter || onlyCP) && (
                <span className="ml-1 w-2 h-2 bg-white rounded-full animate-pulse" />
              )}
          </button>
      </div>

      {showAdvanced && (
        <div className="bg-white border border-blue-100 rounded-[2rem] p-6 shadow-xl shadow-blue-900/5 animate-in slide-in-from-top-4 duration-300 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Status Temporal</label>
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => setHidePast(!hidePast)}>
              <input 
                type="checkbox" 
                checked={hidePast}
                onChange={() => {}}
                className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs font-bold text-slate-700">Ocultar datas passadas</span>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Filtrar Responsável</label>
            <select 
              value={respFilter}
              onChange={(e) => setRespFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            >
              <option value="">TODOS OS RESPONSÁVEIS</option>
              {units.map(unit => (
                <option key={unit.id} value={unit.acronym}>{unit.acronym} - {unit.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Destaques</label>
            <div className="flex items-center gap-3 p-3 bg-yellow-50/50 border border-yellow-100 rounded-xl cursor-pointer hover:bg-yellow-50 transition-colors" onClick={() => setOnlyCP(!onlyCP)}>
              <input 
                type="checkbox" 
                checked={onlyCP}
                onChange={() => {}}
                className="w-5 h-5 rounded border-yellow-300 text-yellow-600 focus:ring-yellow-500"
              />
              <span className="text-xs font-bold text-yellow-800 uppercase tracking-tight">Apenas Pontos de Controle</span>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'list' && (
        <div className="space-y-4">
            {filteredEvents.map((event) => (
                <div 
                    key={event.id}
                    onClick={() => onSelectEvent(event.id!)}
                    className={`group border p-5 rounded-3xl shadow-sm hover:shadow-xl hover:border-blue-200 transition-all cursor-pointer flex flex-col md:flex-row gap-4 md:items-center relative overflow-hidden ${
                      event.isControlPoint ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-slate-200'
                    }`}
                >
                    {event.isControlPoint && (
                      <div className="absolute top-0 right-0 p-2 opacity-30">
                        <AlertTriangle size={16} className="text-yellow-600" />
                      </div>
                    )}
                    {getStatusColor(event) && (
                        <div className={`absolute top-0 left-0 w-1.5 h-full ${getStatusColor(event)} opacity-80`} />
                    )}
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 group-hover:w-2 transition-all opacity-0 group-hover:opacity-100" />
                    
                    <div className="flex items-center gap-4 min-w-[200px]">
                        <div className={`bg-slate-50 group-hover:bg-blue-50 w-14 h-14 rounded-2xl flex flex-col items-center justify-center border transition-colors shadow-sm ${
                            event.isControlPoint ? 'border-yellow-300' : 'border-slate-200'
                        }`}>
                            <span className="text-[10px] font-bold text-slate-400 group-hover:text-blue-400 uppercase leading-none">{new Date(event.date + 'T00:00:00').toLocaleString('pt-BR', {month: 'short'})}</span>
                            <span className="text-2xl font-black text-slate-900 group-hover:text-blue-700">{new Date(event.date + 'T00:00:00').getDate()}</span>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-blue-600 uppercase tracking-widest flex items-center gap-2">
                                {event.isControlPoint && (
                                  <span className="bg-yellow-400 text-yellow-900 px-1.5 py-0.5 rounded text-[9px] font-black animate-pulse">
                                    PONTO DE CONTROLE
                                  </span>
                                )}
                                {getDisplayMonth(event)}
                                {event.supervisorUnit && (
                                  <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-[9px] font-black">
                                    RESPONSÁVEL: {event.supervisorUnit}
                                  </span>
                                )}
                            </p>
                            <p className="text-base font-bold text-slate-900 font-serif leading-tight mt-0.5">{event.title.split(',')[0]}</p>
                        </div>
                    </div>

                    <div className="flex-1 border-l border-slate-100 pl-4 md:pl-6">
                        <p className="text-sm text-slate-600 leading-relaxed font-medium line-clamp-2 italic">
                            "{event.description}"
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex -space-x-2">
                             {[1, 2].map((_, i) => (
                                 <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 text-[10px] font-black flex items-center justify-center text-slate-400">
                                   ZE
                                 </div>
                             ))}
                        </div>
                        {isAdmin && (
                          <div className="flex gap-1 transition-opacity">
                              <button 
                                  onClick={(e) => { e.stopPropagation(); handleOpenModal(event); }}
                                  className="p-2 hover:bg-blue-50 text-blue-400 rounded-lg"
                              >
                                  <Edit2 size={18} />
                              </button>
                              <button 
                                  type="button"
                                  onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleDelete(event.id, e);
                                  }}
                                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100 active:scale-95 z-20"
                                  title="Excluir marco"
                              >
                                  <Trash2 size={18} />
                              </button>
                          </div>
                        )}
                        <ChevronRight className="text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" size={24} />
                    </div>
                </div>
            ))}
        </div>
      )}

      {viewMode === 'calendar' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {months.map(month => (
                <div key={month} className="space-y-4">
                    <div className="flex items-center gap-2 px-1">
                        <CalendarIcon size={16} className="text-blue-600" />
                        <h3 className="font-black text-slate-900 uppercase tracking-tighter text-lg">{month}</h3>
                        <div className="flex-1 h-[1px] bg-slate-200 ml-2" />
                    </div>
                    {filteredEvents.filter(e => e.month === month).map(event => (
                        <div 
                            key={event.id}
                            onClick={() => onSelectEvent(event.id!)}
                            className={`border p-4 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer group relative overflow-hidden ${
                              event.isControlPoint ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-slate-200'
                            }`}
                        >
                            {getStatusColor(event) && (
                                <div className={`absolute top-0 left-0 w-full h-1 ${getStatusColor(event)} opacity-60`} />
                            )}
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest leading-none mb-1">{getDisplayMonth(event)}</span>
                                    <span className="bg-blue-50 text-blue-700 text-[10px] font-black px-2 py-1 rounded-lg uppercase w-fit">Dia {new Date(event.date + 'T00:00:00').getDate()}</span>
                                </div>
                                {isAdmin && (
                                  <div className="flex gap-1 transition-opacity">
                                      <button 
                                          onClick={(e) => { e.stopPropagation(); handleOpenModal(event); }}
                                          className="p-1 hover:bg-blue-50 text-blue-400 rounded"
                                      >
                                          <Edit2 size={14} />
                                      </button>
                                      <button 
                                          type="button"
                                          onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              handleDelete(event.id, e);
                                          }}
                                          className="p-1 px-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100 active:scale-95"
                                          title="Excluir"
                                      >
                                          <Trash2 size={14} />
                                      </button>
                                  </div>
                                )}
                            </div>
                            <h4 className="text-sm font-bold text-slate-900 line-clamp-2 mb-2 group-hover:text-blue-600 transition-colors">{event.title}</h4>
                            <p className="text-[11px] text-slate-500 line-clamp-3 leading-relaxed italic border-t border-slate-50 pt-2">
                                {event.description}
                            </p>
                        </div>
                    ))}
                </div>
            ))}
        </div>
      )}

      {viewMode === 'timeline' && (
        <div className="relative py-16 px-4 overflow-x-hidden min-h-[600px] bg-slate-50/30 rounded-[3rem] mt-8">
          {(() => {
            const itemsPerRow = 3;
            const rows = [];
            for (let i = 0; i < filteredEvents.length; i += itemsPerRow) {
              rows.push(filteredEvents.slice(i, i + itemsPerRow));
            }

            return (
              <div className="flex flex-col gap-32">
                {rows.map((row, rowIndex) => (
                  <div 
                    key={rowIndex} 
                    className={`flex flex-col md:flex-row gap-8 md:gap-1 relative items-center justify-start ${rowIndex % 2 === 1 ? 'md:flex-row-reverse' : ''}`}
                  >
                    {/* Horizontal Connector Line for this row */}
                    <div className={`hidden md:block absolute top-[52px] h-[4px] border-t-2 border-dashed border-blue-400/40 -z-10 ${
                      row.length > 1 
                        ? (rowIndex % 2 === 0 ? 'left-[16.6%] right-[16.6%]' : 'right-[16.6%] left-[16.6%]') 
                        : 'hidden'
                    }`} />

                    {row.map((event, eventIndex) => {
                      const absoluteIndex = rowIndex * itemsPerRow + eventIndex;
                      const isLastInRow = eventIndex === row.length - 1;
                      const isLastOverall = absoluteIndex === filteredEvents.length - 1;
                      const statusColor = getStatusColor(event);

                      return (
                        <div 
                          key={event.id} 
                          className="w-full md:w-1/3 relative z-10 animate-in zoom-in-90 duration-500 flex flex-col items-center"
                          style={{ animationDelay: `${eventIndex * 100}ms` }}
                        >
                          {/* Serpentine Vertical Connector */}
                          {isLastInRow && !isLastOverall && (
                            <div className={`hidden md:block absolute top-[52px] h-[190px] w-[2px] border-l-2 border-dashed border-blue-400/40 -z-10 ${rowIndex % 2 === 0 ? 'right-[50%] translate-x-[150px]' : 'left-[50%] -translate-x-[150px]'}`}>
                               <div className={`absolute bottom-0 w-[150px] h-[2px] border-t-2 border-dashed border-blue-400/40 ${rowIndex % 2 === 0 ? 'right-0' : 'left-0'}`} />
                            </div>
                          )}

                          {/* Connector Node */}
                          <div className={`w-10 h-10 rounded-full border-[6px] border-white shadow-lg z-20 transition-all hover:scale-125 flex items-center justify-center ${
                            event.isControlPoint ? 'bg-yellow-400' : 'bg-blue-500'
                          }`}>
                            {event.isControlPoint ? <Star size={14} className="text-white" fill="white" /> : <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                          </div>

                          {/* Event Card */}
                          <div 
                            onClick={() => onSelectEvent(event.id!)}
                            className={`group relative mt-10 p-6 w-[90%] rounded-[2.5rem] border-2 transition-all cursor-pointer shadow-md hover:shadow-2xl hover:-translate-y-3 ${
                              event.isControlPoint 
                              ? 'bg-yellow-50/90 border-yellow-200 hover:border-yellow-400 backdrop-blur-sm' 
                              : 'bg-white border-slate-100 hover:border-blue-400'
                            }`}
                          >
                            <div className="flex flex-col gap-3">
                              <div className="flex justify-between items-center">
                                <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                                  event.isControlPoint ? 'bg-yellow-400 text-yellow-900 shadow-sm' : 'bg-blue-50 text-blue-600'
                                }`}>
                                  {format(new Date(event.date + 'T00:00:00'), "dd 'de' MMM", { locale: ptBR })}
                                </span>
                                {event.isControlPoint && <AlertTriangle size={14} className="text-yellow-600 animate-pulse" />}
                              </div>
                              
                              <h4 className="text-base font-bold text-slate-900 group-hover:text-blue-700 leading-tight transition-colors line-clamp-2 min-h-[3rem]">
                                {event.title}
                              </h4>
                              
                              <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed italic border-t border-slate-50 pt-3 opacity-80 group-hover:opacity-100 transition-opacity">
                                {event.description}
                              </p>

                              <div className="flex items-center justify-between mt-2 pt-2">
                                <div className="flex -space-x-1.5">
                                  <div className="w-6 h-6 rounded-full bg-slate-100 border border-white flex items-center justify-center text-[7px] font-black text-slate-500">ZE</div>
                                  <div className="w-6 h-6 rounded-full bg-blue-100 border border-white flex items-center justify-center text-[7px] font-black text-blue-600">CRE</div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[8px] font-black text-slate-300 uppercase letter-spacing-widest">Detalhes</span>
                                  <ChevronRight size={10} className="text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-white/20 animate-in zoom-in-95 duration-300">
                <div className="bg-blue-900 p-6 text-white flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-black uppercase tracking-tight">{editingEvent ? 'Editar Marco' : 'Novo Marco Temporal'}</h3>
                        <p className="text-blue-300 text-[10px] font-bold uppercase">Gestão da Resolução TSE 23.750</p>
                    </div>
                    <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-blue-800 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>
                <form onSubmit={handleSave} className="p-8 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Data do Evento</label>
                            <input 
                                type="date" 
                                required
                                value={formData.date}
                                onChange={(e) => setFormData({...formData, date: e.target.value})}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-900 outline-none transition-all"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Título Curto</label>
                            <input 
                                type="text" 
                                required
                                placeholder="Ex: 6 de abril, segunda-feira"
                                value={formData.title}
                                onChange={(e) => setFormData({...formData, title: e.target.value})}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-900 outline-none transition-all placeholder:text-slate-300"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Mês de Referência (Headers)</label>
                        <input 
                            type="text" 
                            required
                            placeholder="Ex: ABRIL DE 2026"
                            value={formData.month}
                            onChange={(e) => setFormData({...formData, month: e.target.value.toUpperCase()})}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-900 outline-none transition-all placeholder:text-slate-300"
                        />
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Unidade Responsável</label>
                            <select 
                                value={formData.supervisorUnit}
                                onChange={(e) => setFormData({...formData, supervisorUnit: e.target.value})}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-900 outline-none transition-all placeholder:text-slate-300"
                            >
                                <option value="">Selecione a Unidade Responsável por esta Data</option>
                                {units.map(unit => (
                                    <option key={unit.id} value={unit.acronym}>{unit.acronym} - {unit.name}</option>
                                ))}
                            </select>
                        </div>

                        <label className="flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-100 rounded-xl cursor-pointer hover:bg-yellow-100 transition-colors group">
                            <input 
                                type="checkbox"
                                checked={formData.isControlPoint}
                                onChange={(e) => setFormData({...formData, isControlPoint: e.target.checked})}
                                className="w-5 h-5 rounded-md border-yellow-300 text-yellow-600 focus:ring-yellow-500"
                            />
                            <div>
                                <p className="text-xs font-black text-yellow-900 uppercase">Marco de Controle</p>
                                <p className="text-[10px] text-yellow-700 font-bold uppercase tracking-tight">Destacar este marco como ponto de atenção especial</p>
                            </div>
                        </label>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Descrição Integral da Norma</label>
                        <textarea 
                            required
                            rows={4}
                            placeholder="Descreva detalhadamente o evento e base legal..."
                            value={formData.description}
                            onChange={(e) => setFormData({...formData, description: e.target.value})}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-900 outline-none transition-all placeholder:text-slate-300 resize-none"
                        />
                    </div>

                    <div className="flex gap-4 pt-4 border-t border-slate-50">
                        <button 
                            type="button" 
                            onClick={() => setIsModalOpen(false)}
                            className="flex-1 px-6 py-3 border border-slate-200 rounded-xl text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit"
                            className="flex-1 px-6 py-3 bg-blue-900 text-white rounded-xl font-bold text-sm shadow-xl shadow-blue-900/40 hover:bg-blue-800 transition-all active:scale-95"
                        >
                            {editingEvent ? 'Salvar Alterações' : 'Criar Marco Temporal'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {filteredEvents.length === 0 && (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center flex flex-col items-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 mb-4">
                  <Search size={40} />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Nenhum resultado encontrado</h3>
              <p className="text-slate-500 max-w-sm mt-1">Tente ajustar sua pesquisa ou filtros para encontrar o que procura.</p>
              <button 
                onClick={clearFilters}
                className="mt-6 text-blue-600 font-bold hover:underline"
              >
                Limpar Todos os Filtros
              </button>
          </div>
      )}
    </div>
  );
}

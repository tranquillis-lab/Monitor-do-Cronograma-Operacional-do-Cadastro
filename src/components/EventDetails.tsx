import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  CheckCircle2, 
  Circle, 
  Clock, 
  Paperclip, 
  ExternalLink, 
  Plus, 
  MoreVertical,
  Users,
  ShieldCheck,
  FileText,
  AlertCircle,
  X,
  Trash2,
  ChevronRight,
  Link as LinkIcon,
  Edit2
} from 'lucide-react';
import { 
  getTasks, 
  getEvents, 
  getDocumentsByEvent, 
  createTask, 
  updateTask, 
  deleteTask,
  getResponsibleUnits,
  deleteDocument
} from '../lib/db';
import { CalendarEvent, Task, Document as AppDocument, ResponsibleUnit } from '../types';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  eventId: string;
  isAdmin: boolean;
  onBack: () => void;
}

export default function EventDetails({ eventId, isAdmin, onBack }: Props) {
  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [documents, setDocuments] = useState<AppDocument[]>([]);
  const [units, setUnits] = useState<ResponsibleUnit[]>([]);
  const [loading, setLoading] = useState(true);
  
  // New Task State
  const [newTaskText, setNewTaskText] = useState('');
  const [newResponsible, setNewResponsible] = useState<string>('Geral');
  const [newRequiresCompliance, setNewRequiresCompliance] = useState(false);
  const [newTaskDeadline, setNewTaskDeadline] = useState('');
  const [newTaskNotes, setNewTaskNotes] = useState('');

  // Editing Task State
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTaskText, setEditTaskText] = useState('');
  const [editResponsible, setEditResponsible] = useState('Geral');
  const [editRequiresCompliance, setEditRequiresCompliance] = useState(false);
  const [editTaskDeadline, setEditTaskDeadline] = useState('');
  const [editTaskNotes, setEditTaskNotes] = useState('');

  // Document Modal State
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [activeTargetId, setActiveTargetId] = useState<string | null>(null);
  const [docFormData, setDocFormData] = useState({
    name: '',
    url: '',
    type: 'link' as 'link' | 'file'
  });

  useEffect(() => {
    fetchData();
  }, [eventId]);

  async function fetchData() {
    const events = await getEvents();
    const ev = events.find(e => e.id === eventId);
    if (ev) setEvent(ev);
    
    const t = await getTasks(eventId);
    setTasks(t);

    const d = await getDocumentsByEvent(eventId);
    setDocuments(d);

    const u = await getResponsibleUnits();
    setUnits(u);
    
    setLoading(false);
  }

  const handleToggleTask = async (task: Task) => {
    if (!auth.currentUser) return;
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    await updateTask(task.id!, { status: newStatus });
    setTasks(tasks.map(t => t.id === task.id ? { ...t, status: newStatus as 'pending' | 'completed' } : t));
  };

  const handleAddTask = async () => {
    if (!isAdmin) return;
    if (!newTaskText.trim()) return;
    const newTask: Omit<Task, 'id'> = {
        eventId,
        description: newTaskText,
        responsible: newResponsible,
        requiresCompliance: newRequiresCompliance,
        status: 'pending',
        deadline: newTaskDeadline || undefined,
        notes: newTaskNotes || undefined
    };
    const created = await createTask(newTask);
    setTasks([...tasks, created]);
    setNewTaskText('');
    setNewRequiresCompliance(false);
    setNewTaskDeadline('');
    setNewTaskNotes('');
  };

  const handleOpenEditTask = (task: Task) => {
    if (!isAdmin) return;
    setEditingTask(task);
    setEditTaskText(task.description);
    setEditResponsible(task.responsible);
    setEditRequiresCompliance(task.requiresCompliance);
    setEditTaskDeadline(task.deadline || '');
    setEditTaskNotes(task.notes || '');
    setIsEditModalOpen(true);
  };

  const handleSaveEditTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !editingTask.id) return;
    try {
      const updatedFields: Partial<Task> = {
        description: editTaskText,
        responsible: editResponsible,
        requiresCompliance: editRequiresCompliance,
        deadline: editTaskDeadline || undefined,
        notes: editTaskNotes || ''
      };
      await updateTask(editingTask.id, updatedFields);
      setTasks(tasks.map(t => t.id === editingTask.id ? { ...t, ...updatedFields } : t));
      setIsEditModalOpen(false);
      setEditingTask(null);
    } catch (error) {
      console.error('Erro ao atualizar atividade:', error);
      alert('Erro ao atualizar a atividade.');
    }
  };

  const handleDeleteTask = async (id: string | undefined) => {
    if (!id) {
        alert('DEBUG: ID da tarefa está indefinido!');
        return;
    }
    
    // Debug log que o usuário pode ver no console se abrir
    console.log('[DEBUG] handleDeleteTask literal start:', id);
    
    if (!isAdmin) {
        alert('⚠️ Acesso Negado: A variável isAdmin está Falsa.');
        return;
    }
    
    const msg = "⚠️ EXCLUSÃO PERMANENTE\n\nDeseja realmente excluir este desdobramento?\nEsta ação removerá também todas as evidências vinculadas.";
    
    if (window.confirm(msg)) {
        try {
            console.log('[DEBUG] Procedendo com exclusão no Firestore:', id);
            await deleteTask(id);
            setTasks(prev => prev.filter(t => t.id !== id));
            alert('✅ Registro excluído com sucesso.');
        } catch (error) {
            console.error('[DEBUG] Falha na exclusão:', error);
            alert('❌ Erro na exclusão: ' + (error instanceof Error ? error.message : 'Erro de rede/permissão'));
        }
    }
  };

  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = activeTargetId || eventId;
    if (!auth.currentUser) return;
    try {
        const newDoc: Omit<AppDocument, 'id'> = {
            relatedId: targetId,
            eventId: eventId,
            name: docFormData.name,
            url: docFormData.url,
            type: docFormData.type,
            uploadedAt: new Date().toISOString()
        };
        const ref = await addDoc(collection(db, 'documents'), newDoc);
        setDocuments([...documents, { ...newDoc, id: ref.id }]);
        setIsDocModalOpen(false);
        setActiveTargetId(null);
        setDocFormData({ name: '', url: '', type: 'link' });
    } catch (error) {
        console.error('Erro ao anexar documento:', error);
        alert('Erro ao anexar documento.');
    }
  };

  const handleDeleteDocument = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAdmin) return;
    if (confirm('Deseja excluir esta evidência?')) {
        try {
            await deleteDocument(id);
            setDocuments(documents.filter(d => d.id !== id));
        } catch (error) {
            console.error('Erro ao excluir evidência:', error);
            alert('Erro ao excluir evidência.');
        }
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );

  if (!event) return <div>Evento não encontrado.</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-blue-900 hover:border-blue-200 transition-all shadow-sm group"
              title="Voltar ao Cronograma"
            >
              <ChevronRight className="rotate-180 group-hover:-translate-x-1 transition-transform" size={20} />
            </button>
            <div className="bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Detalhes do Evento</h2>
              <p className="text-slate-400 text-[10px] font-black uppercase">Resolução TSE Nº 23.750/2026</p>
            </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row">
            <div className="bg-blue-900 text-white p-8 md:w-64 flex flex-col justify-between shrink-0 relative overflow-hidden">
                <div className="relative z-10">
                    <span className="text-[10px] font-black text-blue-300 uppercase tracking-widest">{event.month}</span>
                    <h2 className="text-5xl font-black mt-2 leading-none">{format(new Date(event.date + 'T00:00:00'), 'dd')}</h2>
                    <p className="text-xs font-bold text-blue-200 mt-1 uppercase">{format(new Date(event.date + 'T00:00:00'), 'MMMM', {locale: ptBR})}</p>
                </div>
                <div className="mt-8 relative z-10 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-[10px] font-black text-blue-400 uppercase tracking-widest bg-blue-950/50 px-2 py-1.5 rounded border border-blue-800">
                        <ShieldCheck size={14} />
                        Res 23.750/26
                    </div>
                    {event.supervisorUnit && (
                      <div className="flex items-center gap-2 text-[10px] font-black text-white uppercase tracking-widest bg-blue-700/50 px-2 py-1.5 rounded border border-blue-600/50">
                        <Users size={14} />
                        RESPONSÁVEL: {event.supervisorUnit}
                      </div>
                    )}
                </div>
                <FileText className="absolute -bottom-6 -right-6 text-white/5" size={120} />
            </div>
            <div className="flex-1 p-8 flex flex-col justify-center">
                <h1 className="text-2xl font-black text-slate-900 leading-tight uppercase mb-4 tracking-tight">{event.title}</h1>
                <p className="text-sm text-slate-500 leading-relaxed font-medium bg-slate-50 p-4 rounded-lg border border-slate-100 italic">
                    "{event.description}"
                </p>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Checklist */}
        <div className="lg:col-span-2 flex flex-col">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col flex-1">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <CheckCircle2 className="text-blue-900" size={18} />
                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Dossiê de Ações e Workflow</h3>
                    </div>
                    <span className="text-[10px] font-black text-blue-900 bg-blue-50 px-2 py-1 rounded">
                        {tasks.filter(t => t.status === 'completed').length}/{tasks.length} CONCLUÍDAS
                    </span>
                </div>

                <div className="p-6 space-y-3">
                    {tasks.map(task => (
                        <div 
                            key={task.id}
                            className={`group flex items-start gap-4 p-4 rounded-xl border transition-all ${
                                task.status === 'completed' 
                                    ? 'bg-slate-50 border-slate-100' 
                                    : 'bg-white border-slate-200 hover:border-blue-200 hover:shadow-sm'
                            }`}
                        >
                            <button 
                                onClick={() => handleToggleTask(task)}
                                className={`mt-0.5 transition-colors ${
                                    task.status === 'completed' ? 'text-blue-900' : 'text-slate-200 hover:text-blue-700'
                                } ${!auth.currentUser ? 'cursor-default opacity-50' : ''}`}
                                disabled={!auth.currentUser}
                            >
                                {task.status === 'completed' ? <CheckCircle2 size={22} className="fill-blue-50" /> : <Circle size={22} />}
                            </button>
                            <div className="flex-1">
                                <p className={`text-xs font-bold leading-snug ${task.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                                    {task.description}
                                </p>
                                {task.notes && (
                                    <p className="text-[11px] text-slate-500 mt-1.5 bg-slate-50 p-2.5 rounded-[12px] border border-slate-100 italic leading-normal">
                                        <span className="font-extrabold text-slate-600 not-italic uppercase tracking-wider text-[8px] block mb-0.5">Observações:</span>
                                        {task.notes}
                                    </p>
                                )}
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="text-[9px] font-black text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 uppercase tracking-tight">
                                        SETOR: {task.responsible}
                                    </span>
                                    {task.requiresCompliance && (
                                        <span className="inline-flex items-center gap-1 text-[9px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 uppercase tracking-tight">
                                            <AlertCircle size={10} /> Evidência Obrigatória
                                        </span>
                                    )}
                                    {task.deadline && (
                                        <span className="inline-flex items-center gap-1 text-[9px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 uppercase tracking-tight">
                                            <Clock size={10} /> Prazo: {format(new Date(task.deadline + 'T00:00:00'), 'dd/MM/yyyy')}
                                        </span>
                                    )}
                                </div>
                                
                                {/* Task Evidence */}
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {documents.filter(d => d.relatedId === task.id).map(doc => (
                                        <a 
                                            key={doc.id}
                                            href={doc.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 px-2 py-1 bg-blue-50 border border-blue-100 rounded text-[9px] font-bold text-blue-700 hover:bg-blue-100 transition-colors group/ev"
                                        >
                                            <Paperclip size={10} />
                                            <span className="max-w-[120px] truncate">{doc.name}</span>
                                            <div className="flex items-center gap-1 ml-1 scale-110">
                                                <ExternalLink size={10} className="text-blue-400 group-hover/ev:text-blue-700 transition-colors" />
                                                {isAdmin && (
                                                    <button 
                                                        onClick={(e) => handleDeleteDocument(doc.id!, e)}
                                                        className="text-red-500 hover:text-red-700 transition-colors bg-white rounded-full p-0.5 shadow-sm border border-red-100"
                                                    >
                                                        <X size={10} />
                                                    </button>
                                                )}
                                            </div>
                                        </a>
                                    ))}
                                    {auth.currentUser && (
                                        <button 
                                            onClick={() => { setActiveTargetId(task.id!); setIsDocModalOpen(true); }}
                                            className="flex items-center gap-1 px-2 py-1 border border-dashed border-slate-300 rounded text-[9px] font-bold text-slate-400 hover:border-blue-400 hover:text-blue-600 transition-all"
                                        >
                                            <Plus size={10} />
                                            Anexar Evidência
                                        </button>
                                    )}
                                </div>
                            </div>
                                  {isAdmin && (
                                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                      <button 
                                         type="button" 
                                         onClick={(e) => {
                                             e.preventDefault();
                                             e.stopPropagation();
                                             handleOpenEditTask(task);
                                         }}
                                         className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition-all active:scale-95 shadow-sm bg-white border border-slate-100"
                                         title="Editar"
                                      >
                                          <Edit2 size={14} />
                                      </button>
                                      <button 
                                          type="button" 
                                          onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              handleDeleteTask(task.id);
                                          }}
                                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all active:scale-95 shadow-sm bg-white border border-slate-100"
                                          title="Excluir"
                                      >
                                          <Trash2 size={14} />
                                      </button>
                                    </div>
                                  )}
                        </div>
                    ))}
                    
                    {isAdmin && (
                      <div className="pt-4 border-t border-slate-50 space-y-3">
                          <div className="flex gap-2">
                              <input 
                                  type="text" 
                                  value={newTaskText}
                                  onChange={(e) => setNewTaskText(e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                                  placeholder="Desdobrar nova tarefa..." 
                                  className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-xs font-bold uppercase tracking-tight focus:ring-2 focus:ring-blue-900 outline-none transition-all placeholder:text-slate-300"
                              />
                              <button 
                                  onClick={handleAddTask}
                                  className="bg-blue-900 text-white px-4 py-2.5 rounded-lg hover:bg-blue-800 transition-colors shadow-lg shadow-blue-900/20"
                              >
                                  <Plus size={18} />
                              </button>
                          </div>
                          <div className="flex items-center gap-4 px-1">
                              <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-black text-slate-400 uppercase">Responsável:</span>
                                  <select 
                                      className="text-[10px] font-black text-blue-900 bg-blue-50 px-2 py-1 rounded outline-none cursor-pointer"
                                      value={newResponsible}
                                      onChange={(e) => setNewResponsible(e.target.value)}
                                  >
                                      {units.map(unit => (
                                          <option key={unit.id} value={unit.acronym}>{unit.acronym}</option>
                                      ))}
                                      {units.length === 0 && <option value="Geral">Geral</option>}
                                  </select>
                              </div>
                              <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-black text-slate-400 uppercase">Prazo Interno:</span>
                                  <input 
                                    type="date"
                                    value={newTaskDeadline}
                                    onChange={(e) => setNewTaskDeadline(e.target.value)}
                                    className="text-[10px] font-black text-blue-900 bg-blue-50 px-2 py-1 rounded outline-none border-none"
                                  />
                              </div>
                              <label className="flex items-center gap-2 cursor-pointer group">
                                  <input 
                                      type="checkbox" 
                                      className="w-3 h-3 text-blue-900 rounded" 
                                      checked={newRequiresCompliance}
                                      onChange={(e) => setNewRequiresCompliance(e.target.checked)}
                                  />
                                  <span className="text-[10px] font-black text-slate-400 uppercase group-hover:text-amber-600 transition-colors">Exigir Evidência</span>
                              </label>
                          </div>
                          <div className="flex gap-2 px-1">
                              <input 
                                  type="text" 
                                  value={newTaskNotes}
                                  onChange={(e) => setNewTaskNotes(e.target.value)}
                                  placeholder="Observações adicionais / Instruções específicas de cumprimento (Opcional)..." 
                                  className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[11px] outline-none transition-all placeholder:text-slate-300 font-sans focus:ring-2 focus:ring-blue-900"
                              />
                          </div>
                      </div>
                    )}
                </div>
            </div>
        </div>

        {/* Evidence & Status */}
        <div className="space-y-6">
            <div className="bg-blue-900 rounded-xl shadow-lg border border-blue-950 p-6 text-white relative overflow-hidden group">
                <FileText className="absolute -top-6 -right-6 text-white/5 group-hover:scale-110 transition-transform" size={100} />
                <h3 className="text-[11px] font-black text-blue-300 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <Paperclip size={16} />
                    Repositório de Evidências
                </h3>
                
                <div className="space-y-2 mb-6 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                    {documents.filter(d => d.relatedId === eventId).map(doc => (
                        <a 
                            key={doc.id}
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-3 bg-blue-950/40 hover:bg-blue-950/60 rounded-lg border border-blue-800 transition-all group/item"
                        >
                            <div className="w-7 h-7 rounded bg-blue-800 flex items-center justify-center">
                                {doc.type === 'link' ? <LinkIcon className="text-blue-300" size={14} /> : <FileText className="text-blue-300" size={14} />}
                            </div>
                            <span className="flex-1 text-[10px] font-bold text-blue-100 truncate uppercase tracking-tight">{doc.name}</span>
                            <div className="flex items-center gap-2">
                                <ExternalLink size={12} className="text-blue-500 group-hover/item:text-white" />
                                {isAdmin && (
                                    <button 
                                        onClick={(e) => handleDeleteDocument(doc.id!, e)}
                                        className="text-blue-400 hover:text-red-400 p-1 rounded transition-colors"
                                    >
                                        <X size={12} />
                                    </button>
                                )}
                            </div>
                        </a>
                    ))}
                    {documents.length === 0 && (
                        <div className="py-8 text-center border-2 border-dashed border-blue-800 rounded-xl">
                            <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Nenhum anexo</p>
                        </div>
                    )}
                </div>

                <button 
                    onClick={() => setIsDocModalOpen(true)}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-white text-blue-900 rounded-lg font-black text-[10px] uppercase tracking-widest shadow-md hover:bg-blue-50 transition-all"
                >
                    <Plus size={14} />
                    Juntar Documentos
                </button>
            </div>

        </div>
      </div>

      {/* Document Modal */}
      {isDocModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="bg-blue-900 p-6 text-white flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-black uppercase tracking-tight">Anexar Documento</h3>
                        <p className="text-blue-300 text-[9px] font-bold uppercase">
                            {activeTargetId ? 'Evidência para desdobramento específico' : 'Repositório Digital de Conformidade'}
                        </p>
                    </div>
                    <button onClick={() => setIsDocModalOpen(false)} className="p-2 hover:bg-blue-800 rounded-full">
                        <X size={20} />
                    </button>
                </div>
                <form onSubmit={handleAddDocument} className="p-8 space-y-5">
                    <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Nome do Arquivo/Link</label>
                        <input 
                            type="text" 
                            required
                            placeholder="Ex: Ofício-circular 12/2026"
                            value={docFormData.name}
                            onChange={(e) => setDocFormData({...docFormData, name: e.target.value})}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-900 outline-none transition-all placeholder:text-slate-300"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">URL ou Link Externo</label>
                        <input 
                            type="url" 
                            required
                            placeholder="https://..."
                            value={docFormData.url}
                            onChange={(e) => setDocFormData({...docFormData, url: e.target.value})}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-900 outline-none transition-all placeholder:text-slate-300"
                        />
                    </div>
                    <div className="flex gap-4">
                        <label className="flex-1 flex items-center justify-center gap-2 p-3 bg-slate-50 border-2 border-slate-100 rounded-xl cursor-pointer hover:bg-slate-100 transition-all group">
                            <input 
                                type="radio" 
                                className="hidden" 
                                name="docType" 
                                checked={docFormData.type === 'link'} 
                                onChange={() => setDocFormData({...docFormData, type: 'link'})} 
                            />
                            <div className={`w-3 h-3 rounded-full border ${docFormData.type === 'link' ? 'bg-blue-900 border-blue-900' : 'border-slate-300'}`} />
                            <span className={`text-[10px] font-black uppercase ${docFormData.type === 'link' ? 'text-blue-900' : 'text-slate-400'}`}>Link Externo</span>
                        </label>
                        <label className="flex-1 flex items-center justify-center gap-2 p-3 bg-slate-50 border-2 border-slate-100 rounded-xl cursor-pointer hover:bg-slate-100 transition-all group">
                            <input 
                                type="radio" 
                                className="hidden" 
                                name="docType" 
                                checked={docFormData.type === 'file'} 
                                onChange={() => setDocFormData({...docFormData, type: 'file'})} 
                            />
                            <div className={`w-3 h-3 rounded-full border ${docFormData.type === 'file' ? 'bg-blue-900 border-blue-900' : 'border-slate-300'}`} />
                            <span className={`text-[10px] font-black uppercase ${docFormData.type === 'file' ? 'text-blue-900' : 'text-slate-400'}`}>Arquivo</span>
                        </label>
                    </div>
                    <button 
                        type="submit"
                        className="w-full py-4 bg-blue-900 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-900/30 hover:bg-blue-800 transition-all mt-4"
                    >
                        Confirmar Anexo
                    </button>
                </form>
            </div>
        </div>
      )}

      {/* Edit Task Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden border border-slate-150 animate-in zoom-in-95 duration-300">
                <div className="bg-blue-900 p-6 text-white flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-black uppercase tracking-tight">Editar Desdobramento</h3>
                        <p className="text-blue-300 text-[10px] font-bold uppercase">Gestão da Atividade / Ação</p>
                    </div>
                    <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-blue-800 rounded-full">
                        <X size={20} />
                    </button>
                </div>
                <form onSubmit={handleSaveEditTask} className="p-8 space-y-5">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Descrição Integral da Atividade</label>
                        <textarea 
                            required
                            rows={3}
                            value={editTaskText}
                            onChange={(e) => setEditTaskText(e.target.value)}
                            placeholder="Descreva a atividade..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-900 outline-none transition-all placeholder:text-slate-300 resize-none font-sans"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Unidade Responsável</label>
                            <select 
                                value={editResponsible}
                                onChange={(e) => setEditResponsible(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-900 outline-none transition-all"
                            >
                                {units.map(unit => (
                                    <option key={unit.id} value={unit.acronym}>{unit.acronym}</option>
                                ))}
                                {units.length === 0 && <option value="Geral">Geral</option>}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Prazo Interno</label>
                            <input 
                                type="date"
                                value={editTaskDeadline}
                                onChange={(e) => setEditTaskDeadline(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-900 outline-none transition-all"
                            />
                        </div>
                    </div>

                    <label className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-100 rounded-xl cursor-pointer hover:bg-amber-100 transition-colors group flex">
                        <input 
                            type="checkbox"
                            checked={editRequiresCompliance}
                            onChange={(e) => setEditRequiresCompliance(e.target.checked)}
                            className="w-5 h-5 rounded-md border-amber-300 text-amber-600 focus:ring-amber-500"
                        />
                        <div>
                            <p className="text-xs font-black text-amber-900 uppercase">Ação Exige Comprovação / Evidência</p>
                            <p className="text-[10px] text-amber-700 font-bold uppercase tracking-tight">Obrigatório anexar ofícios, circulares ou relatórios para conclusão</p>
                        </div>
                    </label>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Observações / Detalhes Adicionais (Opcional)</label>
                        <textarea 
                            rows={3}
                            value={editTaskNotes}
                            onChange={(e) => setEditTaskNotes(e.target.value)}
                            placeholder="Esclareça detalhes da ação, instruções adicionais ou orientações para a evidência..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-900 outline-none transition-all placeholder:text-slate-300 resize-none font-sans"
                        />
                    </div>

                    <div className="flex gap-4 pt-2">
                        <button 
                            type="button" 
                            onClick={() => setIsEditModalOpen(false)}
                            className="flex-1 px-6 py-3 border border-slate-200 rounded-xl text-slate-500 font-bold text-sm hover:bg-slate-50 transition-all"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit"
                            className="flex-1 px-6 py-3 bg-blue-900 text-white rounded-xl font-bold text-sm shadow-xl shadow-blue-900/40 hover:bg-blue-800 transition-all"
                        >
                            Salvar Alterações
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
}

// Internal icons needed
function Target({ className, size }: { className?: string, size?: number }) {
    return <AlertCircle className={className} size={size} />;
}

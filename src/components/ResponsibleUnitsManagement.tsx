import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  Check, 
  AlertCircle,
  Search,
  ChevronRight
} from 'lucide-react';
import { 
  getResponsibleUnits, 
  createResponsibleUnit, 
  updateResponsibleUnit, 
  deleteResponsibleUnit 
} from '../lib/db';
import { ResponsibleUnit } from '../types';
import { auth } from '../lib/firebase';

export default function ResponsibleUnitsManagement({ isAdmin }: { isAdmin: boolean }) {
  const [units, setUnits] = useState<ResponsibleUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<ResponsibleUnit | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    acronym: '',
    description: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const data = await getResponsibleUnits();
    setUnits(data);
    setLoading(false);
  }

  const handleOpenModal = (unit?: ResponsibleUnit) => {
    if (!isAdmin) return;
    if (unit) {
      setEditingUnit(unit);
      setFormData({
        name: unit.name,
        acronym: unit.acronym,
        description: unit.description || ''
      });
    } else {
      setEditingUnit(null);
      setFormData({
        name: '',
        acronym: '',
        description: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    
    try {
      if (editingUnit) {
        await updateResponsibleUnit(editingUnit.id!, formData);
      } else {
        await createResponsibleUnit(formData);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Erro ao salvar unidade:', error);
      alert('Erro ao salvar unidade responsável.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) return;
    if (confirm('Tem certeza que deseja excluir esta unidade? Isso pode afetar tarefas vinculadas.')) {
      try {
        await deleteResponsibleUnit(id);
        fetchData();
      } catch (error) {
        console.error('Erro ao excluir unidade:', error);
        alert('Erro ao excluir unidade.');
      }
    }
  };

  const filteredUnits = units.filter(u => 
    u.name.toLowerCase().includes(search.toLowerCase()) || 
    u.acronym.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div className="flex-1 flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-900"></div>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-8 custom-scrollbar">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
              <button 
                onClick={() => window.dispatchEvent(new CustomEvent('changeView', { detail: 'dashboard' }))}
                className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-blue-900 hover:border-blue-200 transition-all shadow-sm group"
                title="Voltar ao Início"
              >
                <ChevronRight className="rotate-180 group-hover:-translate-x-1 transition-transform" size={20} />
              </button>
              <div>
                <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
                  <Building2 className="text-blue-900" size={32} />
                  Unidades Responsáveis
                </h1>
                <p className="text-slate-500 font-medium mt-1">Gerencie os departamentos e setores encarregados das ações.</p>
              </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                    type="text" 
                    placeholder="Pesquisar unidade..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-900 outline-none transition-all w-64 shadow-sm"
                />
            </div>
            {isAdmin && (
              <button 
                  onClick={() => handleOpenModal()}
                  className="flex items-center gap-2 bg-blue-900 hover:bg-blue-800 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-900/20 transition-all active:scale-95"
              >
                  <Plus size={18} />
                  Nova Unidade
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUnits.map(unit => (
            <div key={unit.id} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-900" />
                <div className="flex justify-between items-start mb-4">
                    <div className="bg-blue-50 text-blue-900 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">
                        {unit.acronym}
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1 transition-all">
                        <button 
                            onClick={() => handleOpenModal(unit)}
                            className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                        >
                            <Edit2 size={16} />
                        </button>
                        <button 
                            onClick={() => handleDelete(unit.id!)}
                            className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition-colors border border-red-50 shadow-sm"
                        >
                            <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                </div>
                <h3 className="text-lg font-black text-slate-900 uppercase leading-tight mb-2 group-hover:text-blue-900 transition-colors">
                    {unit.name}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                    {unit.description || 'Sem descrição cadastrada.'}
                </p>
            </div>
          ))}

          {filteredUnits.length === 0 && (
            <div className="col-span-full py-20 text-center bg-white rounded-2xl border-2 border-dashed border-slate-200">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mx-auto mb-4">
                    <Building2 size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Nenhuma unidade encontrada</h3>
                <p className="text-slate-500 text-sm mt-1">Tente ajustar sua pesquisa ou cadastre uma nova unidade.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="bg-blue-900 p-6 text-white flex justify-between items-center">
              <div>
                <h3 className="text-lg font-black uppercase tracking-tight">
                  {editingUnit ? 'Editar Unidade' : 'Cadastrar Unidade'}
                </h3>
                <p className="text-blue-300 text-[10px] font-bold uppercase tracking-widest">
                  Gestão de Governança Institucional
                </p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-blue-800 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-8 space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Nome da Unidade</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ex: Corregedoria Regional Eleitoral"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-900 outline-none transition-all placeholder:text-slate-300"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Sigla / Acrônimo</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ex: CRE"
                  value={formData.acronym}
                  onChange={(e) => setFormData({...formData, acronym: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-900 outline-none transition-all placeholder:text-slate-300"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Descrição das Funções</label>
                <textarea 
                  rows={3}
                  placeholder="Descreva as principais atribuições desta unidade..."
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-900 outline-none transition-all placeholder:text-slate-300 resize-none"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-4 bg-blue-900 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-900/30 hover:bg-blue-800 transition-all"
                >
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

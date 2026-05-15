import React, { useState, useEffect } from 'react';
import { Trash2, Upload, Search, MapPin, Download, Filter, CheckCircle2, AlertTriangle, MoreVertical, Activity, ChevronRight } from 'lucide-react';
import { getZones, deleteZone, clearAllZones } from '../lib/db';
import { Zone } from '../types';
import { collection, addDoc, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

export default function ZoneManagement({ isAdmin }: { isAdmin: boolean }) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const data = await getZones();
    setZones(data.sort((a, b) => Number(a.id) - Number(b.id)));
    setLoading(false);
  }

  const handleDelete = async (id: string) => {
    if (!isAdmin) return;
    if (confirm(`Excluir a Zona ${id.padStart(3, '0')}ª ZGO?`)) {
        try {
            await deleteZone(id);
            setZones(zones.filter(z => z.id !== id));
        } catch (error) {
            console.error('Erro ao excluir zona:', error);
            alert('Erro ao excluir zona.');
        }
    }
  };

  const handleClearAll = async () => {
    if (!isAdmin) return;
    if (confirm('ATENÇÃO: Esta ação irá EXCLUIR PERMANENTEMENTE todas as zonas eleitorais cadastradas. Deseja continuar?')) {
        setIsClearing(true);
        try {
            await clearAllZones();
            setZones([]);
            alert('Base de dados excluída com sucesso.');
        } catch (error) {
            console.error('Erro ao excluir zonas:', error);
            alert('Erro ao excluir base de dados.');
        } finally {
            setIsClearing(false);
        }
    }
  };

  const fixEncoding = (text: string): string => {
    // Common UTF-8 artifacts that appear when Latin-1 is expected or vice-versa
    const replacements: { [key: string]: string } = {
        'Ã¡': 'á', 'Ã ': 'à', 'Ã¢': 'â', 'Ã£': 'ã',
        'Ã©': 'é', 'Ãª': 'ê',
        'Ã\xad': 'í',
        'Ã³': 'ó', 'Ã´': 'ô', 'Ãµ': 'õ',
        'Ãº': 'ú',
        'Ã§': 'ç',
        'Ã\x81': 'Á', 'Ã\x80': 'À', 'Ã\x82': 'Â', 'Ã\x83': 'Ã',
        'Ã\x89': 'É', 'Ã\x8a': 'Ê',
        'Ã\x8d': 'Í',
        'Ã\x93': 'Ó', 'Ã\x94': 'Ô', 'Ã\x95': 'Õ',
        'Ã\x9a': 'Ú',
        'Ã\x87': 'Ç',
        'Âº': 'º', 'Âª': 'ª'
    };

    let fixed = text;
    Object.keys(replacements).forEach(key => {
        const regex = new RegExp(key, 'g');
        fixed = fixed.replace(regex, replacements[key]);
    });

    return fixed;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
        let text = event.target?.result as string;
        
        // Retify data / Fix common encoding issues
        text = fixEncoding(text);

        const lines = text.split('\n');
        const batch = writeBatch(db);
        const newZones: Zone[] = [];
        const seenIds = new Set<string>();

        for (const line of lines) {
            if (!line.trim()) continue;
            
            // Try different separators if ; doesn't work
            let parts = line.split(';');
            if (parts.length < 2) parts = line.split(',');

            const id = parts[0]?.trim();
            const municipality = parts[1]?.trim();

            if (id && municipality && !isNaN(Number(id))) {
                if (seenIds.has(id)) continue;
                seenIds.add(id);

                const zoneData = { 
                    id: id.replace(/^0+/, ''), // Remove leading zeros for consistent ID
                    municipality: municipality.replace(/"/g, '') // Remove quotes if present
                };
                const zoneRef = doc(db, 'zones', zoneData.id);
                batch.set(zoneRef, zoneData);
                newZones.push(zoneData);
            }
        }

        try {
            await batch.commit();
            setZones(prev => {
                const combined = [...prev];
                newZones.forEach(nz => {
                    const idx = combined.findIndex(z => z.id === nz.id);
                    if (idx >= 0) combined[idx] = nz;
                    else combined.push(nz);
                });
                return combined.sort((a, b) => Number(a.id) - Number(b.id));
            });
            alert(`${newZones.length} zonas processadas e importadas com sucesso!`);
        } catch (error) {
            console.error('Error uploading zones:', error);
            alert('Erro ao importar de zonas. Verifique o formato do CSV (nº da zona; município)');
        } finally {
            setIsUploading(false);
            if (e.target) e.target.value = ''; // Reset input
        }
    };
    reader.readAsText(file);
  };

  const filteredZones = zones.filter(z => 
    z.id.includes(search) || 
    z.municipality.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
              <button 
                onClick={() => window.dispatchEvent(new CustomEvent('changeView', { detail: 'dashboard' }))}
                className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm group"
                title="Voltar ao Início"
              >
                <ChevronRight className="rotate-180 group-hover:-translate-x-1 transition-transform" size={20} />
              </button>
              <div>
                <h2 className="text-3xl font-bold text-slate-900 tracking-tight italic flex items-center gap-3">
                  <MapPin className="text-blue-600" size={32} />
                  Gestão de Unidades (Zonas Eleitorais)
                </h2>
                <p className="text-slate-500 font-medium">Acompanhamento granular do cumprimento por município.</p>
              </div>
        </div>
        <div className="flex items-center gap-3">
            {isAdmin && (
              <>
                <button 
                  onClick={handleClearAll}
                  disabled={isClearing || isUploading}
                  className="flex items-center gap-2 bg-white border border-red-200 px-5 py-2.5 rounded-xl text-red-600 font-bold text-sm hover:bg-red-50 transition-all shadow-sm disabled:opacity-50"
                  title="Excluir todas as zonas atuais"
                >
                  <Trash2 size={18} />
                  {isClearing ? 'Excluindo...' : 'Limpar Base'}
                </button>
                <label className="flex items-center gap-2 bg-white border border-slate-200 px-5 py-2.5 rounded-xl text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all cursor-pointer shadow-sm">
                    <Upload size={18} />
                    {isUploading ? 'Importando...' : 'Importar Zonas'}
                    <input type="file" accept=".csv, .txt" className="hidden" onChange={handleFileUpload} disabled={isUploading || isClearing} />
                </label>
              </>
            )}
            <button className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-900/10 transition-all hover:bg-slate-800 active:scale-95">
                <Download size={18} />
                Exportar Relatório
            </button>
        </div>
      </div>

      {/* KPI Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                      <MapPin size={20} />
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase">Total de Zonas</span>
              </div>
              <p className="text-3xl font-black text-slate-900">{zones.length}</p>
              <p className="text-xs text-slate-500 mt-1 font-medium">Unidades registradas no sistema.</p>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center">
                      <CheckCircle2 size={20} />
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase">Alta Conformidade</span>
              </div>
              <p className="text-3xl font-black text-green-600">84%</p>
              <p className="text-xs text-slate-500 mt-1 font-medium">Zonas sem pendências críticas.</p>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                      <AlertTriangle size={20} />
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase">Zonas em Risco</span>
              </div>
              <p className="text-3xl font-black text-amber-600">12</p>
              <p className="text-xs text-slate-500 mt-1 font-medium">Unidades com prazos vencidos.</p>
          </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row gap-4 md:items-center justify-between bg-slate-50/50">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                    type="text" 
                    placeholder="Filtrar por nº zona ou município..." 
                    className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                  <button className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-slate-600 transition-all shadow-sm">
                      <Filter size={18} />
                  </button>
                  <button className="flex items-center gap-2 p-3 bg-white border border-slate-200 rounded-xl text-slate-600 font-bold text-xs shadow-sm hover:bg-slate-50 transition-all">
                      <Activity size={16} className="text-blue-500" />
                      Status de Atividade
                  </button>
              </div>
          </div>

          <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                  <thead>
                      <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                          <th className="px-8 py-4">Nº da Zona</th>
                          <th className="px-8 py-4">Município</th>
                          <th className="px-8 py-4">Status de Conformidade</th>
                          <th className="px-8 py-4">Última Atividade</th>
                          <th className="px-8 py-4 text-center">Ação</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                      {filteredZones.map((zone) => (
                          <tr key={zone.id} className="hover:bg-slate-50 transition-colors group">
                              <td className="px-8 py-4">
                                  <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                                          {zone.id.padStart(3, '0')}ª
                                      </div>
                                      <span className="font-bold text-slate-900 font-mono tracking-tight">{zone.id.padStart(3, '0')}ª ZGO</span>
                                  </div>
                              </td>
                              <td className="px-8 py-4">
                                  <span className="text-sm font-bold text-slate-600 italic">"{zone.municipality}"</span>
                              </td>
                              <td className="px-8 py-4">
                                  <div className="flex items-center gap-2">
                                      <div className="flex-1 max-w-[120px] h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                          <div className="w-[85%] h-full bg-green-500 rounded-full" />
                                      </div>
                                      <span className="text-xs font-black text-green-600">85%</span>
                                  </div>
                              </td>
                              <td className="px-8 py-4 text-xs text-slate-400 font-medium italic">
                                  Ontem às 14:32
                              </td>
                              <td className="px-8 py-4 text-center">
                                  {isAdmin && (
                                      <button 
                                          onClick={() => handleDelete(zone.id)}
                                          className="p-2 hover:bg-red-50 border border-transparent hover:border-red-100 rounded-lg text-slate-300 hover:text-red-500 transition-all shadow-sm"
                                          title="Excluir Zona"
                                      >
                                          <Trash2 size={18} />
                                      </button>
                                  )}
                                  {!isAdmin && (
                                      <button className="p-2 opacity-20 cursor-not-allowed">
                                          <MoreVertical size={18} />
                                      </button>
                                  )}
                              </td>
                          </tr>
                      ))}
                      {filteredZones.length === 0 && (
                          <tr>
                              <td colSpan={5} className="px-8 py-20 text-center">
                                  <div className="flex flex-col items-center opacity-40">
                                      <MapPin size={48} className="text-slate-300 mb-4" />
                                      <p className="text-sm font-bold">Nenhuma zona cadastrada.</p>
                                      <p className="text-xs">Faça o upload do arquivo CSV para popular o banco de unidades.</p>
                                  </div>
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

import React, { useState, useRef, useEffect } from 'react';
import { RefreshCw, Trash2, AlertTriangle, CheckCircle2, Download, Upload, Database, ShieldCheck, Info, UserPlus, Mail, X, Plus, ChevronRight } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, getDocs, writeBatch } from 'firebase/firestore';
import { seedInitialData, exportFullBackup, restoreFullBackup, repairDataInvariants, getAdmins, addAdmin, removeAdmin } from '../lib/db';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function SettingsView({ isAdmin }: { isAdmin: boolean }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [admins, setAdmins] = useState<{id: string, email: string}[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdmin) {
      fetchAdmins();
    }
  }, [isAdmin]);

  async function fetchAdmins() {
    const list = await getAdmins();
    setAdmins(list);
  }

  async function handleAddAdmin() {
    if (!newAdminEmail.trim() || !newAdminEmail.includes('@')) return;
    setLoading(true);
    await addAdmin(newAdminEmail);
    setNewAdminEmail('');
    await fetchAdmins();
    setLoading(false);
    setStatusMsg('Administrador adicionado com sucesso.');
    setTimeout(() => setStatusMsg(null), 3000);
  }

  async function handleRemoveAdmin(id: string) {
    if (!confirm('Excluir este administrador?')) return;
    setLoading(true);
    await removeAdmin(id);
    await fetchAdmins();
    setLoading(false);
    setStatusMsg('Administrador removido.');
    setTimeout(() => setStatusMsg(null), 3000);
  }

  async function handleResetData() {
    if (!isAdmin) return;
    if (!window.confirm('TEM CERTEZA? Isso irá apagar todo o cronograma atual e os desdobramentos para reiniciá-los a partir da base original corrigida.')) return;

    setLoading(true);
    try {
      const batchSize = 500;
      const collections = ['events', 'tasks', 'compliance', 'documents', 'zones', 'responsibleUnits'];
      
      for (const colName of collections) {
        const snap = await getDocs(collection(db, colName));
        const docs = snap.docs;
        for (let i = 0; i < docs.length; i += batchSize) {
          const batch = writeBatch(db);
          docs.slice(i, i + batchSize).forEach(doc => batch.delete(doc.ref));
          await batch.commit();
        }
      }

      await seedInitialData();
      setDone(true);
      setStatusMsg('Base reiniciada com sucesso.');
      setTimeout(() => setDone(false), 3000);
    } catch (err) {
      console.error(err);
      alert('Erro ao resetar dados.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRepair() {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const count = await repairDataInvariants();
      if (count > 0) {
        alert(`${count} registros corrigidos com sucesso.`);
      } else {
        alert('Nenhum registro corrompido encontrado.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao reparar dados.');
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const backup = await exportFullBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup_cronograma_${format(new Date(), 'yyyy-MM-dd_HHmm')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setStatusMsg('Backup exportado com sucesso. Você pode salvá-lo no seu Google Drive.');
    } catch (err) {
      console.error(err);
      alert('Erro ao exportar backup.');
    } finally {
      setLoading(false);
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    if (!isAdmin || !e.target.files?.[0]) return;
    if (!window.confirm('ATENÇÃO: Restaurar um backup irá SUBSTITUIR TODOS os dados atuais. Deseja continuar?')) {
        e.target.value = '';
        return;
    }

    setLoading(true);
    try {
      const file = e.target.files[0];
      const reader = new FileReader();
      
      const fileData = await new Promise((resolve, reject) => {
        reader.onload = (event) => resolve(JSON.parse(event.target?.result as string));
        reader.onerror = reject;
        reader.readAsText(file);
      });

      await restoreFullBackup(fileData);
      alert('Backup restaurado com sucesso! Recarregando aplicação...');
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert('Erro ao restaurar backup. Verifique se o arquivo JSON é válido.');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  if (!isAdmin) {
    return (
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm text-center">
        <AlertTriangle className="text-amber-500 mx-auto mb-4" size={48} />
        <h3 className="text-xl font-bold text-slate-900">Acesso Restrito</h3>
        <p className="text-slate-500 mt-2">Apenas administradores podem acessar as configurações do sistema.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700 pb-20">
        <div className="flex items-center gap-4">
              <button 
                onClick={() => window.dispatchEvent(new CustomEvent('changeView', { detail: 'dashboard' }))}
                className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm group"
                title="Voltar ao Início"
              >
                <ChevronRight className="rotate-180 group-hover:-translate-x-1 transition-transform" size={20} />
              </button>
              <div className="bg-white border border-slate-200 px-4 py-2 rounded-xl">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">Painel Administrativo</h2>
                <p className="text-slate-400 text-[10px] font-black uppercase">Configurações do Sistema</p>
              </div>
        </div>

      <div className="bg-white p-8 md:p-12 rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/40 relative overflow-hidden">
        {/* Decorative background */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-full blur-3xl -mr-32 -mt-32 opacity-50" />
        
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
            <div>
              <h2 className="text-3xl md:text-4xl font-black text-slate-900 uppercase tracking-tighter mb-3 leading-none">
                Gestão do Sistema
              </h2>
              <div className="flex items-center gap-2 text-slate-500 font-bold text-sm uppercase tracking-widest">
                <ShieldCheck size={16} className="text-emerald-500" />
                Segurança e Integridade de Dados
              </div>
            </div>
            
            {statusMsg && (
                <div className="bg-emerald-50 text-emerald-700 px-6 py-3 rounded-2xl border border-emerald-100 flex items-center gap-3 animate-in slide-in-from-right duration-300">
                    <CheckCircle2 size={18} />
                    <span className="text-xs font-black uppercase tracking-tight">{statusMsg}</span>
                </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Admin Management Section */}
            <div className="group bg-blue-900 p-8 rounded-[2rem] border border-blue-950 shadow-2xl flex flex-col h-full text-white lg:col-span-1 md:col-span-2">
              <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-white mb-6">
                <UserPlus size={28} />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight mb-3">Administradores</h3>
              <p className="text-blue-200 text-sm font-medium leading-relaxed mb-6">
                Gerencie quem possui permissões totais de edição no sistema. O acesso é validado pelo e-mail Google.
              </p>
              
              <div className="space-y-4 mb-6 flex-grow overflow-y-auto max-h-[160px] pr-2 custom-scrollbar">
                {admins.map(admin => (
                  <div key={admin.id} className="flex items-center justify-between bg-blue-950/50 p-2 rounded-lg border border-blue-800">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Mail size={14} className="text-blue-400 shrink-0" />
                      <span className="text-[10px] font-bold truncate">{admin.email}</span>
                    </div>
                    <button 
                      onClick={() => handleRemoveAdmin(admin.id)}
                      className="text-blue-400 hover:text-red-400 p-1"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                {admins.length === 0 && (
                  <p className="text-[10px] text-blue-400 italic">Nenhum administrador extra cadastrado.</p>
                )}
              </div>

              <div className="space-y-3">
                <input 
                  type="email"
                  placeholder="E-mail Google do Admin..."
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  className="w-full bg-blue-950/50 border border-blue-800 rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-blue-400 outline-none placeholder:text-blue-700"
                />
                <button 
                  onClick={handleAddAdmin}
                  disabled={loading || !newAdminEmail.includes('@')}
                  className="w-full flex items-center justify-center gap-2 bg-white text-blue-900 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-50 transition-all disabled:opacity-50"
                >
                  <Plus size={16} />
                  Adicionar Admin
                </button>
              </div>
            </div>

            {/* Backup Section */}
            <div className="group bg-slate-50 hover:bg-white p-8 rounded-[2rem] border border-slate-200 hover:border-blue-200 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/10 flex flex-col h-full">
              <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-600/20 mb-6 group-hover:scale-105 transition-transform">
                <Download size={28} />
              </div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-3">Backup Completo</h3>
              <p className="text-slate-500 text-sm font-medium leading-relaxed mb-8 flex-grow">
                Exporte todos os eventos, tarefas, desdobramentos e zones em um arquivo JSON. 
                Recomendamos salvar este arquivo periodicamente no seu <span className="text-blue-600 font-bold">Google Drive</span> para garantir a segurança dos dados.
              </p>
              <button 
                onClick={handleExport}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 bg-slate-900 text-white hover:bg-blue-600 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:opacity-50"
              >
                <Download size={18} />
                Exportar para Drive
              </button>
            </div>

            {/* Restore Section */}
            <div className="group bg-slate-50 hover:bg-white p-8 rounded-[2rem] border border-slate-200 hover:border-emerald-200 transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/10 flex flex-col h-full">
              <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-600/20 mb-6 group-hover:scale-105 transition-transform">
                <Upload size={28} />
              </div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-3">Restaurar Backup</h3>
              <p className="text-slate-500 text-sm font-medium leading-relaxed mb-8 flex-grow">
                Selecione um arquivo de backup previamente exportado para restaurar o banco de dados ao estado original. 
                <span className="text-red-500 font-bold block mt-2">Isso apagará todos os dados atuais.</span>
              </p>
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleImport}
                className="hidden" 
                accept=".json"
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 bg-white text-emerald-700 border-2 border-emerald-600 hover:bg-emerald-50 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
              >
                <Upload size={18} />
                Selecionar do Drive
              </button>
            </div>

            {/* Repair Section */}
            <div className="group bg-slate-50 hover:bg-white p-8 rounded-[2rem] border border-slate-200 hover:border-amber-200 transition-all duration-300 hover:shadow-2xl hover:shadow-amber-500/10 flex flex-col h-full">
              <div className="w-14 h-14 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-amber-500/20 mb-6 group-hover:scale-105 transition-transform">
                <Database size={28} />
              </div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-3">Reparo de Base</h3>
              <p className="text-slate-500 text-sm font-medium leading-relaxed mb-8 flex-grow">
                Corrige automaticamente inconsistências em títulos e cabeçalhos de meses sem afetar seus cadastros atuais. 
                Utilize se notar datas incorretas ("14 de Junho") em locais indevidos.
              </p>
              <button 
                onClick={handleRepair}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 bg-amber-100 text-amber-900 hover:bg-amber-200 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
              >
                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                Reparar Integridade
              </button>
            </div>

          </div>

          <div className="mt-12 p-8 border-2 border-slate-100 bg-slate-50/30 rounded-3xl">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white rounded-xl shadow-sm">
                <Info className="text-slate-400" size={24} />
              </div>
              <div className="space-y-4">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Procedimento de Segurança</h4>
                <p className="text-sm text-slate-600 font-medium leading-loose">
                  Como a aplicação opera em ambiente de contêiner dinâmico, recomendamos o seguinte fluxo de backup:
                </p>
                <ol className="list-decimal list-inside text-sm text-slate-600 font-medium space-y-3 pl-2">
                  <li>Clique em <span className="font-bold underline">Exportar para Drive</span> para gerar o arquivo de backup.</li>
                  <li>Salve o arquivo JSON baixado em sua pasta institucional no <span className="font-bold text-blue-600">Google Drive</span>.</li>
                  <li>Em caso de perda de dados, clique em <span className="font-bold underline">Selecionar do Drive</span> e escolha o arquivo salvo.</li>
                </ol>
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-center">
            <button 
              onClick={handleResetData}
              disabled={loading}
              className="group flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] hover:text-red-500 transition-colors"
            >
              <Trash2 size={12} className="group-hover:animate-pulse" />
              Reset Critical: Redefinir para Padrão de Fábrica
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

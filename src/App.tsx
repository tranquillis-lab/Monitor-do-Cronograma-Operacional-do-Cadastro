/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Calendar, 
  CheckSquare, 
  FileText, 
  LayoutDashboard, 
  MapPin, 
  Settings,
  Menu,
  X,
  Bell,
  Search,
  ChevronRight,
  LogIn,
  LogOut,
  User,
  Building2,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { seedInitialData } from './lib/db';
import { auth, loginWithGoogle, logout } from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { getAdmins } from './lib/db';

// Components
import Dashboard from './components/Dashboard';
import ScheduleView from './components/ScheduleView';
import ZoneManagement from './components/ZoneManagement';
import EventDetails from './components/EventDetails';
import ResponsibleUnitsManagement from './components/ResponsibleUnitsManagement';
import SettingsView from './components/SettingsView';
import DeadlineMonitor from './components/DeadlineMonitor';

type View = 'dashboard' | 'schedule' | 'zones' | 'event-details' | 'units' | 'settings' | 'deadlines';

export default function App() {
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [admins, setAdmins] = useState<{id: string, email: string}[]>([]);

  useEffect(() => {
    const fetchAdmins = async () => {
      const adminList = await getAdmins();
      setAdmins(adminList);
    };

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) fetchAdmins();
    });
    seedInitialData();
    return () => unsubscribe();
  }, []);

  const userEmail = user?.email?.toLowerCase();
  const isAdmin = userEmail === 'tranquillis@gmail.com' || admins.some(a => a.email === userEmail);

  const navItems = [
    { id: 'dashboard', label: 'Painel', icon: LayoutDashboard },
    { id: 'schedule', label: 'Cronograma', icon: Calendar },
    { id: 'deadlines', label: 'Monitor de Prazos', icon: Clock },
    { id: 'zones', label: 'Gestão de Zonas', icon: MapPin },
    { id: 'units', label: 'Unidades', icon: Building2 },
  ];

  const handleSelectEvent = (id: string) => {
    setSelectedEventId(id);
    setActiveView('event-details');
  };

  useEffect(() => {
    if (user) {
      console.log('Usuário Logado:', user.email);
      console.log('Status Admin:', isAdmin);
    }
  }, [user, isAdmin]);

  if (loading) {
    return (
      <div className="h-screen w-full bg-blue-900 flex flex-col items-center justify-center text-white p-6 text-center">
        <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center animate-pulse mb-4">
           <CheckSquare size={32} className="text-white" />
        </div>
        <h2 className="text-xl font-bold uppercase tracking-widest animate-pulse">Carregando Sistema...</h2>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.aside 
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            className="w-72 bg-white border-r border-slate-200 flex flex-col z-50 absolute lg:relative h-full shadow-xl lg:shadow-none"
          >
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-blue-900 text-white shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded flex items-center justify-center">
                  <CheckSquare className="text-blue-900" size={24} />
                </div>
                <div>
                  <h1 className="font-bold text-xs leading-tight uppercase tracking-tight">Monitoramento</h1>
                  <p className="text-[10px] text-blue-200 font-bold uppercase">Cronograma Operacional</p>
                </div>
              </div>
              <button 
                onClick={() => setSidebarOpen(false)} 
                className="lg:hidden p-1 hover:bg-blue-800 rounded text-blue-300"
              >
                <X size={20} />
              </button>
            </div>

            <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
              <div className="px-3 mb-4 mt-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-2">Controle Central</div>
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id as View)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
                    activeView === item.id 
                      ? 'bg-blue-50 text-blue-900 border border-blue-100 shadow-sm' 
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <item.icon size={18} className={activeView === item.id ? 'text-blue-700' : 'text-slate-400 group-hover:text-slate-600'} />
                  <span className="font-bold text-xs uppercase tracking-tight" translate="no">{item.label}</span>
                </button>
              ))}

              <div className="pt-8 px-3 mb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-2">Suporte e Normas</div>
              <a 
                href="https://www.tse.jus.br/legislacao/compilada/res/2021/resolucao-no-23-659-de-26-de-outubro-de-2021" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-600 hover:bg-slate-50 transition-all font-bold text-xs uppercase tracking-tight"
              >
                <FileText size={18} className="text-slate-400" />
                <span>Resolução TSE nº 23.750/2026</span>
              </a>
              <button 
                onClick={() => setActiveView('settings')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all font-bold text-xs uppercase tracking-tight ${
                  activeView === 'settings' ? 'bg-blue-50 text-blue-900 border border-blue-100 shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Settings size={18} className={activeView === 'settings' ? 'text-blue-700' : 'text-slate-400'} />
                <span>Configurações</span>
              </button>
            </nav>

            <div className="p-4 bg-slate-50 border-t border-slate-200">
              {user ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 group cursor-pointer">
                    <div className="w-10 h-10 rounded-lg overflow-hidden border-2 border-white shadow-md">
                      {user.photoURL ? (
                        <img src={user.photoURL} alt={user.displayName || 'User'} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-blue-900 text-white flex items-center justify-center font-black text-xs uppercase tracking-tighter">
                          {user.displayName?.slice(0, 2) || user.email?.slice(0, 2) || 'U'}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight truncate">{user.displayName || user.email}</p>
                      <p className={`text-[10px] font-black uppercase ${isAdmin ? 'text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100' : 'text-slate-400'}`}>
                        {isAdmin ? '🛡️ Administrador' : 'Acesso Restrito'}
                      </p>
                    </div>
                  </div>

                  <button 
                    onClick={() => logout()}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase text-slate-500 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all shadow-sm"
                  >
                    <LogOut size={14} />
                    Finalizar Sessão
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => loginWithGoogle()}
                  className="w-full py-4 bg-blue-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-900/40 hover:bg-blue-800 transition-all flex items-center justify-center gap-2"
                >
                  <LogIn size={16} />
                  Fazer Login Google
                </button>
              )}
              
              <div className="mt-6">
                <div className="h-6 flex items-center justify-between text-[10px] font-black text-slate-400 flex-shrink-0">
                  <span>CONFORMIDADE GERAL</span>
                  <span className="text-blue-600">82.4%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div className="w-[82%] h-full bg-blue-900" />
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-blue-900 flex items-center justify-between px-6 shrink-0 shadow-lg z-40">
          <div className="flex items-center gap-4">
            {!isSidebarOpen && (
              <button 
                onClick={() => setSidebarOpen(true)}
                className="p-2 hover:bg-blue-800 rounded-lg text-white transition-colors"
              >
                <Menu size={24} />
              </button>
            )}
            <div className="hidden md:flex items-center gap-2 text-xs font-bold text-blue-200 uppercase tracking-widest whitespace-nowrap">
              <span>CONTROLE OPERACIONAL</span>
              <ChevronRight size={14} className="text-blue-400" />
              <span className="text-white" translate="no">
                {activeView === 'dashboard' ? 'Painel' : 
                 activeView === 'schedule' ? 'Cronograma' : 
                 activeView === 'zones' ? 'Gestão de Zonas' : 
                 activeView === 'units' ? 'Unidades' : 
                 activeView === 'settings' ? 'Configurações' : 
                 activeView === 'deadlines' ? 'Monitor de Prazos Internos' :
                 activeView === 'event-details' ? 'Detalhes do Marco' : activeView}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="relative group hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-300 pointer-events-none" size={16} />
              <input 
                type="text" 
                placeholder="Pesquisar..." 
                className="pl-10 pr-4 py-1.5 bg-blue-800 border-none rounded text-xs text-white w-48 focus:ring-2 focus:ring-blue-400 focus:bg-blue-700 transition-all outline-none placeholder:text-blue-400" 
              />
            </div>
            <div className="flex gap-2">
              <button className="px-3 py-1.5 bg-blue-800 text-white rounded text-[10px] font-black uppercase tracking-widest border border-blue-700 hover:bg-blue-700 transition-colors">Lista</button>
              <button className="px-3 py-1.5 bg-blue-700/30 text-white/70 rounded text-[10px] font-black uppercase tracking-widest hover:text-white transition-colors">Calendário</button>
            </div>
            <button className="p-2 hover:bg-blue-800 rounded-full text-blue-200 relative">
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 border-2 border-blue-900 rounded-full"></span>
            </button>
          </div>
        </header>

        {/* Dynamic View Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="min-h-full flex flex-col">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeView + (selectedEventId || '')}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 p-6"
              >
                <div className="max-w-7xl mx-auto h-full">
                  {activeView === 'dashboard' && (
                    <Dashboard 
                      onNavigate={(v) => setActiveView(v)} 
                      onSelectEvent={handleSelectEvent}
                      isAdmin={isAdmin}
                    />
                  )}
                  {activeView === 'schedule' && <ScheduleView onSelectEvent={handleSelectEvent} isAdmin={isAdmin} />}
                  {activeView === 'zones' && <ZoneManagement isAdmin={isAdmin} />}
                  {activeView === 'units' && <ResponsibleUnitsManagement isAdmin={isAdmin} />}
                  {activeView === 'settings' && <SettingsView isAdmin={isAdmin} />}
                  {activeView === 'deadlines' && <DeadlineMonitor isAdmin={isAdmin} onSelectEvent={handleSelectEvent} />}
                  {activeView === 'event-details' && selectedEventId && (
                    <EventDetails 
                      eventId={selectedEventId} 
                      isAdmin={isAdmin}
                      onBack={() => setActiveView('schedule')} 
                    />
                  )}
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Footer */}
            <footer className="h-8 bg-slate-100 border-t border-slate-200 px-6 flex items-center justify-between text-[10px] font-bold text-slate-500 shrink-0 uppercase tracking-widest">
              <div className="flex gap-6">
                <span>Base de Dados: <b className="text-slate-800 font-black">Res_23.750_v2026.csv</b></span>
                <span className="hidden sm:inline">Ultima Atualização: <b className="text-slate-800 font-black">Há 2 minutos</b></span>
              </div>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span> Conexão Ativa</span>
                <span className="text-slate-300">|</span>
                <span>v2.4.0-conformity</span>
              </div>
            </footer>
          </div>
        </div>
      </main>
    </div>
  );
}

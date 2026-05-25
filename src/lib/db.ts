import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  where, 
  updateDoc, 
  deleteDoc, 
  addDoc,
  Timestamp,
  orderBy,
  writeBatch
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { CalendarEvent, Task, Zone, ComplianceRecord, Document, ResponsibleUnit } from '../types';
import { RAW_SCHEDULE_CSV } from './constants';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function seedInitialData() {
  const path = 'events';
  try {
    const eventsSnap = await getDocs(collection(db, path));
    if (!eventsSnap.empty) return; // Already seeded

    console.log('Seeding initial data...');
    const lines = RAW_SCHEDULE_CSV.split('\n');
    let currentMonth = '';
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      // Check if it's a month header (e.g., ABRIL DE 2026,,)
      // Robust detection: ends with ,, and contains ' DE 20'
      if (line.endsWith(',,') && line.toUpperCase().includes(' DE 20')) {
        currentMonth = line.replace(',,', '').replace(/"/g, '').trim();
        continue;
      }

      // Rough CSV parsing
      const parts: string[] = [];
      let currentPart = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
          if (line[i] === '"') inQuotes = !inQuotes;
          else if (line[i] === ',' && !inQuotes) {
              parts.push(currentPart.trim());
              currentPart = '';
          } else {
              currentPart += line[i];
          }
      }
      parts.push(currentPart.trim());

      if (parts.length >= 1 && parts[0]) {
        const dateStr = parts[0].replace(/"/g, '');
        const description = (parts[1] || '').replace(/"/g, '');
        
        // Simple logic to extract a date for sorting/filtering
        const eventDate = parsePortugueseDate(dateStr, currentMonth);

        const eventRef = await addDoc(collection(db, 'events'), {
          date: eventDate,
          title: dateStr,
          description: description || 'Data operacional vinculada ao calendário.',
          month: currentMonth
        });

        // Check for predefined tasks
        if (parts[2]) {
          const tasksStr = parts.slice(2).join(' ').replace(/"/g, '').trim();
          const taskMatches = tasksStr.split(/(?=\d\.)/);
          for (const t of taskMatches) {
            if (t.trim()) {
              await addDoc(collection(db, 'tasks'), {
                eventId: eventRef.id,
                description: t.trim(),
                responsible: t.includes('Ofício-circular') ? 'Corregedoria' : t.includes('ASCOM') ? 'ASCOM' : 'Geral',
                requiresCompliance: t.includes('Zonas') || t.includes('cartórios'),
                status: 'pending'
              });
            }
          }
        }
      }
    }

    // Seed Responsible Units if empty
    const unitsSnap = await getDocs(collection(db, 'responsibleUnits'));
    if (unitsSnap.empty) {
      console.log('Seeding initial responsible units...');
      const initialUnits = [
        { name: 'Corregidoria Regional Eleitoral', acronym: 'Corregedoria', description: 'Atividades correicionais e diretrizes gerais.' },
        { name: 'Zonas Eleitorais', acronym: 'Zona Eleitoral', description: 'Execução local nos cartórios.' },
        { name: 'Assessoria de Comunicação', acronym: 'ASCOM', description: 'Divulgação e imprensa.' },
        { name: 'Diretoria Geral / Outros', acronym: 'Geral', description: 'Demandas diversas.' }
      ];
      for (const unit of initialUnits) {
        await addDoc(collection(db, 'responsibleUnits'), unit);
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

function parsePortugueseDate(dateStr: string, monthYear: string): string {
    const months: Record<string, string> = {
        'janeiro': '01', 'fevereiro': '02', 'março': '03', 'abril': '04', 
        'maio': '05', 'junho': '06', 'julho': '07', 'agosto': '08', 
        'setembro': '09', 'outubro': '10', 'novembro': '11', 'dezembro': '12'
    };
    
    const dayMatch = dateStr.match(/^(\d+)/);
    const monthMatch = dateStr.toLowerCase().match(/(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)/);
    const yearMatch = monthYear.match(/(\d{4})/);
    
    const day = dayMatch ? dayMatch[1].padStart(2, '0') : '01';
    const month = monthMatch ? months[monthMatch[1]] : '01';
    const year = yearMatch ? yearMatch[1] : '2026';
    
    return `${year}-${month}-${day}`;
}

// DB Helpers
export const getEvents = async () => {
    const path = 'events';
    try {
        const q = query(collection(db, path), orderBy('date', 'asc'));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as CalendarEvent));
    } catch (error) {
        handleFirestoreError(error, OperationType.LIST, path);
        return [];
    }
};

export const getTasks = async (eventId?: string) => {
    const path = 'tasks';
    try {
        const snap = await getDocs(collection(db, path));
        const allTasks = snap.docs.map(d => ({ id: d.id, ...d.data() } as Task));
        if (eventId) {
            return allTasks.filter(t => 
                t.eventId === eventId || 
                (t.eventIds && t.eventIds.includes(eventId))
            );
        }
        return allTasks;
    } catch (error) {
        handleFirestoreError(error, OperationType.LIST, path);
        return [];
    }
};

export const getZones = async () => {
    const path = 'zones';
    try {
        const snap = await getDocs(collection(db, path));
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as Zone));
    } catch (error) {
        handleFirestoreError(error, OperationType.LIST, path);
        return [];
    }
};

export const getCompliance = async () => {
    const path = 'compliance';
    try {
        const snap = await getDocs(collection(db, path));
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as ComplianceRecord));
    } catch (error) {
        handleFirestoreError(error, OperationType.LIST, path);
        return [];
    }
};

export const getDocuments = async (relatedId: string) => {
    const path = 'documents';
    try {
        const q = query(collection(db, path), where('relatedId', '==', relatedId));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as Document));
    } catch (error) {
        handleFirestoreError(error, OperationType.LIST, path);
        return [];
    }
};

export const getDocumentsByEvent = async (eventId: string) => {
    const path = 'documents';
    try {
        const q = query(collection(db, path), where('eventId', '==', eventId));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as Document));
    } catch (error) {
        handleFirestoreError(error, OperationType.LIST, path);
        return [];
    }
};

export const createEvent = async (event: Omit<CalendarEvent, 'id'>) => {
    const path = 'events';
    try {
        const eventWithMeta = {
            ...event,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        const ref = await addDoc(collection(db, path), eventWithMeta);
        return { ...eventWithMeta, id: ref.id };
    } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
        throw error;
    }
};

export const updateEvent = async (id: string, event: Partial<CalendarEvent>) => {
    const path = `events/${id}`;
    try {
        const eventWithMeta = {
            ...event,
            updatedAt: new Date().toISOString()
        };
        await updateDoc(doc(db, 'events', id), eventWithMeta);
    } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
    }
};

export const deleteEvent = async (id: string) => {
    const path = `events/${id}`;
    try {
        await deleteDoc(doc(db, 'events', id));
        
        // Delete or unlink related tasks
        const tasks = await getTasks(id);
        for (const t of tasks) {
            const hasMultipleLinks = (t.eventIds && t.eventIds.length > 1);
            if (hasMultipleLinks) {
                const newEventIds = t.eventIds!.filter(eid => eid !== id);
                await updateTask(t.id!, {
                    eventIds: newEventIds,
                    eventId: newEventIds[0] || ''
                });
            } else {
                await deleteDoc(doc(db, 'tasks', t.id!));
            }
        }

        // Delete related documents
        const docs = await getDocumentsByEvent(id);
        for (const d of docs) {
            await deleteDoc(doc(db, 'documents', d.id!));
        }
    } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
    }
};

export const createTask = async (task: Omit<Task, 'id'>) => {
    const path = 'tasks';
    try {
        const taskWithMeta = {
            ...task,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        const ref = await addDoc(collection(db, path), taskWithMeta);
        return { ...taskWithMeta, id: ref.id };
    } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
        throw error;
    }
};

export const updateTask = async (id: string, task: Partial<Task>) => {
    const path = `tasks/${id}`;
    try {
        const taskWithMeta = {
            ...task,
            updatedAt: new Date().toISOString()
        };
        await updateDoc(doc(db, 'tasks', id), taskWithMeta);
    } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
    }
};

export const deleteTask = async (id: string) => {
    const path = `tasks/${id}`;
    try {
        await deleteDoc(doc(db, 'tasks', id));
        
        // Delete related documents
        const docs = await getDocuments(id);
        for (const d of docs) {
            await deleteDoc(doc(db, 'documents', d.id!));
        }
    } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
    }
};

export const deleteDocument = async (id: string) => {
    const path = `documents/${id}`;
    try {
        await deleteDoc(doc(db, 'documents', id));
    } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
    }
};

export const getResponsibleUnits = async () => {
    const path = 'responsibleUnits';
    try {
        const snap = await getDocs(collection(db, path));
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as ResponsibleUnit));
    } catch (error) {
        handleFirestoreError(error, OperationType.LIST, path);
        return [];
    }
};

export const createResponsibleUnit = async (unit: Omit<ResponsibleUnit, 'id'>) => {
    const path = 'responsibleUnits';
    try {
        const ref = await addDoc(collection(db, path), unit);
        return { ...unit, id: ref.id };
    } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
        throw error;
    }
};

export const updateResponsibleUnit = async (id: string, unit: Partial<ResponsibleUnit>) => {
    const path = `responsibleUnits/${id}`;
    try {
        await updateDoc(doc(db, 'responsibleUnits', id), unit);
    } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
    }
};

export const deleteResponsibleUnit = async (id: string) => {
    const path = `responsibleUnits/${id}`;
    try {
        await deleteDoc(doc(db, 'responsibleUnits', id));
    } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
    }
};

export const deleteZone = async (id: string) => {
    const path = `zones/${id}`;
    try {
        await deleteDoc(doc(db, 'zones', id));
    } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
    }
};

export const exportFullBackup = async () => {
    const collections = ['events', 'tasks', 'zones', 'compliance', 'documents', 'responsibleUnits'];
    const backup: any = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        exportedBy: auth.currentUser?.email,
        data: {}
    };

    for (const colName of collections) {
        const snap = await getDocs(collection(db, colName));
        backup.data[colName] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    
    return backup;
};

export const restoreFullBackup = async (backupData: any) => {
    if (!backupData || !backupData.data) throw new Error('Formato de backup inválido.');

    const collections = ['events', 'tasks', 'zones', 'compliance', 'documents', 'responsibleUnits'];
    
    // 1. Clear existing data
    for (const colName of collections) {
        const snap = await getDocs(collection(db, colName));
        const batchSize = 500;
        const docs = snap.docs;
        
        for (let i = 0; i < docs.length; i += batchSize) {
            const batch = writeBatch(db);
            const chunk = docs.slice(i, i + batchSize);
            chunk.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        }
    }

    // 2. Import new data
    for (const colName of collections) {
        const items = backupData.data[colName] || [];
        const batchSize = 500;

        for (let i = 0; i < items.length; i += batchSize) {
            const batch = writeBatch(db);
            const chunk = items.slice(i, i + batchSize);
            chunk.forEach((item: any) => {
                const { id, ...rest } = item;
                const docRef = doc(db, colName, id);
                batch.set(docRef, rest);
            });
            await batch.commit();
        }
    }
};

export const repairDataInvariants = async () => {
    const path = 'events';
    try {
        const snap = await getDocs(collection(db, path));
        const batch = writeBatch(db);
        let count = 0;

        for (const d of snap.docs) {
            const data = d.data() as CalendarEvent;
            let needsUpdate = false;
            const update: any = {};

            // Fix corrupted months
            const monthLower = (data.month || '').toLowerCase();
            const monthIsCorrupted = /^\d/.test(data.month || '') || 
                                   ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'].some(day => monthLower.includes(day));
            
            if (monthIsCorrupted || !data.month) {
                const eventDate = new Date(data.date + 'T00:00:00');
                const months = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
                const correctMonth = `${months[eventDate.getMonth()]} DE ${eventDate.getFullYear()}`;
                update.month = correctMonth;
                needsUpdate = true;
            }

            // Fix corrupted titles (if title is identical to another date format or corrupted)
            const titleLower = (data.title || '').toLowerCase();
            const titleIsCorrupted = titleLower.includes('domingo') || titleLower.includes('segunda') || titleLower.includes('terça') || titleLower.includes('quarta');
            
            if (titleIsCorrupted && data.date) {
                const eventDate = new Date(data.date + 'T00:00:00');
                const days = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
                const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
                const correctTitle = `${eventDate.getDate()} de ${months[eventDate.getMonth()]}, ${days[eventDate.getDay()]}`;
                update.title = correctTitle;
                needsUpdate = true;
            }

            if (needsUpdate) {
                batch.update(d.ref, update);
                count++;
            }
        }

        if (count > 0) {
            await batch.commit();
        }
        return count;
    } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
        return 0;
    }
};

export const clearAllZones = async () => {
    const path = 'zones';
    try {
        const snap = await getDocs(collection(db, path));
        const batch = writeBatch(db);
        snap.docs.forEach(d => {
            batch.delete(d.ref);
        });
        await batch.commit();
    } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
    }
};

export const getAdmins = async () => {
    const path = 'admins';
    try {
        const snap = await getDocs(collection(db, path));
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as { id: string, email: string }));
    } catch (error) {
        handleFirestoreError(error, OperationType.LIST, path);
        return [];
    }
};

export const addAdmin = async (email: string) => {
    const path = 'admins';
    try {
        const emailLower = email.toLowerCase();
        await setDoc(doc(db, path, emailLower), { 
            email: emailLower, 
            createdAt: new Date().toISOString() 
        });
    } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
    }
};

export const removeAdmin = async (id: string) => {
    const path = `admins/${id}`;
    try {
        await deleteDoc(doc(db, 'admins', id));
    } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
    }
};

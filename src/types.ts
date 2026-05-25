export interface CalendarEvent {
  id?: string;
  date: string;
  title: string;
  description: string;
  month: string;
  supervisorUnit?: string;
  isControlPoint?: boolean;
}

export interface Task {
  id?: string;
  eventId: string;
  eventIds?: string[]; // Multiple linked events
  description: string;
  responsible: string;
  requiresCompliance: boolean;
  status: 'pending' | 'completed';
  deadline?: string; // Internal deadline for this specific task
}

export interface ResponsibleUnit {
  id?: string;
  name: string;
  acronym: string;
  description?: string;
}

export interface Zone {
  id: string; // Zone number
  municipality: string;
}

export interface ComplianceRecord {
  id?: string; // usually zoneId_taskId
  zoneId: string;
  taskId: string;
  status: 'pending' | 'completed';
  updatedAt: string;
  evidenceUrl?: string;
  notes?: string;
}

export interface Document {
  id?: string;
  relatedId: string;
  eventId?: string;
  name: string;
  url: string;
  type: 'file' | 'link';
  uploadedAt: string;
}

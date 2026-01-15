export type LeadStatus = 'nuevo' | 'contactado' | 'interesado' | 'cliente';
export type LeadSegment = 'franquicia' | 'pyme';
export type LeadSource = 'google_maps' | 'web_scraping' | 'referido' | 'manual';

export interface Lead {
  id: string;
  companyName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  city: string;
  status: LeadStatus;
  segment: LeadSegment;
  source: LeadSource;
  equipmentCount?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  lastContactedAt?: Date;
  tags?: string[];
  score?: number;
  emailUnsubscribed?: boolean;
}

export interface LeadActivity {
  id: string;
  leadId: string;
  type: 'nota' | 'email' | 'llamada' | 'whatsapp' | 'reunion' | 'visita' | 'estado' | 'creado';
  description: string;
  createdAt: Date;
  createdBy?: string;
}

export interface DashboardStats {
  totalLeads: number;
  newLeads: number;
  contactedLeads: number;
  interestedLeads: number;
  clients: number;
  thisWeekLeads: number;
  conversionRate: number;
}

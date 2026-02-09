export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          session_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          session_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ai_chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chat_sessions: {
        Row: {
          created_at: string
          id: string
          model: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          model?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          model?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      budget_notifications: {
        Row: {
          created_at: string
          id: string
          invoice_url: string | null
          message: string
          metadata: Json | null
          read: boolean
          request_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_url?: string | null
          message: string
          metadata?: Json | null
          read?: boolean
          request_id?: string | null
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invoice_url?: string | null
          message?: string
          metadata?: Json | null
          read?: boolean
          request_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      budget_requests: {
        Row: {
          created_at: string
          email_empresa: string | null
          emails: Json
          emails_preview: Json | null
          id: string
          products: Json
          prompt: string
          request_id: string | null
          response_data: Json | null
          solicitud_original: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_empresa?: string | null
          emails?: Json
          emails_preview?: Json | null
          id?: string
          products?: Json
          prompt: string
          request_id?: string | null
          response_data?: Json | null
          solicitud_original?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_empresa?: string | null
          emails?: Json
          emails_preview?: Json | null
          id?: string
          products?: Json
          prompt?: string
          request_id?: string | null
          response_data?: Json | null
          solicitud_original?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      budgets_received: {
        Row: {
          created_at: string
          email_original: string | null
          email_proveedor: string
          estado: string | null
          fecha_recepcion: string | null
          id: string
          invoice_id: string | null
          metadata: Json | null
          observaciones: string | null
          productos: Json
          proveedor: string
          request_id: string
          selected: boolean
          stel_budget_id: string | null
          total: number | null
          user_responsible: string
          validez: string | null
        }
        Insert: {
          created_at?: string
          email_original?: string | null
          email_proveedor: string
          estado?: string | null
          fecha_recepcion?: string | null
          id?: string
          invoice_id?: string | null
          metadata?: Json | null
          observaciones?: string | null
          productos?: Json
          proveedor: string
          request_id: string
          selected?: boolean
          stel_budget_id?: string | null
          total?: number | null
          user_responsible: string
          validez?: string | null
        }
        Update: {
          created_at?: string
          email_original?: string | null
          email_proveedor?: string
          estado?: string | null
          fecha_recepcion?: string | null
          id?: string
          invoice_id?: string | null
          metadata?: Json | null
          observaciones?: string | null
          productos?: Json
          proveedor?: string
          request_id?: string
          selected?: boolean
          stel_budget_id?: string | null
          total?: number | null
          user_responsible?: string
          validez?: string | null
        }
        Relationships: []
      }
      campaign_emails: {
        Row: {
          campaign_id: string
          created_at: string
          error_message: string | null
          id: string
          lead_id: string
          opened_at: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          lead_id: string
          opened_at?: string | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          lead_id?: string
          opened_at?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_emails_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_emails_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          is_admin: boolean
          joined_at: string
          last_read_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          is_admin?: boolean
          joined_at?: string
          last_read_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          is_admin?: boolean
          joined_at?: string
          last_read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "internal_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          created_at: string
          id: string
          name: string
          scheduled_at: string | null
          sent_at: string | null
          status: string
          template_id: string | null
          total_opened: number | null
          total_recipients: number | null
          total_sent: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          template_id?: string | null
          total_opened?: number | null
          total_recipients?: number | null
          total_sent?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          template_id?: string | null
          total_opened?: number | null
          total_recipients?: number | null
          total_sent?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body: string
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          subject: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          subject: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          subject?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      follow_up_reminders: {
        Row: {
          created_at: string
          id: string
          is_completed: boolean
          lead_id: string
          message: string | null
          reminder_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_completed?: boolean
          lead_id: string
          message?: string | null
          reminder_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_completed?: boolean
          lead_id?: string
          message?: string | null
          reminder_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_reminders_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      general_reminders: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          is_completed: boolean
          priority: string
          reminder_date: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_completed?: boolean
          priority?: string
          reminder_date: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_completed?: boolean
          priority?: string
          reminder_date?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      google_sheets_configs: {
        Row: {
          auto_sync_enabled: boolean
          auto_sync_interval: number
          created_at: string
          custom_columns: Json | null
          id: string
          last_sync_at: string | null
          name: string
          sheet_name: string
          spreadsheet_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_sync_enabled?: boolean
          auto_sync_interval?: number
          created_at?: string
          custom_columns?: Json | null
          id?: string
          last_sync_at?: string | null
          name: string
          sheet_name?: string
          spreadsheet_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_sync_enabled?: boolean
          auto_sync_interval?: number
          created_at?: string
          custom_columns?: Json | null
          id?: string
          last_sync_at?: string | null
          name?: string
          sheet_name?: string
          spreadsheet_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      internal_conversations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_group: boolean
          name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_group?: boolean
          name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_group?: boolean
          name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      internal_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          file_name: string | null
          file_size: number | null
          file_url: string | null
          id: string
          is_deleted: boolean
          is_edited: boolean
          message_type: string
          reply_to_id: string | null
          sender_id: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          is_deleted?: boolean
          is_edited?: boolean
          message_type?: string
          reply_to_id?: string | null
          sender_id: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          is_deleted?: boolean
          is_edited?: boolean
          message_type?: string
          reply_to_id?: string | null
          sender_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "internal_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "internal_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_activities: {
        Row: {
          created_at: string
          description: string
          id: string
          lead_id: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          lead_id: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          lead_id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_folders: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          address: string | null
          city: string
          company_name: string
          contact_name: string | null
          created_at: string
          email: string | null
          email_unsubscribed: boolean | null
          equipment_count: number | null
          folder_id: string | null
          id: string
          last_contacted_at: string | null
          latitude: number | null
          longitude: number | null
          mobile_phone: string | null
          notes: string | null
          phone: string | null
          phone_type: string | null
          score: number | null
          segment: string
          source: string
          status: string
          tags: string[] | null
          updated_at: string
          user_id: string
          website: string | null
          whatsapp_sent_count: number
          whatsapp_verified: boolean | null
        }
        Insert: {
          address?: string | null
          city?: string
          company_name: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          email_unsubscribed?: boolean | null
          equipment_count?: number | null
          folder_id?: string | null
          id?: string
          last_contacted_at?: string | null
          latitude?: number | null
          longitude?: number | null
          mobile_phone?: string | null
          notes?: string | null
          phone?: string | null
          phone_type?: string | null
          score?: number | null
          segment?: string
          source?: string
          status?: string
          tags?: string[] | null
          updated_at?: string
          user_id: string
          website?: string | null
          whatsapp_sent_count?: number
          whatsapp_verified?: boolean | null
        }
        Update: {
          address?: string | null
          city?: string
          company_name?: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          email_unsubscribed?: boolean | null
          equipment_count?: number | null
          folder_id?: string | null
          id?: string
          last_contacted_at?: string | null
          latitude?: number | null
          longitude?: number | null
          mobile_phone?: string | null
          notes?: string | null
          phone?: string | null
          phone_type?: string | null
          score?: number | null
          segment?: string
          source?: string
          status?: string
          tags?: string[] | null
          updated_at?: string
          user_id?: string
          website?: string | null
          whatsapp_sent_count?: number
          whatsapp_verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "lead_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          category: string | null
          content: string
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          email_campaign_reports: boolean
          email_lead_updates: boolean
          email_reminder_notifications: boolean
          email_security_alerts: boolean
          email_weekly_summary: boolean
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_campaign_reports?: boolean
          email_lead_updates?: boolean
          email_reminder_notifications?: boolean
          email_security_alerts?: boolean
          email_weekly_summary?: boolean
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_campaign_reports?: boolean
          email_lead_updates?: boolean
          email_reminder_notifications?: boolean
          email_security_alerts?: boolean
          email_weekly_summary?: boolean
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      osticket_config: {
        Row: {
          api_key: string
          created_at: string
          id: string
          is_enabled: boolean
          message_template: string
          notification_numbers: string[]
          osticket_url: string
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key?: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          message_template?: string
          notification_numbers?: string[]
          osticket_url?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          message_template?: string
          notification_numbers?: string[]
          osticket_url?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      osticket_tickets: {
        Row: {
          created_at: string
          customer_email: string | null
          customer_name: string | null
          department: string | null
          id: string
          message: string | null
          notification_phone: string | null
          notification_sent: boolean
          priority: string | null
          subject: string
          ticket_id: string | null
          ticket_number: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          department?: string | null
          id?: string
          message?: string | null
          notification_phone?: string | null
          notification_sent?: boolean
          priority?: string | null
          subject: string
          ticket_id?: string | null
          ticket_number?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          department?: string | null
          id?: string
          message?: string | null
          notification_phone?: string | null
          notification_sent?: boolean
          priority?: string | null
          subject?: string
          ticket_id?: string | null
          ticket_number?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          role: string | null
          theme_preference: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          role?: string | null
          theme_preference?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          role?: string | null
          theme_preference?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      providers: {
        Row: {
          activo: boolean | null
          created_at: string | null
          email: string
          especialidad: string[] | null
          id: string
          metadata: Json | null
          nombre: string
          notas: string | null
          telefono: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          activo?: boolean | null
          created_at?: string | null
          email: string
          especialidad?: string[] | null
          id?: string
          metadata?: Json | null
          nombre: string
          notas?: string | null
          telefono?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          activo?: boolean | null
          created_at?: string | null
          email?: string
          especialidad?: string[] | null
          id?: string
          metadata?: Json | null
          nombre?: string
          notas?: string | null
          telefono?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      seo_articles: {
        Row: {
          created_at: string
          error_details: Json | null
          error_message: string | null
          html_content: string | null
          id: string
          image_count: number | null
          images: Json | null
          images_failed_count: number | null
          images_success_count: number | null
          keywords: Json | null
          meta_description: string | null
          meta_tags: Json | null
          optimizations: Json | null
          research_summary: string | null
          security_score: number | null
          seo_score: number | null
          slug: string | null
          status: string
          structured_data: Json | null
          suggested_links: Json | null
          title: string | null
          topic: string
          updated_at: string
          user_id: string
          word_count: number | null
          workflow_id: string | null
        }
        Insert: {
          created_at?: string
          error_details?: Json | null
          error_message?: string | null
          html_content?: string | null
          id?: string
          image_count?: number | null
          images?: Json | null
          images_failed_count?: number | null
          images_success_count?: number | null
          keywords?: Json | null
          meta_description?: string | null
          meta_tags?: Json | null
          optimizations?: Json | null
          research_summary?: string | null
          security_score?: number | null
          seo_score?: number | null
          slug?: string | null
          status?: string
          structured_data?: Json | null
          suggested_links?: Json | null
          title?: string | null
          topic: string
          updated_at?: string
          user_id: string
          word_count?: number | null
          workflow_id?: string | null
        }
        Update: {
          created_at?: string
          error_details?: Json | null
          error_message?: string | null
          html_content?: string | null
          id?: string
          image_count?: number | null
          images?: Json | null
          images_failed_count?: number | null
          images_success_count?: number | null
          keywords?: Json | null
          meta_description?: string | null
          meta_tags?: Json | null
          optimizations?: Json | null
          research_summary?: string | null
          security_score?: number | null
          seo_score?: number | null
          slug?: string | null
          status?: string
          structured_data?: Json | null
          suggested_links?: Json | null
          title?: string | null
          topic?: string
          updated_at?: string
          user_id?: string
          word_count?: number | null
          workflow_id?: string | null
        }
        Relationships: []
      }
      shared_files: {
        Row: {
          created_at: string | null
          description: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string | null
          folder_id: string | null
          folder_path: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type?: string | null
          folder_id?: string | null
          folder_path?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string | null
          folder_id?: string | null
          folder_path?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_files_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "shared_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_folders: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          name: string
          parent_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
          parent_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "shared_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      waha_messages: {
        Row: {
          ack_status: string | null
          chat_id: string
          content: string
          created_at: string
          from_me: boolean
          id: string
          is_edited: boolean | null
          is_revoked: boolean | null
          lead_id: string | null
          media_url: string | null
          message_id: string | null
          message_type: string | null
          reaction: string | null
          reply_to_id: string | null
          timestamp: string
          user_id: string
        }
        Insert: {
          ack_status?: string | null
          chat_id: string
          content: string
          created_at?: string
          from_me?: boolean
          id?: string
          is_edited?: boolean | null
          is_revoked?: boolean | null
          lead_id?: string | null
          media_url?: string | null
          message_id?: string | null
          message_type?: string | null
          reaction?: string | null
          reply_to_id?: string | null
          timestamp?: string
          user_id: string
        }
        Update: {
          ack_status?: string | null
          chat_id?: string
          content?: string
          created_at?: string
          from_me?: boolean
          id?: string
          is_edited?: boolean | null
          is_revoked?: boolean | null
          lead_id?: string | null
          media_url?: string | null
          message_id?: string | null
          message_type?: string | null
          reaction?: string | null
          reply_to_id?: string | null
          timestamp?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waha_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_chat_folders: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_chats: {
        Row: {
          avatar_url: string | null
          chat_id: string
          created_at: string
          custom_name: string | null
          folder_id: string | null
          id: string
          is_archived: boolean | null
          last_message_at: string | null
          phone: string
          unread_count: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          chat_id: string
          created_at?: string
          custom_name?: string | null
          folder_id?: string | null
          id?: string
          is_archived?: boolean | null
          last_message_at?: string | null
          phone: string
          unread_count?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          chat_id?: string
          created_at?: string
          custom_name?: string | null
          folder_id?: string | null
          id?: string
          is_archived?: boolean | null
          last_message_at?: string | null
          phone?: string
          unread_count?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_chats_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_chat_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_logs: {
        Row: {
          created_at: string
          error_details: string | null
          id: string
          level: string
          message: string
          metadata: Json | null
          node_error: string | null
          request_id: string | null
        }
        Insert: {
          created_at?: string
          error_details?: string | null
          id?: string
          level?: string
          message: string
          metadata?: Json | null
          node_error?: string | null
          request_id?: string | null
        }
        Update: {
          created_at?: string
          error_details?: string | null
          id?: string
          level?: string
          message?: string
          metadata?: Json | null
          node_error?: string | null
          request_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_lead_score: { Args: { p_lead_id: string }; Returns: number }
      get_user_email: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_conversation_participant: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const

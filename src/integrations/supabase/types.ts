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
      achievements: {
        Row: {
          achievement_type: string
          achievement_value: number | null
          date_earned: string
          id: string
          user_id: string
        }
        Insert: {
          achievement_type: string
          achievement_value?: number | null
          date_earned?: string
          id?: string
          user_id: string
        }
        Update: {
          achievement_type?: string
          achievement_value?: number | null
          date_earned?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      action_plan_steps: {
        Row: {
          author_id: string
          author_name: string | null
          created_at: string
          id: string
          note: string
          plan_id: string
          progress_change: number | null
          status_change:
            | Database["public"]["Enums"]["action_plan_status"]
            | null
        }
        Insert: {
          author_id: string
          author_name?: string | null
          created_at?: string
          id?: string
          note: string
          plan_id: string
          progress_change?: number | null
          status_change?:
            | Database["public"]["Enums"]["action_plan_status"]
            | null
        }
        Update: {
          author_id?: string
          author_name?: string | null
          created_at?: string
          id?: string
          note?: string
          plan_id?: string
          progress_change?: number | null
          status_change?:
            | Database["public"]["Enums"]["action_plan_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "action_plan_steps_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "action_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      action_plan_tutors: {
        Row: {
          created_at: string
          id: string
          is_mentor: boolean | null
          language: string | null
          mentor_name: string | null
          team_leader: string
          tutor_external_id: string | null
          tutor_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_mentor?: boolean | null
          language?: string | null
          mentor_name?: string | null
          team_leader: string
          tutor_external_id?: string | null
          tutor_name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_mentor?: boolean | null
          language?: string | null
          mentor_name?: string | null
          team_leader?: string
          tutor_external_id?: string | null
          tutor_name?: string
        }
        Relationships: []
      }
      action_plans: {
        Row: {
          category: Database["public"]["Enums"]["action_plan_category"]
          created_at: string
          created_by: string
          due_date: string
          evaluation:
            | Database["public"]["Enums"]["action_plan_evaluation"]
            | null
          evaluation_notes: string | null
          id: string
          progress: number
          quality_baseline_score: number | null
          quality_month1_score: number | null
          quality_month2_score: number | null
          quality_month3_score: number | null
          resolved_at: string | null
          start_date: string
          status: Database["public"]["Enums"]["action_plan_status"]
          summary: string | null
          team_leader: string
          tutor_external_id: string | null
          tutor_name: string
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["action_plan_category"]
          created_at?: string
          created_by: string
          due_date?: string
          evaluation?:
            | Database["public"]["Enums"]["action_plan_evaluation"]
            | null
          evaluation_notes?: string | null
          id?: string
          progress?: number
          quality_baseline_score?: number | null
          quality_month1_score?: number | null
          quality_month2_score?: number | null
          quality_month3_score?: number | null
          resolved_at?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["action_plan_status"]
          summary?: string | null
          team_leader: string
          tutor_external_id?: string | null
          tutor_name: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["action_plan_category"]
          created_at?: string
          created_by?: string
          due_date?: string
          evaluation?:
            | Database["public"]["Enums"]["action_plan_evaluation"]
            | null
          evaluation_notes?: string | null
          id?: string
          progress?: number
          quality_baseline_score?: number | null
          quality_month1_score?: number | null
          quality_month2_score?: number | null
          quality_month3_score?: number | null
          resolved_at?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["action_plan_status"]
          summary?: string | null
          team_leader?: string
          tutor_external_id?: string | null
          tutor_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          audience: Database["public"]["Enums"]["announcement_audience"]
          created_at: string
          created_by: string | null
          date: string
          description: string
          id: string
          priority: Database["public"]["Enums"]["announcement_priority"]
          status: Database["public"]["Enums"]["announcement_status"]
          title: string
          updated_at: string
        }
        Insert: {
          audience?: Database["public"]["Enums"]["announcement_audience"]
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string
          id?: string
          priority?: Database["public"]["Enums"]["announcement_priority"]
          status?: Database["public"]["Enums"]["announcement_status"]
          title: string
          updated_at?: string
        }
        Update: {
          audience?: Database["public"]["Enums"]["announcement_audience"]
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string
          id?: string
          priority?: Database["public"]["Enums"]["announcement_priority"]
          status?: Database["public"]["Enums"]["announcement_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: string | null
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Relationships: []
      }
      cs_ticket_audit: {
        Row: {
          changed_by: string | null
          changed_by_name: string | null
          created_at: string
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
          ticket_id: string
          ticket_number: string
        }
        Insert: {
          changed_by?: string | null
          changed_by_name?: string | null
          created_at?: string
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          ticket_id: string
          ticket_number: string
        }
        Update: {
          changed_by?: string | null
          changed_by_name?: string | null
          created_at?: string
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          ticket_id?: string
          ticket_number?: string
        }
        Relationships: []
      }
      cs_ticket_categories: {
        Row: {
          case_type: Database["public"]["Enums"]["cs_ticket_case_type"]
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          case_type: Database["public"]["Enums"]["cs_ticket_case_type"]
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          case_type?: Database["public"]["Enums"]["cs_ticket_case_type"]
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      cs_tickets: {
        Row: {
          case_details: string | null
          case_type: Database["public"]["Enums"]["cs_ticket_case_type"]
          case_types: Database["public"]["Enums"]["cs_ticket_case_type"][]
          category: string
          created_at: string
          created_by: string | null
          cs_category: string | null
          edu_category: string | null
          id: string
          need_response_deadline: string | null
          session_num_or_date: string | null
          status: Database["public"]["Enums"]["cs_ticket_status"]
          student_id: string | null
          team_leader: string
          team_leader_response: string | null
          ticket_date: string
          ticket_number: string
          tutor_external_id: string
          tutor_name: string
          updated_at: string
        }
        Insert: {
          case_details?: string | null
          case_type: Database["public"]["Enums"]["cs_ticket_case_type"]
          case_types?: Database["public"]["Enums"]["cs_ticket_case_type"][]
          category: string
          created_at?: string
          created_by?: string | null
          cs_category?: string | null
          edu_category?: string | null
          id?: string
          need_response_deadline?: string | null
          session_num_or_date?: string | null
          status?: Database["public"]["Enums"]["cs_ticket_status"]
          student_id?: string | null
          team_leader: string
          team_leader_response?: string | null
          ticket_date?: string
          ticket_number: string
          tutor_external_id: string
          tutor_name: string
          updated_at?: string
        }
        Update: {
          case_details?: string | null
          case_type?: Database["public"]["Enums"]["cs_ticket_case_type"]
          case_types?: Database["public"]["Enums"]["cs_ticket_case_type"][]
          category?: string
          created_at?: string
          created_by?: string | null
          cs_category?: string | null
          edu_category?: string | null
          id?: string
          need_response_deadline?: string | null
          session_num_or_date?: string | null
          status?: Database["public"]["Enums"]["cs_ticket_status"]
          student_id?: string | null
          team_leader?: string
          team_leader_response?: string | null
          ticket_date?: string
          ticket_number?: string
          tutor_external_id?: string
          tutor_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      edu_descriptions: {
        Row: {
          color: string
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          name: string
          type: Database["public"]["Enums"]["edu_description_type"]
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          type?: Database["public"]["Enums"]["edu_description_type"]
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          type?: Database["public"]["Enums"]["edu_description_type"]
          updated_at?: string
        }
        Relationships: []
      }
      engagement_uploads: {
        Row: {
          availability_type: string | null
          created_at: string
          id: string
          is_mentor: boolean | null
          month: string
          rating: number | null
          sessions_with_feedback: number | null
          team_leader: string
          total_sessions: number | null
          tutor_external_id: string | null
          tutor_language: string | null
          tutor_name: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          availability_type?: string | null
          created_at?: string
          id?: string
          is_mentor?: boolean | null
          month: string
          rating?: number | null
          sessions_with_feedback?: number | null
          team_leader: string
          total_sessions?: number | null
          tutor_external_id?: string | null
          tutor_language?: string | null
          tutor_name: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          availability_type?: string | null
          created_at?: string
          id?: string
          is_mentor?: boolean | null
          month?: string
          rating?: number | null
          sessions_with_feedback?: number | null
          team_leader?: string
          total_sessions?: number | null
          tutor_external_id?: string | null
          tutor_language?: string | null
          tutor_name?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      feature_controls: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          enabled_admin: boolean
          enabled_community_moderator: boolean
          enabled_mentor: boolean
          enabled_super_team_leader: boolean
          enabled_team_leader: boolean
          feature_key: string
          id: string
          name: string
          route_path: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          enabled_admin?: boolean
          enabled_community_moderator?: boolean
          enabled_mentor?: boolean
          enabled_super_team_leader?: boolean
          enabled_team_leader?: boolean
          feature_key: string
          id?: string
          name: string
          route_path?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          enabled_admin?: boolean
          enabled_community_moderator?: boolean
          enabled_mentor?: boolean
          enabled_super_team_leader?: boolean
          enabled_team_leader?: boolean
          feature_key?: string
          id?: string
          name?: string
          route_path?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      feature_plans: {
        Row: {
          assigned_to: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          module: Database["public"]["Enums"]["feature_module"]
          name: string
          progress: number
          status: Database["public"]["Enums"]["feature_plan_status"]
          target_release: string
          updated_at: string
          visibility: Database["public"]["Enums"]["feature_plan_visibility"]
        }
        Insert: {
          assigned_to?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          module?: Database["public"]["Enums"]["feature_module"]
          name: string
          progress?: number
          status?: Database["public"]["Enums"]["feature_plan_status"]
          target_release?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["feature_plan_visibility"]
        }
        Update: {
          assigned_to?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          module?: Database["public"]["Enums"]["feature_module"]
          name?: string
          progress?: number
          status?: Database["public"]["Enums"]["feature_plan_status"]
          target_release?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["feature_plan_visibility"]
        }
        Relationships: []
      }
      goals: {
        Row: {
          created_at: string
          current_value: number | null
          deadline: string | null
          goal_type: string
          id: string
          status: string | null
          target_value: number
          user_id: string
        }
        Insert: {
          created_at?: string
          current_value?: number | null
          deadline?: string | null
          goal_type: string
          id?: string
          status?: string | null
          target_value: number
          user_id: string
        }
        Update: {
          created_at?: string
          current_value?: number | null
          deadline?: string | null
          goal_type?: string
          id?: string
          status?: string | null
          target_value?: number
          user_id?: string
        }
        Relationships: []
      }
      live_issues_sheet_config: {
        Row: {
          created_at: string
          csv_url: string | null
          id: string
          last_sync_message: string | null
          last_sync_rows: number | null
          last_sync_status: string | null
          last_synced_at: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          csv_url?: string | null
          id?: string
          last_sync_message?: string | null
          last_sync_rows?: number | null
          last_sync_status?: string | null
          last_synced_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          csv_url?: string | null
          id?: string
          last_sync_message?: string | null
          last_sync_rows?: number | null
          last_sync_status?: string | null
          last_synced_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      live_session_issue_audit: {
        Row: {
          case_id: string
          changed_by: string | null
          changed_by_name: string | null
          created_at: string
          field_name: string
          id: string
          issue_id: string
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          case_id: string
          changed_by?: string | null
          changed_by_name?: string | null
          created_at?: string
          field_name: string
          id?: string
          issue_id: string
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          case_id?: string
          changed_by?: string | null
          changed_by_name?: string | null
          created_at?: string
          field_name?: string
          id?: string
          issue_id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_session_issue_audit_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "live_session_issues"
            referencedColumns: ["id"]
          },
        ]
      }
      live_session_issues: {
        Row: {
          action_status: string | null
          case_id: string
          class_type: string | null
          created_at: string
          day_of_week: string | null
          edu_description_id: string | null
          edu_notes: string | null
          edu_validation:
            | Database["public"]["Enums"]["edu_validation_status"]
            | null
          extra_action: string | null
          from_tutor_id: string | null
          from_tutor_name: string | null
          from_tutor_type: string | null
          group_type: string | null
          id: string
          issue_details: string | null
          issue_reason: string | null
          issue_time: string | null
          language: string | null
          last_synced_at: string
          moderation_deduction: string | null
          moderator_decision: string | null
          moderator_name: string | null
          month: string | null
          raw: Json
          session_date: string | null
          session_id: string | null
          severity: string | null
          source_of_issue: string | null
          student_id: string | null
          team_leader: string | null
          time_slot: string | null
          to_tutor_id: string | null
          to_tutor_name: string | null
          to_tutor_type: string | null
          updated_at: string
          updated_by: string | null
          year: string | null
        }
        Insert: {
          action_status?: string | null
          case_id: string
          class_type?: string | null
          created_at?: string
          day_of_week?: string | null
          edu_description_id?: string | null
          edu_notes?: string | null
          edu_validation?:
            | Database["public"]["Enums"]["edu_validation_status"]
            | null
          extra_action?: string | null
          from_tutor_id?: string | null
          from_tutor_name?: string | null
          from_tutor_type?: string | null
          group_type?: string | null
          id?: string
          issue_details?: string | null
          issue_reason?: string | null
          issue_time?: string | null
          language?: string | null
          last_synced_at?: string
          moderation_deduction?: string | null
          moderator_decision?: string | null
          moderator_name?: string | null
          month?: string | null
          raw?: Json
          session_date?: string | null
          session_id?: string | null
          severity?: string | null
          source_of_issue?: string | null
          student_id?: string | null
          team_leader?: string | null
          time_slot?: string | null
          to_tutor_id?: string | null
          to_tutor_name?: string | null
          to_tutor_type?: string | null
          updated_at?: string
          updated_by?: string | null
          year?: string | null
        }
        Update: {
          action_status?: string | null
          case_id?: string
          class_type?: string | null
          created_at?: string
          day_of_week?: string | null
          edu_description_id?: string | null
          edu_notes?: string | null
          edu_validation?:
            | Database["public"]["Enums"]["edu_validation_status"]
            | null
          extra_action?: string | null
          from_tutor_id?: string | null
          from_tutor_name?: string | null
          from_tutor_type?: string | null
          group_type?: string | null
          id?: string
          issue_details?: string | null
          issue_reason?: string | null
          issue_time?: string | null
          language?: string | null
          last_synced_at?: string
          moderation_deduction?: string | null
          moderator_decision?: string | null
          moderator_name?: string | null
          month?: string | null
          raw?: Json
          session_date?: string | null
          session_id?: string | null
          severity?: string | null
          source_of_issue?: string | null
          student_id?: string | null
          team_leader?: string | null
          time_slot?: string | null
          to_tutor_id?: string | null
          to_tutor_name?: string | null
          to_tutor_type?: string | null
          updated_at?: string
          updated_by?: string | null
          year?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_session_issues_edu_description_id_fkey"
            columns: ["edu_description_id"]
            isOneToOne: false
            referencedRelation: "edu_descriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      login_tokens: {
        Row: {
          created_at: string
          created_by: string
          id: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          token?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string
          read_status: boolean | null
          related_task_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message: string
          read_status?: boolean | null
          related_task_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          read_status?: boolean | null
          related_task_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_related_task_id_fkey"
            columns: ["related_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      official_holidays: {
        Row: {
          created_at: string
          created_by: string | null
          holiday_date: string
          id: string
          label: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          holiday_date: string
          id?: string
          label?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          holiday_date?: string
          id?: string
          label?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active_status: boolean | null
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          last_login: string | null
          locked_until: string | null
          login_attempts: number | null
          mentor_id: string
          mentor_name: string
          team_leader: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active_status?: boolean | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          last_login?: string | null
          locked_until?: string | null
          login_attempts?: number | null
          mentor_id: string
          mentor_name: string
          team_leader: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active_status?: boolean | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          last_login?: string | null
          locked_until?: string | null
          login_attempts?: number | null
          mentor_id?: string
          mentor_name?: string
          team_leader?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quality_uploads: {
        Row: {
          agent_name: string
          created_at: string
          id: string
          scope: string
          score: number
          session_date: string | null
          team_leader: string
          tutor_id: string | null
          uploaded_by: string
        }
        Insert: {
          agent_name: string
          created_at?: string
          id?: string
          scope?: string
          score: number
          session_date?: string | null
          team_leader: string
          tutor_id?: string | null
          uploaded_by: string
        }
        Update: {
          agent_name?: string
          created_at?: string
          id?: string
          scope?: string
          score?: number
          session_date?: string | null
          team_leader?: string
          tutor_id?: string | null
          uploaded_by?: string
        }
        Relationships: []
      }
      study_modules: {
        Row: {
          created_at: string
          display_order: number
          grade_band: string
          hours_required: number
          id: string
          is_active: boolean
          module_code: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          grade_band: string
          hours_required: number
          id?: string
          is_active?: boolean
          module_code: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          grade_band?: string
          hours_required?: number
          id?: string
          is_active?: boolean
          module_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      study_plan_sheet_configs: {
        Row: {
          column_mapping: Json
          created_at: string
          csv_url: string | null
          id: string
          sheet_kind: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          column_mapping?: Json
          created_at?: string
          csv_url?: string | null
          id?: string
          sheet_kind: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          column_mapping?: Json
          created_at?: string
          csv_url?: string | null
          id?: string
          sheet_kind?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      task_categories: {
        Row: {
          category_name: string
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          is_default: boolean
          role: string
          updated_at: string
        }
        Insert: {
          category_name: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          is_default?: boolean
          role: string
          updated_at?: string
        }
        Update: {
          category_name?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          is_default?: boolean
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      task_form_fields: {
        Row: {
          created_at: string
          display_order: number
          field_label: string
          field_name: string
          field_options: Json | null
          field_type: string
          id: string
          is_active: boolean
          is_required: boolean
          is_system_field: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          field_label: string
          field_name: string
          field_options?: Json | null
          field_type?: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          is_system_field?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          field_label?: string
          field_name?: string
          field_options?: Json | null
          field_type?: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          is_system_field?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_by: string | null
          created_at: string
          created_by: string | null
          date_from: string | null
          date_to: string | null
          description: string
          duration_minutes: number | null
          end_time: string | null
          id: string
          priority: number | null
          related_link: string | null
          start_time: string | null
          status: Database["public"]["Enums"]["task_status"]
          task_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          created_by?: string | null
          date_from?: string | null
          date_to?: string | null
          description: string
          duration_minutes?: number | null
          end_time?: string | null
          id?: string
          priority?: number | null
          related_link?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          task_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          created_by?: string | null
          date_from?: string | null
          date_to?: string | null
          description?: string
          duration_minutes?: number | null
          end_time?: string | null
          id?: string
          priority?: number | null
          related_link?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          task_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      team_leader_attendance: {
        Row: {
          check_in_time: string | null
          created_at: string
          date: string
          id: string
          late_reason: string | null
          minutes_late: number
          status: Database["public"]["Enums"]["attendance_status"]
          team_leader_id: string
          team_leader_name: string | null
          updated_at: string
        }
        Insert: {
          check_in_time?: string | null
          created_at?: string
          date?: string
          id?: string
          late_reason?: string | null
          minutes_late?: number
          status?: Database["public"]["Enums"]["attendance_status"]
          team_leader_id: string
          team_leader_name?: string | null
          updated_at?: string
        }
        Update: {
          check_in_time?: string | null
          created_at?: string
          date?: string
          id?: string
          late_reason?: string | null
          minutes_late?: number
          status?: Database["public"]["Enums"]["attendance_status"]
          team_leader_id?: string
          team_leader_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tutor_blocked_modules: {
        Row: {
          blocked_by: string | null
          blocked_by_name: string | null
          created_at: string
          id: string
          module_id: string
          reason: string | null
          team_leader: string | null
          tutor_external_id: string
          updated_at: string
        }
        Insert: {
          blocked_by?: string | null
          blocked_by_name?: string | null
          created_at?: string
          id?: string
          module_id: string
          reason?: string | null
          team_leader?: string | null
          tutor_external_id: string
          updated_at?: string
        }
        Update: {
          blocked_by?: string | null
          blocked_by_name?: string | null
          created_at?: string
          id?: string
          module_id?: string
          reason?: string | null
          team_leader?: string | null
          tutor_external_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_blocked_modules_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "study_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_leaves: {
        Row: {
          created_at: string
          id: string
          leave_date: string
          source: string | null
          team_leader: string | null
          tutor_external_id: string
          tutor_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          leave_date: string
          source?: string | null
          team_leader?: string | null
          tutor_external_id: string
          tutor_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          leave_date?: string
          source?: string | null
          team_leader?: string | null
          tutor_external_id?: string
          tutor_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tutor_published_modules: {
        Row: {
          created_at: string
          id: string
          is_assigned: boolean
          is_finished: boolean
          module_id: string
          phase: string
          team_leader: string
          tutor_external_id: string
          tutor_name: string
          updated_at: string
          week_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_assigned?: boolean
          is_finished?: boolean
          module_id: string
          phase?: string
          team_leader: string
          tutor_external_id: string
          tutor_name: string
          updated_at?: string
          week_start: string
        }
        Update: {
          created_at?: string
          id?: string
          is_assigned?: boolean
          is_finished?: boolean
          module_id?: string
          phase?: string
          team_leader?: string
          tutor_external_id?: string
          tutor_name?: string
          updated_at?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_published_modules_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "study_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_weekend_days: {
        Row: {
          created_at: string
          id: string
          source: string | null
          team_leader: string | null
          tutor_external_id: string
          tutor_name: string | null
          updated_at: string
          weekend_days: string[]
        }
        Insert: {
          created_at?: string
          id?: string
          source?: string | null
          team_leader?: string | null
          tutor_external_id: string
          tutor_name?: string | null
          updated_at?: string
          weekend_days?: string[]
        }
        Update: {
          created_at?: string
          id?: string
          source?: string | null
          team_leader?: string | null
          tutor_external_id?: string
          tutor_name?: string | null
          updated_at?: string
          weekend_days?: string[]
        }
        Relationships: []
      }
      tutor_weekly_occupation: {
        Row: {
          created_at: string
          free_hours: number | null
          id: string
          phase: string
          scheduled_sessions: number
          source: string | null
          team_leader: string
          tutor_external_id: string
          tutor_name: string
          updated_at: string
          week_start: string
        }
        Insert: {
          created_at?: string
          free_hours?: number | null
          id?: string
          phase?: string
          scheduled_sessions?: number
          source?: string | null
          team_leader: string
          tutor_external_id: string
          tutor_name: string
          updated_at?: string
          week_start: string
        }
        Update: {
          created_at?: string
          free_hours?: number | null
          id?: string
          phase?: string
          scheduled_sessions?: number
          source?: string | null
          team_leader?: string
          tutor_external_id?: string
          tutor_name?: string
          updated_at?: string
          week_start?: string
        }
        Relationships: []
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
          role?: Database["public"]["Enums"]["app_role"]
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
      weekly_study_plan_items: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_completed: boolean
          is_partial: boolean
          module_id: string
          plan_id: string
          planned_hours: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_completed?: boolean
          is_partial?: boolean
          module_id: string
          plan_id: string
          planned_hours: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_completed?: boolean
          is_partial?: boolean
          module_id?: string
          plan_id?: string
          planned_hours?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_study_plan_items_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "study_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_study_plan_items_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "weekly_study_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_study_plan_snapshots: {
        Row: {
          created_at: string
          generated_by: string | null
          generated_by_name: string | null
          id: string
          items_count: number
          notes: string | null
          team_leader: string | null
          total_free_hours: number
          total_planned_hours: number
          tutors_count: number
          week_start: string
        }
        Insert: {
          created_at?: string
          generated_by?: string | null
          generated_by_name?: string | null
          id?: string
          items_count?: number
          notes?: string | null
          team_leader?: string | null
          total_free_hours?: number
          total_planned_hours?: number
          tutors_count?: number
          week_start: string
        }
        Update: {
          created_at?: string
          generated_by?: string | null
          generated_by_name?: string | null
          id?: string
          items_count?: number
          notes?: string | null
          team_leader?: string | null
          total_free_hours?: number
          total_planned_hours?: number
          tutors_count?: number
          week_start?: string
        }
        Relationships: []
      }
      weekly_study_plans: {
        Row: {
          created_at: string
          free_hours: number
          generated_by: string | null
          id: string
          notes: string | null
          planned_hours: number
          status: string
          team_leader: string
          tutor_external_id: string
          tutor_name: string
          updated_at: string
          week_start: string
        }
        Insert: {
          created_at?: string
          free_hours?: number
          generated_by?: string | null
          id?: string
          notes?: string | null
          planned_hours?: number
          status?: string
          team_leader: string
          tutor_external_id: string
          tutor_name: string
          updated_at?: string
          week_start: string
        }
        Update: {
          created_at?: string
          free_hours?: number
          generated_by?: string | null
          id?: string
          notes?: string | null
          planned_hours?: number
          status?: string
          team_leader?: string
          tutor_external_id?: string
          tutor_name?: string
          updated_at?: string
          week_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      broadcast_announcement_notification: {
        Args: { _audience: string; _priority?: string; _title: string }
        Returns: number
      }
      cs_ticket_belongs_to_me: {
        Args: { _team_leader: string }
        Returns: boolean
      }
      find_team_leader_user_ids: {
        Args: { _team_leader_name: string }
        Returns: string[]
      }
      get_current_user_mentor_name: { Args: never; Returns: string }
      get_my_team_cs_tickets: {
        Args: never
        Returns: {
          case_details: string | null
          case_type: Database["public"]["Enums"]["cs_ticket_case_type"]
          case_types: Database["public"]["Enums"]["cs_ticket_case_type"][]
          category: string
          created_at: string
          created_by: string | null
          cs_category: string | null
          edu_category: string | null
          id: string
          need_response_deadline: string | null
          session_num_or_date: string | null
          status: Database["public"]["Enums"]["cs_ticket_status"]
          student_id: string | null
          team_leader: string
          team_leader_response: string | null
          ticket_date: string
          ticket_number: string
          tutor_external_id: string
          tutor_name: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "cs_tickets"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_team_task_stats: {
        Args: never
        Returns: {
          completed_tasks: number
          in_progress_tasks: number
          overdue_tasks: number
          team_leader: string
          total_tasks: number
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_user_in_my_team: { Args: { _user_id: string }; Returns: boolean }
      mark_absent_team_leaders: {
        Args: { _target_date?: string }
        Returns: number
      }
      notify_tickets_due_today: { Args: never; Returns: number }
      notify_tl_checkin_reminder: { Args: never; Returns: number }
      team_leader_name_matches: {
        Args: { _candidate: string; _mine: string }
        Returns: boolean
      }
    }
    Enums: {
      action_plan_category:
        | "quality"
        | "leaves_abuse"
        | "communication"
        | "cs_complaints"
        | "emergency_abuse"
        | "no_show_abuse"
      action_plan_evaluation: "improved" | "not_improved"
      action_plan_status: "active" | "on_hold" | "resolved" | "escalated"
      announcement_audience: "team_leaders" | "mentors" | "both"
      announcement_priority: "important" | "normal"
      announcement_status: "published" | "draft"
      app_role:
        | "admin"
        | "team_leader"
        | "mentor"
        | "community_moderator"
        | "super_team_leader"
      attendance_status: "on_time" | "late" | "absent"
      cs_ticket_case_type: "CS" | "Edu"
      cs_ticket_status:
        | "Pending"
        | "Validated"
        | "Rejected"
        | "Valid"
        | "Not Valid"
        | "Not a Complain"
      edu_description_type: "deduction" | "no_deduction" | "neutral"
      edu_validation_status: "deduct" | "no_deduction" | "pending"
      feature_module:
        | "Tasks"
        | "Action Plans"
        | "Engagement"
        | "Tracking"
        | "Reports"
        | "User Management"
        | "Announcements"
        | "Other"
      feature_plan_status: "planned" | "in_progress" | "completed" | "blocked"
      feature_plan_visibility: "team_leaders" | "mentors" | "both" | "hidden"
      task_status: "todo" | "in_progress" | "done" | "archived"
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
      action_plan_category: [
        "quality",
        "leaves_abuse",
        "communication",
        "cs_complaints",
        "emergency_abuse",
        "no_show_abuse",
      ],
      action_plan_evaluation: ["improved", "not_improved"],
      action_plan_status: ["active", "on_hold", "resolved", "escalated"],
      announcement_audience: ["team_leaders", "mentors", "both"],
      announcement_priority: ["important", "normal"],
      announcement_status: ["published", "draft"],
      app_role: [
        "admin",
        "team_leader",
        "mentor",
        "community_moderator",
        "super_team_leader",
      ],
      attendance_status: ["on_time", "late", "absent"],
      cs_ticket_case_type: ["CS", "Edu"],
      cs_ticket_status: [
        "Pending",
        "Validated",
        "Rejected",
        "Valid",
        "Not Valid",
        "Not a Complain",
      ],
      edu_description_type: ["deduction", "no_deduction", "neutral"],
      edu_validation_status: ["deduct", "no_deduction", "pending"],
      feature_module: [
        "Tasks",
        "Action Plans",
        "Engagement",
        "Tracking",
        "Reports",
        "User Management",
        "Announcements",
        "Other",
      ],
      feature_plan_status: ["planned", "in_progress", "completed", "blocked"],
      feature_plan_visibility: ["team_leaders", "mentors", "both", "hidden"],
      task_status: ["todo", "in_progress", "done", "archived"],
    },
  },
} as const

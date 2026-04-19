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
          message: string
          read_status: boolean | null
          related_task_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read_status?: boolean | null
          related_task_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_current_user_mentor_name: { Args: never; Returns: string }
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
      app_role: "admin" | "team_leader" | "mentor" | "community_moderator"
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
      app_role: ["admin", "team_leader", "mentor", "community_moderator"],
      task_status: ["todo", "in_progress", "done", "archived"],
    },
  },
} as const

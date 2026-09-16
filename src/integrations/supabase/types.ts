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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_login_attempts: {
        Row: {
          created_at: string
          id: string
          ip: string
          succeeded: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          ip: string
          succeeded?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          ip?: string
          succeeded?: boolean
        }
        Relationships: []
      }
      beginner_sessions: {
        Row: {
          aspect_ratio: string
          created_at: string
          description: string | null
          duration_seconds: number | null
          id: string
          is_published: boolean
          session_code: string
          sort_order: number
          thumbnail_path: string | null
          title: string
          updated_at: string
          video_path: string | null
          video_source: string
          video_url: string | null
        }
        Insert: {
          aspect_ratio?: string
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          id?: string
          is_published?: boolean
          session_code: string
          sort_order?: number
          thumbnail_path?: string | null
          title: string
          updated_at?: string
          video_path?: string | null
          video_source?: string
          video_url?: string | null
        }
        Update: {
          aspect_ratio?: string
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          id?: string
          is_published?: boolean
          session_code?: string
          sort_order?: number
          thumbnail_path?: string | null
          title?: string
          updated_at?: string
          video_path?: string | null
          video_source?: string
          video_url?: string | null
        }
        Relationships: []
      }
      content_access: {
        Row: {
          content_id: string
          content_type: string
          created_at: string
          id: string
          level_id: string
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string
          id?: string
          level_id: string
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string
          id?: string
          level_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_access_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      final_test_answers: {
        Row: {
          answer_text: string | null
          awarded_marks: number | null
          created_at: string
          id: string
          question_id: string
          selected_option: number | null
          test_id: string
        }
        Insert: {
          answer_text?: string | null
          awarded_marks?: number | null
          created_at?: string
          id?: string
          question_id: string
          selected_option?: number | null
          test_id: string
        }
        Update: {
          answer_text?: string | null
          awarded_marks?: number | null
          created_at?: string
          id?: string
          question_id?: string
          selected_option?: number | null
          test_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "final_test_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "final_test_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "final_test_answers_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "final_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      final_test_questions: {
        Row: {
          correct_option: number | null
          created_at: string
          id: string
          is_published: boolean
          marks: number
          options_en: string[]
          options_ur: string[]
          question_en: string
          question_type: string
          question_ur: string | null
          sort_order: number
          time_limit_seconds: number
          updated_at: string
          voice_path: string | null
          voice_url: string | null
        }
        Insert: {
          correct_option?: number | null
          created_at?: string
          id?: string
          is_published?: boolean
          marks?: number
          options_en?: string[]
          options_ur?: string[]
          question_en: string
          question_type?: string
          question_ur?: string | null
          sort_order?: number
          time_limit_seconds?: number
          updated_at?: string
          voice_path?: string | null
          voice_url?: string | null
        }
        Update: {
          correct_option?: number | null
          created_at?: string
          id?: string
          is_published?: boolean
          marks?: number
          options_en?: string[]
          options_ur?: string[]
          question_en?: string
          question_type?: string
          question_ur?: string | null
          sort_order?: number
          time_limit_seconds?: number
          updated_at?: string
          voice_path?: string | null
          voice_url?: string | null
        }
        Relationships: []
      }
      final_test_rules: {
        Row: {
          id: string
          rules_en: string | null
          rules_ur: string | null
          show_result_to_candidate: boolean
          updated_at: string
          voice_path: string | null
          voice_url: string | null
        }
        Insert: {
          id?: string
          rules_en?: string | null
          rules_ur?: string | null
          show_result_to_candidate?: boolean
          updated_at?: string
          voice_path?: string | null
          voice_url?: string | null
        }
        Update: {
          id?: string
          rules_en?: string | null
          rules_ur?: string | null
          show_result_to_candidate?: boolean
          updated_at?: string
          voice_path?: string | null
          voice_url?: string | null
        }
        Relationships: []
      }
      final_tests: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          language: string | null
          marks: number | null
          mobile: string
          person_name: string
          result: string
          started_at: string | null
          status: string
          token: string
          updated_at: string
          upline_account_id: string | null
          upline_name: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          language?: string | null
          marks?: number | null
          mobile: string
          person_name: string
          result?: string
          started_at?: string | null
          status?: string
          token: string
          updated_at?: string
          upline_account_id?: string | null
          upline_name: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          language?: string | null
          marks?: number | null
          mobile?: string
          person_name?: string
          result?: string
          started_at?: string | null
          status?: string
          token?: string
          updated_at?: string
          upline_account_id?: string | null
          upline_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "final_tests_upline_account_id_fkey"
            columns: ["upline_account_id"]
            isOneToOne: false
            referencedRelation: "member_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lectures: {
        Row: {
          aspect_ratio: string
          created_at: string
          description: string | null
          duration_seconds: number | null
          id: string
          is_archived: boolean
          is_published: boolean
          level_id: string | null
          series_id: string | null
          sort_order: number
          thumbnail_path: string | null
          title: string
          updated_at: string
          video_path: string | null
          video_source: string
          video_url: string | null
        }
        Insert: {
          aspect_ratio?: string
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          id?: string
          is_archived?: boolean
          is_published?: boolean
          level_id?: string | null
          series_id?: string | null
          sort_order?: number
          thumbnail_path?: string | null
          title: string
          updated_at?: string
          video_path?: string | null
          video_source?: string
          video_url?: string | null
        }
        Update: {
          aspect_ratio?: string
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          id?: string
          is_archived?: boolean
          is_published?: boolean
          level_id?: string | null
          series_id?: string | null
          sort_order?: number
          thumbnail_path?: string | null
          title?: string
          updated_at?: string
          video_path?: string | null
          video_source?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lectures_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lectures_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      levels: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_published: boolean
          name: string
          rank_order: number
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          name: string
          rank_order: number
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          name?: string
          rank_order?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      live_premieres: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          scheduled_at: string
          token: string
          training_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          scheduled_at: string
          token: string
          training_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          scheduled_at?: string
          token?: string
          training_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_premieres_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "member_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_premieres_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "live_trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      live_trainings: {
        Row: {
          aspect_ratio: string
          created_at: string
          description: string | null
          duration_seconds: number | null
          id: string
          is_published: boolean
          sort_order: number
          thumbnail_path: string | null
          title: string
          updated_at: string
          video_path: string | null
          video_source: string
          video_url: string | null
        }
        Insert: {
          aspect_ratio?: string
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          id?: string
          is_published?: boolean
          sort_order?: number
          thumbnail_path?: string | null
          title: string
          updated_at?: string
          video_path?: string | null
          video_source?: string
          video_url?: string | null
        }
        Update: {
          aspect_ratio?: string
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          id?: string
          is_published?: boolean
          sort_order?: number
          thumbnail_path?: string | null
          title?: string
          updated_at?: string
          video_path?: string | null
          video_source?: string
          video_url?: string | null
        }
        Relationships: []
      }
      member_profiles: {
        Row: {
          age: number | null
          avatar_path: string | null
          cnic: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          last_login_at: string | null
          level_id: string | null
          member_id: string
          notes: string | null
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          age?: number | null
          avatar_path?: string | null
          cnic?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id: string
          last_login_at?: string | null
          level_id?: string | null
          member_id: string
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          age?: number | null
          avatar_path?: string | null
          cnic?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          last_login_at?: string | null
          level_id?: string | null
          member_id?: string
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_profiles_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_reads: {
        Row: {
          id: string
          member_id: string
          notification_id: string
          read_at: string
        }
        Insert: {
          id?: string
          member_id: string
          notification_id: string
          read_at?: string
        }
        Update: {
          id?: string
          member_id?: string
          notification_id?: string
          read_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_reads_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          audience_level_id: string | null
          body: string | null
          created_at: string
          id: string
          kind: string
          link_path: string | null
          title: string
        }
        Insert: {
          audience_level_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link_path?: string | null
          title: string
        }
        Update: {
          audience_level_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link_path?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_audience_level_id_fkey"
            columns: ["audience_level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      reels: {
        Row: {
          caption: string | null
          created_at: string
          created_by: string | null
          created_by_admin: boolean
          id: string
          is_published: boolean
          thumbnail_path: string | null
          title: string
          updated_at: string
          video_path: string | null
          video_source: string
          video_url: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          created_by?: string | null
          created_by_admin?: boolean
          id?: string
          is_published?: boolean
          thumbnail_path?: string | null
          title: string
          updated_at?: string
          video_path?: string | null
          video_source?: string
          video_url?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          created_by?: string | null
          created_by_admin?: boolean
          id?: string
          is_published?: boolean
          thumbnail_path?: string | null
          title?: string
          updated_at?: string
          video_path?: string | null
          video_source?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reels_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "member_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          body: string | null
          created_at: string
          description: string | null
          external_url: string | null
          id: string
          is_published: boolean
          lecture_id: string | null
          resource_type: string
          series_id: string | null
          sort_order: number
          storage_path: string | null
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          description?: string | null
          external_url?: string | null
          id?: string
          is_published?: boolean
          lecture_id?: string | null
          resource_type: string
          series_id?: string | null
          sort_order?: number
          storage_path?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          description?: string | null
          external_url?: string | null
          id?: string
          is_published?: boolean
          lecture_id?: string | null
          resource_type?: string
          series_id?: string | null
          sort_order?: number
          storage_path?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resources_lecture_id_fkey"
            columns: ["lecture_id"]
            isOneToOne: false
            referencedRelation: "lectures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      series: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_archived: boolean
          is_published: boolean
          level_id: string
          sort_order: number
          thumbnail_path: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_archived?: boolean
          is_published?: boolean
          level_id: string
          sort_order?: number
          thumbnail_path?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_archived?: boolean
          is_published?: boolean
          level_id?: string
          sort_order?: number
          thumbnail_path?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "series_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      watch_positions: {
        Row: {
          created_at: string
          id: string
          lecture_id: string
          member_id: string
          position_seconds: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          lecture_id: string
          member_id: string
          position_seconds?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          lecture_id?: string
          member_id?: string
          position_seconds?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "watch_positions_lecture_id_fkey"
            columns: ["lecture_id"]
            isOneToOne: false
            referencedRelation: "lectures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watch_positions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          invite_url: string
          is_published: boolean
          join_code: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          invite_url: string
          is_published?: boolean
          join_code: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          invite_url?: string
          is_published?: boolean
          join_code?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_lecture: { Args: { _lecture_id: string }; Returns: boolean }
      can_access_level_content: {
        Args: { _level_id: string }
        Returns: boolean
      }
      can_access_series: { Args: { _series_id: string }; Returns: boolean }
      current_member_level: { Args: never; Returns: string }
      generate_member_id: { Args: never; Returns: string }
      is_manager_member: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

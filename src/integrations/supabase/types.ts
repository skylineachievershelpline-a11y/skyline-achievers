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
      ai_messages: {
        Row: {
          ai_message_id: string
          created_at: string
          id: string
          parts: Json
          role: string
          thread_id: string
          user_id: string
        }
        Insert: {
          ai_message_id: string
          created_at?: string
          id?: string
          parts?: Json
          role: string
          thread_id: string
          user_id: string
        }
        Update: {
          ai_message_id?: string
          created_at?: string
          id?: string
          parts?: Json
          role?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "ai_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_threads: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      beginner_session_extras: {
        Row: {
          aspect_ratio: string
          created_at: string
          description: string | null
          file_bucket: string | null
          id: string
          is_published: boolean
          kind: string
          section_id: string | null
          session_id: string
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
          file_bucket?: string | null
          id?: string
          is_published?: boolean
          kind?: string
          section_id?: string | null
          session_id: string
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
          file_bucket?: string | null
          id?: string
          is_published?: boolean
          kind?: string
          section_id?: string | null
          session_id?: string
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
            foreignKeyName: "beginner_session_extras_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "content_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beginner_session_extras_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "beginner_sessions"
            referencedColumns: ["id"]
          },
        ]
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
      chat_messages: {
        Row: {
          body: string | null
          created_at: string
          delivered_at: string | null
          id: string
          kind: string
          media_mime: string | null
          media_name: string | null
          media_path: string | null
          read_at: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          kind?: string
          media_mime?: string | null
          media_name?: string | null
          media_path?: string | null
          read_at?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          kind?: string
          media_mime?: string | null
          media_name?: string | null
          media_path?: string | null
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      chat_preferences: {
        Row: {
          show_avatar: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          show_avatar?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          show_avatar?: boolean
          updated_at?: string
          user_id?: string
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
      content_sections: {
        Row: {
          created_at: string
          id: string
          is_published: boolean
          name: string
          scope: string
          session_id: string | null
          sort_order: number
          thumbnail_path: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_published?: boolean
          name: string
          scope?: string
          session_id?: string | null
          sort_order?: number
          thumbnail_path?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_published?: boolean
          name?: string
          scope?: string
          session_id?: string | null
          sort_order?: number
          thumbnail_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_sections_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "beginner_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      course_enrollments: {
        Row: {
          admin_note: string | null
          amount_pkr: number | null
          buyer_code: string | null
          buyer_id: string
          buyer_kind: string
          buyer_name: string
          course_id: string
          created_at: string
          id: string
          method_label: string | null
          note: string | null
          phone: string | null
          proof_path: string | null
          reference: string | null
          reviewed_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          amount_pkr?: number | null
          buyer_code?: string | null
          buyer_id: string
          buyer_kind?: string
          buyer_name: string
          course_id: string
          created_at?: string
          id?: string
          method_label?: string | null
          note?: string | null
          phone?: string | null
          proof_path?: string | null
          reference?: string | null
          reviewed_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          amount_pkr?: number | null
          buyer_code?: string | null
          buyer_id?: string
          buyer_kind?: string
          buyer_name?: string
          course_id?: string
          created_at?: string
          id?: string
          method_label?: string | null
          note?: string | null
          phone?: string | null
          proof_path?: string | null
          reference?: string | null
          reviewed_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "paid_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_payment_methods: {
        Row: {
          account_name: string | null
          account_number: string | null
          created_at: string
          id: string
          instructions: string | null
          is_active: boolean
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          created_at?: string
          id?: string
          instructions?: string | null
          is_active?: boolean
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          created_at?: string
          id?: string
          instructions?: string | null
          is_active?: boolean
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      course_payment_settings: {
        Row: {
          id: string
          intro: string | null
          steps: string | null
          support_contact: string | null
          turnaround_note: string | null
          updated_at: string
        }
        Insert: {
          id: string
          intro?: string | null
          steps?: string | null
          support_contact?: string | null
          turnaround_note?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          intro?: string | null
          steps?: string | null
          support_contact?: string | null
          turnaround_note?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      daily_inspirations: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          kind: string
          part_of_day: string
          reference: string | null
          schedule_type: string
          sort_order: number
          text_en: string | null
          text_ur: string | null
          updated_at: string
          weekday: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          kind: string
          part_of_day: string
          reference?: string | null
          schedule_type?: string
          sort_order?: number
          text_en?: string | null
          text_ur?: string | null
          updated_at?: string
          weekday?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          part_of_day?: string
          reference?: string | null
          schedule_type?: string
          sort_order?: number
          text_en?: string | null
          text_ur?: string | null
          updated_at?: string
          weekday?: number | null
        }
        Relationships: []
      }
      earning_rates: {
        Row: {
          id: string
          join_earning_pkr: number
          lead_investment_pkr: number
          updated_at: string
        }
        Insert: {
          id?: string
          join_earning_pkr?: number
          lead_investment_pkr?: number
          updated_at?: string
        }
        Update: {
          id?: string
          join_earning_pkr?: number
          lead_investment_pkr?: number
          updated_at?: string
        }
        Relationships: []
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
      landing_intro: {
        Row: {
          aspect_ratio: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
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
          id?: string
          is_active?: boolean
          thumbnail_path?: string | null
          title?: string
          updated_at?: string
          video_path?: string | null
          video_source?: string
          video_url?: string | null
        }
        Update: {
          aspect_ratio?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          thumbnail_path?: string | null
          title?: string
          updated_at?: string
          video_path?: string | null
          video_source?: string
          video_url?: string | null
        }
        Relationships: []
      }
      landing_quotes: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          quote_text: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          quote_text: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          quote_text?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      landing_reviews: {
        Row: {
          aspect_ratio: string
          created_at: string
          designation: string | null
          id: string
          is_active: boolean
          person_name: string
          photo_path: string | null
          rating: number | null
          review_text: string
          sort_order: number
          status: string
          updated_at: string
          video_path: string | null
          video_source: string
          video_url: string | null
        }
        Insert: {
          aspect_ratio?: string
          created_at?: string
          designation?: string | null
          id?: string
          is_active?: boolean
          person_name: string
          photo_path?: string | null
          rating?: number | null
          review_text: string
          sort_order?: number
          status?: string
          updated_at?: string
          video_path?: string | null
          video_source?: string
          video_url?: string | null
        }
        Update: {
          aspect_ratio?: string
          created_at?: string
          designation?: string | null
          id?: string
          is_active?: boolean
          person_name?: string
          photo_path?: string | null
          rating?: number | null
          review_text?: string
          sort_order?: number
          status?: string
          updated_at?: string
          video_path?: string | null
          video_source?: string
          video_url?: string | null
        }
        Relationships: []
      }
      leave_applications: {
        Row: {
          admin_note: string | null
          created_at: string
          from_date: string
          id: string
          member_id: string
          reason: string
          reviewed_at: string | null
          status: string
          to_date: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          from_date: string
          id?: string
          member_id: string
          reason: string
          reviewed_at?: string | null
          status?: string
          to_date: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          from_date?: string
          id?: string
          member_id?: string
          reason?: string
          reviewed_at?: string | null
          status?: string
          to_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_applications_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lectures: {
        Row: {
          aspect_ratio: string
          category_id: string | null
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
          category_id?: string | null
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
          category_id?: string | null
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
            foreignKeyName: "lectures_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "training_categories"
            referencedColumns: ["id"]
          },
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
      member_daily_reports: {
        Row: {
          absent_reason: string | null
          created_at: string
          enrollments: number
          id: string
          is_absent: boolean
          leads_count: number
          member_id: string
          mentorship_paid: number
          pending_count: number
          rate_per_lead: number
          report_date: string
          responses: number
          submitted_at: string | null
          two_cc: number
          updated_at: string
        }
        Insert: {
          absent_reason?: string | null
          created_at?: string
          enrollments?: number
          id?: string
          is_absent?: boolean
          leads_count?: number
          member_id: string
          mentorship_paid?: number
          pending_count?: number
          rate_per_lead?: number
          report_date: string
          responses?: number
          submitted_at?: string | null
          two_cc?: number
          updated_at?: string
        }
        Update: {
          absent_reason?: string | null
          created_at?: string
          enrollments?: number
          id?: string
          is_absent?: boolean
          leads_count?: number
          member_id?: string
          mentorship_paid?: number
          pending_count?: number
          rate_per_lead?: number
          report_date?: string
          responses?: number
          submitted_at?: string | null
          two_cc?: number
          updated_at?: string
        }
        Relationships: []
      }
      member_profiles: {
        Row: {
          age: number | null
          avatar_path: string | null
          bio: string | null
          cc_due_at: string | null
          cc_extensions: number
          cnic: string | null
          created_at: string
          dashboard_cover_path: string | null
          email: string | null
          full_name: string
          id: string
          is_official: boolean
          last_login_at: string | null
          level_id: string | null
          level_since: string
          member_id: string
          mentorship_completed_at: string | null
          mentorship_due_at: string | null
          mentorship_extensions: number
          mentorship_fee_pkr: number
          mentorship_paid_pkr: number
          notes: string | null
          phone: string | null
          status: string
          training_locked: boolean
          updated_at: string
          upline_id: string | null
          working_enabled: boolean
        }
        Insert: {
          age?: number | null
          avatar_path?: string | null
          bio?: string | null
          cc_due_at?: string | null
          cc_extensions?: number
          cnic?: string | null
          created_at?: string
          dashboard_cover_path?: string | null
          email?: string | null
          full_name: string
          id: string
          is_official?: boolean
          last_login_at?: string | null
          level_id?: string | null
          level_since?: string
          member_id: string
          mentorship_completed_at?: string | null
          mentorship_due_at?: string | null
          mentorship_extensions?: number
          mentorship_fee_pkr?: number
          mentorship_paid_pkr?: number
          notes?: string | null
          phone?: string | null
          status?: string
          training_locked?: boolean
          updated_at?: string
          upline_id?: string | null
          working_enabled?: boolean
        }
        Update: {
          age?: number | null
          avatar_path?: string | null
          bio?: string | null
          cc_due_at?: string | null
          cc_extensions?: number
          cnic?: string | null
          created_at?: string
          dashboard_cover_path?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_official?: boolean
          last_login_at?: string | null
          level_id?: string | null
          level_since?: string
          member_id?: string
          mentorship_completed_at?: string | null
          mentorship_due_at?: string | null
          mentorship_extensions?: number
          mentorship_fee_pkr?: number
          mentorship_paid_pkr?: number
          notes?: string | null
          phone?: string | null
          status?: string
          training_locked?: boolean
          updated_at?: string
          upline_id?: string | null
          working_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "member_profiles_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_profiles_upline_id_fkey"
            columns: ["upline_id"]
            isOneToOne: false
            referencedRelation: "member_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      member_training_access: {
        Row: {
          category_id: string
          created_at: string
          id: string
          member_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          member_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_training_access_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "training_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_training_access_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_dismissals: {
        Row: {
          created_at: string
          member_id: string
          notification_id: string
        }
        Insert: {
          created_at?: string
          member_id: string
          notification_id: string
        }
        Update: {
          created_at?: string
          member_id?: string
          notification_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_dismissals_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
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
          media_bucket: string | null
          media_path: string | null
          media_type: string | null
          title: string
        }
        Insert: {
          audience_level_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link_path?: string | null
          media_bucket?: string | null
          media_path?: string | null
          media_type?: string | null
          title: string
        }
        Update: {
          audience_level_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link_path?: string | null
          media_bucket?: string | null
          media_path?: string | null
          media_type?: string | null
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
      paid_course_lessons: {
        Row: {
          aspect_ratio: string
          course_id: string
          created_at: string
          description: string | null
          duration_seconds: number | null
          id: string
          is_preview: boolean
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
          course_id: string
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          id?: string
          is_preview?: boolean
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
          course_id?: string
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          id?: string
          is_preview?: boolean
          is_published?: boolean
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
            foreignKeyName: "paid_course_lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "paid_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      paid_courses: {
        Row: {
          created_at: string
          description: string | null
          duration_label: string | null
          highlights: string[]
          id: string
          is_published: boolean
          old_price_pkr: number | null
          price_pkr: number
          sort_order: number
          tagline: string | null
          thumbnail_path: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_label?: string | null
          highlights?: string[]
          id?: string
          is_published?: boolean
          old_price_pkr?: number | null
          price_pkr?: number
          sort_order?: number
          tagline?: string | null
          thumbnail_path?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_label?: string | null
          highlights?: string[]
          id?: string
          is_published?: boolean
          old_price_pkr?: number | null
          price_pkr?: number
          sort_order?: number
          tagline?: string | null
          thumbnail_path?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
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
      reel_comments: {
        Row: {
          author_id: string
          author_name: string
          body: string
          created_at: string
          id: string
          reel_id: string
          status: string
          updated_at: string
        }
        Insert: {
          author_id: string
          author_name: string
          body: string
          created_at?: string
          id?: string
          reel_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          author_name?: string
          body?: string
          created_at?: string
          id?: string
          reel_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reel_comments_reel_id_fkey"
            columns: ["reel_id"]
            isOneToOne: false
            referencedRelation: "reels"
            referencedColumns: ["id"]
          },
        ]
      }
      reel_likes: {
        Row: {
          created_at: string
          id: string
          reel_id: string
          viewer_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reel_id: string
          viewer_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reel_id?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reel_likes_reel_id_fkey"
            columns: ["reel_id"]
            isOneToOne: false
            referencedRelation: "reels"
            referencedColumns: ["id"]
          },
        ]
      }
      reel_saves: {
        Row: {
          created_at: string
          id: string
          reel_id: string
          viewer_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reel_id: string
          viewer_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reel_id?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reel_saves_reel_id_fkey"
            columns: ["reel_id"]
            isOneToOne: false
            referencedRelation: "reels"
            referencedColumns: ["id"]
          },
        ]
      }
      reel_views: {
        Row: {
          id: string
          reel_id: string
          seen_at: string
          viewer_id: string
        }
        Insert: {
          id?: string
          reel_id: string
          seen_at?: string
          viewer_id: string
        }
        Update: {
          id?: string
          reel_id?: string
          seen_at?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reel_views_reel_id_fkey"
            columns: ["reel_id"]
            isOneToOne: false
            referencedRelation: "reels"
            referencedColumns: ["id"]
          },
        ]
      }
      reels: {
        Row: {
          base_likes: number
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
          base_likes?: number
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
          base_likes?: number
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
          section_id: string | null
          series_id: string | null
          session_id: string | null
          session_section_id: string | null
          sort_order: number
          storage_path: string | null
          thumbnail_path: string | null
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
          section_id?: string | null
          series_id?: string | null
          session_id?: string | null
          session_section_id?: string | null
          sort_order?: number
          storage_path?: string | null
          thumbnail_path?: string | null
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
          section_id?: string | null
          series_id?: string | null
          session_id?: string | null
          session_section_id?: string | null
          sort_order?: number
          storage_path?: string | null
          thumbnail_path?: string | null
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
            foreignKeyName: "resources_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "content_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "beginner_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_session_section_id_fkey"
            columns: ["session_section_id"]
            isOneToOne: false
            referencedRelation: "content_sections"
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
      stories: {
        Row: {
          audience_beginners: boolean
          audience_level_id: string | null
          audience_level_ids: string[]
          audience_type: string
          background: string | null
          caption: string | null
          created_at: string
          expires_at: string
          id: string
          is_published: boolean
          kind: string
          media_bucket: string | null
          media_path: string | null
          text_body: string | null
        }
        Insert: {
          audience_beginners?: boolean
          audience_level_id?: string | null
          audience_level_ids?: string[]
          audience_type?: string
          background?: string | null
          caption?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          is_published?: boolean
          kind: string
          media_bucket?: string | null
          media_path?: string | null
          text_body?: string | null
        }
        Update: {
          audience_beginners?: boolean
          audience_level_id?: string | null
          audience_level_ids?: string[]
          audience_type?: string
          background?: string | null
          caption?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          is_published?: boolean
          kind?: string
          media_bucket?: string | null
          media_path?: string | null
          text_body?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stories_audience_level_id_fkey"
            columns: ["audience_level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      trainee_invites: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string | null
          token: string
          updated_at: string
          upline_id: string
          uses: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          token: string
          updated_at?: string
          upline_id: string
          uses?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          token?: string
          updated_at?: string
          upline_id?: string
          uses?: number
        }
        Relationships: [
          {
            foreignKeyName: "trainee_invites_upline_id_fkey"
            columns: ["upline_id"]
            isOneToOne: false
            referencedRelation: "member_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trainee_session_unlocks: {
        Row: {
          created_at: string
          id: string
          session_id: string
          trainee_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          session_id: string
          trainee_id: string
        }
        Update: {
          created_at?: string
          id?: string
          session_id?: string
          trainee_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainee_session_unlocks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "beginner_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainee_session_unlocks_trainee_id_fkey"
            columns: ["trainee_id"]
            isOneToOne: false
            referencedRelation: "trainees"
            referencedColumns: ["id"]
          },
        ]
      }
      trainees: {
        Row: {
          age: number | null
          avatar_path: string | null
          created_at: string
          full_name: string
          id: string
          last_login_at: string | null
          phone: string | null
          source: string
          status: string
          trainee_code: string
          updated_at: string
          upline_id: string | null
        }
        Insert: {
          age?: number | null
          avatar_path?: string | null
          created_at?: string
          full_name: string
          id: string
          last_login_at?: string | null
          phone?: string | null
          source?: string
          status?: string
          trainee_code: string
          updated_at?: string
          upline_id?: string | null
        }
        Update: {
          age?: number | null
          avatar_path?: string | null
          created_at?: string
          full_name?: string
          id?: string
          last_login_at?: string | null
          phone?: string | null
          source?: string
          status?: string
          trainee_code?: string
          updated_at?: string
          upline_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trainees_upline_id_fkey"
            columns: ["upline_id"]
            isOneToOne: false
            referencedRelation: "member_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      training_categories: {
        Row: {
          created_at: string
          description: string | null
          group_id: string | null
          id: string
          is_published: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          group_id?: string | null
          id?: string
          is_published?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          group_id?: string | null
          id?: string
          is_published?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_categories_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "training_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      training_category_access: {
        Row: {
          category_id: string
          created_at: string
          id: string
          level_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          level_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          level_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_category_access_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "training_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_category_access_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      training_group_access: {
        Row: {
          created_at: string
          group_id: string
          id: string
          level_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          level_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          level_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_group_access_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "training_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_group_access_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      training_groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_published: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
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
      can_post_reels: { Args: never; Returns: boolean }
      current_member_level: { Args: never; Returns: string }
      generate_member_id: { Args: never; Returns: string }
      generate_trainee_id: { Args: never; Returns: string }
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

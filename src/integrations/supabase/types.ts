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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      folders: {
        Row: {
          created_at: string
          created_by_email: string | null
          description: string | null
          id: string
          name: string
          parent_folder_id: string | null
          team_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by_email?: string | null
          description?: string | null
          id?: string
          name: string
          parent_folder_id?: string | null
          team_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by_email?: string | null
          description?: string | null
          id?: string
          name?: string
          parent_folder_id?: string | null
          team_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "folders_parent_folder_id_fkey"
            columns: ["parent_folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folders_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      query_approvals: {
        Row: {
          created_at: string
          id: string
          query_history_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          query_history_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          query_history_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "query_approvals_query_history_id_fkey"
            columns: ["query_history_id"]
            isOneToOne: false
            referencedRelation: "query_history"
            referencedColumns: ["id"]
          },
        ]
      }
      query_history: {
        Row: {
          change_reason: string | null
          created_at: string
          id: string
          modified_by_email: string
          query_id: string
          sql_content: string
          status: string
        }
        Insert: {
          change_reason?: string | null
          created_at?: string
          id?: string
          modified_by_email: string
          query_id: string
          sql_content: string
          status?: string
        }
        Update: {
          change_reason?: string | null
          created_at?: string
          id?: string
          modified_by_email?: string
          query_id?: string
          sql_content?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "query_history_query_id_fkey"
            columns: ["query_id"]
            isOneToOne: false
            referencedRelation: "sql_queries"
            referencedColumns: ["id"]
          },
        ]
      }
      sql_queries: {
        Row: {
          created_at: string
          created_by_email: string | null
          description: string | null
          folder_id: string
          id: string
          last_modified_by_email: string | null
          sql_content: string
          status: string
          team_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by_email?: string | null
          description?: string | null
          folder_id: string
          id?: string
          last_modified_by_email?: string | null
          sql_content: string
          status?: string
          team_id: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by_email?: string | null
          description?: string | null
          folder_id?: string
          id?: string
          last_modified_by_email?: string | null
          sql_content?: string
          status?: string
          team_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sql_queries_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sql_queries_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invitations: {
        Row: {
          created_at: string
          id: string
          invited_by_user_id: string | null
          invited_email: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by_user_id?: string | null
          invited_email: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by_user_id?: string | null
          invited_email?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invitations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          admin_id: string
          approval_quota: number
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          admin_id: string
          approval_quota?: number
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          admin_id?: string
          approval_quota?: number
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_query_with_quota: {
        Args: {
          _approver_user_id: string
          _query_history_id: string
          _query_id: string
        }
        Returns: Json
      }
      can_create_team: { Args: { _admin_id: string }; Returns: boolean }
      create_team_with_admin: {
        Args: { _approval_quota?: number; _team_name: string }
        Returns: {
          admin_id: string
          approval_quota: number
          created_at: string
          team_id: string
          team_name: string
        }[]
      }
      get_all_folder_paths: {
        Args: never
        Returns: {
          full_path: string
          id: string
        }[]
      }
      get_folder_team_id: { Args: { _folder_id: string }; Returns: string }
      get_query_team_id: { Args: { _query_id: string }; Returns: string }
      get_team_folder_paths: {
        Args: { _team_id: string }
        Returns: {
          full_path: string
          id: string
        }[]
      }
      is_team_admin: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_member: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      process_pending_invitations: {
        Args: { _user_id: string }
        Returns: {
          processed_count: number
          team_ids: string[]
        }[]
      }
      reject_query_with_authorization: {
        Args: {
          _query_history_id: string
          _query_id: string
          _rejecter_user_id: string
        }
        Returns: Json
      }
      submit_query_for_approval:
        | {
            Args: {
              _change_reason: string
              _modified_by_email: string
              _query_id: string
              _sql_content: string
            }
            Returns: Json
          }
        | {
            Args: {
              _change_reason: string
              _modified_by_email: string
              _query_id: string
              _sql_content: string
              _team_id: string
              _user_id: string
            }
            Returns: Json
          }
      update_query_status: {
        Args: {
          _modifier_email: string
          _new_status: string
          _query_id: string
        }
        Returns: Json
      }
      user_admin_teams: {
        Args: { _user_id: string }
        Returns: {
          team_id: string
        }[]
      }
      user_can_access_team: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      user_has_valid_invitation: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      user_inviters: {
        Args: { _user_id: string }
        Returns: {
          inviter_id: string
        }[]
      }
      user_is_team_admin: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      user_pending_invitation_teams: {
        Args: { _user_id: string }
        Returns: {
          team_id: string
        }[]
      }
      user_teams: {
        Args: { _user_id: string }
        Returns: {
          team_id: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "member"
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
      app_role: ["admin", "member"],
    },
  },
} as const

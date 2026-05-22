/* eslint-disable @typescript-eslint/no-redundant-type-constituents */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      citizen_assignments: {
        Row: {
          assigned_on_turn_number: number;
          assignment_type: string;
          citizen_id: string;
          construction_project_id: number | null;
          created_at: string;
          deposit_instance_id: number | null;
          job_id: number;
          managed_population_instance_id: number | null;
          trade_route_id: number | null;
          updated_at: string;
        };
        Insert: {
          assigned_on_turn_number: number;
          assignment_type: string;
          citizen_id: string;
          construction_project_id?: number | null;
          created_at?: string;
          deposit_instance_id?: number | null;
          job_id: number;
          managed_population_instance_id?: number | null;
          trade_route_id?: number | null;
          updated_at?: string;
        };
        Update: {
          assigned_on_turn_number?: number;
          assignment_type?: string;
          citizen_id?: string;
          construction_project_id?: number | null;
          created_at?: string;
          deposit_instance_id?: number | null;
          job_id?: number;
          managed_population_instance_id?: number | null;
          trade_route_id?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "citizen_assignments_citizen_id_fkey";
            columns: ["citizen_id"];
            isOneToOne: true;
            referencedRelation: "citizens";
            referencedColumns: ["id"];
          },
        ];
      };
      citizens: {
        Row: {
          born_on_turn_number: number | null;
          citizen_type: string;
          created_at: string;
          death_cause: string | null;
          id: string;
          name: string;
          npc_flaw: string | null;
          npc_goal: string | null;
          npc_secret_contradiction: string | null;
          npc_trait_1: string | null;
          npc_trait_2: string | null;
          parent_a_citizen_id: string | null;
          parent_b_citizen_id: string | null;
          personality_text: string | null;
          profile_photo_url: string | null;
          role_nation_id: string | null;
          role_settlement_id: string | null;
          role_type: string;
          settlement_id: string | null;
          sex: string;
          skills_text: string | null;
          status: string;
          updated_at: string;
          user_id: string | null;
          world_id: string;
        };
        Insert: {
          born_on_turn_number?: number | null;
          citizen_type: string;
          created_at?: string;
          death_cause?: string | null;
          id?: string;
          name: string;
          npc_flaw?: string | null;
          npc_goal?: string | null;
          npc_secret_contradiction?: string | null;
          npc_trait_1?: string | null;
          npc_trait_2?: string | null;
          parent_a_citizen_id?: string | null;
          parent_b_citizen_id?: string | null;
          personality_text?: string | null;
          profile_photo_url?: string | null;
          role_nation_id?: string | null;
          role_settlement_id?: string | null;
          role_type?: string;
          settlement_id?: string | null;
          sex: string;
          skills_text?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string | null;
          world_id: string;
        };
        Update: {
          born_on_turn_number?: number | null;
          citizen_type?: string;
          created_at?: string;
          death_cause?: string | null;
          id?: string;
          name?: string;
          npc_flaw?: string | null;
          npc_goal?: string | null;
          npc_secret_contradiction?: string | null;
          npc_trait_1?: string | null;
          npc_trait_2?: string | null;
          parent_a_citizen_id?: string | null;
          parent_b_citizen_id?: string | null;
          personality_text?: string | null;
          profile_photo_url?: string | null;
          role_nation_id?: string | null;
          role_settlement_id?: string | null;
          role_type?: string;
          settlement_id?: string | null;
          sex?: string;
          skills_text?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string | null;
          world_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "citizens_parent_a_citizen_id_fkey";
            columns: ["parent_a_citizen_id"];
            isOneToOne: false;
            referencedRelation: "citizens";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "citizens_parent_b_citizen_id_fkey";
            columns: ["parent_b_citizen_id"];
            isOneToOne: false;
            referencedRelation: "citizens";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "citizens_role_nation_id_fkey";
            columns: ["role_nation_id"];
            isOneToOne: false;
            referencedRelation: "nations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "citizens_role_settlement_id_fkey";
            columns: ["role_settlement_id"];
            isOneToOne: false;
            referencedRelation: "settlements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "citizens_settlement_id_fkey";
            columns: ["settlement_id"];
            isOneToOne: false;
            referencedRelation: "settlements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "citizens_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "citizens_world_id_fkey";
            columns: ["world_id"];
            isOneToOne: false;
            referencedRelation: "worlds";
            referencedColumns: ["id"];
          },
        ];
      };
      nations: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          is_hidden: boolean;
          name: string;
          updated_at: string;
          world_id: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_hidden?: boolean;
          name: string;
          updated_at?: string;
          world_id: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_hidden?: boolean;
          name?: string;
          updated_at?: string;
          world_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "nations_world_id_fkey";
            columns: ["world_id"];
            isOneToOne: false;
            referencedRelation: "worlds";
            referencedColumns: ["id"];
          },
        ];
      };
      nation_relationships: {
        Row: {
          created_at: string;
          current_stance: string;
          from_nation_id: string;
          id: string;
          pending_changed_by_citizen_id: string | null;
          pending_stance: string | null;
          pending_status: string | null;
          to_nation_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          current_stance?: string;
          from_nation_id: string;
          id?: string;
          pending_changed_by_citizen_id?: string | null;
          pending_stance?: string | null;
          pending_status?: string | null;
          to_nation_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          current_stance?: string;
          from_nation_id?: string;
          id?: string;
          pending_changed_by_citizen_id?: string | null;
          pending_stance?: string | null;
          pending_status?: string | null;
          to_nation_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "nation_relationships_from_nation_id_fkey";
            columns: ["from_nation_id"];
            isOneToOne: false;
            referencedRelation: "nations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nation_relationships_pending_changed_by_citizen_id_fkey";
            columns: ["pending_changed_by_citizen_id"];
            isOneToOne: false;
            referencedRelation: "citizens";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nation_relationships_to_nation_id_fkey";
            columns: ["to_nation_id"];
            isOneToOne: false;
            referencedRelation: "nations";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          citizen_id: string | null;
          event_id: string | null;
          generated_at: string;
          generated_in_transition_id: string | null;
          id: string;
          is_read: boolean;
          message_text: string;
          nation_id: string | null;
          notification_type: string;
          recipient_user_id: string;
          settlement_id: string | null;
          trade_route_id: string | null;
          world_id: string;
        };
        Insert: {
          citizen_id?: string | null;
          event_id?: string | null;
          generated_at?: string;
          generated_in_transition_id?: string | null;
          id?: string;
          is_read?: boolean;
          message_text: string;
          nation_id?: string | null;
          notification_type: string;
          recipient_user_id: string;
          settlement_id?: string | null;
          trade_route_id?: string | null;
          world_id: string;
        };
        Update: {
          citizen_id?: string | null;
          event_id?: string | null;
          generated_at?: string;
          generated_in_transition_id?: string | null;
          id?: string;
          is_read?: boolean;
          message_text?: string;
          nation_id?: string | null;
          notification_type?: string;
          recipient_user_id?: string;
          settlement_id?: string | null;
          trade_route_id?: string | null;
          world_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_nation_id_fkey";
            columns: ["nation_id"];
            isOneToOne: false;
            referencedRelation: "nations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_recipient_user_id_fkey";
            columns: ["recipient_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_settlement_id_fkey";
            columns: ["settlement_id"];
            isOneToOne: false;
            referencedRelation: "settlements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_transition_world_fkey";
            columns: ["generated_in_transition_id", "world_id"];
            isOneToOne: false;
            referencedRelation: "turn_transitions";
            referencedColumns: ["id", "world_id"];
          },
          {
            foreignKeyName: "notifications_world_id_fkey";
            columns: ["world_id"];
            isOneToOne: false;
            referencedRelation: "worlds";
            referencedColumns: ["id"];
          },
        ];
      };
      partnerships: {
        Row: {
          change_reason: string | null;
          changed_by_user_id: string | null;
          citizen_a_id: string;
          citizen_b_id: string;
          created_at: string;
          ended_on_turn_number: number | null;
          formed_on_turn_number: number;
          id: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          change_reason?: string | null;
          changed_by_user_id?: string | null;
          citizen_a_id: string;
          citizen_b_id: string;
          created_at?: string;
          ended_on_turn_number?: number | null;
          formed_on_turn_number: number;
          id?: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          change_reason?: string | null;
          changed_by_user_id?: string | null;
          citizen_a_id?: string;
          citizen_b_id?: string;
          created_at?: string;
          ended_on_turn_number?: number | null;
          formed_on_turn_number?: number;
          id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "partnerships_changed_by_user_id_fkey";
            columns: ["changed_by_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partnerships_citizen_a_id_fkey";
            columns: ["citizen_a_id"];
            isOneToOne: false;
            referencedRelation: "citizens";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partnerships_citizen_b_id_fkey";
            columns: ["citizen_b_id"];
            isOneToOne: false;
            referencedRelation: "citizens";
            referencedColumns: ["id"];
          },
        ];
      };
      settlements: {
        Row: {
          auto_ready_enabled: boolean;
          coord_x: number | null;
          coord_z: number | null;
          created_at: string;
          description: string | null;
          id: string;
          is_ready_current_turn: boolean;
          last_ready_at: string | null;
          name: string;
          nation_id: string;
          ready_set_at: string | null;
          ready_set_by_citizen_id: string | null;
          updated_at: string;
        };
        Insert: {
          auto_ready_enabled?: boolean;
          coord_x?: number | null;
          coord_z?: number | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_ready_current_turn?: boolean;
          last_ready_at?: string | null;
          name: string;
          nation_id: string;
          ready_set_at?: string | null;
          ready_set_by_citizen_id?: string | null;
          updated_at?: string;
        };
        Update: {
          auto_ready_enabled?: boolean;
          coord_x?: number | null;
          coord_z?: number | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_ready_current_turn?: boolean;
          last_ready_at?: string | null;
          name?: string;
          nation_id?: string;
          ready_set_at?: string | null;
          ready_set_by_citizen_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "settlements_nation_id_fkey";
            columns: ["nation_id"];
            isOneToOne: false;
            referencedRelation: "nations";
            referencedColumns: ["id"];
          },
        ];
      };
      turn_log_entries: {
        Row: {
          citizen_id: string | null;
          id: string;
          log_category: string;
          nation_id: string | null;
          payload_jsonb: Json;
          resource_id: string | null;
          settlement_id: string | null;
          turn_transition_id: string;
          world_id: string;
        };
        Insert: {
          citizen_id?: string | null;
          id?: string;
          log_category: string;
          nation_id?: string | null;
          payload_jsonb?: Json;
          resource_id?: string | null;
          settlement_id?: string | null;
          turn_transition_id: string;
          world_id: string;
        };
        Update: {
          citizen_id?: string | null;
          id?: string;
          log_category?: string;
          nation_id?: string | null;
          payload_jsonb?: Json;
          resource_id?: string | null;
          settlement_id?: string | null;
          turn_transition_id?: string;
          world_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "turn_log_entries_nation_id_fkey";
            columns: ["nation_id"];
            isOneToOne: false;
            referencedRelation: "nations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "turn_log_entries_settlement_id_fkey";
            columns: ["settlement_id"];
            isOneToOne: false;
            referencedRelation: "settlements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "turn_log_entries_transition_world_fkey";
            columns: ["turn_transition_id", "world_id"];
            isOneToOne: false;
            referencedRelation: "turn_transitions";
            referencedColumns: ["id", "world_id"];
          },
          {
            foreignKeyName: "turn_log_entries_world_id_fkey";
            columns: ["world_id"];
            isOneToOne: false;
            referencedRelation: "worlds";
            referencedColumns: ["id"];
          },
        ];
      };
      turn_transitions: {
        Row: {
          finished_at: string | null;
          forecast_snapshot_jsonb: Json | null;
          from_turn_number: number;
          id: string;
          initiated_by_user_id: string;
          readiness_summary_jsonb: Json | null;
          started_at: string;
          status: string;
          to_turn_number: number;
          world_id: string;
        };
        Insert: {
          finished_at?: string | null;
          forecast_snapshot_jsonb?: Json | null;
          from_turn_number: number;
          id?: string;
          initiated_by_user_id: string;
          readiness_summary_jsonb?: Json | null;
          started_at?: string;
          status?: string;
          to_turn_number: number;
          world_id: string;
        };
        Update: {
          finished_at?: string | null;
          forecast_snapshot_jsonb?: Json | null;
          from_turn_number?: number;
          id?: string;
          initiated_by_user_id?: string;
          readiness_summary_jsonb?: Json | null;
          started_at?: string;
          status?: string;
          to_turn_number?: number;
          world_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "turn_transitions_initiated_by_user_id_fkey";
            columns: ["initiated_by_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "turn_transitions_world_id_fkey";
            columns: ["world_id"];
            isOneToOne: false;
            referencedRelation: "worlds";
            referencedColumns: ["id"];
          },
        ];
      };
      users: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          is_super_admin: boolean;
          status: string;
          updated_at: string;
          username: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          id: string;
          is_super_admin?: boolean;
          status?: string;
          updated_at?: string;
          username: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          is_super_admin?: boolean;
          status?: string;
          updated_at?: string;
          username?: string;
        };
        Relationships: [];
      };
      world_admins: {
        Row: {
          created_at: string;
          id: string;
          user_id: string;
          world_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          user_id: string;
          world_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          user_id?: string;
          world_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "world_admins_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "world_admins_world_id_fkey";
            columns: ["world_id"];
            isOneToOne: false;
            referencedRelation: "worlds";
            referencedColumns: ["id"];
          },
        ];
      };
      worlds: {
        Row: {
          archived_at: string | null;
          calendar_config_json: Json;
          created_at: string;
          current_turn_number: number;
          id: string;
          name: string;
          owner_id: string;
          status: string;
          updated_at: string;
          visibility: string;
        };
        Insert: {
          archived_at?: string | null;
          calendar_config_json?: Json;
          created_at?: string;
          current_turn_number?: number;
          id?: string;
          name: string;
          owner_id: string;
          status?: string;
          updated_at?: string;
          visibility?: string;
        };
        Update: {
          archived_at?: string | null;
          calendar_config_json?: Json;
          created_at?: string;
          current_turn_number?: number;
          id?: string;
          name?: string;
          owner_id?: string;
          status?: string;
          updated_at?: string;
          visibility?: string;
        };
        Relationships: [
          {
            foreignKeyName: "worlds_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      advance_world_turn_if_current: {
        Args: {
          p_expected_turn_number: number;
          p_initiated_by_user_id: string;
          p_log_payload_jsonb?: Json;
          p_notification_payload_jsonb?: Json;
          p_world_id: string;
        };
        Returns: {
          from_turn_number: number;
          id: string;
          initiated_by_user_id: string;
          started_at: string;
          status: string;
          to_turn_number: number;
          world_id: string;
        }[];
      };
      current_app_user_id: { Args: never; Returns: string };
      default_calendar_config: { Args: never; Returns: Json };
      has_world_access: { Args: { p_world_id: string }; Returns: boolean };
      is_active_app_user: { Args: never; Returns: boolean };
      is_super_admin: { Args: never; Returns: boolean };
      is_valid_calendar_config: { Args: { config: Json }; Returns: boolean };
      is_world_admin: { Args: { p_world_id: string }; Returns: boolean };
      set_settlement_auto_ready: {
        Args: { p_auto_ready_enabled: boolean; p_settlement_id: string };
        Returns: {
          auto_ready_enabled: boolean;
          id: string;
          is_ready_current_turn: boolean;
          ready_set_at: string;
        }[];
      };
      set_settlement_readiness: {
        Args: { p_is_ready: boolean; p_settlement_id: string };
        Returns: {
          id: string;
          is_ready_current_turn: boolean;
          last_ready_at: string;
          ready_set_at: string;
        }[];
      };
      user_controls_player_character_in_world: {
        Args: { p_world_id: string };
        Returns: boolean;
      };
      user_is_nation_manager_of: {
        Args: { p_nation_id: string };
        Returns: boolean;
      };
      user_is_settlement_manager_of: {
        Args: { p_settlement_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;

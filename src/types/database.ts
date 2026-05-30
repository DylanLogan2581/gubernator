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
      building_blueprint_tiers: {
        Row: {
          building_blueprint_id: string;
          construction_costs_json: Json;
          created_at: string;
          effects_json: Json;
          id: string;
          tier_number: number;
          updated_at: string;
          upkeep_costs_json: Json;
          worker_turns_required: number;
        };
        Insert: {
          building_blueprint_id: string;
          construction_costs_json?: Json;
          created_at?: string;
          effects_json?: Json;
          id?: string;
          tier_number: number;
          updated_at?: string;
          upkeep_costs_json?: Json;
          worker_turns_required?: number;
        };
        Update: {
          building_blueprint_id?: string;
          construction_costs_json?: Json;
          created_at?: string;
          effects_json?: Json;
          id?: string;
          tier_number?: number;
          updated_at?: string;
          upkeep_costs_json?: Json;
          worker_turns_required?: number;
        };
        Relationships: [
          {
            foreignKeyName: "building_blueprint_tiers_building_blueprint_id_fkey";
            columns: ["building_blueprint_id"];
            isOneToOne: false;
            referencedRelation: "building_blueprints";
            referencedColumns: ["id"];
          },
        ];
      };
      building_blueprints: {
        Row: {
          created_at: string;
          description: string | null;
          grace_period_turns: number;
          id: string;
          is_active: boolean;
          max_instances_per_settlement: number | null;
          name: string;
          slug: string;
          updated_at: string;
          world_id: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          grace_period_turns?: number;
          id?: string;
          is_active?: boolean;
          max_instances_per_settlement?: number | null;
          name: string;
          slug: string;
          updated_at?: string;
          world_id: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          grace_period_turns?: number;
          id?: string;
          is_active?: boolean;
          max_instances_per_settlement?: number | null;
          name?: string;
          slug?: string;
          updated_at?: string;
          world_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "building_blueprints_world_id_fkey";
            columns: ["world_id"];
            isOneToOne: false;
            referencedRelation: "worlds";
            referencedColumns: ["id"];
          },
        ];
      };
      citizen_assignments: {
        Row: {
          assigned_on_turn_number: number;
          assignment_type: string;
          citizen_id: string;
          construction_project_id: number | null;
          created_at: string;
          deposit_instance_id: number | null;
          job_id: number | null;
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
          job_id?: number | null;
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
          job_id?: number | null;
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
          sex: string | null;
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
          sex?: string | null;
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
          sex?: string | null;
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
            foreignKeyName: "citizens_parent_a_world_fkey";
            columns: ["parent_a_citizen_id", "world_id"];
            isOneToOne: false;
            referencedRelation: "citizens";
            referencedColumns: ["id", "world_id"];
          },
          {
            foreignKeyName: "citizens_parent_b_citizen_id_fkey";
            columns: ["parent_b_citizen_id"];
            isOneToOne: false;
            referencedRelation: "citizens";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "citizens_parent_b_world_fkey";
            columns: ["parent_b_citizen_id", "world_id"];
            isOneToOne: false;
            referencedRelation: "citizens";
            referencedColumns: ["id", "world_id"];
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
      deposit_types: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          job_id: string;
          name: string;
          output_units_per_worker: number;
          slug: string;
          updated_at: string;
          worker_inputs_json: Json;
          world_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          job_id: string;
          name: string;
          output_units_per_worker: number;
          slug: string;
          updated_at?: string;
          worker_inputs_json?: Json;
          world_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          job_id?: string;
          name?: string;
          output_units_per_worker?: number;
          slug?: string;
          updated_at?: string;
          worker_inputs_json?: Json;
          world_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "deposit_types_job_id_fk";
            columns: ["job_id"];
            isOneToOne: true;
            referencedRelation: "job_definitions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "deposit_types_world_id_fkey";
            columns: ["world_id"];
            isOneToOne: false;
            referencedRelation: "worlds";
            referencedColumns: ["id"];
          },
        ];
      };
      job_definitions: {
        Row: {
          base_capacity: number | null;
          created_at: string;
          id: string;
          inputs_json: Json;
          is_active: boolean;
          job_type: string;
          linked_deposit_type_id: string | null;
          linked_managed_population_type_id: string | null;
          name: string;
          outputs_json: Json;
          slug: string;
          trader_capacity_per_worker: number | null;
          updated_at: string;
          world_id: string;
        };
        Insert: {
          base_capacity?: number | null;
          created_at?: string;
          id?: string;
          inputs_json?: Json;
          is_active?: boolean;
          job_type: string;
          linked_deposit_type_id?: string | null;
          linked_managed_population_type_id?: string | null;
          name: string;
          outputs_json?: Json;
          slug: string;
          trader_capacity_per_worker?: number | null;
          updated_at?: string;
          world_id: string;
        };
        Update: {
          base_capacity?: number | null;
          created_at?: string;
          id?: string;
          inputs_json?: Json;
          is_active?: boolean;
          job_type?: string;
          linked_deposit_type_id?: string | null;
          linked_managed_population_type_id?: string | null;
          name?: string;
          outputs_json?: Json;
          slug?: string;
          trader_capacity_per_worker?: number | null;
          updated_at?: string;
          world_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "job_definitions_linked_deposit_type_fk";
            columns: ["linked_deposit_type_id"];
            isOneToOne: false;
            referencedRelation: "deposit_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "job_definitions_linked_managed_pop_type_fk";
            columns: ["linked_managed_population_type_id"];
            isOneToOne: false;
            referencedRelation: "managed_population_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "job_definitions_world_id_fkey";
            columns: ["world_id"];
            isOneToOne: false;
            referencedRelation: "worlds";
            referencedColumns: ["id"];
          },
        ];
      };
      managed_population_types: {
        Row: {
          created_at: string;
          culling_job_id: string;
          culling_outputs_json: Json;
          growth_rate: number;
          husbandry_job_id: string;
          husbandry_workers_per_n_animals: number;
          id: string;
          is_active: boolean;
          maintenance_rules_json: Json;
          name: string;
          slug: string;
          updated_at: string;
          world_id: string;
        };
        Insert: {
          created_at?: string;
          culling_job_id: string;
          culling_outputs_json?: Json;
          growth_rate?: number;
          husbandry_job_id: string;
          husbandry_workers_per_n_animals: number;
          id?: string;
          is_active?: boolean;
          maintenance_rules_json?: Json;
          name: string;
          slug: string;
          updated_at?: string;
          world_id: string;
        };
        Update: {
          created_at?: string;
          culling_job_id?: string;
          culling_outputs_json?: Json;
          growth_rate?: number;
          husbandry_job_id?: string;
          husbandry_workers_per_n_animals?: number;
          id?: string;
          is_active?: boolean;
          maintenance_rules_json?: Json;
          name?: string;
          slug?: string;
          updated_at?: string;
          world_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "managed_population_types_culling_job_fk";
            columns: ["culling_job_id"];
            isOneToOne: true;
            referencedRelation: "job_definitions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "managed_population_types_husbandry_job_fk";
            columns: ["husbandry_job_id"];
            isOneToOne: true;
            referencedRelation: "job_definitions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "managed_population_types_world_id_fkey";
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
          world_id: string;
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
          world_id: string;
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
          world_id?: string;
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
            foreignKeyName: "nation_relationships_from_nation_world_fkey";
            columns: ["from_nation_id", "world_id"];
            isOneToOne: false;
            referencedRelation: "nations";
            referencedColumns: ["id", "world_id"];
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
          {
            foreignKeyName: "nation_relationships_to_nation_world_fkey";
            columns: ["to_nation_id", "world_id"];
            isOneToOne: false;
            referencedRelation: "nations";
            referencedColumns: ["id", "world_id"];
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
      resources: {
        Row: {
          base_stockpile_cap: number;
          created_at: string;
          id: string;
          is_deleted: boolean;
          is_system_resource: boolean;
          last_cleanup_summary_json: Json | null;
          name: string;
          slug: string;
          updated_at: string;
          world_id: string;
        };
        Insert: {
          base_stockpile_cap?: number;
          created_at?: string;
          id?: string;
          is_deleted?: boolean;
          is_system_resource?: boolean;
          last_cleanup_summary_json?: Json | null;
          name: string;
          slug: string;
          updated_at?: string;
          world_id: string;
        };
        Update: {
          base_stockpile_cap?: number;
          created_at?: string;
          id?: string;
          is_deleted?: boolean;
          is_system_resource?: boolean;
          last_cleanup_summary_json?: Json | null;
          name?: string;
          slug?: string;
          updated_at?: string;
          world_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "resources_world_id_fkey";
            columns: ["world_id"];
            isOneToOne: false;
            referencedRelation: "worlds";
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
          {
            foreignKeyName: "settlements_ready_set_by_citizen_id_fkey";
            columns: ["ready_set_by_citizen_id"];
            isOneToOne: false;
            referencedRelation: "citizens";
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
      user_active_player_characters: {
        Row: {
          citizen_id: string;
          updated_at: string;
          user_id: string;
          world_id: string;
        };
        Insert: {
          citizen_id: string;
          updated_at?: string;
          user_id: string;
          world_id: string;
        };
        Update: {
          citizen_id?: string;
          updated_at?: string;
          user_id?: string;
          world_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_active_player_characters_citizen_id_fkey";
            columns: ["citizen_id"];
            isOneToOne: false;
            referencedRelation: "citizens";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_active_player_characters_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_active_player_characters_world_id_fkey";
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
          fertility_chance: number;
          food_consumption_per_citizen: number;
          homelessness_decline_rate: number;
          id: string;
          incest_prevention_depth: number;
          maximum_fertility_age_turns: number | null;
          minimum_partnership_age_turns: number;
          mourning_period_turns: number;
          name: string;
          naming_config_json: Json;
          npc_flavor_config_json: Json;
          owner_id: string;
          partnership_seek_chance: number;
          starvation_severity_multiplier: number;
          status: string;
          updated_at: string;
          visibility: string;
          water_consumption_per_citizen: number;
        };
        Insert: {
          archived_at?: string | null;
          calendar_config_json?: Json;
          created_at?: string;
          current_turn_number?: number;
          fertility_chance?: number;
          food_consumption_per_citizen?: number;
          homelessness_decline_rate?: number;
          id?: string;
          incest_prevention_depth?: number;
          maximum_fertility_age_turns?: number | null;
          minimum_partnership_age_turns?: number;
          mourning_period_turns?: number;
          name: string;
          naming_config_json?: Json;
          npc_flavor_config_json?: Json;
          owner_id: string;
          partnership_seek_chance?: number;
          starvation_severity_multiplier?: number;
          status?: string;
          updated_at?: string;
          visibility?: string;
          water_consumption_per_citizen?: number;
        };
        Update: {
          archived_at?: string | null;
          calendar_config_json?: Json;
          created_at?: string;
          current_turn_number?: number;
          fertility_chance?: number;
          food_consumption_per_citizen?: number;
          homelessness_decline_rate?: number;
          id?: string;
          incest_prevention_depth?: number;
          maximum_fertility_age_turns?: number | null;
          minimum_partnership_age_turns?: number;
          mourning_period_turns?: number;
          name?: string;
          naming_config_json?: Json;
          npc_flavor_config_json?: Json;
          owner_id?: string;
          partnership_seek_chance?: number;
          starvation_severity_multiplier?: number;
          status?: string;
          updated_at?: string;
          visibility?: string;
          water_consumption_per_citizen?: number;
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
      assign_citizen_role: {
        Args: {
          p_citizen_id: string;
          p_role_nation_id?: string;
          p_role_settlement_id?: string;
          p_role_type: string;
        };
        Returns: {
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
          sex: string | null;
          skills_text: string | null;
          status: string;
          updated_at: string;
          user_id: string | null;
          world_id: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "citizens";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      citizen_role_scope_matches: {
        Args: {
          p_citizen_settlement_id: string;
          p_role_nation_id: string;
          p_role_settlement_id: string;
          p_role_type: string;
        };
        Returns: boolean;
      };
      citizen_visible_to_current_user: {
        Args: { p_citizen_id: string };
        Returns: boolean;
      };
      citizens_have_close_kinship: {
        Args: {
          p_citizen_a_id: string;
          p_citizen_b_id: string;
          p_depth: number;
        };
        Returns: boolean;
      };
      create_citizen_internal: {
        Args: {
          p_born_on_turn_number: number;
          p_citizen_type: string;
          p_name: string;
          p_npc_flaw: string;
          p_npc_goal: string;
          p_npc_secret_contradiction: string;
          p_npc_trait_1: string;
          p_npc_trait_2: string;
          p_parent_a_citizen_id: string;
          p_parent_b_citizen_id: string;
          p_personality_text: string;
          p_profile_photo_url: string;
          p_settlement_id: string;
          p_sex: string;
          p_skills_text: string;
          p_user_id: string;
          p_world_id: string;
        };
        Returns: {
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
          sex: string | null;
          skills_text: string | null;
          status: string;
          updated_at: string;
          user_id: string | null;
          world_id: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "citizens";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      create_npc: {
        Args: {
          p_born_on_turn_number?: number;
          p_name?: string;
          p_npc_flaw?: string;
          p_npc_goal?: string;
          p_npc_secret_contradiction?: string;
          p_npc_trait_1?: string;
          p_npc_trait_2?: string;
          p_parent_a_citizen_id?: string;
          p_parent_b_citizen_id?: string;
          p_personality_text?: string;
          p_profile_photo_url?: string;
          p_settlement_id?: string;
          p_sex?: string;
          p_skills_text?: string;
          p_world_id: string;
        };
        Returns: {
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
          sex: string | null;
          skills_text: string | null;
          status: string;
          updated_at: string;
          user_id: string | null;
          world_id: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "citizens";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      create_partnership: {
        Args: {
          p_change_reason: string;
          p_citizen_a_id: string;
          p_citizen_b_id: string;
          p_ended_on_turn_number?: number;
          p_formed_on_turn_number: number;
          p_status?: string;
          p_turn_transition_id: string;
        };
        Returns: {
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
        }[];
        SetofOptions: {
          from: "*";
          to: "partnerships";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      create_player_character: {
        Args: {
          p_born_on_turn_number?: number;
          p_name?: string;
          p_parent_a_citizen_id?: string;
          p_parent_b_citizen_id?: string;
          p_personality_text?: string;
          p_profile_photo_url?: string;
          p_settlement_id?: string;
          p_sex?: string;
          p_skills_text?: string;
          p_user_id?: string;
          p_world_id: string;
        };
        Returns: {
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
          sex: string | null;
          skills_text: string | null;
          status: string;
          updated_at: string;
          user_id: string | null;
          world_id: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "citizens";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      current_app_user_id: { Args: never; Returns: string };
      current_user_active_player_character_id: {
        Args: { p_world_id: string };
        Returns: string;
      };
      current_user_has_world_access: {
        Args: { p_world_id: string };
        Returns: boolean;
      };
      current_user_manages_nation: {
        Args: { p_nation_id: string };
        Returns: boolean;
      };
      current_user_manages_settlement: {
        Args: { p_settlement_id: string };
        Returns: boolean;
      };
      current_user_player_character_ids: {
        Args: { p_world_id: string };
        Returns: string[];
      };
      default_calendar_config: { Args: never; Returns: Json };
      default_naming_config: { Args: never; Returns: Json };
      default_npc_flavor_config: { Args: never; Returns: Json };
      dissolve_partnership: {
        Args: {
          p_change_reason: string;
          p_ended_on_turn_number: number;
          p_partnership_id: string;
          p_turn_transition_id: string;
        };
        Returns: {
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
        }[];
        SetofOptions: {
          from: "*";
          to: "partnerships";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      end_partnership_internal: {
        Args: {
          p_change_reason: string;
          p_ended_on_turn_number: number;
          p_log_category: string;
          p_partnership_id: string;
          p_terminal_status: string;
          p_turn_transition_id: string;
        };
        Returns: {
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
        }[];
        SetofOptions: {
          from: "*";
          to: "partnerships";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      has_world_access: { Args: { p_world_id: string }; Returns: boolean };
      is_active_app_user: { Args: never; Returns: boolean };
      is_any_world_admin: { Args: never; Returns: boolean };
      is_nation_manager_of: { Args: { p_nation_id: string }; Returns: boolean };
      is_settlement_manager_of: {
        Args: { p_settlement_id: string };
        Returns: boolean;
      };
      is_super_admin: { Args: never; Returns: boolean };
      is_valid_calendar_config: { Args: { config: Json }; Returns: boolean };
      is_valid_job_io_array: {
        Args: { arr: Json; p_world_id: string };
        Returns: boolean;
      };
      is_valid_naming_config: { Args: { config: Json }; Returns: boolean };
      is_valid_npc_flavor_config: { Args: { config: Json }; Returns: boolean };
      is_valid_population_resource_array: {
        Args: { arr: Json; p_world_id: string };
        Returns: boolean;
      };
      is_valid_resource_cost_array: {
        Args: { arr: Json; p_world_id: string };
        Returns: boolean;
      };
      is_valid_tier_effects_array: {
        Args: { arr: Json; p_world_id: string };
        Returns: boolean;
      };
      is_valid_worker_inputs_array: {
        Args: { arr: Json; p_world_id: string };
        Returns: boolean;
      };
      is_world_admin: { Args: { p_world_id: string }; Returns: boolean };
      link_user_to_citizen: {
        Args: { p_citizen_id: string; p_user_id: string };
        Returns: {
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
          sex: string | null;
          skills_text: string | null;
          status: string;
          updated_at: string;
          user_id: string | null;
          world_id: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "citizens";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      mark_partnership_widowed: {
        Args: {
          p_change_reason: string;
          p_ended_on_turn_number: number;
          p_partnership_id: string;
          p_turn_transition_id: string;
        };
        Returns: {
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
        }[];
        SetofOptions: {
          from: "*";
          to: "partnerships";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      nation_visible_to_current_user: {
        Args: { p_nation_id: string };
        Returns: boolean;
      };
      reassign_partner: {
        Args: {
          p_change_reason: string;
          p_ended_on_turn_number: number;
          p_formed_on_turn_number: number;
          p_new_partner_citizen_id: string;
          p_old_partnership_id: string;
          p_retained_citizen_id: string;
          p_turn_transition_id: string;
        };
        Returns: {
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
        }[];
        SetofOptions: {
          from: "*";
          to: "partnerships";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      respond_to_bilateral: {
        Args: {
          p_from_nation_id: string;
          p_response: string;
          p_to_nation_id: string;
        };
        Returns: {
          created_at: string;
          current_stance: string;
          from_nation_id: string;
          id: string;
          pending_changed_by_citizen_id: string | null;
          pending_stance: string | null;
          pending_status: string | null;
          to_nation_id: string;
          updated_at: string;
          world_id: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "nation_relationships";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      revoke_citizen_role: {
        Args: { p_citizen_id: string };
        Returns: {
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
          sex: string | null;
          skills_text: string | null;
          status: string;
          updated_at: string;
          user_id: string | null;
          world_id: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "citizens";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
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
      unlink_user_from_citizen: {
        Args: { p_citizen_id: string };
        Returns: {
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
          sex: string | null;
          skills_text: string | null;
          status: string;
          updated_at: string;
          user_id: string | null;
          world_id: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "citizens";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      user_has_player_character_in_world: {
        Args: { p_world_id: string };
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

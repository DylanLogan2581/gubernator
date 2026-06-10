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
      admin_create_user_idempotency_keys: {
        Row: {
          caller_user_id: string;
          created_at: string;
          created_user_email: string;
          created_user_id: string;
          created_user_username: string;
          expires_at: string;
          idempotency_key: string;
        };
        Insert: {
          caller_user_id: string;
          created_at?: string;
          created_user_email: string;
          created_user_id: string;
          created_user_username: string;
          expires_at?: string;
          idempotency_key: string;
        };
        Update: {
          caller_user_id?: string;
          created_at?: string;
          created_user_email?: string;
          created_user_id?: string;
          created_user_username?: string;
          expires_at?: string;
          idempotency_key?: string;
        };
        Relationships: [];
      };
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
          is_trashed: boolean;
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
          is_trashed?: boolean;
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
          is_trashed?: boolean;
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
          construction_project_id: string | null;
          created_at: string;
          deposit_instance_id: string | null;
          job_id: string | null;
          managed_population_instance_id: string | null;
          trade_route_end: string | null;
          trade_route_id: string | null;
          updated_at: string;
        };
        Insert: {
          assigned_on_turn_number: number;
          assignment_type: string;
          citizen_id: string;
          construction_project_id?: string | null;
          created_at?: string;
          deposit_instance_id?: string | null;
          job_id?: string | null;
          managed_population_instance_id?: string | null;
          trade_route_end?: string | null;
          trade_route_id?: string | null;
          updated_at?: string;
        };
        Update: {
          assigned_on_turn_number?: number;
          assignment_type?: string;
          citizen_id?: string;
          construction_project_id?: string | null;
          created_at?: string;
          deposit_instance_id?: string | null;
          job_id?: string | null;
          managed_population_instance_id?: string | null;
          trade_route_end?: string | null;
          trade_route_id?: string | null;
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
          {
            foreignKeyName: "citizen_assignments_construction_project_id_fkey";
            columns: ["construction_project_id"];
            isOneToOne: false;
            referencedRelation: "construction_projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "citizen_assignments_deposit_instance_id_fkey";
            columns: ["deposit_instance_id"];
            isOneToOne: false;
            referencedRelation: "deposit_instances";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "citizen_assignments_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "job_definitions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "citizen_assignments_managed_population_instance_id_fkey";
            columns: ["managed_population_instance_id"];
            isOneToOne: false;
            referencedRelation: "managed_population_instances";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "citizen_assignments_trade_route_id_fkey";
            columns: ["trade_route_id"];
            isOneToOne: false;
            referencedRelation: "trade_routes";
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
          death_cause_category:
            | Database["public"]["Enums"]["death_cause_category"]
            | null;
          given_name: string;
          id: string;
          name: string | null;
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
          surname: string | null;
          updated_at: string;
          user_id: string | null;
          world_id: string;
        };
        Insert: {
          born_on_turn_number?: number | null;
          citizen_type: string;
          created_at?: string;
          death_cause?: string | null;
          death_cause_category?:
            | Database["public"]["Enums"]["death_cause_category"]
            | null;
          given_name: string;
          id?: string;
          name?: string | null;
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
          surname?: string | null;
          updated_at?: string;
          user_id?: string | null;
          world_id: string;
        };
        Update: {
          born_on_turn_number?: number | null;
          citizen_type?: string;
          created_at?: string;
          death_cause?: string | null;
          death_cause_category?:
            | Database["public"]["Enums"]["death_cause_category"]
            | null;
          given_name?: string;
          id?: string;
          name?: string | null;
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
          surname?: string | null;
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
      construction_projects: {
        Row: {
          activated_on_turn_number: number | null;
          building_blueprint_id: string;
          cancelled_at: string | null;
          completed_in_transition_id: string | null;
          created_at: string;
          id: string;
          progress_worker_turns: number;
          queue_position: number;
          settlement_id: string;
          status: string;
          target_tier_id: string;
          updated_at: string;
        };
        Insert: {
          activated_on_turn_number?: number | null;
          building_blueprint_id: string;
          cancelled_at?: string | null;
          completed_in_transition_id?: string | null;
          created_at?: string;
          id?: string;
          progress_worker_turns?: number;
          queue_position: number;
          settlement_id: string;
          status: string;
          target_tier_id: string;
          updated_at?: string;
        };
        Update: {
          activated_on_turn_number?: number | null;
          building_blueprint_id?: string;
          cancelled_at?: string | null;
          completed_in_transition_id?: string | null;
          created_at?: string;
          id?: string;
          progress_worker_turns?: number;
          queue_position?: number;
          settlement_id?: string;
          status?: string;
          target_tier_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "construction_projects_building_blueprint_id_fkey";
            columns: ["building_blueprint_id"];
            isOneToOne: false;
            referencedRelation: "building_blueprints";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "construction_projects_completed_in_transition_id_fkey";
            columns: ["completed_in_transition_id"];
            isOneToOne: false;
            referencedRelation: "turn_transitions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "construction_projects_settlement_id_fkey";
            columns: ["settlement_id"];
            isOneToOne: false;
            referencedRelation: "settlements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "construction_projects_target_tier_id_fkey";
            columns: ["target_tier_id"];
            isOneToOne: false;
            referencedRelation: "building_blueprint_tiers";
            referencedColumns: ["id"];
          },
        ];
      };
      deposit_instance_resources: {
        Row: {
          created_at: string;
          deposit_instance_id: string;
          id: string;
          initial_quantity: number;
          remaining_quantity: number;
          resource_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          deposit_instance_id: string;
          id?: string;
          initial_quantity: number;
          remaining_quantity: number;
          resource_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deposit_instance_id?: string;
          id?: string;
          initial_quantity?: number;
          remaining_quantity?: number;
          resource_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "deposit_instance_resources_deposit_instance_id_fkey";
            columns: ["deposit_instance_id"];
            isOneToOne: false;
            referencedRelation: "deposit_instances";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "deposit_instance_resources_resource_id_fkey";
            columns: ["resource_id"];
            isOneToOne: false;
            referencedRelation: "resources";
            referencedColumns: ["id"];
          },
        ];
      };
      deposit_instances: {
        Row: {
          created_at: string;
          deposit_type_id: string;
          discovered_by_event_id: string | null;
          id: string;
          max_workers: number | null;
          name: string;
          settlement_id: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          deposit_type_id: string;
          discovered_by_event_id?: string | null;
          id?: string;
          max_workers?: number | null;
          name: string;
          settlement_id: string;
          status: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deposit_type_id?: string;
          discovered_by_event_id?: string | null;
          id?: string;
          max_workers?: number | null;
          name?: string;
          settlement_id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "deposit_instances_deposit_type_id_fkey";
            columns: ["deposit_type_id"];
            isOneToOne: false;
            referencedRelation: "deposit_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "deposit_instances_discovered_by_event_id_fkey";
            columns: ["discovered_by_event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "deposit_instances_settlement_id_fkey";
            columns: ["settlement_id"];
            isOneToOne: false;
            referencedRelation: "settlements";
            referencedColumns: ["id"];
          },
        ];
      };
      deposit_types: {
        Row: {
          created_at: string;
          id: string;
          is_trashed: boolean;
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
          is_trashed?: boolean;
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
          is_trashed?: boolean;
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
            isOneToOne: false;
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
      events: {
        Row: {
          activate_on_transition_after_turn_number: number;
          created_at: string;
          description: string | null;
          effect_payload_jsonb: Json;
          effect_type: string;
          id: string;
          name: string;
          status: string;
          updated_at: string;
          world_id: string;
        };
        Insert: {
          activate_on_transition_after_turn_number: number;
          created_at?: string;
          description?: string | null;
          effect_payload_jsonb?: Json;
          effect_type: string;
          id?: string;
          name: string;
          status?: string;
          updated_at?: string;
          world_id: string;
        };
        Update: {
          activate_on_transition_after_turn_number?: number;
          created_at?: string;
          description?: string | null;
          effect_payload_jsonb?: Json;
          effect_type?: string;
          id?: string;
          name?: string;
          status?: string;
          updated_at?: string;
          world_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "events_world_id_fkey";
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
          is_trashed: boolean;
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
          is_trashed?: boolean;
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
          is_trashed?: boolean;
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
      managed_population_instances: {
        Row: {
          configured_cull_quantity: number;
          created_at: string;
          current_count: number;
          id: string;
          managed_population_type_id: string;
          name: string;
          settlement_id: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          configured_cull_quantity?: number;
          created_at?: string;
          current_count: number;
          id?: string;
          managed_population_type_id: string;
          name: string;
          settlement_id: string;
          status: string;
          updated_at?: string;
        };
        Update: {
          configured_cull_quantity?: number;
          created_at?: string;
          current_count?: number;
          id?: string;
          managed_population_type_id?: string;
          name?: string;
          settlement_id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "managed_population_instances_managed_population_type_id_fkey";
            columns: ["managed_population_type_id"];
            isOneToOne: false;
            referencedRelation: "managed_population_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "managed_population_instances_settlement_id_fkey";
            columns: ["settlement_id"];
            isOneToOne: false;
            referencedRelation: "settlements";
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
          is_trashed: boolean;
          maintenance_rules_json: Json;
          name: string;
          regular_outputs_json: Json;
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
          is_trashed?: boolean;
          maintenance_rules_json?: Json;
          name: string;
          regular_outputs_json?: Json;
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
          is_trashed?: boolean;
          maintenance_rules_json?: Json;
          name?: string;
          regular_outputs_json?: Json;
          slug?: string;
          updated_at?: string;
          world_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "managed_population_types_culling_job_fk";
            columns: ["culling_job_id"];
            isOneToOne: false;
            referencedRelation: "job_definitions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "managed_population_types_husbandry_job_fk";
            columns: ["husbandry_job_id"];
            isOneToOne: false;
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
      namesets: {
        Row: {
          config_json: Json;
          created_at: string;
          id: string;
          is_default: boolean;
          is_trashed: boolean;
          name: string;
          updated_at: string;
          world_id: string;
        };
        Insert: {
          config_json?: Json;
          created_at?: string;
          id?: string;
          is_default?: boolean;
          is_trashed?: boolean;
          name: string;
          updated_at?: string;
          world_id: string;
        };
        Update: {
          config_json?: Json;
          created_at?: string;
          id?: string;
          is_default?: boolean;
          is_trashed?: boolean;
          name?: string;
          updated_at?: string;
          world_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "namesets_world_id_fkey";
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
          nameset_id: string | null;
          updated_at: string;
          world_id: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_hidden?: boolean;
          name: string;
          nameset_id?: string | null;
          updated_at?: string;
          world_id: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_hidden?: boolean;
          name?: string;
          nameset_id?: string | null;
          updated_at?: string;
          world_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "nations_nameset_id_fkey";
            columns: ["nameset_id"];
            isOneToOne: false;
            referencedRelation: "namesets";
            referencedColumns: ["id"];
          },
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
          notification_type: Database["public"]["Enums"]["notification_type"];
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
          notification_type: Database["public"]["Enums"]["notification_type"];
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
          notification_type?: Database["public"]["Enums"]["notification_type"];
          recipient_user_id?: string;
          settlement_id?: string | null;
          trade_route_id?: string | null;
          world_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_citizen_id_fkey";
            columns: ["citizen_id"];
            isOneToOne: false;
            referencedRelation: "citizens";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
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
            foreignKeyName: "notifications_trade_route_fkey";
            columns: ["trade_route_id"];
            isOneToOne: false;
            referencedRelation: "trade_routes";
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
          decay_rate: number;
          id: string;
          is_system_resource: boolean;
          is_trashed: boolean;
          last_cleanup_summary_json: Json | null;
          name: string;
          slug: string;
          updated_at: string;
          world_id: string;
        };
        Insert: {
          base_stockpile_cap?: number;
          created_at?: string;
          decay_rate?: number;
          id?: string;
          is_system_resource?: boolean;
          is_trashed?: boolean;
          last_cleanup_summary_json?: Json | null;
          name: string;
          slug: string;
          updated_at?: string;
          world_id: string;
        };
        Update: {
          base_stockpile_cap?: number;
          created_at?: string;
          decay_rate?: number;
          id?: string;
          is_system_resource?: boolean;
          is_trashed?: boolean;
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
      settlement_buildings: {
        Row: {
          activated_on_turn_number: number;
          building_blueprint_id: string;
          created_at: string;
          current_tier_id: string;
          deactivated_in_transition_id: string | null;
          id: string;
          missed_upkeep_count: number;
          name: string | null;
          settlement_id: string;
          source_project_id: string | null;
          state: string;
          updated_at: string;
        };
        Insert: {
          activated_on_turn_number: number;
          building_blueprint_id: string;
          created_at?: string;
          current_tier_id: string;
          deactivated_in_transition_id?: string | null;
          id?: string;
          missed_upkeep_count?: number;
          name?: string | null;
          settlement_id: string;
          source_project_id?: string | null;
          state: string;
          updated_at?: string;
        };
        Update: {
          activated_on_turn_number?: number;
          building_blueprint_id?: string;
          created_at?: string;
          current_tier_id?: string;
          deactivated_in_transition_id?: string | null;
          id?: string;
          missed_upkeep_count?: number;
          name?: string | null;
          settlement_id?: string;
          source_project_id?: string | null;
          state?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "settlement_buildings_building_blueprint_id_fkey";
            columns: ["building_blueprint_id"];
            isOneToOne: false;
            referencedRelation: "building_blueprints";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "settlement_buildings_current_tier_id_fkey";
            columns: ["current_tier_id"];
            isOneToOne: false;
            referencedRelation: "building_blueprint_tiers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "settlement_buildings_deactivated_in_transition_id_fkey";
            columns: ["deactivated_in_transition_id"];
            isOneToOne: false;
            referencedRelation: "turn_transitions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "settlement_buildings_settlement_id_fkey";
            columns: ["settlement_id"];
            isOneToOne: false;
            referencedRelation: "settlements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "settlement_buildings_source_project_id_fkey";
            columns: ["source_project_id"];
            isOneToOne: false;
            referencedRelation: "construction_projects";
            referencedColumns: ["id"];
          },
        ];
      };
      settlement_resource_stockpiles: {
        Row: {
          created_at: string;
          id: string;
          quantity: number;
          resource_id: string;
          settlement_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          quantity?: number;
          resource_id: string;
          settlement_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          quantity?: number;
          resource_id?: string;
          settlement_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "settlement_resource_stockpiles_resource_id_fkey";
            columns: ["resource_id"];
            isOneToOne: false;
            referencedRelation: "resources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "settlement_resource_stockpiles_settlement_id_fkey";
            columns: ["settlement_id"];
            isOneToOne: false;
            referencedRelation: "settlements";
            referencedColumns: ["id"];
          },
        ];
      };
      settlement_turn_resource_snapshots: {
        Row: {
          consumed_amount: number;
          created_at: string;
          id: string;
          produced_amount: number;
          quantity_after: number;
          quantity_before: number;
          resource_id: string;
          settlement_id: string;
          trade_in_amount: number;
          trade_out_amount: number;
          turn_number: number;
          turn_transition_id: string | null;
          world_id: string;
        };
        Insert: {
          consumed_amount?: number;
          created_at?: string;
          id?: string;
          produced_amount?: number;
          quantity_after?: number;
          quantity_before?: number;
          resource_id: string;
          settlement_id: string;
          trade_in_amount?: number;
          trade_out_amount?: number;
          turn_number: number;
          turn_transition_id?: string | null;
          world_id: string;
        };
        Update: {
          consumed_amount?: number;
          created_at?: string;
          id?: string;
          produced_amount?: number;
          quantity_after?: number;
          quantity_before?: number;
          resource_id?: string;
          settlement_id?: string;
          trade_in_amount?: number;
          trade_out_amount?: number;
          turn_number?: number;
          turn_transition_id?: string | null;
          world_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "settlement_turn_resource_snapshots_resource_id_fkey";
            columns: ["resource_id"];
            isOneToOne: false;
            referencedRelation: "resources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "settlement_turn_resource_snapshots_settlement_id_fkey";
            columns: ["settlement_id"];
            isOneToOne: false;
            referencedRelation: "settlements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "settlement_turn_resource_snapshots_transition_world_fkey";
            columns: ["turn_transition_id", "world_id"];
            isOneToOne: false;
            referencedRelation: "turn_transitions";
            referencedColumns: ["id", "world_id"];
          },
          {
            foreignKeyName: "settlement_turn_resource_snapshots_world_id_fkey";
            columns: ["world_id"];
            isOneToOne: false;
            referencedRelation: "worlds";
            referencedColumns: ["id"];
          },
        ];
      };
      settlement_turn_snapshots: {
        Row: {
          birth_count: number;
          buildings_summary_json: Json | null;
          created_at: string;
          death_count: number;
          homeless_deaths_count: number;
          id: string;
          managed_populations_summary_json: Json | null;
          partnerships_formed_count: number;
          population_cap: number;
          population_npc: number;
          population_player_character: number;
          population_total: number;
          settlement_id: string;
          starvation_deaths_count: number;
          trade_summary_json: Json | null;
          turn_number: number;
          turn_transition_id: string | null;
          warnings_summary_json: Json | null;
          world_id: string;
        };
        Insert: {
          birth_count?: number;
          buildings_summary_json?: Json | null;
          created_at?: string;
          death_count?: number;
          homeless_deaths_count?: number;
          id?: string;
          managed_populations_summary_json?: Json | null;
          partnerships_formed_count?: number;
          population_cap: number;
          population_npc: number;
          population_player_character: number;
          population_total: number;
          settlement_id: string;
          starvation_deaths_count?: number;
          trade_summary_json?: Json | null;
          turn_number: number;
          turn_transition_id?: string | null;
          warnings_summary_json?: Json | null;
          world_id: string;
        };
        Update: {
          birth_count?: number;
          buildings_summary_json?: Json | null;
          created_at?: string;
          death_count?: number;
          homeless_deaths_count?: number;
          id?: string;
          managed_populations_summary_json?: Json | null;
          partnerships_formed_count?: number;
          population_cap?: number;
          population_npc?: number;
          population_player_character?: number;
          population_total?: number;
          settlement_id?: string;
          starvation_deaths_count?: number;
          trade_summary_json?: Json | null;
          turn_number?: number;
          turn_transition_id?: string | null;
          warnings_summary_json?: Json | null;
          world_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "settlement_turn_snapshots_settlement_id_fkey";
            columns: ["settlement_id"];
            isOneToOne: false;
            referencedRelation: "settlements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "settlement_turn_snapshots_transition_world_fkey";
            columns: ["turn_transition_id", "world_id"];
            isOneToOne: false;
            referencedRelation: "turn_transitions";
            referencedColumns: ["id", "world_id"];
          },
          {
            foreignKeyName: "settlement_turn_snapshots_world_id_fkey";
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
          nameset_id: string | null;
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
          nameset_id?: string | null;
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
          nameset_id?: string | null;
          nation_id?: string;
          ready_set_at?: string | null;
          ready_set_by_citizen_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "settlements_nameset_id_fkey";
            columns: ["nameset_id"];
            isOneToOne: false;
            referencedRelation: "namesets";
            referencedColumns: ["id"];
          },
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
      trade_route_legs: {
        Row: {
          created_at: string;
          direction: string;
          id: string;
          quantity_per_transition: number;
          resource_id: string;
          trade_route_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          direction: string;
          id?: string;
          quantity_per_transition: number;
          resource_id: string;
          trade_route_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          direction?: string;
          id?: string;
          quantity_per_transition?: number;
          resource_id?: string;
          trade_route_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trade_route_legs_resource_id_fkey";
            columns: ["resource_id"];
            isOneToOne: false;
            referencedRelation: "resources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trade_route_legs_trade_route_id_fkey";
            columns: ["trade_route_id"];
            isOneToOne: false;
            referencedRelation: "trade_routes";
            referencedColumns: ["id"];
          },
        ];
      };
      trade_routes: {
        Row: {
          created_at: string;
          destination_approval_status: string;
          destination_approved_by_citizen_id: string | null;
          destination_settlement_id: string;
          id: string;
          origin_approval_status: string;
          origin_approved_by_citizen_id: string | null;
          origin_settlement_id: string;
          pause_reason_last_transition: string | null;
          proposed_by_citizen_id: string;
          replacement_for_trade_route_id: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          destination_approval_status?: string;
          destination_approved_by_citizen_id?: string | null;
          destination_settlement_id: string;
          id?: string;
          origin_approval_status?: string;
          origin_approved_by_citizen_id?: string | null;
          origin_settlement_id: string;
          pause_reason_last_transition?: string | null;
          proposed_by_citizen_id: string;
          replacement_for_trade_route_id?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          destination_approval_status?: string;
          destination_approved_by_citizen_id?: string | null;
          destination_settlement_id?: string;
          id?: string;
          origin_approval_status?: string;
          origin_approved_by_citizen_id?: string | null;
          origin_settlement_id?: string;
          pause_reason_last_transition?: string | null;
          proposed_by_citizen_id?: string;
          replacement_for_trade_route_id?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trade_routes_destination_approved_by_citizen_id_fkey";
            columns: ["destination_approved_by_citizen_id"];
            isOneToOne: false;
            referencedRelation: "citizens";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trade_routes_destination_settlement_id_fkey";
            columns: ["destination_settlement_id"];
            isOneToOne: false;
            referencedRelation: "settlements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trade_routes_origin_approved_by_citizen_id_fkey";
            columns: ["origin_approved_by_citizen_id"];
            isOneToOne: false;
            referencedRelation: "citizens";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trade_routes_origin_settlement_id_fkey";
            columns: ["origin_settlement_id"];
            isOneToOne: false;
            referencedRelation: "settlements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trade_routes_proposed_by_citizen_id_fkey";
            columns: ["proposed_by_citizen_id"];
            isOneToOne: false;
            referencedRelation: "citizens";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trade_routes_replacement_for_trade_route_id_fkey";
            columns: ["replacement_for_trade_route_id"];
            isOneToOne: false;
            referencedRelation: "trade_routes";
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
          turn_transition_id: string | null;
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
          turn_transition_id?: string | null;
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
          turn_transition_id?: string | null;
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
          is_trashed: boolean;
          maximum_fertility_age_turns: number | null;
          minimum_partnership_age_turns: number;
          mourning_period_turns: number;
          name: string;
          naming_config_json: Json;
          npc_flavor_config_json: Json;
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
          is_trashed?: boolean;
          maximum_fertility_age_turns?: number | null;
          minimum_partnership_age_turns?: number;
          mourning_period_turns?: number;
          name: string;
          naming_config_json?: Json;
          npc_flavor_config_json?: Json;
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
          is_trashed?: boolean;
          maximum_fertility_age_turns?: number | null;
          minimum_partnership_age_turns?: number;
          mourning_period_turns?: number;
          name?: string;
          naming_config_json?: Json;
          npc_flavor_config_json?: Json;
          partnership_seek_chance?: number;
          starvation_severity_multiplier?: number;
          status?: string;
          updated_at?: string;
          visibility?: string;
          water_consumption_per_citizen?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      settlement_stockpiles_view: {
        Row: {
          effective_cap: number | null;
          is_system_resource: boolean | null;
          quantity: number | null;
          resource_id: string | null;
          resource_name: string | null;
          settlement_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "settlement_resource_stockpiles_resource_id_fkey";
            columns: ["resource_id"];
            isOneToOne: false;
            referencedRelation: "resources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "settlement_resource_stockpiles_settlement_id_fkey";
            columns: ["settlement_id"];
            isOneToOne: false;
            referencedRelation: "settlements";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      add_settlement_building_as_admin: {
        Args: {
          p_blueprint_id: string;
          p_name?: string;
          p_settlement_id: string;
          p_tier_id: string;
        };
        Returns: {
          id: string;
        }[];
      };
      admin_clear_user_active_player_character: {
        Args: { p_user_id: string; p_world_id: string };
        Returns: undefined;
      };
      admin_set_user_active_player_character: {
        Args: { p_citizen_id: string; p_user_id: string; p_world_id: string };
        Returns: {
          citizen_id: string;
          updated_at: string;
          user_id: string;
          world_id: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "user_active_player_characters";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      apply_turn_transition: {
        Args: {
          p_expected_turn_number: number;
          p_payload: Json;
          p_transition_id: string;
          p_world_id: string;
        };
        Returns: Json;
      };
      approve_trade_route_side: {
        Args: {
          p_approver_citizen_id: string;
          p_route_id: string;
          p_side: string;
        };
        Returns: {
          destination_settlement_id: string;
          id: string;
          origin_settlement_id: string;
          status: string;
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
          death_cause_category:
            | Database["public"]["Enums"]["death_cause_category"]
            | null;
          given_name: string;
          id: string;
          name: string | null;
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
          surname: string | null;
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
      cancel_construction_project: {
        Args: { p_project_id: string };
        Returns: {
          project_id: string;
          unassigned_citizen_count: number;
        }[];
      };
      cancel_trade_route: {
        Args: { p_route_id: string };
        Returns: {
          destination_settlement_id: string;
          id: string;
          origin_settlement_id: string;
          status: string;
        }[];
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
          p_born_on_turn_number?: number;
          p_citizen_type: string;
          p_given_name: string;
          p_npc_flaw?: string;
          p_npc_goal?: string;
          p_npc_secret_contradiction?: string;
          p_npc_trait_1?: string;
          p_npc_trait_2?: string;
          p_parent_a_citizen_id?: string;
          p_parent_b_citizen_id?: string;
          p_personality_text?: string;
          p_profile_photo_url?: string;
          p_settlement_id: string;
          p_sex?: string;
          p_skills_text?: string;
          p_surname?: string;
          p_user_id?: string;
          p_world_id: string;
        };
        Returns: {
          born_on_turn_number: number | null;
          citizen_type: string;
          created_at: string;
          death_cause: string | null;
          death_cause_category:
            | Database["public"]["Enums"]["death_cause_category"]
            | null;
          given_name: string;
          id: string;
          name: string | null;
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
          surname: string | null;
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
      create_construction_project: {
        Args: {
          p_blueprint_id: string;
          p_settlement_id: string;
          p_target_tier_id: string;
        };
        Returns: {
          activated_on_turn_number: number | null;
          building_blueprint_id: string;
          cancelled_at: string | null;
          completed_in_transition_id: string | null;
          created_at: string;
          id: string;
          progress_worker_turns: number;
          queue_position: number;
          settlement_id: string;
          status: string;
          target_tier_id: string;
          updated_at: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "construction_projects";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      create_deposit_instance: {
        Args: {
          p_deposit_type_id: string;
          p_max_workers: number;
          p_name: string;
          p_resources: Json;
          p_settlement_id: string;
        };
        Returns: {
          created_at: string;
          deposit_type_id: string;
          discovered_by_event_id: string | null;
          id: string;
          max_workers: number | null;
          name: string;
          settlement_id: string;
          status: string;
          updated_at: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "deposit_instances";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      create_managed_population_instance: {
        Args: {
          p_initial_count: number;
          p_initial_cull_quantity: number;
          p_name: string;
          p_settlement_id: string;
          p_type_id: string;
        };
        Returns: {
          configured_cull_quantity: number;
          created_at: string;
          current_count: number;
          id: string;
          managed_population_type_id: string;
          name: string;
          settlement_id: string;
          status: string;
          updated_at: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "managed_population_instances";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      create_npc: {
        Args: {
          p_born_on_turn_number?: number;
          p_given_name: string;
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
          p_surname?: string;
          p_world_id: string;
        };
        Returns: {
          born_on_turn_number: number | null;
          citizen_type: string;
          created_at: string;
          death_cause: string | null;
          death_cause_category:
            | Database["public"]["Enums"]["death_cause_category"]
            | null;
          given_name: string;
          id: string;
          name: string | null;
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
          surname: string | null;
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
          p_given_name: string;
          p_parent_a_citizen_id?: string;
          p_parent_b_citizen_id?: string;
          p_personality_text?: string;
          p_profile_photo_url?: string;
          p_settlement_id?: string;
          p_sex?: string;
          p_skills_text?: string;
          p_surname?: string;
          p_user_id: string;
          p_world_id: string;
        };
        Returns: {
          born_on_turn_number: number | null;
          citizen_type: string;
          created_at: string;
          death_cause: string | null;
          death_cause_category:
            | Database["public"]["Enums"]["death_cause_category"]
            | null;
          given_name: string;
          id: string;
          name: string | null;
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
          surname: string | null;
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
      create_world: {
        Args: { p_name: string; p_visibility?: string };
        Returns: {
          archived_at: string | null;
          calendar_config_json: Json;
          created_at: string;
          current_turn_number: number;
          fertility_chance: number;
          food_consumption_per_citizen: number;
          homelessness_decline_rate: number;
          id: string;
          incest_prevention_depth: number;
          is_trashed: boolean;
          maximum_fertility_age_turns: number | null;
          minimum_partnership_age_turns: number;
          mourning_period_turns: number;
          name: string;
          naming_config_json: Json;
          npc_flavor_config_json: Json;
          partnership_seek_chance: number;
          starvation_severity_multiplier: number;
          status: string;
          updated_at: string;
          visibility: string;
          water_consumption_per_citizen: number;
        }[];
        SetofOptions: {
          from: "*";
          to: "worlds";
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
      current_user_player_character_world_ids: {
        Args: never;
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
      fail_stuck_turn_transition: {
        Args: { p_transition_id: string; p_world_id: string };
        Returns: Json;
      };
      get_citizen_admin_details: {
        Args: { p_citizen_id: string };
        Returns: {
          npc_flaw: string;
          npc_goal: string;
          npc_secret_contradiction: string;
          npc_trait_1: string;
          npc_trait_2: string;
          personality_text: string;
          skills_text: string;
        }[];
      };
      get_settlement_construction_project_counts: {
        Args: { p_settlement_id: string };
        Returns: {
          building_blueprint_id: string;
          construction_project_id: string;
          current_count: number;
          queue_position: number;
          status: string;
          target_tier_id: string;
        }[];
      };
      get_settlement_standard_job_counts: {
        Args: { p_settlement_id: string };
        Returns: {
          capacity: number;
          current_count: number;
          job_id: string;
          job_name: string;
          job_slug: string;
          world_id: string;
        }[];
      };
      grant_world_admin: {
        Args: { p_user_id: string; p_world_id: string };
        Returns: undefined;
      };
      hard_delete_building_blueprint: {
        Args: { p_blueprint_id: string; p_world_id: string };
        Returns: {
          id: string;
          world_id: string;
        }[];
      };
      hard_delete_construction_project: {
        Args: { p_project_id: string };
        Returns: {
          project_id: string;
          success: boolean;
        }[];
      };
      hard_delete_deposit_instance: {
        Args: { p_deposit_instance_id: string };
        Returns: {
          id: string;
          settlement_id: string;
        }[];
      };
      hard_delete_deposit_type: {
        Args: { p_deposit_type_id: string; p_world_id: string };
        Returns: {
          id: string;
          world_id: string;
        }[];
      };
      hard_delete_job_definition: {
        Args: { p_job_id: string; p_world_id: string };
        Returns: {
          id: string;
          world_id: string;
        }[];
      };
      hard_delete_managed_population_type: {
        Args: { p_mpt_id: string; p_world_id: string };
        Returns: {
          id: string;
          world_id: string;
        }[];
      };
      hard_delete_nameset: {
        Args: { p_nameset_id: string; p_world_id: string };
        Returns: {
          id: string;
          world_id: string;
        }[];
      };
      hard_delete_resource: {
        Args: { p_resource_id: string; p_world_id: string };
        Returns: {
          id: string;
          world_id: string;
        }[];
      };
      hard_delete_settlement_building: {
        Args: { p_building_id: string; p_world_id: string };
        Returns: {
          id: string;
          world_id: string;
        }[];
      };
      hard_delete_world: {
        Args: { p_world_id: string };
        Returns: {
          id: string;
        }[];
      };
      has_world_access: { Args: { p_world_id: string }; Returns: boolean };
      internal_apply_turn_transition_advance_world_turn: {
        Args: { p_expected_turn_number: number; p_world_id: string };
        Returns: number;
      };
      internal_apply_turn_transition_citizen_partnership_patches: {
        Args: { p_payload: Json; p_transition_id: string; p_world_id: string };
        Returns: Record<string, unknown>;
      };
      internal_apply_turn_transition_construction_patches: {
        Args: {
          p_payload: Json;
          p_to_turn_number: number;
          p_transition_id: string;
        };
        Returns: Record<string, unknown>;
      };
      internal_apply_turn_transition_deposit_managed_pop_patches: {
        Args: { p_payload: Json };
        Returns: Record<string, unknown>;
      };
      internal_apply_turn_transition_log_entries_and_notifications: {
        Args: { p_payload: Json; p_transition_id: string; p_world_id: string };
        Returns: Record<string, unknown>;
      };
      internal_apply_turn_transition_settlement_snapshots: {
        Args: { p_payload: Json; p_transition_id: string; p_world_id: string };
        Returns: number;
      };
      internal_apply_turn_transition_stockpile_deltas: {
        Args: {
          p_expected_turn_number: number;
          p_payload: Json;
          p_transition_id: string;
          p_world_id: string;
        };
        Returns: number;
      };
      internal_apply_turn_transition_trade_route_patches: {
        Args: { p_payload: Json };
        Returns: number;
      };
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
          death_cause_category:
            | Database["public"]["Enums"]["death_cause_category"]
            | null;
          given_name: string;
          id: string;
          name: string | null;
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
          surname: string | null;
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
      manual_deconstruct_settlement_building: {
        Args: { p_settlement_building_id: string };
        Returns: {
          settlement_building_id: string;
        }[];
      };
      mark_citizen_dead: {
        Args: { p_citizen_id: string; p_reason: string };
        Returns: {
          born_on_turn_number: number | null;
          citizen_type: string;
          created_at: string;
          death_cause: string | null;
          death_cause_category:
            | Database["public"]["Enums"]["death_cause_category"]
            | null;
          given_name: string;
          id: string;
          name: string | null;
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
          surname: string | null;
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
      propose_trade_route: {
        Args: {
          p_destination: string;
          p_legs: Json;
          p_origin: string;
          p_proposed_by_citizen_id: string;
        };
        Returns: {
          destination_settlement_id: string;
          id: string;
          origin_settlement_id: string;
        }[];
      };
      prune_old_snapshots_and_logs: {
        Args: {
          p_prune_notifications?: boolean;
          p_retention_turns?: number;
          p_world_id: string;
        };
        Returns: Json;
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
      reject_trade_route_side: {
        Args: {
          p_rejector_citizen_id: string;
          p_route_id: string;
          p_side: string;
        };
        Returns: {
          destination_settlement_id: string;
          id: string;
          origin_settlement_id: string;
          status: string;
        }[];
      };
      remove_deposit_instance: {
        Args: { p_deposit_instance_id: string };
        Returns: {
          id: string;
          settlement_id: string;
        }[];
      };
      remove_managed_population_instance: {
        Args: { p_instance_id: string };
        Returns: {
          id: string;
          settlement_id: string;
        }[];
      };
      rename_world: {
        Args: { p_name: string; p_world_id: string };
        Returns: {
          archived_at: string | null;
          calendar_config_json: Json;
          created_at: string;
          current_turn_number: number;
          fertility_chance: number;
          food_consumption_per_citizen: number;
          homelessness_decline_rate: number;
          id: string;
          incest_prevention_depth: number;
          is_trashed: boolean;
          maximum_fertility_age_turns: number | null;
          minimum_partnership_age_turns: number;
          mourning_period_turns: number;
          name: string;
          naming_config_json: Json;
          npc_flavor_config_json: Json;
          partnership_seek_chance: number;
          starvation_severity_multiplier: number;
          status: string;
          updated_at: string;
          visibility: string;
          water_consumption_per_citizen: number;
        }[];
        SetofOptions: {
          from: "*";
          to: "worlds";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      reorder_construction_projects: {
        Args: { p_positions: Json; p_settlement_id: string };
        Returns: {
          updated_count: number;
        }[];
      };
      replace_trade_route: {
        Args: {
          p_new_payload: Json;
          p_old_id: string;
          p_proposing_citizen_id: string;
        };
        Returns: {
          destination_settlement_id: string;
          new_route_id: string;
          old_route_id: string;
          origin_settlement_id: string;
        }[];
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
      restore_building_blueprint: {
        Args: { p_blueprint_id: string; p_world_id: string };
        Returns: {
          created_at: string;
          description: string | null;
          grace_period_turns: number;
          id: string;
          is_trashed: boolean;
          max_instances_per_settlement: number | null;
          name: string;
          slug: string;
          updated_at: string;
          world_id: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "building_blueprints";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      restore_deposit_instance: {
        Args: { p_deposit_instance_id: string };
        Returns: {
          id: string;
          settlement_id: string;
        }[];
      };
      restore_deposit_type: {
        Args: { p_deposit_type_id: string; p_world_id: string };
        Returns: {
          created_at: string;
          id: string;
          is_trashed: boolean;
          job_id: string;
          name: string;
          output_units_per_worker: number;
          slug: string;
          updated_at: string;
          worker_inputs_json: Json;
          world_id: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "deposit_types";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      restore_job_definition: {
        Args: { p_job_id: string; p_world_id: string };
        Returns: {
          base_capacity: number | null;
          created_at: string;
          id: string;
          inputs_json: Json;
          is_trashed: boolean;
          job_type: string;
          linked_deposit_type_id: string | null;
          linked_managed_population_type_id: string | null;
          name: string;
          outputs_json: Json;
          slug: string;
          trader_capacity_per_worker: number | null;
          updated_at: string;
          world_id: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "job_definitions";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      restore_managed_population_type: {
        Args: { p_mpt_id: string; p_world_id: string };
        Returns: {
          created_at: string;
          culling_job_id: string;
          culling_outputs_json: Json;
          growth_rate: number;
          husbandry_job_id: string;
          husbandry_workers_per_n_animals: number;
          id: string;
          is_trashed: boolean;
          maintenance_rules_json: Json;
          name: string;
          regular_outputs_json: Json;
          slug: string;
          updated_at: string;
          world_id: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "managed_population_types";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      restore_nameset: {
        Args: { p_nameset_id: string; p_world_id: string };
        Returns: {
          id: string;
          world_id: string;
        }[];
      };
      restore_resource: {
        Args: { p_resource_id: string; p_world_id: string };
        Returns: {
          base_stockpile_cap: number;
          created_at: string;
          decay_rate: number;
          id: string;
          is_system_resource: boolean;
          is_trashed: boolean;
          last_cleanup_summary_json: Json | null;
          name: string;
          slug: string;
          updated_at: string;
          world_id: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "resources";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      restore_settlement_building: {
        Args: { p_building_id: string; p_world_id: string };
        Returns: {
          activated_on_turn_number: number;
          building_blueprint_id: string;
          created_at: string;
          current_tier_id: string;
          deactivated_in_transition_id: string | null;
          id: string;
          missed_upkeep_count: number;
          name: string | null;
          settlement_id: string;
          source_project_id: string | null;
          state: string;
          updated_at: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "settlement_buildings";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      restore_world: {
        Args: { p_world_id: string };
        Returns: {
          archived_at: string | null;
          calendar_config_json: Json;
          created_at: string;
          current_turn_number: number;
          fertility_chance: number;
          food_consumption_per_citizen: number;
          homelessness_decline_rate: number;
          id: string;
          incest_prevention_depth: number;
          is_trashed: boolean;
          maximum_fertility_age_turns: number | null;
          minimum_partnership_age_turns: number;
          mourning_period_turns: number;
          name: string;
          naming_config_json: Json;
          npc_flavor_config_json: Json;
          partnership_seek_chance: number;
          starvation_severity_multiplier: number;
          status: string;
          updated_at: string;
          visibility: string;
          water_consumption_per_citizen: number;
        }[];
        SetofOptions: {
          from: "*";
          to: "worlds";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      resume_construction_project: {
        Args: { p_project_id: string };
        Returns: {
          project_id: string;
          success: boolean;
        }[];
      };
      revoke_citizen_role: {
        Args: { p_citizen_id: string };
        Returns: {
          born_on_turn_number: number | null;
          citizen_type: string;
          created_at: string;
          death_cause: string | null;
          death_cause_category:
            | Database["public"]["Enums"]["death_cause_category"]
            | null;
          given_name: string;
          id: string;
          name: string | null;
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
          surname: string | null;
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
      revoke_world_admin: {
        Args: { p_user_id: string; p_world_id: string };
        Returns: undefined;
      };
      search_users_for_admin_picker: {
        Args: { p_limit?: number; p_query?: string };
        Returns: {
          id: string;
          username: string;
        }[];
      };
      set_bulk_construction_assignment: {
        Args: { p_construction_project_id: string; p_target_count: number };
        Returns: {
          added_citizen_ids: string[];
          after: number;
          before: number;
          removed_citizen_ids: string[];
        }[];
      };
      set_bulk_construction_pool: {
        Args: { p_settlement_id: string; p_target_count: number };
        Returns: {
          added_citizen_ids: string[];
          after: number;
          before: number;
          removed_citizen_ids: string[];
        }[];
      };
      set_bulk_standard_job_assignment: {
        Args: {
          p_job_id: string;
          p_settlement_id: string;
          p_target_count: number;
        };
        Returns: {
          added_citizen_ids: string[];
          after: number;
          before: number;
          removed_citizen_ids: string[];
        }[];
      };
      set_configured_cull_quantity: {
        Args: { p_instance_id: string; p_quantity: number };
        Returns: {
          id: string;
          settlement_id: string;
        }[];
      };
      set_construction_project_workers: {
        Args: { p_project_id: string; p_target_count: number };
        Returns: {
          added_citizen_ids: string[];
          after: number;
          before: number;
          removed_citizen_ids: string[];
        }[];
      };
      set_deposit_instance_max_workers: {
        Args: {
          p_deposit_instance_id: string;
          p_max_workers: number;
          p_removal_strategy: string;
        };
        Returns: {
          max_workers: number;
          unassigned_citizen_ids: string[];
        }[];
      };
      set_deposit_instance_resource_quantities: {
        Args: {
          p_deposit_instance_resource_id: string;
          p_initial_quantity: number;
          p_remaining_quantity: number;
        };
        Returns: {
          deposit_instance_id: string;
          deposit_instance_resource_id: string;
          initial_quantity: number;
          remaining_quantity: number;
          settlement_id: string;
        }[];
      };
      set_nation_nameset: {
        Args: { p_nameset_id: string; p_nation_id: string; p_world_id: string };
        Returns: {
          id: string;
          nameset_id: string;
          world_id: string;
        }[];
      };
      set_per_target_assignment: {
        Args: {
          p_assignment_type: string;
          p_citizen_ids: string[];
          p_settlement_id: string;
          p_target_id: string;
          p_trade_route_end?: string;
        };
        Returns: {
          assigned_count: number;
          replaced_count: number;
        }[];
      };
      set_per_target_bulk_assignment: {
        Args: {
          p_assignment_type: string;
          p_settlement_id: string;
          p_target_count: number;
          p_target_id: string;
          p_trade_route_end?: string;
        };
        Returns: {
          added_citizen_ids: string[];
          after: number;
          before: number;
          removed_citizen_ids: string[];
        }[];
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
      set_settlement_nameset: {
        Args: {
          p_nameset_id: string;
          p_settlement_id: string;
          p_world_id: string;
        };
        Returns: {
          id: string;
          nameset_id: string;
          world_id: string;
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
      set_settlement_stockpile_quantity: {
        Args: {
          p_quantity: number;
          p_resource_id: string;
          p_settlement_id: string;
        };
        Returns: {
          quantity: number;
          resource_id: string;
          settlement_id: string;
        }[];
      };
      set_user_super_admin: {
        Args: { p_user_id: string; p_value: boolean };
        Returns: undefined;
      };
      set_world_current_turn_number: {
        Args: { p_turn_number: number; p_world_id: string };
        Returns: {
          archived_at: string | null;
          calendar_config_json: Json;
          created_at: string;
          current_turn_number: number;
          fertility_chance: number;
          food_consumption_per_citizen: number;
          homelessness_decline_rate: number;
          id: string;
          incest_prevention_depth: number;
          is_trashed: boolean;
          maximum_fertility_age_turns: number | null;
          minimum_partnership_age_turns: number;
          mourning_period_turns: number;
          name: string;
          naming_config_json: Json;
          npc_flavor_config_json: Json;
          partnership_seek_chance: number;
          starvation_severity_multiplier: number;
          status: string;
          updated_at: string;
          visibility: string;
          water_consumption_per_citizen: number;
        }[];
        SetofOptions: {
          from: "*";
          to: "worlds";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      set_world_default_nameset: {
        Args: { p_nameset_id: string; p_world_id: string };
        Returns: {
          id: string;
          world_id: string;
        }[];
      };
      settlement_alive_citizen_count: {
        Args: { p_settlement_id: string };
        Returns: number;
      };
      settlement_alive_citizen_count_internal: {
        Args: { p_settlement_id: string };
        Returns: number;
      };
      settlement_effective_storage_cap: {
        Args: { p_resource_id: string; p_settlement_id: string };
        Returns: number;
      };
      settlement_effective_storage_cap_internal: {
        Args: { p_resource_id: string; p_settlement_id: string };
        Returns: number;
      };
      settlement_job_capacity: {
        Args: { p_job_id: string; p_settlement_id: string };
        Returns: number;
      };
      settlement_population_cap: {
        Args: { p_settlement_id: string };
        Returns: number;
      };
      soft_delete_building_blueprint: {
        Args: { p_blueprint_id: string; p_world_id: string };
        Returns: {
          created_at: string;
          description: string | null;
          grace_period_turns: number;
          id: string;
          is_trashed: boolean;
          max_instances_per_settlement: number | null;
          name: string;
          slug: string;
          updated_at: string;
          world_id: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "building_blueprints";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      soft_delete_deposit_type: {
        Args: { p_deposit_type_id: string; p_world_id: string };
        Returns: {
          created_at: string;
          id: string;
          is_trashed: boolean;
          job_id: string;
          name: string;
          output_units_per_worker: number;
          slug: string;
          updated_at: string;
          worker_inputs_json: Json;
          world_id: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "deposit_types";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      soft_delete_job_definition: {
        Args: { p_job_id: string; p_world_id: string };
        Returns: {
          base_capacity: number | null;
          created_at: string;
          id: string;
          inputs_json: Json;
          is_trashed: boolean;
          job_type: string;
          linked_deposit_type_id: string | null;
          linked_managed_population_type_id: string | null;
          name: string;
          outputs_json: Json;
          slug: string;
          trader_capacity_per_worker: number | null;
          updated_at: string;
          world_id: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "job_definitions";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      soft_delete_managed_population_type: {
        Args: { p_mpt_id: string; p_world_id: string };
        Returns: {
          created_at: string;
          culling_job_id: string;
          culling_outputs_json: Json;
          growth_rate: number;
          husbandry_job_id: string;
          husbandry_workers_per_n_animals: number;
          id: string;
          is_trashed: boolean;
          maintenance_rules_json: Json;
          name: string;
          regular_outputs_json: Json;
          slug: string;
          updated_at: string;
          world_id: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "managed_population_types";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      soft_delete_nameset: {
        Args: { p_nameset_id: string; p_world_id: string };
        Returns: {
          id: string;
          world_id: string;
        }[];
      };
      soft_delete_resource: {
        Args: { p_resource_id: string; p_world_id: string };
        Returns: {
          base_stockpile_cap: number;
          created_at: string;
          decay_rate: number;
          id: string;
          is_system_resource: boolean;
          is_trashed: boolean;
          last_cleanup_summary_json: Json | null;
          name: string;
          slug: string;
          updated_at: string;
          world_id: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "resources";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      start_turn_transition: {
        Args: {
          p_expected_turn_number: number;
          p_initiated_by_user_id: string;
          p_world_id: string;
        };
        Returns: string;
      };
      trash_world: {
        Args: { p_world_id: string };
        Returns: {
          archived_at: string | null;
          calendar_config_json: Json;
          created_at: string;
          current_turn_number: number;
          fertility_chance: number;
          food_consumption_per_citizen: number;
          homelessness_decline_rate: number;
          id: string;
          incest_prevention_depth: number;
          is_trashed: boolean;
          maximum_fertility_age_turns: number | null;
          minimum_partnership_age_turns: number;
          mourning_period_turns: number;
          name: string;
          naming_config_json: Json;
          npc_flavor_config_json: Json;
          partnership_seek_chance: number;
          starvation_severity_multiplier: number;
          status: string;
          updated_at: string;
          visibility: string;
          water_consumption_per_citizen: number;
        }[];
        SetofOptions: {
          from: "*";
          to: "worlds";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      unlink_user_from_citizen: {
        Args: { p_citizen_id: string };
        Returns: {
          born_on_turn_number: number | null;
          citizen_type: string;
          created_at: string;
          death_cause: string | null;
          death_cause_category:
            | Database["public"]["Enums"]["death_cause_category"]
            | null;
          given_name: string;
          id: string;
          name: string | null;
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
          surname: string | null;
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
      update_settlement_coordinates: {
        Args: { p_coord_x: number; p_coord_z: number; p_settlement_id: string };
        Returns: {
          coord_x: number;
          coord_z: number;
          id: string;
        }[];
      };
      user_has_player_character_in_world: {
        Args: { p_world_id: string };
        Returns: boolean;
      };
      world_is_archived: { Args: { p_world_id: string }; Returns: boolean };
    };
    Enums: {
      death_cause_category:
        | "starvation"
        | "homeless"
        | "event"
        | "manual_admin"
        | "unknown";
      notification_type:
        | "turn.completed"
        | "trade_proposal_received"
        | "trade_proposal_accepted"
        | "trade_proposal_rejected"
        | "trade_route_cancelled"
        | "building.auto_deconstructed"
        | "building.suspended"
        | "citizen.born"
        | "citizen.died"
        | "construction.completed"
        | "construction.paused"
        | "deposit.depleted"
        | "managed_population.declining"
        | "managed_population.extinct"
        | "partnership.formed"
        | "partnership.widowed"
        | "settlement.homelessness_occurred"
        | "settlement.starvation_occurred"
        | "trade_route.paused"
        | "trade_route.resumed"
        | "building.recovered";
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
    Enums: {
      death_cause_category: [
        "starvation",
        "homeless",
        "event",
        "manual_admin",
        "unknown",
      ],
      notification_type: [
        "turn.completed",
        "trade_proposal_received",
        "trade_proposal_accepted",
        "trade_proposal_rejected",
        "trade_route_cancelled",
        "building.auto_deconstructed",
        "building.suspended",
        "citizen.born",
        "citizen.died",
        "construction.completed",
        "construction.paused",
        "deposit.depleted",
        "managed_population.declining",
        "managed_population.extinct",
        "partnership.formed",
        "partnership.widowed",
        "settlement.homelessness_occurred",
        "settlement.starvation_occurred",
        "trade_route.paused",
        "trade_route.resumed",
        "building.recovered",
      ],
    },
  },
} as const;

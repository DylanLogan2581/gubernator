export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
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
      armies: {
        Row: {
          created_at: string;
          created_turn_number: number;
          funding_source: string;
          id: string;
          name: string;
          nation_id: string;
          stationed_settlement_id: string;
          updated_at: string;
          world_id: string;
        };
        Insert: {
          created_at?: string;
          created_turn_number: number;
          funding_source: string;
          id?: string;
          name: string;
          nation_id: string;
          stationed_settlement_id: string;
          updated_at?: string;
          world_id: string;
        };
        Update: {
          created_at?: string;
          created_turn_number?: number;
          funding_source?: string;
          id?: string;
          name?: string;
          nation_id?: string;
          stationed_settlement_id?: string;
          updated_at?: string;
          world_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "armies_nation_id_fkey";
            columns: ["nation_id"];
            isOneToOne: false;
            referencedRelation: "nations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "armies_nation_world_fkey";
            columns: ["nation_id", "world_id"];
            isOneToOne: false;
            referencedRelation: "nations";
            referencedColumns: ["id", "world_id"];
          },
          {
            foreignKeyName: "armies_stationed_settlement_nation_fkey";
            columns: ["stationed_settlement_id", "nation_id"];
            isOneToOne: false;
            referencedRelation: "settlements";
            referencedColumns: ["id", "nation_id"];
          },
          {
            foreignKeyName: "armies_world_id_fkey";
            columns: ["world_id"];
            isOneToOne: false;
            referencedRelation: "worlds";
            referencedColumns: ["id"];
          },
        ];
      };
      army_groups: {
        Row: {
          army_id: string;
          created_at: string;
          id: string;
          name: string;
          parent_group_id: string | null;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          army_id: string;
          created_at?: string;
          id?: string;
          name: string;
          parent_group_id?: string | null;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          army_id?: string;
          created_at?: string;
          id?: string;
          name?: string;
          parent_group_id?: string | null;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "army_groups_army_id_fkey";
            columns: ["army_id"];
            isOneToOne: false;
            referencedRelation: "armies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "army_groups_parent_army_fkey";
            columns: ["parent_group_id", "army_id"];
            isOneToOne: false;
            referencedRelation: "army_groups";
            referencedColumns: ["id", "army_id"];
          },
        ];
      };
      army_turn_snapshots: {
        Row: {
          army_id: string;
          created_at: string;
          id: string;
          soldier_count_total: number;
          soldiers_by_unit_type_json: Json;
          turn_number: number;
          upkeep_paid: boolean;
          world_id: string;
        };
        Insert: {
          army_id: string;
          created_at?: string;
          id?: string;
          soldier_count_total: number;
          soldiers_by_unit_type_json?: Json;
          turn_number: number;
          upkeep_paid: boolean;
          world_id: string;
        };
        Update: {
          army_id?: string;
          created_at?: string;
          id?: string;
          soldier_count_total?: number;
          soldiers_by_unit_type_json?: Json;
          turn_number?: number;
          upkeep_paid?: boolean;
          world_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "army_turn_snapshots_army_id_fkey";
            columns: ["army_id"];
            isOneToOne: false;
            referencedRelation: "armies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "army_turn_snapshots_world_id_fkey";
            columns: ["world_id"];
            isOneToOne: false;
            referencedRelation: "worlds";
            referencedColumns: ["id"];
          },
        ];
      };
      army_units: {
        Row: {
          army_id: string;
          created_at: string;
          created_turn_number: number;
          group_id: string | null;
          id: string;
          name: string;
          sort_order: number;
          unit_type_id: string;
          updated_at: string;
        };
        Insert: {
          army_id: string;
          created_at?: string;
          created_turn_number: number;
          group_id?: string | null;
          id?: string;
          name: string;
          sort_order?: number;
          unit_type_id: string;
          updated_at?: string;
        };
        Update: {
          army_id?: string;
          created_at?: string;
          created_turn_number?: number;
          group_id?: string | null;
          id?: string;
          name?: string;
          sort_order?: number;
          unit_type_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "army_units_army_id_fkey";
            columns: ["army_id"];
            isOneToOne: false;
            referencedRelation: "armies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "army_units_group_army_fkey";
            columns: ["group_id", "army_id"];
            isOneToOne: false;
            referencedRelation: "army_groups";
            referencedColumns: ["id", "army_id"];
          },
          {
            foreignKeyName: "army_units_unit_type_id_fkey";
            columns: ["unit_type_id"];
            isOneToOne: false;
            referencedRelation: "unit_types";
            referencedColumns: ["id"];
          },
        ];
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
          icon: string | null;
          icon_color: number | null;
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
          icon?: string | null;
          icon_color?: number | null;
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
          icon?: string | null;
          icon_color?: number | null;
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
            referencedRelation: "citizen_directory_view";
            referencedColumns: ["id"];
          },
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
      citizen_memories: {
        Row: {
          citizen_id: string;
          created_at: string;
          created_by_user_id: string | null;
          event_id: string | null;
          event_memory_id: string | null;
          id: string;
          memory_text: string;
          occurred_on_turn_number: number;
          source: string;
          world_id: string;
        };
        Insert: {
          citizen_id: string;
          created_at?: string;
          created_by_user_id?: string | null;
          event_id?: string | null;
          event_memory_id?: string | null;
          id?: string;
          memory_text: string;
          occurred_on_turn_number: number;
          source: string;
          world_id: string;
        };
        Update: {
          citizen_id?: string;
          created_at?: string;
          created_by_user_id?: string | null;
          event_id?: string | null;
          event_memory_id?: string | null;
          id?: string;
          memory_text?: string;
          occurred_on_turn_number?: number;
          source?: string;
          world_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "citizen_memories_citizen_id_fkey";
            columns: ["citizen_id"];
            isOneToOne: false;
            referencedRelation: "citizen_directory_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "citizen_memories_citizen_id_fkey";
            columns: ["citizen_id"];
            isOneToOne: false;
            referencedRelation: "citizens";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "citizen_memories_created_by_user_id_fkey";
            columns: ["created_by_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "citizen_memories_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "citizen_memories_event_memory_id_fkey";
            columns: ["event_memory_id"];
            isOneToOne: false;
            referencedRelation: "event_memories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "citizen_memories_world_id_fkey";
            columns: ["world_id"];
            isOneToOne: false;
            referencedRelation: "worlds";
            referencedColumns: ["id"];
          },
        ];
      };
      citizens: {
        Row: {
          born_on_turn_number: number | null;
          citizen_type: string;
          created_at: string;
          culture_id: string | null;
          death_cause: string | null;
          death_cause_category:
            | Database["public"]["Enums"]["death_cause_category"]
            | null;
          education_level_id: string | null;
          given_name: string;
          id: string;
          name: string | null;
          nameset_id: string | null;
          npc_flaw: string | null;
          npc_goal: string | null;
          npc_secret_contradiction: string | null;
          npc_trait_1: string | null;
          npc_trait_2: string | null;
          parent_a_citizen_id: string | null;
          parent_b_citizen_id: string | null;
          personality_text: string | null;
          profile_photo_url: string | null;
          religion_id: string | null;
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
          culture_id?: string | null;
          death_cause?: string | null;
          death_cause_category?:
            | Database["public"]["Enums"]["death_cause_category"]
            | null;
          education_level_id?: string | null;
          given_name: string;
          id?: string;
          name?: string | null;
          nameset_id?: string | null;
          npc_flaw?: string | null;
          npc_goal?: string | null;
          npc_secret_contradiction?: string | null;
          npc_trait_1?: string | null;
          npc_trait_2?: string | null;
          parent_a_citizen_id?: string | null;
          parent_b_citizen_id?: string | null;
          personality_text?: string | null;
          profile_photo_url?: string | null;
          religion_id?: string | null;
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
          culture_id?: string | null;
          death_cause?: string | null;
          death_cause_category?:
            | Database["public"]["Enums"]["death_cause_category"]
            | null;
          education_level_id?: string | null;
          given_name?: string;
          id?: string;
          name?: string | null;
          nameset_id?: string | null;
          npc_flaw?: string | null;
          npc_goal?: string | null;
          npc_secret_contradiction?: string | null;
          npc_trait_1?: string | null;
          npc_trait_2?: string | null;
          parent_a_citizen_id?: string | null;
          parent_b_citizen_id?: string | null;
          personality_text?: string | null;
          profile_photo_url?: string | null;
          religion_id?: string | null;
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
            foreignKeyName: "citizens_culture_id_fkey";
            columns: ["culture_id"];
            isOneToOne: false;
            referencedRelation: "cultures";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "citizens_education_level_id_fkey";
            columns: ["education_level_id"];
            isOneToOne: false;
            referencedRelation: "education_levels";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "citizens_nameset_id_fkey";
            columns: ["nameset_id"];
            isOneToOne: false;
            referencedRelation: "namesets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "citizens_parent_a_citizen_id_fkey";
            columns: ["parent_a_citizen_id"];
            isOneToOne: false;
            referencedRelation: "citizen_directory_view";
            referencedColumns: ["id"];
          },
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
            referencedRelation: "citizen_directory_view";
            referencedColumns: ["id", "world_id"];
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
            referencedRelation: "citizen_directory_view";
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
            foreignKeyName: "citizens_parent_b_world_fkey";
            columns: ["parent_b_citizen_id", "world_id"];
            isOneToOne: false;
            referencedRelation: "citizen_directory_view";
            referencedColumns: ["id", "world_id"];
          },
          {
            foreignKeyName: "citizens_parent_b_world_fkey";
            columns: ["parent_b_citizen_id", "world_id"];
            isOneToOne: false;
            referencedRelation: "citizens";
            referencedColumns: ["id", "world_id"];
          },
          {
            foreignKeyName: "citizens_religion_id_fkey";
            columns: ["religion_id"];
            isOneToOne: false;
            referencedRelation: "religions";
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
      construction_project_subsidies: {
        Row: {
          clamped: boolean;
          created_at: string;
          created_by_user_id: string | null;
          granted_quantity: number;
          id: string;
          nation_id: string;
          project_id: string;
          resource_id: string;
          settlement_id: string;
        };
        Insert: {
          clamped?: boolean;
          created_at?: string;
          created_by_user_id?: string | null;
          granted_quantity: number;
          id?: string;
          nation_id: string;
          project_id: string;
          resource_id: string;
          settlement_id: string;
        };
        Update: {
          clamped?: boolean;
          created_at?: string;
          created_by_user_id?: string | null;
          granted_quantity?: number;
          id?: string;
          nation_id?: string;
          project_id?: string;
          resource_id?: string;
          settlement_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "construction_project_subsidies_created_by_user_id_fkey";
            columns: ["created_by_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "construction_project_subsidies_nation_id_fkey";
            columns: ["nation_id"];
            isOneToOne: false;
            referencedRelation: "nations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "construction_project_subsidies_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "construction_projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "construction_project_subsidies_resource_id_fkey";
            columns: ["resource_id"];
            isOneToOne: false;
            referencedRelation: "resources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "construction_project_subsidies_resource_id_fkey";
            columns: ["resource_id"];
            isOneToOne: false;
            referencedRelation: "resources_directory_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "construction_project_subsidies_settlement_id_fkey";
            columns: ["settlement_id"];
            isOneToOne: false;
            referencedRelation: "settlements";
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
      cultures: {
        Row: {
          architecture_craftsmanship: string | null;
          arts_aesthetics: string | null;
          attitudes_to_outsiders: string | null;
          color: string;
          core_values: string | null;
          created_at: string;
          cuisine_meals: string | null;
          demonym: string | null;
          description: string | null;
          dress_fashion: string | null;
          etiquette: string | null;
          festivals_holidays: string | null;
          funerary_customs: string | null;
          gender_family_norms: string | null;
          id: string;
          language_dialects: string | null;
          leadership_occupations: string | null;
          name: string;
          naming_conventions: string | null;
          origins: string | null;
          rites_of_passage: string | null;
          sayings_idioms: string | null;
          social_hierarchy: string | null;
          superstitions_folklore: string | null;
          taboos: string | null;
          updated_at: string;
          world_id: string;
        };
        Insert: {
          architecture_craftsmanship?: string | null;
          arts_aesthetics?: string | null;
          attitudes_to_outsiders?: string | null;
          color?: string;
          core_values?: string | null;
          created_at?: string;
          cuisine_meals?: string | null;
          demonym?: string | null;
          description?: string | null;
          dress_fashion?: string | null;
          etiquette?: string | null;
          festivals_holidays?: string | null;
          funerary_customs?: string | null;
          gender_family_norms?: string | null;
          id?: string;
          language_dialects?: string | null;
          leadership_occupations?: string | null;
          name: string;
          naming_conventions?: string | null;
          origins?: string | null;
          rites_of_passage?: string | null;
          sayings_idioms?: string | null;
          social_hierarchy?: string | null;
          superstitions_folklore?: string | null;
          taboos?: string | null;
          updated_at?: string;
          world_id: string;
        };
        Update: {
          architecture_craftsmanship?: string | null;
          arts_aesthetics?: string | null;
          attitudes_to_outsiders?: string | null;
          color?: string;
          core_values?: string | null;
          created_at?: string;
          cuisine_meals?: string | null;
          demonym?: string | null;
          description?: string | null;
          dress_fashion?: string | null;
          etiquette?: string | null;
          festivals_holidays?: string | null;
          funerary_customs?: string | null;
          gender_family_norms?: string | null;
          id?: string;
          language_dialects?: string | null;
          leadership_occupations?: string | null;
          name?: string;
          naming_conventions?: string | null;
          origins?: string | null;
          rites_of_passage?: string | null;
          sayings_idioms?: string | null;
          social_hierarchy?: string | null;
          superstitions_folklore?: string | null;
          taboos?: string | null;
          updated_at?: string;
          world_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cultures_world_id_fkey";
            columns: ["world_id"];
            isOneToOne: false;
            referencedRelation: "worlds";
            referencedColumns: ["id"];
          },
        ];
      };
      decrees: {
        Row: {
          body_markdown: string;
          created_at: string;
          id: string;
          issued_by_citizen_id: string | null;
          issued_turn_number: number;
          nation_id: string | null;
          revoked_turn_number: number | null;
          settlement_id: string | null;
          title: string;
          world_id: string;
        };
        Insert: {
          body_markdown: string;
          created_at?: string;
          id?: string;
          issued_by_citizen_id?: string | null;
          issued_turn_number: number;
          nation_id?: string | null;
          revoked_turn_number?: number | null;
          settlement_id?: string | null;
          title: string;
          world_id: string;
        };
        Update: {
          body_markdown?: string;
          created_at?: string;
          id?: string;
          issued_by_citizen_id?: string | null;
          issued_turn_number?: number;
          nation_id?: string | null;
          revoked_turn_number?: number | null;
          settlement_id?: string | null;
          title?: string;
          world_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "decrees_issued_by_citizen_id_fkey";
            columns: ["issued_by_citizen_id"];
            isOneToOne: false;
            referencedRelation: "citizen_directory_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "decrees_issued_by_citizen_id_fkey";
            columns: ["issued_by_citizen_id"];
            isOneToOne: false;
            referencedRelation: "citizens";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "decrees_nation_id_fkey";
            columns: ["nation_id"];
            isOneToOne: false;
            referencedRelation: "nations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "decrees_settlement_id_fkey";
            columns: ["settlement_id"];
            isOneToOne: false;
            referencedRelation: "settlements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "decrees_world_id_fkey";
            columns: ["world_id"];
            isOneToOne: false;
            referencedRelation: "worlds";
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
          {
            foreignKeyName: "deposit_instance_resources_resource_id_fkey";
            columns: ["resource_id"];
            isOneToOne: false;
            referencedRelation: "resources_directory_view";
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
      deposit_type_jobs: {
        Row: {
          created_at: string;
          deposit_type_id: string;
          id: string;
          job_id: string;
          output_units_per_worker: number;
          updated_at: string;
          worker_inputs_json: Json;
          world_id: string;
        };
        Insert: {
          created_at?: string;
          deposit_type_id: string;
          id?: string;
          job_id: string;
          output_units_per_worker: number;
          updated_at?: string;
          worker_inputs_json?: Json;
          world_id: string;
        };
        Update: {
          created_at?: string;
          deposit_type_id?: string;
          id?: string;
          job_id?: string;
          output_units_per_worker?: number;
          updated_at?: string;
          worker_inputs_json?: Json;
          world_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "deposit_type_jobs_deposit_type_world_fk";
            columns: ["deposit_type_id", "world_id"];
            isOneToOne: false;
            referencedRelation: "deposit_types";
            referencedColumns: ["id", "world_id"];
          },
          {
            foreignKeyName: "deposit_type_jobs_job_world_fk";
            columns: ["job_id", "world_id"];
            isOneToOne: false;
            referencedRelation: "job_definitions";
            referencedColumns: ["id", "world_id"];
          },
        ];
      };
      deposit_types: {
        Row: {
          created_at: string;
          icon: string | null;
          icon_color: number | null;
          id: string;
          is_trashed: boolean;
          name: string;
          slug: string;
          updated_at: string;
          world_id: string;
        };
        Insert: {
          created_at?: string;
          icon?: string | null;
          icon_color?: number | null;
          id?: string;
          is_trashed?: boolean;
          name: string;
          slug: string;
          updated_at?: string;
          world_id: string;
        };
        Update: {
          created_at?: string;
          icon?: string | null;
          icon_color?: number | null;
          id?: string;
          is_trashed?: boolean;
          name?: string;
          slug?: string;
          updated_at?: string;
          world_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "deposit_types_world_id_fkey";
            columns: ["world_id"];
            isOneToOne: false;
            referencedRelation: "worlds";
            referencedColumns: ["id"];
          },
        ];
      };
      edge_rate_limit_buckets: {
        Row: {
          function_name: string;
          request_count: number;
          user_id: string;
          window_minute: string;
        };
        Insert: {
          function_name: string;
          request_count?: number;
          user_id: string;
          window_minute: string;
        };
        Update: {
          function_name?: string;
          request_count?: number;
          user_id?: string;
          window_minute?: string;
        };
        Relationships: [];
      };
      education_enrollments: {
        Row: {
          citizen_id: string;
          created_at: string;
          enrolled_turn_number: number;
          id: string;
          progress_turns: number;
          settlement_building_id: string;
          target_level_id: string;
          updated_at: string;
          world_id: string;
        };
        Insert: {
          citizen_id: string;
          created_at?: string;
          enrolled_turn_number: number;
          id?: string;
          progress_turns?: number;
          settlement_building_id: string;
          target_level_id: string;
          updated_at?: string;
          world_id: string;
        };
        Update: {
          citizen_id?: string;
          created_at?: string;
          enrolled_turn_number?: number;
          id?: string;
          progress_turns?: number;
          settlement_building_id?: string;
          target_level_id?: string;
          updated_at?: string;
          world_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "education_enrollments_citizen_id_fkey";
            columns: ["citizen_id"];
            isOneToOne: true;
            referencedRelation: "citizen_directory_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "education_enrollments_citizen_id_fkey";
            columns: ["citizen_id"];
            isOneToOne: true;
            referencedRelation: "citizens";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "education_enrollments_settlement_building_id_fkey";
            columns: ["settlement_building_id"];
            isOneToOne: false;
            referencedRelation: "settlement_buildings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "education_enrollments_target_level_id_fkey";
            columns: ["target_level_id"];
            isOneToOne: false;
            referencedRelation: "education_levels";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "education_enrollments_world_id_fkey";
            columns: ["world_id"];
            isOneToOne: false;
            referencedRelation: "worlds";
            referencedColumns: ["id"];
          },
        ];
      };
      education_levels: {
        Row: {
          created_at: string;
          description: string | null;
          icon: string | null;
          icon_color: number | null;
          id: string;
          name: string;
          natural_born_percent: number;
          rank: number;
          updated_at: string;
          world_id: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          icon?: string | null;
          icon_color?: number | null;
          id?: string;
          name: string;
          natural_born_percent?: number;
          rank: number;
          updated_at?: string;
          world_id: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          icon?: string | null;
          icon_color?: number | null;
          id?: string;
          name?: string;
          natural_born_percent?: number;
          rank?: number;
          updated_at?: string;
          world_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "education_levels_world_id_fkey";
            columns: ["world_id"];
            isOneToOne: false;
            referencedRelation: "worlds";
            referencedColumns: ["id"];
          },
        ];
      };
      email_send_log: {
        Row: {
          created_at: string;
          id: string;
          recipient_count: number;
          recipient_spec: Json;
          sender_user_id: string | null;
          subject: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          recipient_count: number;
          recipient_spec: Json;
          sender_user_id?: string | null;
          subject: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          recipient_count?: number;
          recipient_spec?: Json;
          sender_user_id?: string | null;
          subject?: string;
        };
        Relationships: [
          {
            foreignKeyName: "email_send_log_sender_user_id_fkey";
            columns: ["sender_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      event_effects: {
        Row: {
          amount_value: number | null;
          building_blueprint_id: string | null;
          created_at: string;
          deposit_instance_id: string | null;
          effect_type: string;
          event_id: string;
          extra_data_jsonb: Json;
          id: string;
          is_percent: boolean;
          job_id: string | null;
          managed_population_instance_id: string | null;
          managed_population_type_id: string | null;
          multiplier_value: number | null;
          resource_id: string | null;
          settlement_building_id: string | null;
          updated_at: string;
        };
        Insert: {
          amount_value?: number | null;
          building_blueprint_id?: string | null;
          created_at?: string;
          deposit_instance_id?: string | null;
          effect_type: string;
          event_id: string;
          extra_data_jsonb?: Json;
          id?: string;
          is_percent?: boolean;
          job_id?: string | null;
          managed_population_instance_id?: string | null;
          managed_population_type_id?: string | null;
          multiplier_value?: number | null;
          resource_id?: string | null;
          settlement_building_id?: string | null;
          updated_at?: string;
        };
        Update: {
          amount_value?: number | null;
          building_blueprint_id?: string | null;
          created_at?: string;
          deposit_instance_id?: string | null;
          effect_type?: string;
          event_id?: string;
          extra_data_jsonb?: Json;
          id?: string;
          is_percent?: boolean;
          job_id?: string | null;
          managed_population_instance_id?: string | null;
          managed_population_type_id?: string | null;
          multiplier_value?: number | null;
          resource_id?: string | null;
          settlement_building_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_effects_building_blueprint_id_fkey";
            columns: ["building_blueprint_id"];
            isOneToOne: false;
            referencedRelation: "building_blueprints";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_effects_deposit_instance_id_fkey";
            columns: ["deposit_instance_id"];
            isOneToOne: false;
            referencedRelation: "deposit_instances";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_effects_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_effects_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "job_definitions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_effects_managed_population_instance_id_fkey";
            columns: ["managed_population_instance_id"];
            isOneToOne: false;
            referencedRelation: "managed_population_instances";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_effects_managed_population_type_id_fkey";
            columns: ["managed_population_type_id"];
            isOneToOne: false;
            referencedRelation: "managed_population_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_effects_resource_id_fkey";
            columns: ["resource_id"];
            isOneToOne: false;
            referencedRelation: "resources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_effects_resource_id_fkey";
            columns: ["resource_id"];
            isOneToOne: false;
            referencedRelation: "resources_directory_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_effects_settlement_building_id_fkey";
            columns: ["settlement_building_id"];
            isOneToOne: false;
            referencedRelation: "settlement_buildings";
            referencedColumns: ["id"];
          },
        ];
      };
      event_groups: {
        Row: {
          created_at: string;
          created_by_user_id: string | null;
          created_during_turn_number: number;
          description: string | null;
          id: string;
          name: string;
          updated_at: string;
          world_id: string;
        };
        Insert: {
          created_at?: string;
          created_by_user_id?: string | null;
          created_during_turn_number: number;
          description?: string | null;
          id?: string;
          name: string;
          updated_at?: string;
          world_id: string;
        };
        Update: {
          created_at?: string;
          created_by_user_id?: string | null;
          created_during_turn_number?: number;
          description?: string | null;
          id?: string;
          name?: string;
          updated_at?: string;
          world_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_groups_world_id_fkey";
            columns: ["world_id"];
            isOneToOne: false;
            referencedRelation: "worlds";
            referencedColumns: ["id"];
          },
        ];
      };
      event_memories: {
        Row: {
          created_at: string;
          event_id: string;
          id: string;
          memory_text: string;
          turn_offset: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          event_id: string;
          id?: string;
          memory_text: string;
          turn_offset?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          event_id?: string;
          id?: string;
          memory_text?: string;
          turn_offset?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_memories_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      events: {
        Row: {
          activate_on_transition_after_turn_number: number;
          amount_value: number | null;
          building_blueprint_id: string | null;
          created_at: string;
          description: string | null;
          duration_transitions: number | null;
          duration_type: string;
          effect_payload_jsonb: Json;
          effect_type: string | null;
          event_group_id: string | null;
          extra_data_jsonb: Json;
          id: string;
          job_id: number | null;
          managed_population_type_id: string | null;
          multiplier_value: number | null;
          name: string;
          remaining_transitions: number | null;
          scope_nation_id: string | null;
          scope_settlement_id: string | null;
          scope_type: string | null;
          status: string;
          updated_at: string;
          world_id: string;
        };
        Insert: {
          activate_on_transition_after_turn_number: number;
          amount_value?: number | null;
          building_blueprint_id?: string | null;
          created_at?: string;
          description?: string | null;
          duration_transitions?: number | null;
          duration_type?: string;
          effect_payload_jsonb?: Json;
          effect_type?: string | null;
          event_group_id?: string | null;
          extra_data_jsonb?: Json;
          id?: string;
          job_id?: number | null;
          managed_population_type_id?: string | null;
          multiplier_value?: number | null;
          name: string;
          remaining_transitions?: number | null;
          scope_nation_id?: string | null;
          scope_settlement_id?: string | null;
          scope_type?: string | null;
          status?: string;
          updated_at?: string;
          world_id: string;
        };
        Update: {
          activate_on_transition_after_turn_number?: number;
          amount_value?: number | null;
          building_blueprint_id?: string | null;
          created_at?: string;
          description?: string | null;
          duration_transitions?: number | null;
          duration_type?: string;
          effect_payload_jsonb?: Json;
          effect_type?: string | null;
          event_group_id?: string | null;
          extra_data_jsonb?: Json;
          id?: string;
          job_id?: number | null;
          managed_population_type_id?: string | null;
          multiplier_value?: number | null;
          name?: string;
          remaining_transitions?: number | null;
          scope_nation_id?: string | null;
          scope_settlement_id?: string | null;
          scope_type?: string | null;
          status?: string;
          updated_at?: string;
          world_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "events_building_blueprint_id_fkey";
            columns: ["building_blueprint_id"];
            isOneToOne: false;
            referencedRelation: "building_blueprints";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "events_event_group_id_fkey";
            columns: ["event_group_id"];
            isOneToOne: false;
            referencedRelation: "event_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "events_managed_population_type_id_fkey";
            columns: ["managed_population_type_id"];
            isOneToOne: false;
            referencedRelation: "managed_population_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "events_scope_nation_id_fkey";
            columns: ["scope_nation_id"];
            isOneToOne: false;
            referencedRelation: "nations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "events_scope_settlement_id_fkey";
            columns: ["scope_settlement_id"];
            isOneToOne: false;
            referencedRelation: "settlements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "events_world_id_fkey";
            columns: ["world_id"];
            isOneToOne: false;
            referencedRelation: "worlds";
            referencedColumns: ["id"];
          },
        ];
      };
      government_bodies: {
        Row: {
          composition_json: Json;
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          nation_id: string | null;
          settlement_id: string | null;
          updated_at: string;
          world_id: string;
        };
        Insert: {
          composition_json: Json;
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          nation_id?: string | null;
          settlement_id?: string | null;
          updated_at?: string;
          world_id: string;
        };
        Update: {
          composition_json?: Json;
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          nation_id?: string | null;
          settlement_id?: string | null;
          updated_at?: string;
          world_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "government_bodies_nation_id_fkey";
            columns: ["nation_id"];
            isOneToOne: false;
            referencedRelation: "nations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "government_bodies_settlement_id_fkey";
            columns: ["settlement_id"];
            isOneToOne: false;
            referencedRelation: "settlements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "government_bodies_world_id_fkey";
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
          icon: string | null;
          icon_color: number | null;
          id: string;
          inputs_json: Json;
          is_trashed: boolean;
          job_type: string;
          linked_deposit_type_id: string | null;
          linked_managed_population_type_id: string | null;
          name: string;
          outputs_json: Json;
          required_education_level_id: string | null;
          slug: string;
          trader_capacity_per_worker: number | null;
          updated_at: string;
          world_id: string;
        };
        Insert: {
          base_capacity?: number | null;
          created_at?: string;
          icon?: string | null;
          icon_color?: number | null;
          id?: string;
          inputs_json?: Json;
          is_trashed?: boolean;
          job_type: string;
          linked_deposit_type_id?: string | null;
          linked_managed_population_type_id?: string | null;
          name: string;
          outputs_json?: Json;
          required_education_level_id?: string | null;
          slug: string;
          trader_capacity_per_worker?: number | null;
          updated_at?: string;
          world_id: string;
        };
        Update: {
          base_capacity?: number | null;
          created_at?: string;
          icon?: string | null;
          icon_color?: number | null;
          id?: string;
          inputs_json?: Json;
          is_trashed?: boolean;
          job_type?: string;
          linked_deposit_type_id?: string | null;
          linked_managed_population_type_id?: string | null;
          name?: string;
          outputs_json?: Json;
          required_education_level_id?: string | null;
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
            foreignKeyName: "job_definitions_required_education_level_fk";
            columns: ["required_education_level_id"];
            isOneToOne: false;
            referencedRelation: "education_levels";
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
      law_amendment_votes: {
        Row: {
          amendment_id: string;
          cast_by_user_id: string | null;
          created_at: string;
          id: string;
          vote: boolean;
          voter_citizen_id: string;
        };
        Insert: {
          amendment_id: string;
          cast_by_user_id?: string | null;
          created_at?: string;
          id?: string;
          vote: boolean;
          voter_citizen_id: string;
        };
        Update: {
          amendment_id?: string;
          cast_by_user_id?: string | null;
          created_at?: string;
          id?: string;
          vote?: boolean;
          voter_citizen_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "law_amendment_votes_amendment_id_fkey";
            columns: ["amendment_id"];
            isOneToOne: false;
            referencedRelation: "law_amendments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "law_amendment_votes_cast_by_user_id_fkey";
            columns: ["cast_by_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "law_amendment_votes_voter_citizen_id_fkey";
            columns: ["voter_citizen_id"];
            isOneToOne: false;
            referencedRelation: "citizen_directory_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "law_amendment_votes_voter_citizen_id_fkey";
            columns: ["voter_citizen_id"];
            isOneToOne: false;
            referencedRelation: "citizens";
            referencedColumns: ["id"];
          },
        ];
      };
      law_amendments: {
        Row: {
          created_at: string;
          deadline_turn_number: number | null;
          document_id: string;
          id: string;
          operations_json: Json;
          proposed_by_citizen_id: string;
          proposed_turn_number: number;
          rationale_markdown: string | null;
          resolved_turn_number: number | null;
          status: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          deadline_turn_number?: number | null;
          document_id: string;
          id?: string;
          operations_json: Json;
          proposed_by_citizen_id: string;
          proposed_turn_number: number;
          rationale_markdown?: string | null;
          resolved_turn_number?: number | null;
          status?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deadline_turn_number?: number | null;
          document_id?: string;
          id?: string;
          operations_json?: Json;
          proposed_by_citizen_id?: string;
          proposed_turn_number?: number;
          rationale_markdown?: string | null;
          resolved_turn_number?: number | null;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "law_amendments_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "law_documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "law_amendments_proposed_by_citizen_id_fkey";
            columns: ["proposed_by_citizen_id"];
            isOneToOne: false;
            referencedRelation: "citizen_directory_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "law_amendments_proposed_by_citizen_id_fkey";
            columns: ["proposed_by_citizen_id"];
            isOneToOne: false;
            referencedRelation: "citizens";
            referencedColumns: ["id"];
          },
        ];
      };
      law_articles: {
        Row: {
          article_number: number;
          body_markdown: string;
          created_at: string;
          document_id: string;
          heading: string;
          id: string;
          sort_order: number;
          status: string;
          updated_at: string;
        };
        Insert: {
          article_number: number;
          body_markdown: string;
          created_at?: string;
          document_id: string;
          heading: string;
          id?: string;
          sort_order: number;
          status?: string;
          updated_at?: string;
        };
        Update: {
          article_number?: number;
          body_markdown?: string;
          created_at?: string;
          document_id?: string;
          heading?: string;
          id?: string;
          sort_order?: number;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "law_articles_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "law_documents";
            referencedColumns: ["id"];
          },
        ];
      };
      law_document_versions: {
        Row: {
          amendment_title: string;
          articles_snapshot_json: Json;
          created_at: string;
          document_id: string;
          enacted_by_citizen_id: string | null;
          enacted_turn_number: number;
          id: string;
          version: number;
        };
        Insert: {
          amendment_title: string;
          articles_snapshot_json: Json;
          created_at?: string;
          document_id: string;
          enacted_by_citizen_id?: string | null;
          enacted_turn_number: number;
          id?: string;
          version: number;
        };
        Update: {
          amendment_title?: string;
          articles_snapshot_json?: Json;
          created_at?: string;
          document_id?: string;
          enacted_by_citizen_id?: string | null;
          enacted_turn_number?: number;
          id?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "law_document_versions_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "law_documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "law_document_versions_enacted_by_citizen_id_fkey";
            columns: ["enacted_by_citizen_id"];
            isOneToOne: false;
            referencedRelation: "citizen_directory_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "law_document_versions_enacted_by_citizen_id_fkey";
            columns: ["enacted_by_citizen_id"];
            isOneToOne: false;
            referencedRelation: "citizens";
            referencedColumns: ["id"];
          },
        ];
      };
      law_documents: {
        Row: {
          amendment_procedure_json: Json;
          created_at: string;
          created_turn_number: number;
          current_version: number;
          id: string;
          nation_id: string | null;
          preamble_markdown: string | null;
          settlement_id: string | null;
          status: string;
          title: string;
          updated_at: string;
          world_id: string;
        };
        Insert: {
          amendment_procedure_json?: Json;
          created_at?: string;
          created_turn_number: number;
          current_version?: number;
          id?: string;
          nation_id?: string | null;
          preamble_markdown?: string | null;
          settlement_id?: string | null;
          status?: string;
          title: string;
          updated_at?: string;
          world_id: string;
        };
        Update: {
          amendment_procedure_json?: Json;
          created_at?: string;
          created_turn_number?: number;
          current_version?: number;
          id?: string;
          nation_id?: string | null;
          preamble_markdown?: string | null;
          settlement_id?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
          world_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "law_documents_nation_id_fkey";
            columns: ["nation_id"];
            isOneToOne: false;
            referencedRelation: "nations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "law_documents_settlement_id_fkey";
            columns: ["settlement_id"];
            isOneToOne: false;
            referencedRelation: "settlements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "law_documents_world_id_fkey";
            columns: ["world_id"];
            isOneToOne: false;
            referencedRelation: "worlds";
            referencedColumns: ["id"];
          },
        ];
      };
      managed_population_culling_jobs: {
        Row: {
          created_at: string;
          id: string;
          job_id: string;
          managed_population_type_id: string;
          max_cull_per_worker: number;
          updated_at: string;
          world_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          job_id: string;
          managed_population_type_id: string;
          max_cull_per_worker: number;
          updated_at?: string;
          world_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          job_id?: string;
          managed_population_type_id?: string;
          max_cull_per_worker?: number;
          updated_at?: string;
          world_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "managed_population_culling_jobs_job_world_fk";
            columns: ["job_id", "world_id"];
            isOneToOne: false;
            referencedRelation: "job_definitions";
            referencedColumns: ["id", "world_id"];
          },
          {
            foreignKeyName: "managed_population_culling_jobs_type_world_fk";
            columns: ["managed_population_type_id", "world_id"];
            isOneToOne: false;
            referencedRelation: "managed_population_types";
            referencedColumns: ["id", "world_id"];
          },
        ];
      };
      managed_population_husbandry_jobs: {
        Row: {
          created_at: string;
          id: string;
          job_id: string;
          managed_population_type_id: string;
          updated_at: string;
          workers_per_n_animals: number;
          world_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          job_id: string;
          managed_population_type_id: string;
          updated_at?: string;
          workers_per_n_animals: number;
          world_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          job_id?: string;
          managed_population_type_id?: string;
          updated_at?: string;
          workers_per_n_animals?: number;
          world_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "managed_population_husbandry_jobs_job_world_fk";
            columns: ["job_id", "world_id"];
            isOneToOne: false;
            referencedRelation: "job_definitions";
            referencedColumns: ["id", "world_id"];
          },
          {
            foreignKeyName: "managed_population_husbandry_jobs_type_world_fk";
            columns: ["managed_population_type_id", "world_id"];
            isOneToOne: false;
            referencedRelation: "managed_population_types";
            referencedColumns: ["id", "world_id"];
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
          culling_outputs_json: Json;
          growth_rate: number;
          icon: string | null;
          icon_color: number | null;
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
          culling_outputs_json?: Json;
          growth_rate?: number;
          icon?: string | null;
          icon_color?: number | null;
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
          culling_outputs_json?: Json;
          growth_rate?: number;
          icon?: string | null;
          icon_color?: number | null;
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
      nation_currencies: {
        Row: {
          backing_ratio: number | null;
          backing_resource_id: string | null;
          confidence: number;
          created_at: string;
          currency_type: string;
          established_turn_number: number;
          id: string;
          is_in_default: boolean;
          money_supply: number;
          name: string;
          nation_id: string;
          reserve_quantity: number;
          symbol: string;
          updated_at: string;
          world_id: string;
        };
        Insert: {
          backing_ratio?: number | null;
          backing_resource_id?: string | null;
          confidence?: number;
          created_at?: string;
          currency_type: string;
          established_turn_number: number;
          id?: string;
          is_in_default?: boolean;
          money_supply?: number;
          name: string;
          nation_id: string;
          reserve_quantity?: number;
          symbol: string;
          updated_at?: string;
          world_id: string;
        };
        Update: {
          backing_ratio?: number | null;
          backing_resource_id?: string | null;
          confidence?: number;
          created_at?: string;
          currency_type?: string;
          established_turn_number?: number;
          id?: string;
          is_in_default?: boolean;
          money_supply?: number;
          name?: string;
          nation_id?: string;
          reserve_quantity?: number;
          symbol?: string;
          updated_at?: string;
          world_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "nation_currencies_backing_resource_id_fkey";
            columns: ["backing_resource_id"];
            isOneToOne: false;
            referencedRelation: "resources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nation_currencies_backing_resource_id_fkey";
            columns: ["backing_resource_id"];
            isOneToOne: false;
            referencedRelation: "resources_directory_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nation_currencies_nation_id_fkey";
            columns: ["nation_id"];
            isOneToOne: true;
            referencedRelation: "nations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nation_currencies_world_id_fkey";
            columns: ["world_id"];
            isOneToOne: false;
            referencedRelation: "worlds";
            referencedColumns: ["id"];
          },
        ];
      };
      nation_currency_ledger: {
        Row: {
          action: string;
          actor_citizen_id: string | null;
          amount: number | null;
          created_at: string;
          currency_id: string;
          id: string;
          resource_amount: number | null;
          turn_number: number;
        };
        Insert: {
          action: string;
          actor_citizen_id?: string | null;
          amount?: number | null;
          created_at?: string;
          currency_id: string;
          id?: string;
          resource_amount?: number | null;
          turn_number: number;
        };
        Update: {
          action?: string;
          actor_citizen_id?: string | null;
          amount?: number | null;
          created_at?: string;
          currency_id?: string;
          id?: string;
          resource_amount?: number | null;
          turn_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "nation_currency_ledger_actor_citizen_id_fkey";
            columns: ["actor_citizen_id"];
            isOneToOne: false;
            referencedRelation: "citizen_directory_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nation_currency_ledger_actor_citizen_id_fkey";
            columns: ["actor_citizen_id"];
            isOneToOne: false;
            referencedRelation: "citizens";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nation_currency_ledger_currency_id_fkey";
            columns: ["currency_id"];
            isOneToOne: false;
            referencedRelation: "nation_currencies";
            referencedColumns: ["id"];
          },
        ];
      };
      nation_currency_snapshots: {
        Row: {
          burned: number;
          confidence: number;
          created_at: string;
          currency_id: string;
          id: string;
          minted: number;
          money_supply: number;
          nation_id: string;
          reserve_quantity: number;
          turn_number: number;
          turn_transition_id: string;
          world_id: string;
        };
        Insert: {
          burned?: number;
          confidence?: number;
          created_at?: string;
          currency_id: string;
          id?: string;
          minted?: number;
          money_supply?: number;
          nation_id: string;
          reserve_quantity?: number;
          turn_number: number;
          turn_transition_id: string;
          world_id: string;
        };
        Update: {
          burned?: number;
          confidence?: number;
          created_at?: string;
          currency_id?: string;
          id?: string;
          minted?: number;
          money_supply?: number;
          nation_id?: string;
          reserve_quantity?: number;
          turn_number?: number;
          turn_transition_id?: string;
          world_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "nation_currency_snapshots_currency_id_fkey";
            columns: ["currency_id"];
            isOneToOne: false;
            referencedRelation: "nation_currencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nation_currency_snapshots_nation_id_fkey";
            columns: ["nation_id"];
            isOneToOne: false;
            referencedRelation: "nations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nation_currency_snapshots_transition_world_fkey";
            columns: ["turn_transition_id", "world_id"];
            isOneToOne: false;
            referencedRelation: "turn_transitions";
            referencedColumns: ["id", "world_id"];
          },
          {
            foreignKeyName: "nation_currency_snapshots_world_id_fkey";
            columns: ["world_id"];
            isOneToOne: false;
            referencedRelation: "worlds";
            referencedColumns: ["id"];
          },
        ];
      };
      nation_discoveries: {
        Row: {
          created_at: string;
          created_by_user_id: string | null;
          id: string;
          met_at_turn_number: number;
          nation_a_id: string;
          nation_b_id: string;
          world_id: string;
        };
        Insert: {
          created_at?: string;
          created_by_user_id?: string | null;
          id?: string;
          met_at_turn_number: number;
          nation_a_id: string;
          nation_b_id: string;
          world_id: string;
        };
        Update: {
          created_at?: string;
          created_by_user_id?: string | null;
          id?: string;
          met_at_turn_number?: number;
          nation_a_id?: string;
          nation_b_id?: string;
          world_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "nation_discoveries_created_by_user_id_fkey";
            columns: ["created_by_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nation_discoveries_nation_a_id_fkey";
            columns: ["nation_a_id"];
            isOneToOne: false;
            referencedRelation: "nations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nation_discoveries_nation_b_id_fkey";
            columns: ["nation_b_id"];
            isOneToOne: false;
            referencedRelation: "nations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nation_discoveries_world_id_fkey";
            columns: ["world_id"];
            isOneToOne: false;
            referencedRelation: "worlds";
            referencedColumns: ["id"];
          },
        ];
      };
      nation_offices: {
        Row: {
          appointed_turn_number: number;
          citizen_id: string;
          created_at: string;
          ended_turn_number: number | null;
          expires_turn_number: number | null;
          id: string;
          nation_id: string | null;
          office_type_id: string;
          settlement_id: string | null;
          term_turns: number | null;
          updated_at: string;
          world_id: string;
        };
        Insert: {
          appointed_turn_number: number;
          citizen_id: string;
          created_at?: string;
          ended_turn_number?: number | null;
          expires_turn_number?: number | null;
          id?: string;
          nation_id?: string | null;
          office_type_id: string;
          settlement_id?: string | null;
          term_turns?: number | null;
          updated_at?: string;
          world_id: string;
        };
        Update: {
          appointed_turn_number?: number;
          citizen_id?: string;
          created_at?: string;
          ended_turn_number?: number | null;
          expires_turn_number?: number | null;
          id?: string;
          nation_id?: string | null;
          office_type_id?: string;
          settlement_id?: string | null;
          term_turns?: number | null;
          updated_at?: string;
          world_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "nation_offices_citizen_id_fkey";
            columns: ["citizen_id"];
            isOneToOne: false;
            referencedRelation: "citizen_directory_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nation_offices_citizen_id_fkey";
            columns: ["citizen_id"];
            isOneToOne: false;
            referencedRelation: "citizens";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nation_offices_nation_id_fkey";
            columns: ["nation_id"];
            isOneToOne: false;
            referencedRelation: "nations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nation_offices_office_type_id_fkey";
            columns: ["office_type_id"];
            isOneToOne: false;
            referencedRelation: "office_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nation_offices_settlement_id_fkey";
            columns: ["settlement_id"];
            isOneToOne: false;
            referencedRelation: "settlements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nation_offices_world_id_fkey";
            columns: ["world_id"];
            isOneToOne: false;
            referencedRelation: "worlds";
            referencedColumns: ["id"];
          },
        ];
      };
      nation_readiness_votes: {
        Row: {
          cast_by_user_id: string | null;
          created_at: string;
          id: string;
          nation_id: string;
          turn_number: number;
          vote: boolean;
          voter_citizen_id: string;
        };
        Insert: {
          cast_by_user_id?: string | null;
          created_at?: string;
          id?: string;
          nation_id: string;
          turn_number: number;
          vote: boolean;
          voter_citizen_id: string;
        };
        Update: {
          cast_by_user_id?: string | null;
          created_at?: string;
          id?: string;
          nation_id?: string;
          turn_number?: number;
          vote?: boolean;
          voter_citizen_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "nation_readiness_votes_cast_by_user_id_fkey";
            columns: ["cast_by_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nation_readiness_votes_nation_id_fkey";
            columns: ["nation_id"];
            isOneToOne: false;
            referencedRelation: "nations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nation_readiness_votes_voter_citizen_id_fkey";
            columns: ["voter_citizen_id"];
            isOneToOne: false;
            referencedRelation: "citizen_directory_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nation_readiness_votes_voter_citizen_id_fkey";
            columns: ["voter_citizen_id"];
            isOneToOne: false;
            referencedRelation: "citizens";
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
            referencedRelation: "citizen_directory_view";
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
          {
            foreignKeyName: "nation_relationships_to_nation_world_fkey";
            columns: ["to_nation_id", "world_id"];
            isOneToOne: false;
            referencedRelation: "nations";
            referencedColumns: ["id", "world_id"];
          },
        ];
      };
      nation_resource_stockpiles: {
        Row: {
          created_at: string;
          id: string;
          nation_id: string;
          quantity: number;
          resource_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          nation_id: string;
          quantity?: number;
          resource_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          nation_id?: string;
          quantity?: number;
          resource_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "nation_resource_stockpiles_nation_id_fkey";
            columns: ["nation_id"];
            isOneToOne: false;
            referencedRelation: "nations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nation_resource_stockpiles_resource_id_fkey";
            columns: ["resource_id"];
            isOneToOne: false;
            referencedRelation: "resources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nation_resource_stockpiles_resource_id_fkey";
            columns: ["resource_id"];
            isOneToOne: false;
            referencedRelation: "resources_directory_view";
            referencedColumns: ["id"];
          },
        ];
      };
      nation_treaties: {
        Row: {
          created_at: string;
          duration_turns: number | null;
          ends_turn_number: number | null;
          id: string;
          proposed_by_citizen_id: string | null;
          proposer_nation_id: string;
          responded_by_citizen_id: string | null;
          responder_nation_id: string;
          starts_turn_number: number | null;
          status: string;
          terms: Json;
          treaty_type: string;
          updated_at: string;
          world_id: string;
        };
        Insert: {
          created_at?: string;
          duration_turns?: number | null;
          ends_turn_number?: number | null;
          id?: string;
          proposed_by_citizen_id?: string | null;
          proposer_nation_id: string;
          responded_by_citizen_id?: string | null;
          responder_nation_id: string;
          starts_turn_number?: number | null;
          status?: string;
          terms?: Json;
          treaty_type: string;
          updated_at?: string;
          world_id: string;
        };
        Update: {
          created_at?: string;
          duration_turns?: number | null;
          ends_turn_number?: number | null;
          id?: string;
          proposed_by_citizen_id?: string | null;
          proposer_nation_id?: string;
          responded_by_citizen_id?: string | null;
          responder_nation_id?: string;
          starts_turn_number?: number | null;
          status?: string;
          terms?: Json;
          treaty_type?: string;
          updated_at?: string;
          world_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "nation_treaties_proposed_by_citizen_id_fkey";
            columns: ["proposed_by_citizen_id"];
            isOneToOne: false;
            referencedRelation: "citizen_directory_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nation_treaties_proposed_by_citizen_id_fkey";
            columns: ["proposed_by_citizen_id"];
            isOneToOne: false;
            referencedRelation: "citizens";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nation_treaties_proposer_nation_id_fkey";
            columns: ["proposer_nation_id"];
            isOneToOne: false;
            referencedRelation: "nations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nation_treaties_responded_by_citizen_id_fkey";
            columns: ["responded_by_citizen_id"];
            isOneToOne: false;
            referencedRelation: "citizen_directory_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nation_treaties_responded_by_citizen_id_fkey";
            columns: ["responded_by_citizen_id"];
            isOneToOne: false;
            referencedRelation: "citizens";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nation_treaties_responder_nation_id_fkey";
            columns: ["responder_nation_id"];
            isOneToOne: false;
            referencedRelation: "nations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nation_treaties_world_id_fkey";
            columns: ["world_id"];
            isOneToOne: false;
            referencedRelation: "worlds";
            referencedColumns: ["id"];
          },
        ];
      };
      nation_turn_readiness: {
        Row: {
          id: string;
          is_ready: boolean;
          nation_id: string;
          turn_number: number;
          updated_at: string;
          world_id: string;
        };
        Insert: {
          id?: string;
          is_ready?: boolean;
          nation_id: string;
          turn_number: number;
          updated_at?: string;
          world_id: string;
        };
        Update: {
          id?: string;
          is_ready?: boolean;
          nation_id?: string;
          turn_number?: number;
          updated_at?: string;
          world_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "nation_turn_readiness_nation_id_fkey";
            columns: ["nation_id"];
            isOneToOne: false;
            referencedRelation: "nations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nation_turn_readiness_world_id_fkey";
            columns: ["world_id"];
            isOneToOne: false;
            referencedRelation: "worlds";
            referencedColumns: ["id"];
          },
        ];
      };
      nation_turn_snapshots: {
        Row: {
          created_at: string;
          id: string;
          nation_id: string;
          tax_collected_by_resource_json: Json;
          tribute_paid_by_resource_json: Json;
          tribute_received_by_resource_json: Json;
          turn_number: number;
          turn_transition_id: string;
          world_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          nation_id: string;
          tax_collected_by_resource_json?: Json;
          tribute_paid_by_resource_json?: Json;
          tribute_received_by_resource_json?: Json;
          turn_number: number;
          turn_transition_id: string;
          world_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          nation_id?: string;
          tax_collected_by_resource_json?: Json;
          tribute_paid_by_resource_json?: Json;
          tribute_received_by_resource_json?: Json;
          turn_number?: number;
          turn_transition_id?: string;
          world_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "nation_turn_snapshots_nation_id_fkey";
            columns: ["nation_id"];
            isOneToOne: false;
            referencedRelation: "nations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nation_turn_snapshots_transition_world_fkey";
            columns: ["turn_transition_id", "world_id"];
            isOneToOne: false;
            referencedRelation: "turn_transitions";
            referencedColumns: ["id", "world_id"];
          },
          {
            foreignKeyName: "nation_turn_snapshots_world_id_fkey";
            columns: ["world_id"];
            isOneToOne: false;
            referencedRelation: "worlds";
            referencedColumns: ["id"];
          },
        ];
      };
      nations: {
        Row: {
          capital_settlement_id: string | null;
          created_at: string;
          description: string | null;
          flag_path: string | null;
          founded_turn_number: number | null;
          government_type: string;
          id: string;
          name: string;
          nameset_id: string | null;
          primary_culture_id: string | null;
          state_religion_id: string | null;
          tax_rate: number;
          trade_policy: string;
          treasury_currency: number;
          updated_at: string;
          world_id: string;
        };
        Insert: {
          capital_settlement_id?: string | null;
          created_at?: string;
          description?: string | null;
          flag_path?: string | null;
          founded_turn_number?: number | null;
          government_type?: string;
          id?: string;
          name: string;
          nameset_id?: string | null;
          primary_culture_id?: string | null;
          state_religion_id?: string | null;
          tax_rate?: number;
          trade_policy?: string;
          treasury_currency?: number;
          updated_at?: string;
          world_id: string;
        };
        Update: {
          capital_settlement_id?: string | null;
          created_at?: string;
          description?: string | null;
          flag_path?: string | null;
          founded_turn_number?: number | null;
          government_type?: string;
          id?: string;
          name?: string;
          nameset_id?: string | null;
          primary_culture_id?: string | null;
          state_religion_id?: string | null;
          tax_rate?: number;
          trade_policy?: string;
          treasury_currency?: number;
          updated_at?: string;
          world_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "nations_capital_settlement_id_fkey";
            columns: ["capital_settlement_id"];
            isOneToOne: false;
            referencedRelation: "settlements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nations_nameset_id_fkey";
            columns: ["nameset_id"];
            isOneToOne: false;
            referencedRelation: "namesets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nations_primary_culture_id_fkey";
            columns: ["primary_culture_id"];
            isOneToOne: false;
            referencedRelation: "cultures";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nations_state_religion_id_fkey";
            columns: ["state_religion_id"];
            isOneToOne: false;
            referencedRelation: "religions";
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
      notification_preferences: {
        Row: {
          enabled: boolean;
          notification_type: Database["public"]["Enums"]["notification_type"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          enabled?: boolean;
          notification_type: Database["public"]["Enums"]["notification_type"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          enabled?: boolean;
          notification_type?: Database["public"]["Enums"]["notification_type"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
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
          severity: Database["public"]["Enums"]["notification_severity"];
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
          severity?: Database["public"]["Enums"]["notification_severity"];
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
          severity?: Database["public"]["Enums"]["notification_severity"];
          trade_route_id?: string | null;
          world_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_citizen_id_fkey";
            columns: ["citizen_id"];
            isOneToOne: false;
            referencedRelation: "citizen_directory_view";
            referencedColumns: ["id"];
          },
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
      office_types: {
        Row: {
          color: string | null;
          created_at: string;
          default_term_turns: number | null;
          description: string | null;
          excludes_from_labor: boolean;
          icon: string | null;
          id: string;
          max_holders: number | null;
          name: string;
          nation_id: string | null;
          scope: string;
          updated_at: string;
          world_id: string;
        };
        Insert: {
          color?: string | null;
          created_at?: string;
          default_term_turns?: number | null;
          description?: string | null;
          excludes_from_labor?: boolean;
          icon?: string | null;
          id?: string;
          max_holders?: number | null;
          name: string;
          nation_id?: string | null;
          scope: string;
          updated_at?: string;
          world_id: string;
        };
        Update: {
          color?: string | null;
          created_at?: string;
          default_term_turns?: number | null;
          description?: string | null;
          excludes_from_labor?: boolean;
          icon?: string | null;
          id?: string;
          max_holders?: number | null;
          name?: string;
          nation_id?: string | null;
          scope?: string;
          updated_at?: string;
          world_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "office_types_nation_id_fkey";
            columns: ["nation_id"];
            isOneToOne: false;
            referencedRelation: "nations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "office_types_world_id_fkey";
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
            referencedRelation: "citizen_directory_view";
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
            referencedRelation: "citizen_directory_view";
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
      religions: {
        Row: {
          afterlife_beliefs: string | null;
          color: string;
          created_at: string;
          creation_myth: string | null;
          deities: string | null;
          description: string | null;
          ethics_sins: string | null;
          funerary_rites: string | null;
          hierarchy_governance: string | null;
          history_spread: string | null;
          holy_days_festivals: string | null;
          holy_sites: string | null;
          id: string;
          mythology: string | null;
          name: string;
          pilgrimage_devotions: string | null;
          priesthood: string | null;
          relationship_to_state: string | null;
          rituals_ceremonies: string | null;
          sacred_texts: string | null;
          sects_schisms: string | null;
          symbols_vestments: string | null;
          taboos: string | null;
          tenets: string | null;
          updated_at: string;
          virtues: string | null;
          world_id: string;
          worship_practices: string | null;
        };
        Insert: {
          afterlife_beliefs?: string | null;
          color?: string;
          created_at?: string;
          creation_myth?: string | null;
          deities?: string | null;
          description?: string | null;
          ethics_sins?: string | null;
          funerary_rites?: string | null;
          hierarchy_governance?: string | null;
          history_spread?: string | null;
          holy_days_festivals?: string | null;
          holy_sites?: string | null;
          id?: string;
          mythology?: string | null;
          name: string;
          pilgrimage_devotions?: string | null;
          priesthood?: string | null;
          relationship_to_state?: string | null;
          rituals_ceremonies?: string | null;
          sacred_texts?: string | null;
          sects_schisms?: string | null;
          symbols_vestments?: string | null;
          taboos?: string | null;
          tenets?: string | null;
          updated_at?: string;
          virtues?: string | null;
          world_id: string;
          worship_practices?: string | null;
        };
        Update: {
          afterlife_beliefs?: string | null;
          color?: string;
          created_at?: string;
          creation_myth?: string | null;
          deities?: string | null;
          description?: string | null;
          ethics_sins?: string | null;
          funerary_rites?: string | null;
          hierarchy_governance?: string | null;
          history_spread?: string | null;
          holy_days_festivals?: string | null;
          holy_sites?: string | null;
          id?: string;
          mythology?: string | null;
          name?: string;
          pilgrimage_devotions?: string | null;
          priesthood?: string | null;
          relationship_to_state?: string | null;
          rituals_ceremonies?: string | null;
          sacred_texts?: string | null;
          sects_schisms?: string | null;
          symbols_vestments?: string | null;
          taboos?: string | null;
          tenets?: string | null;
          updated_at?: string;
          virtues?: string | null;
          world_id?: string;
          worship_practices?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "religions_world_id_fkey";
            columns: ["world_id"];
            isOneToOne: false;
            referencedRelation: "worlds";
            referencedColumns: ["id"];
          },
        ];
      };
      resource_categories: {
        Row: {
          color: string;
          created_at: string;
          id: string;
          name: string;
          sort_order: number;
          updated_at: string;
          world_id: string;
        };
        Insert: {
          color?: string;
          created_at?: string;
          id?: string;
          name: string;
          sort_order?: number;
          updated_at?: string;
          world_id: string;
        };
        Update: {
          color?: string;
          created_at?: string;
          id?: string;
          name?: string;
          sort_order?: number;
          updated_at?: string;
          world_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "resource_categories_world_id_fkey";
            columns: ["world_id"];
            isOneToOne: false;
            referencedRelation: "worlds";
            referencedColumns: ["id"];
          },
        ];
      };
      resources: {
        Row: {
          base_stockpile_cap: number;
          category_id: string | null;
          change_amount: number;
          change_mode: string;
          created_at: string;
          icon: string | null;
          icon_color: number | null;
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
          category_id?: string | null;
          change_amount?: number;
          change_mode?: string;
          created_at?: string;
          icon?: string | null;
          icon_color?: number | null;
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
          category_id?: string | null;
          change_amount?: number;
          change_mode?: string;
          created_at?: string;
          icon?: string | null;
          icon_color?: number | null;
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
            foreignKeyName: "resources_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "resource_categories";
            referencedColumns: ["id"];
          },
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
            foreignKeyName: "settlement_resource_stockpiles_resource_id_fkey";
            columns: ["resource_id"];
            isOneToOne: false;
            referencedRelation: "resources_directory_view";
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
          adjustment_amount: number;
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
          adjustment_amount?: number;
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
          adjustment_amount?: number;
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
            foreignKeyName: "settlement_turn_resource_snapshots_resource_id_fkey";
            columns: ["resource_id"];
            isOneToOne: false;
            referencedRelation: "resources_directory_view";
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
      settlement_turn_resource_snapshots_p_default: {
        Row: {
          adjustment_amount: number;
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
          adjustment_amount?: number;
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
          adjustment_amount?: number;
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
        Relationships: [];
      };
      settlement_turn_snapshots: {
        Row: {
          birth_count: number;
          buildings_summary_json: Json | null;
          created_at: string;
          death_count: number;
          education_summary_json: Json | null;
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
          education_summary_json?: Json | null;
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
          education_summary_json?: Json | null;
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
            referencedRelation: "citizen_directory_view";
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
      smtp_settings: {
        Row: {
          admin_email: string;
          host: string;
          id: boolean;
          password: string | null;
          port: number;
          sender_name: string;
          updated_at: string;
          updated_by: string | null;
          username: string | null;
        };
        Insert: {
          admin_email: string;
          host: string;
          id?: boolean;
          password?: string | null;
          port: number;
          sender_name: string;
          updated_at?: string;
          updated_by?: string | null;
          username?: string | null;
        };
        Update: {
          admin_email?: string;
          host?: string;
          id?: boolean;
          password?: string | null;
          port?: number;
          sender_name?: string;
          updated_at?: string;
          updated_by?: string | null;
          username?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "smtp_settings_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "users";
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
            foreignKeyName: "trade_route_legs_resource_id_fkey";
            columns: ["resource_id"];
            isOneToOne: false;
            referencedRelation: "resources_directory_view";
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
            referencedRelation: "citizen_directory_view";
            referencedColumns: ["id"];
          },
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
            referencedRelation: "citizen_directory_view";
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
            referencedRelation: "citizen_directory_view";
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
            foreignKeyName: "turn_log_entries_citizen_id_fkey";
            columns: ["citizen_id"];
            isOneToOne: false;
            referencedRelation: "citizen_directory_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "turn_log_entries_citizen_id_fkey";
            columns: ["citizen_id"];
            isOneToOne: false;
            referencedRelation: "citizens";
            referencedColumns: ["id"];
          },
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
      turn_log_entries_p_default: {
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
        Relationships: [];
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
      unit_soldiers: {
        Row: {
          citizen_id: string;
          created_at: string;
          home_settlement_id: string | null;
          id: string;
          recruited_turn_number: number;
          unit_id: string;
          world_id: string;
        };
        Insert: {
          citizen_id: string;
          created_at?: string;
          home_settlement_id?: string | null;
          id?: string;
          recruited_turn_number: number;
          unit_id: string;
          world_id: string;
        };
        Update: {
          citizen_id?: string;
          created_at?: string;
          home_settlement_id?: string | null;
          id?: string;
          recruited_turn_number?: number;
          unit_id?: string;
          world_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "unit_soldiers_citizen_id_fkey";
            columns: ["citizen_id"];
            isOneToOne: true;
            referencedRelation: "citizen_directory_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "unit_soldiers_citizen_id_fkey";
            columns: ["citizen_id"];
            isOneToOne: true;
            referencedRelation: "citizens";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "unit_soldiers_home_settlement_id_fkey";
            columns: ["home_settlement_id"];
            isOneToOne: false;
            referencedRelation: "settlements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "unit_soldiers_unit_id_fkey";
            columns: ["unit_id"];
            isOneToOne: false;
            referencedRelation: "army_units";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "unit_soldiers_world_id_fkey";
            columns: ["world_id"];
            isOneToOne: false;
            referencedRelation: "worlds";
            referencedColumns: ["id"];
          },
        ];
      };
      unit_types: {
        Row: {
          created_at: string;
          description: string | null;
          desertion_rate: number;
          id: string;
          name: string;
          recruitment_costs_json: Json;
          required_building_blueprint_id: string | null;
          required_building_tier_number: number | null;
          required_education_level_id: string | null;
          soldiers_per_unit: number;
          updated_at: string;
          upkeep_costs_json: Json;
          world_id: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          desertion_rate: number;
          id?: string;
          name: string;
          recruitment_costs_json?: Json;
          required_building_blueprint_id?: string | null;
          required_building_tier_number?: number | null;
          required_education_level_id?: string | null;
          soldiers_per_unit: number;
          updated_at?: string;
          upkeep_costs_json?: Json;
          world_id: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          desertion_rate?: number;
          id?: string;
          name?: string;
          recruitment_costs_json?: Json;
          required_building_blueprint_id?: string | null;
          required_building_tier_number?: number | null;
          required_education_level_id?: string | null;
          soldiers_per_unit?: number;
          updated_at?: string;
          upkeep_costs_json?: Json;
          world_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "unit_types_required_building_blueprint_id_fkey";
            columns: ["required_building_blueprint_id"];
            isOneToOne: false;
            referencedRelation: "building_blueprints";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "unit_types_required_building_tier_fk";
            columns: [
              "required_building_blueprint_id",
              "required_building_tier_number",
            ];
            isOneToOne: false;
            referencedRelation: "building_blueprint_tiers";
            referencedColumns: ["building_blueprint_id", "tier_number"];
          },
          {
            foreignKeyName: "unit_types_required_education_level_id_fkey";
            columns: ["required_education_level_id"];
            isOneToOne: false;
            referencedRelation: "education_levels";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "unit_types_world_id_fkey";
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
            referencedRelation: "citizen_directory_view";
            referencedColumns: ["id"];
          },
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
      world_retention_config: {
        Row: {
          created_at: string;
          log_retention_turns: number | null;
          memory_retention_turns: number | null;
          snapshot_retention_turns: number | null;
          updated_at: string;
          world_id: string;
        };
        Insert: {
          created_at?: string;
          log_retention_turns?: number | null;
          memory_retention_turns?: number | null;
          snapshot_retention_turns?: number | null;
          updated_at?: string;
          world_id: string;
        };
        Update: {
          created_at?: string;
          log_retention_turns?: number | null;
          memory_retention_turns?: number | null;
          snapshot_retention_turns?: number | null;
          updated_at?: string;
          world_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "world_retention_config_world_id_fkey";
            columns: ["world_id"];
            isOneToOne: true;
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
          hero_path: string | null;
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
          thumbnail_path: string | null;
          updated_at: string;
          water_consumption_per_citizen: number;
        };
        Insert: {
          archived_at?: string | null;
          calendar_config_json?: Json;
          created_at?: string;
          current_turn_number?: number;
          fertility_chance?: number;
          food_consumption_per_citizen?: number;
          hero_path?: string | null;
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
          thumbnail_path?: string | null;
          updated_at?: string;
          water_consumption_per_citizen?: number;
        };
        Update: {
          archived_at?: string | null;
          calendar_config_json?: Json;
          created_at?: string;
          current_turn_number?: number;
          fertility_chance?: number;
          food_consumption_per_citizen?: number;
          hero_path?: string | null;
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
          thumbnail_path?: string | null;
          updated_at?: string;
          water_consumption_per_citizen?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      citizen_directory_view: {
        Row: {
          age_turns: number | null;
          assignment_label: string | null;
          assignment_type: string | null;
          born_on_turn_number: number | null;
          citizen_type: string | null;
          education_level_name: string | null;
          id: string | null;
          name: string | null;
          nation_id: string | null;
          nation_name: string | null;
          office_types: string | null;
          settlement_id: string | null;
          settlement_name: string | null;
          sex: string | null;
          status: string | null;
          world_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "citizens_settlement_id_fkey";
            columns: ["settlement_id"];
            isOneToOne: false;
            referencedRelation: "settlements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "citizens_world_id_fkey";
            columns: ["world_id"];
            isOneToOne: false;
            referencedRelation: "worlds";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "settlements_nation_id_fkey";
            columns: ["nation_id"];
            isOneToOne: false;
            referencedRelation: "nations";
            referencedColumns: ["id"];
          },
        ];
      };
      nation_turn_population_aggregates: {
        Row: {
          birth_count: number | null;
          death_count: number | null;
          homeless_deaths_count: number | null;
          nation_id: string | null;
          population_cap: number | null;
          population_npc: number | null;
          population_player_character: number | null;
          population_total: number | null;
          starvation_deaths_count: number | null;
          turn_number: number | null;
          world_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "settlement_turn_snapshots_world_id_fkey";
            columns: ["world_id"];
            isOneToOne: false;
            referencedRelation: "worlds";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "settlements_nation_id_fkey";
            columns: ["nation_id"];
            isOneToOne: false;
            referencedRelation: "nations";
            referencedColumns: ["id"];
          },
        ];
      };
      nation_turn_resource_aggregates: {
        Row: {
          adjustment_amount: number | null;
          consumed_amount: number | null;
          nation_id: string | null;
          net_amount: number | null;
          produced_amount: number | null;
          resource_id: string | null;
          resource_name: string | null;
          trade_in_amount: number | null;
          trade_out_amount: number | null;
          turn_number: number | null;
          world_id: string | null;
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
            foreignKeyName: "settlement_turn_resource_snapshots_resource_id_fkey";
            columns: ["resource_id"];
            isOneToOne: false;
            referencedRelation: "resources_directory_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "settlement_turn_resource_snapshots_world_id_fkey";
            columns: ["world_id"];
            isOneToOne: false;
            referencedRelation: "worlds";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "settlements_nation_id_fkey";
            columns: ["nation_id"];
            isOneToOne: false;
            referencedRelation: "nations";
            referencedColumns: ["id"];
          },
        ];
      };
      pg_all_foreign_keys: {
        Row: {
          fk_columns: unknown[] | null;
          fk_constraint_name: unknown;
          fk_schema_name: unknown;
          fk_table_name: unknown;
          fk_table_oid: unknown;
          is_deferrable: boolean | null;
          is_deferred: boolean | null;
          match_type: string | null;
          on_delete: string | null;
          on_update: string | null;
          pk_columns: unknown[] | null;
          pk_constraint_name: unknown;
          pk_index_name: unknown;
          pk_schema_name: unknown;
          pk_table_name: unknown;
          pk_table_oid: unknown;
        };
        Relationships: [];
      };
      resources_directory_view: {
        Row: {
          base_stockpile_cap: number | null;
          category_color: string | null;
          category_id: string | null;
          category_name: string | null;
          change_amount: number | null;
          change_mode: string | null;
          created_at: string | null;
          icon: string | null;
          icon_color: number | null;
          id: string | null;
          is_system_resource: boolean | null;
          is_trashed: boolean | null;
          last_cleanup_summary_json: Json | null;
          name: string | null;
          slug: string | null;
          updated_at: string | null;
          world_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "resources_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "resource_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "resources_world_id_fkey";
            columns: ["world_id"];
            isOneToOne: false;
            referencedRelation: "worlds";
            referencedColumns: ["id"];
          },
        ];
      };
      settlement_stockpiles_view: {
        Row: {
          effective_cap: number | null;
          is_system_resource: boolean | null;
          quantity: number | null;
          resource_icon: string | null;
          resource_icon_color: number | null;
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
            foreignKeyName: "settlement_resource_stockpiles_resource_id_fkey";
            columns: ["resource_id"];
            isOneToOne: false;
            referencedRelation: "resources_directory_view";
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
      tap_funky: {
        Row: {
          args: string | null;
          is_definer: boolean | null;
          is_strict: boolean | null;
          is_visible: boolean | null;
          kind: unknown;
          langoid: unknown;
          name: unknown;
          oid: unknown;
          owner: unknown;
          returns: string | null;
          returns_set: boolean | null;
          schema: unknown;
          volatility: string | null;
        };
        Relationships: [];
      };
      world_turn_population_aggregates: {
        Row: {
          birth_count: number | null;
          death_count: number | null;
          homeless_deaths_count: number | null;
          population_cap: number | null;
          population_npc: number | null;
          population_player_character: number | null;
          population_total: number | null;
          starvation_deaths_count: number | null;
          turn_number: number | null;
          world_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "settlement_turn_snapshots_world_id_fkey";
            columns: ["world_id"];
            isOneToOne: false;
            referencedRelation: "worlds";
            referencedColumns: ["id"];
          },
        ];
      };
      world_turn_resource_aggregates: {
        Row: {
          adjustment_amount: number | null;
          consumed_amount: number | null;
          net_amount: number | null;
          produced_amount: number | null;
          resource_id: string | null;
          resource_name: string | null;
          trade_in_amount: number | null;
          trade_out_amount: number | null;
          turn_number: number | null;
          world_id: string | null;
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
            foreignKeyName: "settlement_turn_resource_snapshots_resource_id_fkey";
            columns: ["resource_id"];
            isOneToOne: false;
            referencedRelation: "resources_directory_view";
            referencedColumns: ["id"];
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
    };
    Functions: {
      _cleanup: { Args: never; Returns: boolean };
      _contract_on: { Args: { "": string }; Returns: unknown };
      _currtest: { Args: never; Returns: number };
      _db_privs: { Args: never; Returns: unknown[] };
      _extensions: { Args: never; Returns: unknown[] };
      _get: { Args: { "": string }; Returns: number };
      _get_latest: { Args: { "": string }; Returns: number[] };
      _get_note: { Args: { "": string }; Returns: string };
      _is_verbose: { Args: never; Returns: boolean };
      _prokind: { Args: { p_oid: unknown }; Returns: unknown };
      _query: { Args: { "": string }; Returns: string };
      _refine_vol: { Args: { "": string }; Returns: string };
      _retval: { Args: { "": string }; Returns: string };
      _table_privs: { Args: never; Returns: unknown[] };
      _temptypes: { Args: { "": string }; Returns: string };
      _todo: { Args: never; Returns: string };
      add_citizen_memory: {
        Args: {
          p_citizen_id: string;
          p_memory_text: string;
          p_occurred_on_turn_number: number;
        };
        Returns: {
          id: string;
        }[];
      };
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
          p_forecast_snapshot_jsonb?: Json;
          p_payload: Json;
          p_transition_id: string;
          p_world_id: string;
        };
        Returns: Json;
      };
      appoint_nation_office: {
        Args: {
          p_citizen_id: string;
          p_nation_id: string;
          p_office_type: string;
          p_term_turns?: number;
        };
        Returns: {
          appointed_turn_number: number;
          citizen_id: string;
          created_at: string;
          ended_turn_number: number | null;
          expires_turn_number: number | null;
          id: string;
          nation_id: string | null;
          office_type_id: string;
          settlement_id: string | null;
          term_turns: number | null;
          updated_at: string;
          world_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "nation_offices";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      appoint_settlement_office: {
        Args: {
          p_citizen_id: string;
          p_office_type: string;
          p_settlement_id: string;
          p_term_turns?: number;
        };
        Returns: {
          appointed_turn_number: number;
          citizen_id: string;
          created_at: string;
          ended_turn_number: number | null;
          expires_turn_number: number | null;
          id: string;
          nation_id: string | null;
          office_type_id: string;
          settlement_id: string | null;
          term_turns: number | null;
          updated_at: string;
          world_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "nation_offices";
          isOneToOne: true;
          isSetofReturn: false;
        };
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
      army_group_depth: { Args: { p_group_id: string }; Returns: number };
      army_group_subtree_height: {
        Args: { p_group_id: string };
        Returns: number;
      };
      assert_world_not_archived: {
        Args: { p_world_id: string };
        Returns: undefined;
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
          culture_id: string | null;
          death_cause: string | null;
          death_cause_category:
            | Database["public"]["Enums"]["death_cause_category"]
            | null;
          education_level_id: string | null;
          given_name: string;
          id: string;
          name: string | null;
          nameset_id: string | null;
          npc_flaw: string | null;
          npc_goal: string | null;
          npc_secret_contradiction: string | null;
          npc_trait_1: string | null;
          npc_trait_2: string | null;
          parent_a_citizen_id: string | null;
          parent_b_citizen_id: string | null;
          personality_text: string | null;
          profile_photo_url: string | null;
          religion_id: string | null;
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
      break_nation_treaty: {
        Args: { p_broken_by_citizen_id: string; p_treaty_id: string };
        Returns: {
          created_at: string;
          duration_turns: number | null;
          ends_turn_number: number | null;
          id: string;
          proposed_by_citizen_id: string | null;
          proposer_nation_id: string;
          responded_by_citizen_id: string | null;
          responder_nation_id: string;
          starts_turn_number: number | null;
          status: string;
          terms: Json;
          treaty_type: string;
          updated_at: string;
          world_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "nation_treaties";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      bulk_set_citizen_culture_religion: {
        Args: {
          p_culture_id: string;
          p_religion_id: string;
          p_settlement_id: string;
        };
        Returns: {
          born_on_turn_number: number | null;
          citizen_type: string;
          created_at: string;
          culture_id: string | null;
          death_cause: string | null;
          death_cause_category:
            | Database["public"]["Enums"]["death_cause_category"]
            | null;
          education_level_id: string | null;
          given_name: string;
          id: string;
          name: string | null;
          nameset_id: string | null;
          npc_flaw: string | null;
          npc_goal: string | null;
          npc_secret_contradiction: string | null;
          npc_trait_1: string | null;
          npc_trait_2: string | null;
          parent_a_citizen_id: string | null;
          parent_b_citizen_id: string | null;
          personality_text: string | null;
          profile_photo_url: string | null;
          religion_id: string | null;
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
      bulk_set_citizen_education: {
        Args: { p_education_level_id: string; p_settlement_id: string };
        Returns: {
          born_on_turn_number: number | null;
          citizen_type: string;
          created_at: string;
          culture_id: string | null;
          death_cause: string | null;
          death_cause_category:
            | Database["public"]["Enums"]["death_cause_category"]
            | null;
          education_level_id: string | null;
          given_name: string;
          id: string;
          name: string | null;
          nameset_id: string | null;
          npc_flaw: string | null;
          npc_goal: string | null;
          npc_secret_contradiction: string | null;
          npc_trait_1: string | null;
          npc_trait_2: string | null;
          parent_a_citizen_id: string | null;
          parent_b_citizen_id: string | null;
          personality_text: string | null;
          profile_photo_url: string | null;
          religion_id: string | null;
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
      burn_currency: {
        Args: { p_amount: number; p_currency_id: string };
        Returns: {
          backing_ratio: number | null;
          backing_resource_id: string | null;
          confidence: number;
          created_at: string;
          currency_type: string;
          established_turn_number: number;
          id: string;
          is_in_default: boolean;
          money_supply: number;
          name: string;
          nation_id: string;
          reserve_quantity: number;
          symbol: string;
          updated_at: string;
          world_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "nation_currencies";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      cancel_construction_project: {
        Args: { p_project_id: string };
        Returns: {
          project_id: string;
          unassigned_citizen_count: number;
        }[];
      };
      cancel_event_or_group: {
        Args: { p_event_id: string; p_group_id: string };
        Returns: Json;
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
      cast_law_amendment_vote: {
        Args: {
          p_amendment_id: string;
          p_vote: boolean;
          p_voter_citizen_id: string;
        };
        Returns: {
          amendment_id: string;
          cast_by_user_id: string | null;
          created_at: string;
          id: string;
          vote: boolean;
          voter_citizen_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "law_amendment_votes";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      cast_nation_readiness_vote: {
        Args: {
          p_nation_id: string;
          p_vote: boolean;
          p_voter_citizen_id: string;
        };
        Returns: {
          cast_by_user_id: string | null;
          created_at: string;
          id: string;
          nation_id: string;
          turn_number: number;
          vote: boolean;
          voter_citizen_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "nation_readiness_votes";
          isOneToOne: true;
          isSetofReturn: false;
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
      col_is_null:
        | {
            Args: {
              column_name: unknown;
              description?: string;
              schema_name: unknown;
              table_name: unknown;
            };
            Returns: string;
          }
        | {
            Args: {
              column_name: unknown;
              description?: string;
              table_name: unknown;
            };
            Returns: string;
          };
      col_not_null:
        | {
            Args: {
              column_name: unknown;
              description?: string;
              schema_name: unknown;
              table_name: unknown;
            };
            Returns: string;
          }
        | {
            Args: {
              column_name: unknown;
              description?: string;
              table_name: unknown;
            };
            Returns: string;
          };
      create_army: {
        Args: {
          p_funding_source: string;
          p_name: string;
          p_nation_id: string;
          p_stationed_settlement_id: string;
        };
        Returns: {
          created_at: string;
          created_turn_number: number;
          funding_source: string;
          id: string;
          name: string;
          nation_id: string;
          stationed_settlement_id: string;
          updated_at: string;
          world_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "armies";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_army_group: {
        Args: {
          p_army_id: string;
          p_name: string;
          p_parent_group_id: string;
          p_sort_order?: number;
        };
        Returns: {
          army_id: string;
          created_at: string;
          id: string;
          name: string;
          parent_group_id: string | null;
          sort_order: number;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "army_groups";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_army_unit: {
        Args: {
          p_army_id: string;
          p_group_id: string;
          p_name: string;
          p_sort_order?: number;
          p_unit_type_id: string;
        };
        Returns: {
          army_id: string;
          created_at: string;
          created_turn_number: number;
          group_id: string | null;
          id: string;
          name: string;
          sort_order: number;
          unit_type_id: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "army_units";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_citizen_internal: {
        Args: {
          p_born_on_turn_number?: number;
          p_citizen_type: string;
          p_culture_id?: string;
          p_education_level_id?: string;
          p_given_name: string;
          p_nameset_id?: string;
          p_npc_flaw?: string;
          p_npc_goal?: string;
          p_npc_secret_contradiction?: string;
          p_npc_trait_1?: string;
          p_npc_trait_2?: string;
          p_parent_a_citizen_id?: string;
          p_parent_b_citizen_id?: string;
          p_personality_text?: string;
          p_profile_photo_url?: string;
          p_religion_id?: string;
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
          culture_id: string | null;
          death_cause: string | null;
          death_cause_category:
            | Database["public"]["Enums"]["death_cause_category"]
            | null;
          education_level_id: string | null;
          given_name: string;
          id: string;
          name: string | null;
          nameset_id: string | null;
          npc_flaw: string | null;
          npc_goal: string | null;
          npc_secret_contradiction: string | null;
          npc_trait_1: string | null;
          npc_trait_2: string | null;
          parent_a_citizen_id: string | null;
          parent_b_citizen_id: string | null;
          personality_text: string | null;
          profile_photo_url: string | null;
          religion_id: string | null;
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
      create_education_level: {
        Args: {
          p_description: string;
          p_icon?: string;
          p_icon_color?: number;
          p_name: string;
          p_natural_born_percent?: number;
          p_world_id: string;
        };
        Returns: {
          created_at: string;
          description: string | null;
          icon: string | null;
          icon_color: number | null;
          id: string;
          name: string;
          natural_born_percent: number;
          rank: number;
          updated_at: string;
          world_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "education_levels";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_event_group_with_events: {
        Args: {
          p_activate_on_transition_after_turn_number: number;
          p_create_citizen_memories: boolean;
          p_duration_transitions: number;
          p_duration_type: string;
          p_effects: Json;
          p_group_description: string;
          p_group_name: string;
          p_memories?: Json;
          p_memory_text: string;
          p_scope_type: string;
          p_targets: Json;
          p_world_id: string;
        };
        Returns: Json;
      };
      create_law_document: {
        Args: {
          p_amendment_procedure_json: Json;
          p_articles: Json;
          p_nation_id: string;
          p_preamble_markdown: string;
          p_settlement_id: string;
          p_title: string;
          p_world_id: string;
        };
        Returns: {
          amendment_procedure_json: Json;
          created_at: string;
          created_turn_number: number;
          current_version: number;
          id: string;
          nation_id: string | null;
          preamble_markdown: string | null;
          settlement_id: string | null;
          status: string;
          title: string;
          updated_at: string;
          world_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "law_documents";
          isOneToOne: true;
          isSetofReturn: false;
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
          p_nameset_id?: string;
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
          culture_id: string | null;
          death_cause: string | null;
          death_cause_category:
            | Database["public"]["Enums"]["death_cause_category"]
            | null;
          education_level_id: string | null;
          given_name: string;
          id: string;
          name: string | null;
          nameset_id: string | null;
          npc_flaw: string | null;
          npc_goal: string | null;
          npc_secret_contradiction: string | null;
          npc_trait_1: string | null;
          npc_trait_2: string | null;
          parent_a_citizen_id: string | null;
          parent_b_citizen_id: string | null;
          personality_text: string | null;
          profile_photo_url: string | null;
          religion_id: string | null;
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
          p_nameset_id?: string;
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
          culture_id: string | null;
          death_cause: string | null;
          death_cause_category:
            | Database["public"]["Enums"]["death_cause_category"]
            | null;
          education_level_id: string | null;
          given_name: string;
          id: string;
          name: string | null;
          nameset_id: string | null;
          npc_flaw: string | null;
          npc_goal: string | null;
          npc_secret_contradiction: string | null;
          npc_trait_1: string | null;
          npc_trait_2: string | null;
          parent_a_citizen_id: string | null;
          parent_b_citizen_id: string | null;
          personality_text: string | null;
          profile_photo_url: string | null;
          religion_id: string | null;
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
        Args: { p_name: string };
        Returns: {
          archived_at: string | null;
          calendar_config_json: Json;
          created_at: string;
          current_turn_number: number;
          fertility_chance: number;
          food_consumption_per_citizen: number;
          hero_path: string | null;
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
          thumbnail_path: string | null;
          updated_at: string;
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
      current_user_can_own_government_body: {
        Args: {
          p_nation_id: string;
          p_settlement_id: string;
          p_world_id: string;
        };
        Returns: boolean;
      };
      current_user_can_own_office_type: {
        Args: { p_nation_id: string; p_world_id: string };
        Returns: boolean;
      };
      current_user_has_player_character_in_nation: {
        Args: { p_nation_id: string };
        Returns: boolean;
      };
      current_user_has_world_access: {
        Args: { p_world_id: string };
        Returns: boolean;
      };
      current_user_holds_nation_office: {
        Args: { p_nation_id: string; p_office_type: string };
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
      current_user_nation_currency_actor_citizen_id: {
        Args: { p_nation_id: string };
        Returns: string;
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
      delete_army: { Args: { p_army_id: string }; Returns: undefined };
      delete_army_group: { Args: { p_group_id: string }; Returns: undefined };
      delete_army_unit: { Args: { p_unit_id: string }; Returns: undefined };
      delete_citizen_memory: {
        Args: { p_memory_id: string };
        Returns: undefined;
      };
      delete_culture: {
        Args: { p_culture_id: string; p_reassign_to_id?: string };
        Returns: {
          id: string;
          world_id: string;
        }[];
      };
      delete_event_or_group: {
        Args: { p_event_id: string; p_group_id: string };
        Returns: Json;
      };
      delete_religion: {
        Args: { p_reassign_to_id?: string; p_religion_id: string };
        Returns: {
          id: string;
          world_id: string;
        }[];
      };
      deposit_reserves: {
        Args: { p_currency_id: string; p_quantity: number };
        Returns: {
          backing_ratio: number | null;
          backing_resource_id: string | null;
          confidence: number;
          created_at: string;
          currency_type: string;
          established_turn_number: number;
          id: string;
          is_in_default: boolean;
          money_supply: number;
          name: string;
          nation_id: string;
          reserve_quantity: number;
          symbol: string;
          updated_at: string;
          world_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "nation_currencies";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      diag:
        | {
            Args: { msg: unknown };
            Returns: {
              error: true;
            } & "Could not choose the best candidate function between: public.diag(msg => text), public.diag(msg => anyelement). Try renaming the parameters or the function itself in the database so function overloading can be resolved";
          }
        | {
            Args: { msg: string };
            Returns: {
              error: true;
            } & "Could not choose the best candidate function between: public.diag(msg => text), public.diag(msg => anyelement). Try renaming the parameters or the function itself in the database so function overloading can be resolved";
          };
      diag_test_name: { Args: { "": string }; Returns: string };
      discharge_soldiers: {
        Args: { p_soldier_ids: string[] };
        Returns: {
          born_on_turn_number: number | null;
          citizen_type: string;
          created_at: string;
          culture_id: string | null;
          death_cause: string | null;
          death_cause_category:
            | Database["public"]["Enums"]["death_cause_category"]
            | null;
          education_level_id: string | null;
          given_name: string;
          id: string;
          name: string | null;
          nameset_id: string | null;
          npc_flaw: string | null;
          npc_goal: string | null;
          npc_secret_contradiction: string | null;
          npc_trait_1: string | null;
          npc_trait_2: string | null;
          parent_a_citizen_id: string | null;
          parent_b_citizen_id: string | null;
          personality_text: string | null;
          profile_photo_url: string | null;
          religion_id: string | null;
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
      dismiss_nation_office: {
        Args: { p_office_id: string };
        Returns: undefined;
      };
      dismiss_settlement_office: {
        Args: { p_office_id: string };
        Returns: undefined;
      };
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
      do_tap:
        | { Args: never; Returns: string[] }
        | { Args: { "": string }; Returns: string[] };
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
      enroll_citizen: {
        Args: { p_citizen_id: string; p_settlement_building_id: string };
        Returns: {
          citizen_id: string;
          created_at: string;
          enrolled_turn_number: number;
          id: string;
          progress_turns: number;
          settlement_building_id: string;
          target_level_id: string;
          updated_at: string;
          world_id: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "education_enrollments";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      ensure_str_snapshot_partitions: {
        Args: { p_turn_number: number; p_world_id: string };
        Returns: undefined;
      };
      ensure_turn_log_partition: {
        Args: { p_world_id: string };
        Returns: undefined;
      };
      establish_nation_currency: {
        Args: {
          p_backing_ratio?: number;
          p_backing_resource_id?: string;
          p_name: string;
          p_nation_id: string;
          p_symbol: string;
          p_type: string;
        };
        Returns: {
          backing_ratio: number | null;
          backing_resource_id: string | null;
          confidence: number;
          created_at: string;
          currency_type: string;
          established_turn_number: number;
          id: string;
          is_in_default: boolean;
          money_supply: number;
          name: string;
          nation_id: string;
          reserve_quantity: number;
          symbol: string;
          updated_at: string;
          world_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "nation_currencies";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      fail:
        | { Args: never; Returns: string }
        | { Args: { "": string }; Returns: string };
      fail_stuck_turn_transition: {
        Args: {
          p_reason?: string;
          p_transition_id: string;
          p_world_id: string;
        };
        Returns: Json;
      };
      findfuncs: { Args: { "": string }; Returns: string[] };
      finish: { Args: { exception_on_failure?: boolean }; Returns: string[] };
      format_type_string: { Args: { "": string }; Returns: string };
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
      get_citizen_family_tree: {
        Args: { p_citizen_id: string };
        Returns: {
          citizen_id: string;
          direction: string;
          generation: number;
          name: string;
          node_path: string;
          parent_a_citizen_id: string;
          parent_b_citizen_id: string;
          parent_path: string;
          partnership_status: string;
          status: string;
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
          qualified_citizen_count: number;
          required_education_level_id: string;
          required_education_level_name: string;
          world_id: string;
        }[];
      };
      grant_nation_resources: {
        Args: {
          p_nation_id: string;
          p_quantity: number;
          p_resource_id: string;
          p_settlement_id: string;
        };
        Returns: Record<string, unknown>;
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
      has_unique: { Args: { "": string }; Returns: string };
      has_world_access: { Args: { p_world_id: string }; Returns: boolean };
      import_world_from_template: {
        Args: { p_name: string; p_template?: Json };
        Returns: {
          archived_at: string | null;
          calendar_config_json: Json;
          created_at: string;
          current_turn_number: number;
          fertility_chance: number;
          food_consumption_per_citizen: number;
          hero_path: string | null;
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
          thumbnail_path: string | null;
          updated_at: string;
          water_consumption_per_citizen: number;
        }[];
        SetofOptions: {
          from: "*";
          to: "worlds";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      in_todo: { Args: never; Returns: boolean };
      increment_rate_limit_bucket: {
        Args: {
          p_function_name: string;
          p_user_id: string;
          p_window_minute: string;
        };
        Returns: number;
      };
      internal_apply_law_amendment_operations: {
        Args: {
          p_amendment_title: string;
          p_document_id: string;
          p_enacted_by_citizen_id: string;
          p_operations_json: Json;
          p_turn_number: number;
        };
        Returns: number;
      };
      internal_apply_turn_transition_advance_world_turn: {
        Args: { p_expected_turn_number: number; p_world_id: string };
        Returns: Record<string, unknown>;
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
      internal_apply_turn_transition_education_patches: {
        Args: { p_payload: Json };
        Returns: Record<string, unknown>;
      };
      internal_apply_turn_transition_event_patches: {
        Args: {
          p_payload: Json;
          p_to_turn_number: number;
          p_transition_id: string;
          p_world_id: string;
        };
        Returns: Record<string, unknown>;
      };
      internal_apply_turn_transition_law_amendment_expiry: {
        Args: {
          p_transition_id: string;
          p_turn_number: number;
          p_world_id: string;
        };
        Returns: Record<string, unknown>;
      };
      internal_apply_turn_transition_log_entries_and_notifications: {
        Args: { p_payload: Json; p_transition_id: string; p_world_id: string };
        Returns: Record<string, unknown>;
      };
      internal_apply_turn_transition_military_upkeep: {
        Args: { p_payload: Json; p_turn_number: number; p_world_id: string };
        Returns: Record<string, unknown>;
      };
      internal_apply_turn_transition_nation_currency: {
        Args: {
          p_expected_turn_number: number;
          p_payload: Json;
          p_transition_id: string;
          p_world_id: string;
        };
        Returns: Record<string, unknown>;
      };
      internal_apply_turn_transition_nation_economy: {
        Args: {
          p_expected_turn_number: number;
          p_payload: Json;
          p_transition_id: string;
          p_world_id: string;
        };
        Returns: Record<string, unknown>;
      };
      internal_apply_turn_transition_office_term_expiry: {
        Args: {
          p_transition_id: string;
          p_turn_number: number;
          p_world_id: string;
        };
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
      internal_apply_turn_transition_treaty_patches: {
        Args: { p_payload: Json };
        Returns: number;
      };
      internal_drop_elapsed_str_snapshot_partitions: {
        Args: {
          p_cutoff_turn: number;
          p_dry_run?: boolean;
          p_world_id: string;
        };
        Returns: number;
      };
      internal_effective_retention: {
        Args: { p_world_id: string };
        Returns: {
          log_turns: number;
          memory_turns: number;
          snapshot_turns: number;
        }[];
      };
      internal_notify_law_amendment: {
        Args: {
          p_message_text: string;
          p_nation_id: string;
          p_notification_type: Database["public"]["Enums"]["notification_type"];
          p_settlement_id: string;
          p_severity: Database["public"]["Enums"]["notification_severity"];
          p_world_id: string;
        };
        Returns: undefined;
      };
      internal_prune_batch_delete: {
        Args: {
          p_batch_limit: number;
          p_dry_run: boolean;
          p_predicate: string;
          p_table: unknown;
        };
        Returns: number;
      };
      internal_prune_world_retention: {
        Args: {
          p_batch_limit?: number;
          p_dry_run?: boolean;
          p_world_id: string;
        };
        Returns: Json;
      };
      internal_secure_str_snapshot_partition: {
        Args: { p_partition: unknown };
        Returns: undefined;
      };
      internal_secure_turn_log_partition: {
        Args: { p_partition: unknown };
        Returns: undefined;
      };
      is_active_app_user: { Args: never; Returns: boolean };
      is_any_world_admin: { Args: never; Returns: boolean };
      is_empty: { Args: { "": string }; Returns: string };
      is_nation_manager_of: { Args: { p_nation_id: string }; Returns: boolean };
      is_settlement_manager_of: {
        Args: { p_settlement_id: string };
        Returns: boolean;
      };
      is_super_admin: { Args: never; Returns: boolean };
      is_valid_calendar_config: { Args: { config: Json }; Returns: boolean };
      is_valid_government_body_composition: {
        Args: { p_composition: Json };
        Returns: boolean;
      };
      is_valid_government_body_composition_entry: {
        Args: { p_entry: Json };
        Returns: boolean;
      };
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
      isnt_empty: { Args: { "": string }; Returns: string };
      issue_decree: {
        Args: {
          p_body_markdown: string;
          p_issued_by_citizen_id: string;
          p_nation_id: string;
          p_settlement_id: string;
          p_title: string;
          p_world_id: string;
        };
        Returns: {
          body_markdown: string;
          created_at: string;
          id: string;
          issued_by_citizen_id: string | null;
          issued_turn_number: number;
          nation_id: string | null;
          revoked_turn_number: number | null;
          settlement_id: string | null;
          title: string;
          world_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "decrees";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      link_user_to_citizen: {
        Args: { p_citizen_id: string; p_user_id: string };
        Returns: {
          born_on_turn_number: number | null;
          citizen_type: string;
          created_at: string;
          culture_id: string | null;
          death_cause: string | null;
          death_cause_category:
            | Database["public"]["Enums"]["death_cause_category"]
            | null;
          education_level_id: string | null;
          given_name: string;
          id: string;
          name: string | null;
          nameset_id: string | null;
          npc_flaw: string | null;
          npc_goal: string | null;
          npc_secret_contradiction: string | null;
          npc_trait_1: string | null;
          npc_trait_2: string | null;
          parent_a_citizen_id: string | null;
          parent_b_citizen_id: string | null;
          personality_text: string | null;
          profile_photo_url: string | null;
          religion_id: string | null;
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
      lives_ok: { Args: { "": string }; Returns: string };
      manual_deconstruct_settlement_building: {
        Args: { p_settlement_building_id: string };
        Returns: {
          settlement_building_id: string;
        }[];
      };
      mark_all_notifications_read: {
        Args: { p_world_id?: string };
        Returns: {
          updated_count: number;
        }[];
      };
      mark_citizen_dead: {
        Args: { p_citizen_id: string; p_reason: string };
        Returns: {
          born_on_turn_number: number | null;
          citizen_type: string;
          created_at: string;
          culture_id: string | null;
          death_cause: string | null;
          death_cause_category:
            | Database["public"]["Enums"]["death_cause_category"]
            | null;
          education_level_id: string | null;
          given_name: string;
          id: string;
          name: string | null;
          nameset_id: string | null;
          npc_flaw: string | null;
          npc_goal: string | null;
          npc_secret_contradiction: string | null;
          npc_trait_1: string | null;
          npc_trait_2: string | null;
          parent_a_citizen_id: string | null;
          parent_b_citizen_id: string | null;
          personality_text: string | null;
          profile_photo_url: string | null;
          religion_id: string | null;
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
      mark_notification_read: {
        Args: { notification_id: string };
        Returns: {
          id: string;
          is_read: boolean;
        }[];
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
      meets_law_amendment_vote_threshold: {
        Args: { p_member_count: number; p_threshold: string; p_yes: number };
        Returns: boolean;
      };
      mint_currency: {
        Args: { p_amount: number; p_currency_id: string };
        Returns: {
          backing_ratio: number | null;
          backing_resource_id: string | null;
          confidence: number;
          created_at: string;
          currency_type: string;
          established_turn_number: number;
          id: string;
          is_in_default: boolean;
          money_supply: number;
          name: string;
          nation_id: string;
          reserve_quantity: number;
          symbol: string;
          updated_at: string;
          world_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "nation_currencies";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      move_army: {
        Args: { p_army_id: string; p_settlement_id: string };
        Returns: {
          created_at: string;
          created_turn_number: number;
          funding_source: string;
          id: string;
          name: string;
          nation_id: string;
          stationed_settlement_id: string;
          updated_at: string;
          world_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "armies";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      move_army_group: {
        Args: { p_group_id: string; p_new_parent_group_id: string };
        Returns: {
          army_id: string;
          created_at: string;
          id: string;
          name: string;
          parent_group_id: string | null;
          sort_order: number;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "army_groups";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      move_army_unit: {
        Args: { p_group_id: string; p_sort_order: number; p_unit_id: string };
        Returns: {
          army_id: string;
          created_at: string;
          created_turn_number: number;
          group_id: string | null;
          id: string;
          name: string;
          sort_order: number;
          unit_type_id: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "army_units";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      nation_images_path_nation_id: { Args: { name: string }; Returns: string };
      nation_readiness_eligible_voter_ids: {
        Args: { p_nation_id: string };
        Returns: string[];
      };
      nation_readiness_summary: {
        Args: { p_world_id: string };
        Returns: {
          eligible_voter_count: number;
          government_type: string;
          has_settlements: boolean;
          is_ready: boolean;
          nation_id: string;
          nation_name: string;
          readiness_mode: string;
          true_vote_count: number;
        }[];
      };
      nation_visible_to_current_user: {
        Args: { p_nation_id: string };
        Returns: boolean;
      };
      nation_world_id: { Args: { p_nation_id: string }; Returns: string };
      nations_have_met: { Args: { a: string; b: string }; Returns: boolean };
      no_plan: { Args: never; Returns: boolean[] };
      num_failed: { Args: never; Returns: number };
      os_name: { Args: never; Returns: string };
      pass:
        | { Args: never; Returns: string }
        | { Args: { "": string }; Returns: string };
      pg_version: { Args: never; Returns: string };
      pg_version_num: { Args: never; Returns: number };
      pgtap_version: { Args: never; Returns: number };
      preview_world_delete: { Args: { p_world_id: string }; Returns: Json };
      propose_law_amendment: {
        Args: {
          p_document_id: string;
          p_operations_json: Json;
          p_proposing_citizen_id: string;
          p_rationale_markdown: string;
          p_title: string;
        };
        Returns: {
          created_at: string;
          deadline_turn_number: number | null;
          document_id: string;
          id: string;
          operations_json: Json;
          proposed_by_citizen_id: string;
          proposed_turn_number: number;
          rationale_markdown: string | null;
          resolved_turn_number: number | null;
          status: string;
          title: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "law_amendments";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      propose_nation_treaty: {
        Args: {
          p_duration_turns?: number;
          p_proposed_by_citizen_id: string;
          p_proposer_nation_id: string;
          p_responder_nation_id: string;
          p_terms: Json;
          p_treaty_type: string;
        };
        Returns: {
          created_at: string;
          duration_turns: number | null;
          ends_turn_number: number | null;
          id: string;
          proposed_by_citizen_id: string | null;
          proposer_nation_id: string;
          responded_by_citizen_id: string | null;
          responder_nation_id: string;
          starts_turn_number: number | null;
          status: string;
          terms: Json;
          treaty_type: string;
          updated_at: string;
          world_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "nation_treaties";
          isOneToOne: true;
          isSetofReturn: false;
        };
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
          p_dry_run?: boolean;
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
      recompute_nation_readiness: {
        Args: { p_nation_id: string; p_turn_number: number };
        Returns: undefined;
      };
      recruit_soldiers: {
        Args: {
          p_citizen_ids: string[];
          p_settlement_id: string;
          p_unit_id: string;
        };
        Returns: {
          citizen_id: string;
          created_at: string;
          home_settlement_id: string | null;
          id: string;
          recruited_turn_number: number;
          unit_id: string;
          world_id: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "unit_soldiers";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      redeem_reserves: {
        Args: { p_currency_id: string; p_quantity: number };
        Returns: {
          backing_ratio: number | null;
          backing_resource_id: string | null;
          confidence: number;
          created_at: string;
          currency_type: string;
          established_turn_number: number;
          id: string;
          is_in_default: boolean;
          money_supply: number;
          name: string;
          nation_id: string;
          reserve_quantity: number;
          symbol: string;
          updated_at: string;
          world_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "nation_currencies";
          isOneToOne: true;
          isSetofReturn: false;
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
      rename_army: {
        Args: { p_army_id: string; p_name: string };
        Returns: {
          created_at: string;
          created_turn_number: number;
          funding_source: string;
          id: string;
          name: string;
          nation_id: string;
          stationed_settlement_id: string;
          updated_at: string;
          world_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "armies";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      rename_army_group: {
        Args: { p_group_id: string; p_name: string };
        Returns: {
          army_id: string;
          created_at: string;
          id: string;
          name: string;
          parent_group_id: string | null;
          sort_order: number;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "army_groups";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      rename_army_unit: {
        Args: { p_name: string; p_unit_id: string };
        Returns: {
          army_id: string;
          created_at: string;
          created_turn_number: number;
          group_id: string | null;
          id: string;
          name: string;
          sort_order: number;
          unit_type_id: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "army_units";
          isOneToOne: true;
          isSetofReturn: false;
        };
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
          hero_path: string | null;
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
          thumbnail_path: string | null;
          updated_at: string;
          water_consumption_per_citizen: number;
        }[];
        SetofOptions: {
          from: "*";
          to: "worlds";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      renew_office: {
        Args: { p_office_id: string; p_term_turns?: number };
        Returns: {
          appointed_turn_number: number;
          citizen_id: string;
          created_at: string;
          ended_turn_number: number | null;
          expires_turn_number: number | null;
          id: string;
          nation_id: string | null;
          office_type_id: string;
          settlement_id: string | null;
          term_turns: number | null;
          updated_at: string;
          world_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "nation_offices";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      reorder_army_group: {
        Args: { p_group_id: string; p_sort_order: number };
        Returns: {
          army_id: string;
          created_at: string;
          id: string;
          name: string;
          parent_group_id: string | null;
          sort_order: number;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "army_groups";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      reorder_construction_projects: {
        Args: { p_positions: Json; p_settlement_id: string };
        Returns: {
          updated_count: number;
        }[];
      };
      reorder_education_level: {
        Args: { p_direction: string; p_level_id: string };
        Returns: {
          created_at: string;
          description: string | null;
          icon: string | null;
          icon_color: number | null;
          id: string;
          name: string;
          natural_born_percent: number;
          rank: number;
          updated_at: string;
          world_id: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "education_levels";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      repeal_law_document: {
        Args: { p_document_id: string };
        Returns: {
          amendment_procedure_json: Json;
          created_at: string;
          created_turn_number: number;
          current_version: number;
          id: string;
          nation_id: string | null;
          preamble_markdown: string | null;
          settlement_id: string | null;
          status: string;
          title: string;
          updated_at: string;
          world_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "law_documents";
          isOneToOne: true;
          isSetofReturn: false;
        };
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
      resolve_government_body_member_ids: {
        Args: { p_body_id: string };
        Returns: string[];
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
      respond_to_nation_treaty: {
        Args: {
          p_responded_by_citizen_id: string;
          p_response: string;
          p_treaty_id: string;
        };
        Returns: {
          created_at: string;
          duration_turns: number | null;
          ends_turn_number: number | null;
          id: string;
          proposed_by_citizen_id: string | null;
          proposer_nation_id: string;
          responded_by_citizen_id: string | null;
          responder_nation_id: string;
          starts_turn_number: number | null;
          status: string;
          terms: Json;
          treaty_type: string;
          updated_at: string;
          world_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "nation_treaties";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      restore_building_blueprint: {
        Args: { p_blueprint_id: string; p_world_id: string };
        Returns: {
          created_at: string;
          description: string | null;
          grace_period_turns: number;
          icon: string | null;
          icon_color: number | null;
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
          icon: string | null;
          icon_color: number | null;
          id: string;
          is_trashed: boolean;
          name: string;
          slug: string;
          updated_at: string;
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
          icon: string | null;
          icon_color: number | null;
          id: string;
          inputs_json: Json;
          is_trashed: boolean;
          job_type: string;
          linked_deposit_type_id: string | null;
          linked_managed_population_type_id: string | null;
          name: string;
          outputs_json: Json;
          required_education_level_id: string | null;
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
          culling_outputs_json: Json;
          growth_rate: number;
          icon: string | null;
          icon_color: number | null;
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
          category_id: string | null;
          change_amount: number;
          change_mode: string;
          created_at: string;
          icon: string | null;
          icon_color: number | null;
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
          hero_path: string | null;
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
          thumbnail_path: string | null;
          updated_at: string;
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
          culture_id: string | null;
          death_cause: string | null;
          death_cause_category:
            | Database["public"]["Enums"]["death_cause_category"]
            | null;
          education_level_id: string | null;
          given_name: string;
          id: string;
          name: string | null;
          nameset_id: string | null;
          npc_flaw: string | null;
          npc_goal: string | null;
          npc_secret_contradiction: string | null;
          npc_trait_1: string | null;
          npc_trait_2: string | null;
          parent_a_citizen_id: string | null;
          parent_b_citizen_id: string | null;
          personality_text: string | null;
          profile_photo_url: string | null;
          religion_id: string | null;
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
      revoke_decree: {
        Args: { p_decree_id: string };
        Returns: {
          body_markdown: string;
          created_at: string;
          id: string;
          issued_by_citizen_id: string | null;
          issued_turn_number: number;
          nation_id: string | null;
          revoked_turn_number: number | null;
          settlement_id: string | null;
          title: string;
          world_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "decrees";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      revoke_world_admin: {
        Args: { p_user_id: string; p_world_id: string };
        Returns: undefined;
      };
      run_scheduled_retention: { Args: never; Returns: undefined };
      runtests:
        | { Args: never; Returns: string[] }
        | { Args: { "": string }; Returns: string[] };
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
      set_citizen_culture_religion: {
        Args: {
          p_citizen_id: string;
          p_culture_id: string;
          p_religion_id: string;
        };
        Returns: {
          born_on_turn_number: number | null;
          citizen_type: string;
          created_at: string;
          culture_id: string | null;
          death_cause: string | null;
          death_cause_category:
            | Database["public"]["Enums"]["death_cause_category"]
            | null;
          education_level_id: string | null;
          given_name: string;
          id: string;
          name: string | null;
          nameset_id: string | null;
          npc_flaw: string | null;
          npc_goal: string | null;
          npc_secret_contradiction: string | null;
          npc_trait_1: string | null;
          npc_trait_2: string | null;
          parent_a_citizen_id: string | null;
          parent_b_citizen_id: string | null;
          personality_text: string | null;
          profile_photo_url: string | null;
          religion_id: string | null;
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
      set_citizen_education: {
        Args: { p_citizen_id: string; p_education_level_id: string };
        Returns: {
          born_on_turn_number: number | null;
          citizen_type: string;
          created_at: string;
          culture_id: string | null;
          death_cause: string | null;
          death_cause_category:
            | Database["public"]["Enums"]["death_cause_category"]
            | null;
          education_level_id: string | null;
          given_name: string;
          id: string;
          name: string | null;
          nameset_id: string | null;
          npc_flaw: string | null;
          npc_goal: string | null;
          npc_secret_contradiction: string | null;
          npc_trait_1: string | null;
          npc_trait_2: string | null;
          parent_a_citizen_id: string | null;
          parent_b_citizen_id: string | null;
          personality_text: string | null;
          profile_photo_url: string | null;
          religion_id: string | null;
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
      set_nation_capital_and_founded_turn: {
        Args: {
          p_capital_settlement_id: string;
          p_founded_turn_number: number;
          p_nation_id: string;
        };
        Returns: {
          capital_settlement_id: string | null;
          created_at: string;
          description: string | null;
          flag_path: string | null;
          founded_turn_number: number | null;
          government_type: string;
          id: string;
          name: string;
          nameset_id: string | null;
          primary_culture_id: string | null;
          state_religion_id: string | null;
          tax_rate: number;
          trade_policy: string;
          treasury_currency: number;
          updated_at: string;
          world_id: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "nations";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      set_nation_culture_religion: {
        Args: {
          p_nation_id: string;
          p_primary_culture_id: string;
          p_state_religion_id: string;
        };
        Returns: {
          capital_settlement_id: string | null;
          created_at: string;
          description: string | null;
          flag_path: string | null;
          founded_turn_number: number | null;
          government_type: string;
          id: string;
          name: string;
          nameset_id: string | null;
          primary_culture_id: string | null;
          state_religion_id: string | null;
          tax_rate: number;
          trade_policy: string;
          treasury_currency: number;
          updated_at: string;
          world_id: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "nations";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      set_nation_flag_path: {
        Args: { p_flag_path: string; p_nation_id: string };
        Returns: {
          capital_settlement_id: string | null;
          created_at: string;
          description: string | null;
          flag_path: string | null;
          founded_turn_number: number | null;
          government_type: string;
          id: string;
          name: string;
          nameset_id: string | null;
          primary_culture_id: string | null;
          state_religion_id: string | null;
          tax_rate: number;
          trade_policy: string;
          treasury_currency: number;
          updated_at: string;
          world_id: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "nations";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      set_nation_nameset: {
        Args: { p_nameset_id: string; p_nation_id: string; p_world_id: string };
        Returns: {
          id: string;
          nameset_id: string;
          world_id: string;
        }[];
      };
      set_nation_tax_rate: {
        Args: { p_nation_id: string; p_rate: number };
        Returns: {
          capital_settlement_id: string | null;
          created_at: string;
          description: string | null;
          flag_path: string | null;
          founded_turn_number: number | null;
          government_type: string;
          id: string;
          name: string;
          nameset_id: string | null;
          primary_culture_id: string | null;
          state_religion_id: string | null;
          tax_rate: number;
          trade_policy: string;
          treasury_currency: number;
          updated_at: string;
          world_id: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "nations";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      set_nation_trade_policy: {
        Args: { p_nation_id: string; p_trade_policy: string };
        Returns: {
          capital_settlement_id: string | null;
          created_at: string;
          description: string | null;
          flag_path: string | null;
          founded_turn_number: number | null;
          government_type: string;
          id: string;
          name: string;
          nameset_id: string | null;
          primary_culture_id: string | null;
          state_religion_id: string | null;
          tax_rate: number;
          trade_policy: string;
          treasury_currency: number;
          updated_at: string;
          world_id: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "nations";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      set_nations_met: {
        Args: { p_a: string; p_b: string };
        Returns: {
          created_at: string;
          created_by_user_id: string | null;
          id: string;
          met_at_turn_number: number;
          nation_a_id: string;
          nation_b_id: string;
          world_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "nation_discoveries";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      set_nations_unmet: {
        Args: { p_a: string; p_b: string };
        Returns: undefined;
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
          hero_path: string | null;
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
          thumbnail_path: string | null;
          updated_at: string;
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
      skip:
        | { Args: { "": string }; Returns: string }
        | { Args: { how_many: number; why: string }; Returns: string };
      soft_delete_building_blueprint: {
        Args: { p_blueprint_id: string; p_world_id: string };
        Returns: {
          created_at: string;
          description: string | null;
          grace_period_turns: number;
          icon: string | null;
          icon_color: number | null;
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
          icon: string | null;
          icon_color: number | null;
          id: string;
          is_trashed: boolean;
          name: string;
          slug: string;
          updated_at: string;
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
          icon: string | null;
          icon_color: number | null;
          id: string;
          inputs_json: Json;
          is_trashed: boolean;
          job_type: string;
          linked_deposit_type_id: string | null;
          linked_managed_population_type_id: string | null;
          name: string;
          outputs_json: Json;
          required_education_level_id: string | null;
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
          culling_outputs_json: Json;
          growth_rate: number;
          icon: string | null;
          icon_color: number | null;
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
          category_id: string | null;
          change_amount: number;
          change_mode: string;
          created_at: string;
          icon: string | null;
          icon_color: number | null;
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
      subsidize_construction_project: {
        Args: { p_nation_id: string; p_project_id: string };
        Returns: {
          clamped: boolean;
          granted_quantity: number;
          resource_id: string;
        }[];
      };
      throws_ok: { Args: { "": string }; Returns: string };
      todo:
        | { Args: { how_many: number }; Returns: boolean[] }
        | { Args: { how_many: number; why: string }; Returns: boolean[] }
        | { Args: { why: string }; Returns: boolean[] }
        | { Args: { how_many: number; why: string }; Returns: boolean[] };
      todo_end: { Args: never; Returns: boolean[] };
      todo_start:
        | { Args: never; Returns: boolean[] }
        | { Args: { "": string }; Returns: boolean[] };
      trash_world: {
        Args: { p_world_id: string };
        Returns: {
          archived_at: string | null;
          calendar_config_json: Json;
          created_at: string;
          current_turn_number: number;
          fertility_chance: number;
          food_consumption_per_citizen: number;
          hero_path: string | null;
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
          thumbnail_path: string | null;
          updated_at: string;
          water_consumption_per_citizen: number;
        }[];
        SetofOptions: {
          from: "*";
          to: "worlds";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      unenroll_citizen: {
        Args: { p_enrollment_id: string };
        Returns: {
          citizen_id: string;
          created_at: string;
          enrolled_turn_number: number;
          id: string;
          progress_turns: number;
          settlement_building_id: string;
          target_level_id: string;
          updated_at: string;
          world_id: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "education_enrollments";
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
          culture_id: string | null;
          death_cause: string | null;
          death_cause_category:
            | Database["public"]["Enums"]["death_cause_category"]
            | null;
          education_level_id: string | null;
          given_name: string;
          id: string;
          name: string | null;
          nameset_id: string | null;
          npc_flaw: string | null;
          npc_goal: string | null;
          npc_secret_contradiction: string | null;
          npc_trait_1: string | null;
          npc_trait_2: string | null;
          parent_a_citizen_id: string | null;
          parent_b_citizen_id: string | null;
          personality_text: string | null;
          profile_photo_url: string | null;
          religion_id: string | null;
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
      update_citizen_memory: {
        Args: {
          p_memory_id: string;
          p_memory_text: string;
          p_occurred_on_turn_number: number;
        };
        Returns: {
          id: string;
        }[];
      };
      update_event_group_with_events: {
        Args: {
          p_activate_on_transition_after_turn_number: number;
          p_create_citizen_memories: boolean;
          p_duration_transitions: number;
          p_duration_type: string;
          p_effects: Json;
          p_group_description: string;
          p_group_id: string;
          p_group_name: string;
          p_memories?: Json;
          p_memory_text: string;
        };
        Returns: Json;
      };
      update_settlement_coordinates: {
        Args: { p_coord_x: number; p_coord_z: number; p_settlement_id: string };
        Returns: {
          coord_x: number;
          coord_z: number;
          id: string;
        }[];
      };
      upsert_world_retention_config: {
        Args: {
          p_log_retention_turns?: number;
          p_snapshot_retention_turns?: number;
          p_world_id: string;
        };
        Returns: undefined;
      };
      user_has_player_character_in_world: {
        Args: { p_world_id: string };
        Returns: boolean;
      };
      validate_event_effect_fields: {
        Args: { p_effect: Json };
        Returns: undefined;
      };
      validate_event_effect_world_membership: {
        Args: { p_effect: Json; p_world_id: string };
        Returns: undefined;
      };
      validate_law_amendment_procedure_json:
        | {
            Args: { p_document_id: string; p_procedure: Json };
            Returns: undefined;
          }
        | {
            Args: {
              p_nation_id: string;
              p_procedure: Json;
              p_settlement_id: string;
            };
            Returns: undefined;
          };
      withdraw_law_amendment: {
        Args: { p_amendment_id: string };
        Returns: {
          created_at: string;
          deadline_turn_number: number | null;
          document_id: string;
          id: string;
          operations_json: Json;
          proposed_by_citizen_id: string;
          proposed_turn_number: number;
          rationale_markdown: string | null;
          resolved_turn_number: number | null;
          status: string;
          title: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "law_amendments";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      withdraw_nation_treaty: {
        Args: { p_treaty_id: string };
        Returns: {
          created_at: string;
          duration_turns: number | null;
          ends_turn_number: number | null;
          id: string;
          proposed_by_citizen_id: string | null;
          proposer_nation_id: string;
          responded_by_citizen_id: string | null;
          responder_nation_id: string;
          starts_turn_number: number | null;
          status: string;
          terms: Json;
          treaty_type: string;
          updated_at: string;
          world_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "nation_treaties";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      world_images_path_world_id: { Args: { name: string }; Returns: string };
      world_is_archived: { Args: { p_world_id: string }; Returns: boolean };
    };
    Enums: {
      death_cause_category:
        | "starvation"
        | "homeless"
        | "event"
        | "manual_admin"
        | "unknown";
      notification_severity: "info" | "warning" | "critical";
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
        | "building.recovered"
        | "event.activated"
        | "event.expired"
        | "player.died"
        | "player.widowed"
        | "nation.succession"
        | "nation.grant_received"
        | "nation.subsidy_received"
        | "nation.treaty_broken"
        | "nation.tribute_missed"
        | "nation.treaty_expired"
        | "currency.default"
        | "currency.confidence_collapsing"
        | "military.upkeep_unpaid"
        | "military.unit_disbanded"
        | "army.relocated"
        | "law.amendment_passed"
        | "law.amendment_failed"
        | "law.amendment_withdrawn"
        | "law.amendment_expired"
        | "office.term_ended";
    };
    CompositeTypes: {
      _time_trial_type: {
        a_time: number | null;
      };
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      death_cause_category: [
        "starvation",
        "homeless",
        "event",
        "manual_admin",
        "unknown",
      ],
      notification_severity: ["info", "warning", "critical"],
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
        "event.activated",
        "event.expired",
        "player.died",
        "player.widowed",
        "nation.succession",
        "nation.grant_received",
        "nation.subsidy_received",
        "nation.treaty_broken",
        "nation.tribute_missed",
        "nation.treaty_expired",
        "currency.default",
        "currency.confidence_collapsing",
        "military.upkeep_unpaid",
        "military.unit_disbanded",
        "army.relocated",
        "law.amendment_passed",
        "law.amendment_failed",
        "law.amendment_withdrawn",
        "law.amendment_expired",
        "office.term_ended",
      ],
    },
  },
} as const;

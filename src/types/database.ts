/**
 * NAGRIK DATABASE SCHEMA TYPES (Supabase Generated / Aligned)
 * Authority: TRD Section 6 & Schema Migrations
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      organisations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          organisation_type: "government_authority" | "demo_authority" | "internal";
          is_demo: boolean;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          organisation_type: "government_authority" | "demo_authority" | "internal";
          is_demo?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          organisation_type?: "government_authority" | "demo_authority" | "internal";
          is_demo?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      profiles: {
        Row: {
          user_id: string;
          display_name: string;
          role: "super_admin" | "authority_admin" | "authority_operator" | "demo_viewer";
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          display_name: string;
          role: "super_admin" | "authority_admin" | "authority_operator" | "demo_viewer";
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          display_name?: string;
          role?: "super_admin" | "authority_admin" | "authority_operator" | "demo_viewer";
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      organisation_memberships: {
        Row: {
          id: string;
          organisation_id: string;
          user_id: string;
          membership_role: "authority_admin" | "authority_operator" | "demo_viewer";
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organisation_id: string;
          user_id: string;
          membership_role: "authority_admin" | "authority_operator" | "demo_viewer";
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organisation_id?: string;
          user_id?: string;
          membership_role?: "authority_admin" | "authority_operator" | "demo_viewer";
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      citizen_contacts: {
        Row: {
          id: string;
          telegram_user_hash: string;
          encrypted_chat_id: string;
          language: "en" | "hi" | "mr";
          consent_version: string;
          consent_at: string;
          created_at: string;
          last_seen_at: string;
        };
        Insert: {
          id?: string;
          telegram_user_hash: string;
          encrypted_chat_id: string;
          language?: "en" | "hi" | "mr";
          consent_version?: string;
          consent_at?: string;
          created_at?: string;
          last_seen_at?: string;
        };
        Update: {
          id?: string;
          telegram_user_hash?: string;
          encrypted_chat_id?: string;
          language?: "en" | "hi" | "mr";
          consent_version?: string;
          consent_at?: string;
          created_at?: string;
          last_seen_at?: string;
        };
      };
      spots: {
        Row: {
          id: string;
          spot_code: string;
          pilot_id: string;
          group_id: string;
          category_id: string;
          issue_type_id: string;
          canonical_latitude: number;
          canonical_longitude: number;
          anchor_accuracy_m: number | null;
          status:
            | "NEW"
            | "UNDER_REVIEW"
            | "VERIFIED"
            | "ASSIGNED"
            | "HANDED_OFF"
            | "AUTHORITY_ACKNOWLEDGED"
            | "IN_PROGRESS"
            | "RESOLUTION_SUBMITTED"
            | "RESOLVED"
            | "REOPENED"
            | "REJECTED";
          severity_label: "low" | "medium" | "high" | null;
          assigned_organisation_id: string | null;
          public_approved: boolean;
          is_demo: boolean;
          resolved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          spot_code: string;
          pilot_id?: string;
          group_id: string;
          category_id: string;
          issue_type_id: string;
          canonical_latitude: number;
          canonical_longitude: number;
          anchor_accuracy_m?: number | null;
          status?: string;
          severity_label?: "low" | "medium" | "high" | null;
          assigned_organisation_id?: string | null;
          public_approved?: boolean;
          is_demo?: boolean;
          resolved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          spot_code?: string;
          pilot_id?: string;
          group_id?: string;
          category_id?: string;
          issue_type_id?: string;
          canonical_latitude?: number;
          canonical_longitude?: number;
          anchor_accuracy_m?: number | null;
          status?: string;
          severity_label?: "low" | "medium" | "high" | null;
          assigned_organisation_id?: string | null;
          public_approved?: boolean;
          is_demo?: boolean;
          resolved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      reports: {
        Row: {
          id: string;
          ticket_code: string;
          citizen_contact_id: string;
          pilot_id: string;
          group_id: string;
          category_id: string;
          issue_type_id: string;
          description_private: string | null;
          language: "en" | "hi" | "mr";
          latitude: number | null;
          longitude: number | null;
          horizontal_accuracy_m: number | null;
          location_source: "telegram_location" | "manual_pin" | "landmark";
          location_review_status: "unreviewed" | "confirmed" | "corrected" | "insufficient";
          spot_id: string | null;
          match_method: "manual_confirmed" | "manual_new_spot" | "admin_override" | null;
          match_distance_m: number | null;
          matched_by: string | null;
          matched_at: string | null;
          match_note: string | null;
          review_status: "new" | "under_review" | "verified" | "rejected";
          public_summary: string | null;
          public_approved: boolean;
          is_demo: boolean;
          telegram_update_id: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          ticket_code: string;
          citizen_contact_id: string;
          pilot_id?: string;
          group_id: string;
          category_id: string;
          issue_type_id: string;
          description_private?: string | null;
          language?: "en" | "hi" | "mr";
          latitude?: number | null;
          longitude?: number | null;
          horizontal_accuracy_m?: number | null;
          location_source?: "telegram_location" | "manual_pin" | "landmark";
          location_review_status?: "unreviewed" | "confirmed" | "corrected" | "insufficient";
          spot_id?: string | null;
          match_method?: "manual_confirmed" | "manual_new_spot" | "admin_override" | null;
          match_distance_m?: number | null;
          matched_by?: string | null;
          matched_at?: string | null;
          match_note?: string | null;
          review_status?: "new" | "under_review" | "verified" | "rejected";
          public_summary?: string | null;
          public_approved?: boolean;
          is_demo?: boolean;
          telegram_update_id?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          ticket_code?: string;
          citizen_contact_id?: string;
          pilot_id?: string;
          group_id?: string;
          category_id?: string;
          issue_type_id?: string;
          description_private?: string | null;
          language?: "en" | "hi" | "mr";
          latitude?: number | null;
          longitude?: number | null;
          horizontal_accuracy_m?: number | null;
          location_source?: "telegram_location" | "manual_pin" | "landmark";
          location_review_status?: "unreviewed" | "confirmed" | "corrected" | "insufficient";
          spot_id?: string | null;
          match_method?: "manual_confirmed" | "manual_new_spot" | "admin_override" | null;
          match_distance_m?: number | null;
          matched_by?: string | null;
          matched_at?: string | null;
          match_note?: string | null;
          review_status?: "new" | "under_review" | "verified" | "rejected";
          public_summary?: string | null;
          public_approved?: boolean;
          is_demo?: boolean;
          telegram_update_id?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      evidence: {
        Row: {
          id: string;
          report_id: string | null;
          spot_id: string | null;
          evidence_stage: "citizen_initial" | "authority_after" | "authority_video" | "other";
          storage_path_private: string;
          storage_path_public: string | null;
          mime_type: string;
          file_size_bytes: number;
          sha256: string;
          telegram_file_unique_id: string | null;
          uploaded_by_user_id: string | null;
          uploaded_by_contact_id: string | null;
          server_received_at: string;
          public_approved_at: string | null;
          delete_after: string | null;
        };
        Insert: {
          id?: string;
          report_id?: string | null;
          spot_id?: string | null;
          evidence_stage: "citizen_initial" | "authority_after" | "authority_video" | "other";
          storage_path_private: string;
          storage_path_public?: string | null;
          mime_type: string;
          file_size_bytes: number;
          sha256: string;
          telegram_file_unique_id?: string | null;
          uploaded_by_user_id?: string | null;
          uploaded_by_contact_id?: string | null;
          server_received_at?: string;
          public_approved_at?: string | null;
          delete_after?: string | null;
        };
        Update: {
          id?: string;
          report_id?: string | null;
          spot_id?: string | null;
          evidence_stage?: "citizen_initial" | "authority_after" | "authority_video" | "other";
          storage_path_private?: string;
          storage_path_public?: string | null;
          mime_type?: string;
          file_size_bytes?: number;
          sha256?: string;
          telegram_file_unique_id?: string | null;
          uploaded_by_user_id?: string | null;
          uploaded_by_contact_id?: string | null;
          server_received_at?: string;
          public_approved_at?: string | null;
          delete_after?: string | null;
        };
      };
      status_history: {
        Row: {
          id: string;
          spot_id: string;
          previous_status: string | null;
          new_status: string;
          actor_type: "system" | "super_admin" | "authority_user";
          actor_user_id: string | null;
          note: string;
          source: "telegram" | "admin_dashboard" | "authority_dashboard" | "system";
          created_at: string;
        };
        Insert: {
          id?: string;
          spot_id: string;
          previous_status?: string | null;
          new_status: string;
          actor_type: "system" | "super_admin" | "authority_user";
          actor_user_id?: string | null;
          note?: string;
          source?: "telegram" | "admin_dashboard" | "authority_dashboard" | "system";
          created_at?: string;
        };
        Update: {
          id?: string;
          spot_id?: string;
          previous_status?: string | null;
          new_status?: string;
          actor_type?: "system" | "super_admin" | "authority_user";
          actor_user_id?: string | null;
          note?: string;
          source?: "telegram" | "admin_dashboard" | "authority_dashboard" | "system";
          created_at?: string;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          actor_type: "system" | "super_admin" | "authority_user";
          actor_user_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          before_value: Json | null;
          after_value: Json | null;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_type: "system" | "super_admin" | "authority_user";
          actor_user_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          before_value?: Json | null;
          after_value?: Json | null;
          reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_type?: "system" | "super_admin" | "authority_user";
          actor_user_id?: string | null;
          action?: string;
          entity_type?: string;
          entity_id?: string | null;
          before_value?: Json | null;
          after_value?: Json | null;
          reason?: string | null;
          created_at?: string;
        };
      };
      authority_handoffs: {
        Row: {
          id: string;
          spot_id: string;
          organisation_id: string | null;
          destination_name: string;
          handoff_method: "official_portal" | "email" | "letter" | "in_person" | "other";
          submitted_at: string;
          official_reference: string | null;
          proof_evidence_id: string | null;
          recorded_by: string;
          note: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          spot_id: string;
          organisation_id?: string | null;
          destination_name: string;
          handoff_method: "official_portal" | "email" | "letter" | "in_person" | "other";
          submitted_at?: string;
          official_reference?: string | null;
          proof_evidence_id?: string | null;
          recorded_by: string;
          note: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          spot_id?: string;
          organisation_id?: string | null;
          destination_name?: string;
          handoff_method?: "official_portal" | "email" | "letter" | "in_person" | "other";
          submitted_at?: string;
          official_reference?: string | null;
          proof_evidence_id?: string | null;
          recorded_by?: string;
          note?: string;
          created_at?: string;
        };
      };
      resolution_submissions: {
        Row: {
          id: string;
          spot_id: string;
          submitted_by: string;
          completion_note: string;
          completion_date: string | null;
          work_order_reference: string | null;
          after_photo_evidence_id: string;
          video_evidence_id: string | null;
          review_status: "pending" | "approved" | "rejected" | "more_info_required";
          reviewed_by: string | null;
          review_note: string | null;
          created_at: string;
          reviewed_at: string | null;
        };
        Insert: {
          id?: string;
          spot_id: string;
          submitted_by: string;
          completion_note: string;
          completion_date?: string | null;
          work_order_reference?: string | null;
          after_photo_evidence_id: string;
          video_evidence_id?: string | null;
          review_status?: "pending" | "approved" | "rejected" | "more_info_required";
          reviewed_by?: string | null;
          review_note?: string | null;
          created_at?: string;
          reviewed_at?: string | null;
        };
        Update: {
          id?: string;
          spot_id?: string;
          submitted_by?: string;
          completion_note?: string;
          completion_date?: string | null;
          work_order_reference?: string | null;
          after_photo_evidence_id?: string;
          video_evidence_id?: string | null;
          review_status?: "pending" | "approved" | "rejected" | "more_info_required";
          reviewed_by?: string | null;
          review_note?: string | null;
          created_at?: string;
          reviewed_at?: string | null;
        };
      };
      ai_assessments: {
        Row: {
          id: string;
          spot_id: string;
          resolution_submission_id: string | null;
          assessment_type: "image_eligibility" | "repair_comparison" | "voice_transcription" | "other_category_suggestion";
          model_name: string;
          input_evidence_ids: Json;
          result_code: string;
          result_text: string;
          is_advisory_only: boolean;
          requested_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          spot_id: string;
          resolution_submission_id?: string | null;
          assessment_type: "image_eligibility" | "repair_comparison" | "voice_transcription" | "other_category_suggestion";
          model_name: string;
          input_evidence_ids?: Json;
          result_code: string;
          result_text: string;
          is_advisory_only?: boolean;
          requested_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          spot_id?: string;
          resolution_submission_id?: string | null;
          assessment_type?: "image_eligibility" | "repair_comparison" | "voice_transcription" | "other_category_suggestion";
          model_name?: string;
          input_evidence_ids?: Json;
          result_code?: string;
          result_text?: string;
          is_advisory_only?: boolean;
          requested_by?: string;
          created_at?: string;
        };
      };
      telegram_updates: {
        Row: {
          update_id: number;
          received_at: string;
          processed_at: string | null;
          processing_status: "received" | "processed" | "failed" | "ignored_duplicate";
          failure_reason: string | null;
        };
        Insert: {
          update_id: number;
          received_at?: string;
          processed_at?: string | null;
          processing_status?: "received" | "processed" | "failed" | "ignored_duplicate";
          failure_reason?: string | null;
        };
        Update: {
          update_id?: number;
          received_at?: string;
          processed_at?: string | null;
          processing_status?: "received" | "processed" | "failed" | "ignored_duplicate";
          failure_reason?: string | null;
        };
      };
      report_drafts: {
        Row: {
          id: string;
          citizen_contact_id: string;
          conversation_state: string;
          draft_payload: Json;
          expires_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          citizen_contact_id: string;
          conversation_state: string;
          draft_payload?: Json;
          expires_at: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          citizen_contact_id?: string;
          conversation_state?: string;
          draft_payload?: Json;
          expires_at?: string;
          updated_at?: string;
        };
      };
      citizen_challenges: {
        Row: {
          id: string;
          spot_id: string;
          report_id: string | null;
          citizen_contact_id: string;
          challenge_type: "still_not_fixed" | "wrong_location" | "other";
          note: string | null;
          status: "new" | "under_review" | "accepted" | "rejected";
          reviewed_by: string | null;
          review_note: string | null;
          created_at: string;
          reviewed_at: string | null;
        };
        Insert: {
          id?: string;
          spot_id: string;
          report_id?: string | null;
          citizen_contact_id: string;
          challenge_type: "still_not_fixed" | "wrong_location" | "other";
          note?: string | null;
          status?: "new" | "under_review" | "accepted" | "rejected";
          reviewed_by?: string | null;
          review_note?: string | null;
          created_at?: string;
          reviewed_at?: string | null;
        };
        Update: {
          id?: string;
          spot_id?: string;
          report_id?: string | null;
          citizen_contact_id?: string;
          challenge_type?: "still_not_fixed" | "wrong_location" | "other";
          note?: string | null;
          status?: "new" | "under_review" | "accepted" | "rejected";
          reviewed_by?: string | null;
          review_note?: string | null;
          created_at?: string;
          reviewed_at?: string | null;
        };
      };
      notification_outbox: {
        Row: {
          id: string;
          citizen_contact_id: string;
          event_type: string;
          payload: Json;
          delivery_status: "pending" | "sent" | "failed";
          attempt_count: number;
          last_attempt_at: string | null;
          last_error: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          citizen_contact_id: string;
          event_type: string;
          payload?: Json;
          delivery_status?: "pending" | "sent" | "failed";
          attempt_count?: number;
          last_attempt_at?: string | null;
          last_error?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          citizen_contact_id?: string;
          event_type?: string;
          payload?: Json;
          delivery_status?: "pending" | "sent" | "failed";
          attempt_count?: number;
          last_attempt_at?: string | null;
          last_error?: string | null;
          created_at?: string;
        };
      };
      pilot_settings: {
        Row: {
          id: string;
          pilot_name: string;
          anchor_description: string;
          centre_latitude: number;
          centre_longitude: number;
          radius_m: number;
          is_active: boolean;
          settings_payload: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          pilot_name: string;
          anchor_description: string;
          centre_latitude: number;
          centre_longitude: number;
          radius_m?: number;
          is_active?: boolean;
          settings_payload?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          pilot_name?: string;
          anchor_description?: string;
          centre_latitude?: number;
          centre_longitude?: number;
          radius_m?: number;
          is_active?: boolean;
          settings_payload?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Functions: {
      current_user_role: {
        Args: Record<PropertyKey, never>;
        Returns: string | null;
      };
      is_super_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_demo_viewer: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      get_user_organisations: {
        Args: Record<PropertyKey, never>;
        Returns: string[];
      };
      generate_ticket_code: {
        Args: { p_pilot_prefix?: string };
        Returns: string;
      };
      generate_spot_code: {
        Args: { p_pilot_prefix?: string };
        Returns: string;
      };
      create_report_submission: {
        Args: {
          p_telegram_user_hash: string;
          p_encrypted_chat_id: string;
          p_language: string;
          p_pilot_id?: string;
          p_group_id: string;
          p_category_id: string;
          p_issue_type_id: string;
          p_description_private?: string | null;
          p_latitude?: number | null;
          p_longitude?: number | null;
          p_horizontal_accuracy_m?: number | null;
          p_location_source?: string;
          p_storage_path_private?: string | null;
          p_mime_type?: string | null;
          p_file_size_bytes?: number | null;
          p_sha256?: string | null;
          p_telegram_file_unique_id?: string | null;
          p_telegram_update_id?: number | null;
          p_is_demo?: boolean;
        };
        Returns: Json;
      };
      create_spot_for_report: {
        Args: {
          p_report_id: string;
          p_actor_user_id: string;
          p_severity_label?: string | null;
          p_assigned_organisation_id?: string | null;
        };
        Returns: Json;
      };
      link_report_to_spot: {
        Args: {
          p_report_id: string;
          p_spot_id: string;
          p_actor_user_id: string;
          p_match_distance_m: number;
          p_match_note?: string | null;
        };
        Returns: boolean;
      };
      transition_spot_status: {
        Args: {
          p_spot_id: string;
          p_new_status: string;
          p_actor_type: string;
          p_actor_user_id: string;
          p_note: string;
          p_source?: string;
        };
        Returns: boolean;
      };
      record_authority_handoff: {
        Args: {
          p_spot_id: string;
          p_destination_name: string;
          p_handoff_method: string;
          p_recorded_by: string;
          p_note: string;
          p_official_reference?: string | null;
          p_proof_evidence_id?: string | null;
          p_organisation_id?: string | null;
        };
        Returns: string;
      };
      submit_resolution_request: {
        Args: {
          p_spot_id: string;
          p_submitted_by: string;
          p_completion_note: string;
          p_after_photo_evidence_id: string;
          p_completion_date?: string | null;
          p_work_order_reference?: string | null;
          p_video_evidence_id?: string | null;
        };
        Returns: string;
      };
      review_resolution_request: {
        Args: {
          p_submission_id: string;
          p_reviewed_by: string;
          p_decision: string;
          p_review_note: string;
        };
        Returns: boolean;
      };
      create_citizen_challenge: {
        Args: {
          p_spot_id: string;
          p_citizen_contact_id: string;
          p_challenge_type: string;
          p_note?: string | null;
          p_report_id?: string | null;
        };
        Returns: string;
      };
    };
  };
}

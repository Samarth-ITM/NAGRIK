/**
 * NAGRIK CORE TYPE DEFINITIONS
 * Authority: PRD Sections 4, 8, 9, 10 & TRD Section 6
 */

export type SupportedLanguage = "en" | "hi" | "mr";

export type UserRole =
  | "super_admin"
  | "authority_admin"
  | "authority_operator"
  | "demo_viewer";

export type OrganisationType =
  | "government_authority"
  | "demo_authority"
  | "internal";

export type SpotStatus =
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

export type ReportReviewStatus =
  | "new"
  | "under_review"
  | "verified"
  | "rejected";

export type LocationSource =
  | "telegram_location"
  | "manual_pin"
  | "landmark";

export type LocationReviewStatus =
  | "unreviewed"
  | "confirmed"
  | "corrected"
  | "insufficient";

export type MatchMethod =
  | "manual_confirmed"
  | "manual_new_spot"
  | "admin_override";

export type EvidenceStage =
  | "citizen_initial"
  | "authority_after"
  | "authority_video"
  | "other";

export type HandoffMethod =
  | "official_portal"
  | "email"
  | "letter"
  | "in_person"
  | "other";

export type ResolutionReviewStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "more_info_required";

export type AIAssessmentResultCode =
  | "APPEARS_FIXED"
  | "APPEARS_NOT_FIXED"
  | "UNCERTAIN"
  | "ELIGIBLE"
  | "NOT_ELIGIBLE";

// ============================================================================
// Entity Models
// ============================================================================

export interface Organisation {
  id: string;
  name: string;
  slug: string;
  organisation_type: OrganisationType;
  is_demo: boolean;
  is_active: boolean;
  created_at: string;
}

export interface Profile {
  user_id: string;
  display_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface OrganisationMembership {
  id: string;
  organisation_id: string;
  user_id: string;
  membership_role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface CitizenContact {
  id: string;
  telegram_user_hash: string;
  encrypted_chat_id: string;
  language: SupportedLanguage;
  consent_version: string;
  consent_at: string;
  created_at: string;
  last_seen_at: string;
}

export interface Report {
  id: string;
  ticket_code: string;
  citizen_contact_id: string;
  pilot_id: string;
  group_id: string;
  category_id: string;
  issue_type_id: string;
  description_private: string | null;
  language: SupportedLanguage;
  latitude: number | null;
  longitude: number | null;
  horizontal_accuracy_m: number | null;
  location_source: LocationSource;
  location_review_status: LocationReviewStatus;
  spot_id: string | null;
  match_method: MatchMethod | null;
  match_distance_m: number | null;
  matched_by: string | null;
  matched_at: string | null;
  match_note: string | null;
  review_status: ReportReviewStatus;
  public_summary: string | null;
  public_approved: boolean;
  is_demo: boolean;
  telegram_update_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface Spot {
  id: string;
  spot_code: string;
  pilot_id: string;
  group_id: string;
  category_id: string;
  issue_type_id: string;
  canonical_latitude: number;
  canonical_longitude: number;
  anchor_accuracy_m: number | null;
  status: SpotStatus;
  severity_label: "low" | "medium" | "high" | null;
  assigned_organisation_id: string | null;
  public_approved: boolean;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Evidence {
  id: string;
  report_id: string | null;
  spot_id: string | null;
  evidence_stage: EvidenceStage;
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
}

export interface StatusHistory {
  id: string;
  spot_id: string;
  previous_status: SpotStatus | null;
  new_status: SpotStatus;
  actor_type: "system" | "super_admin" | "authority_user";
  actor_user_id: string | null;
  note: string;
  source: "telegram" | "admin_dashboard" | "authority_dashboard" | "system";
  created_at: string;
}

export interface AuthorityHandoff {
  id: string;
  spot_id: string;
  organisation_id: string | null;
  destination_name: string;
  handoff_method: HandoffMethod;
  submitted_at: string;
  official_reference: string | null;
  proof_evidence_id: string | null;
  recorded_by: string;
  note: string;
}

export interface ResolutionSubmission {
  id: string;
  spot_id: string;
  submitted_by: string;
  completion_note: string;
  completion_date: string | null;
  work_order_reference: string | null;
  after_photo_evidence_id: string;
  video_evidence_id: string | null;
  review_status: ResolutionReviewStatus;
  reviewed_by: string | null;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface AIAssessment {
  id: string;
  spot_id: string;
  resolution_submission_id: string | null;
  assessment_type:
    | "image_eligibility"
    | "repair_comparison"
    | "voice_transcription"
    | "other_category_suggestion";
  model_name: string;
  input_evidence_ids: string[];
  result_code: AIAssessmentResultCode | string;
  result_text: string;
  is_advisory_only: true;
  requested_by: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_type: "system" | "super_admin" | "authority_user";
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before_value: Record<string, unknown> | null;
  after_value: Record<string, unknown> | null;
  reason: string | null;
  created_at: string;
}

export * from "./database";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types";

export interface CreateSpotParams {
  reportId: string;
  actorUserId: string;
  severityLabel?: string | null;
  assignedOrganisationId?: string | null;
}

export interface LinkReportParams {
  reportId: string;
  spotId: string;
  actorUserId: string;
  matchDistanceM: number;
  matchNote?: string | null;
}

export interface TransitionStatusParams {
  spotId: string;
  newStatus: string;
  actorType: "super_admin" | "authority_user" | "system";
  actorUserId: string;
  note: string;
  source?: string;
}

export interface RecordHandoffParams {
  spotId: string;
  destinationName: string;
  handoffMethod: string;
  recordedBy: string;
  note: string;
  officialReference?: string | null;
  proofEvidenceId?: string | null;
  organisationId?: string | null;
}

export interface SubmitResolutionParams {
  spotId: string;
  submittedBy: string;
  completionNote: string;
  afterPhotoEvidenceId: string;
  completionDate?: string | null;
  workOrderReference?: string | null;
  videoEvidenceId?: string | null;
}

export interface ReviewResolutionParams {
  submissionId: string;
  reviewedBy: string;
  decision: "approved" | "rejected" | "more_info_required";
  reviewNote: string;
}

export interface CreateChallengeParams {
  spotId: string;
  citizenContactId: string;
  challengeType: "still_not_fixed" | "wrong_location" | "other";
  note?: string | null;
  reportId?: string | null;
}

export interface FindDuplicateCandidatesParams {
  latitude: number;
  longitude: number;
  categoryId: string;
  pilotId?: string;
  isDemo?: boolean;
}

/**
 * Nagrik Transactional Civic Workflow Service
 * Authority: TRD Section 7, 9, 10 & PRD Sections 9, 10, 11
 */
export class WorkflowService {
  constructor(private client: SupabaseClient<any>) {}

  /**
   * Creates a new physical issue spot from a verified citizen report.
   */
  async createSpotForReport(params: CreateSpotParams) {
    const { data, error } = await this.client.rpc("create_spot_for_report", {
      p_report_id: params.reportId,
      p_actor_user_id: params.actorUserId,
      p_severity_label: params.severityLabel ?? null,
      p_assigned_organisation_id: params.assignedOrganisationId ?? null,
    });

    if (error) throw new Error(error.message);
    return data;
  }

  /**
   * Links an unlinked report to an existing physical issue spot after review.
   */
  async linkReportToSpot(params: LinkReportParams) {
    const { data, error } = await this.client.rpc("link_report_to_spot", {
      p_report_id: params.reportId,
      p_spot_id: params.spotId,
      p_actor_user_id: params.actorUserId,
      p_match_distance_m: params.matchDistanceM,
      p_match_note: params.matchNote ?? null,
    });

    if (error) throw new Error(error.message);
    return data;
  }

  /**
   * Executes a validated state machine transition for a spot.
   */
  async transitionSpotStatus(params: TransitionStatusParams) {
    const { data, error } = await this.client.rpc("transition_spot_status", {
      p_spot_id: params.spotId,
      p_new_status: params.newStatus,
      p_actor_type: params.actorType,
      p_actor_user_id: params.actorUserId,
      p_note: params.note,
      p_source: params.source ?? "admin_dashboard",
    });

    if (error) throw new Error(error.message);
    return data;
  }

  /**
   * Records an official authority handoff with proof evidence and destination.
   */
  async recordAuthorityHandoff(params: RecordHandoffParams) {
    const { data, error } = await this.client.rpc("record_authority_handoff", {
      p_spot_id: params.spotId,
      p_destination_name: params.destinationName,
      p_handoff_method: params.handoffMethod,
      p_recorded_by: params.recordedBy,
      p_note: params.note,
      p_official_reference: params.officialReference ?? null,
      p_proof_evidence_id: params.proofEvidenceId ?? null,
      p_organisation_id: params.organisationId ?? null,
    });

    if (error) throw new Error(error.message);
    return data;
  }

  /**
   * Submits repair completion request by an assigned authority with mandatory after-photo.
   */
  async submitResolutionRequest(params: SubmitResolutionParams) {
    const { data, error } = await this.client.rpc("submit_resolution_request", {
      p_spot_id: params.spotId,
      p_submitted_by: params.submittedBy,
      p_completion_note: params.completionNote,
      p_after_photo_evidence_id: params.afterPhotoEvidenceId,
      p_completion_date: params.completionDate ?? null,
      p_work_order_reference: params.workOrderReference ?? null,
      p_video_evidence_id: params.videoEvidenceId ?? null,
    });

    if (error) throw new Error(error.message);
    return data;
  }

  /**
   * Super-admin approval or rejection of a resolution request.
   */
  async reviewResolutionRequest(params: ReviewResolutionParams) {
    const { data, error } = await this.client.rpc("review_resolution_request", {
      p_submission_id: params.submissionId,
      p_reviewed_by: params.reviewedBy,
      p_decision: params.decision,
      p_review_note: params.reviewNote,
    });

    if (error) throw new Error(error.message);
    return data;
  }

  /**
   * Records a citizen challenge ("Still not fixed") with rate-limiting.
   */
  async createCitizenChallenge(params: CreateChallengeParams) {
    const { data, error } = await this.client.rpc("create_citizen_challenge", {
      p_spot_id: params.spotId,
      p_citizen_contact_id: params.citizenContactId,
      p_challenge_type: params.challengeType,
      p_note: params.note ?? null,
      p_report_id: params.reportId ?? null,
    });

    if (error) throw new Error(error.message);
    return data;
  }

  /**
   * Finds duplicate candidate spots within 10 metres sorted by ascending distance.
   */
  async findDuplicateCandidates(params: FindDuplicateCandidatesParams) {
    const { data, error } = await this.client.rpc("find_duplicate_candidates", {
      p_latitude: params.latitude,
      p_longitude: params.longitude,
      p_category_id: params.categoryId,
      p_pilot_id: params.pilotId ?? "kharghar_itm_v1",
      p_is_demo: params.isDemo ?? false,
    });

    if (error) throw new Error(error.message);
    return data ?? [];
  }
}

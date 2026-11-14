"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { WorkflowService } from "./service";
import { isSuperAdmin, isAuthorityUser } from "@/lib/permissions";

export type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Super-Admin Server Action: Create Physical Spot from Report
 */
export async function createSpotAction(formData: {
  reportId: string;
  severityLabel?: string | null;
  assignedOrganisationId?: string | null;
}): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Authentication required." };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!isSuperAdmin(profile?.role)) {
      return { success: false, error: "Only super administrators can create spots." };
    }

    const workflow = new WorkflowService(supabase);
    const result = await workflow.createSpotForReport({
      reportId: formData.reportId,
      actorUserId: user.id,
      severityLabel: formData.severityLabel,
      assignedOrganisationId: formData.assignedOrganisationId,
    });

    revalidatePath("/dashboard");
    revalidatePath("/issues");
    return { success: true, data: result };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "An unexpected error occurred.",
    };
  }
}

/**
 * Super-Admin Server Action: Link Report to Existing Spot
 */
export async function linkReportAction(formData: {
  reportId: string;
  spotId: string;
  matchDistanceM: number;
  matchNote?: string | null;
}): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Authentication required." };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!isSuperAdmin(profile?.role)) {
      return { success: false, error: "Only super administrators can link reports." };
    }

    const workflow = new WorkflowService(supabase);
    const result = await workflow.linkReportToSpot({
      reportId: formData.reportId,
      spotId: formData.spotId,
      actorUserId: user.id,
      matchDistanceM: formData.matchDistanceM,
      matchNote: formData.matchNote,
    });

    revalidatePath("/dashboard");
    revalidatePath("/issues");
    return { success: true, data: result };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "An unexpected error occurred.",
    };
  }
}

/**
 * Server Action: Transition Spot Status (Super-Admin or Assigned Authority)
 */
export async function transitionSpotStatusAction(formData: {
  spotId: string;
  newStatus: string;
  note: string;
}): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Authentication required." };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const actorType = isSuperAdmin(profile?.role)
      ? "super_admin"
      : isAuthorityUser(profile?.role)
      ? "authority_user"
      : null;

    if (!actorType) {
      return { success: false, error: "Unauthorized: Invalid user role." };
    }

    const workflow = new WorkflowService(supabase);
    const result = await workflow.transitionSpotStatus({
      spotId: formData.spotId,
      newStatus: formData.newStatus,
      actorType,
      actorUserId: user.id,
      note: formData.note,
      source: actorType === "super_admin" ? "admin_dashboard" : "authority_dashboard",
    });

    revalidatePath("/dashboard");
    revalidatePath("/issues");
    return { success: true, data: result };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "An unexpected error occurred.",
    };
  }
}

/**
 * Super-Admin Server Action: Record Authority Handoff
 */
export async function recordHandoffAction(formData: {
  spotId: string;
  destinationName: string;
  handoffMethod: string;
  note: string;
  officialReference?: string | null;
  proofEvidenceId?: string | null;
  organisationId?: string | null;
}): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Authentication required." };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!isSuperAdmin(profile?.role)) {
      return { success: false, error: "Only super administrators can record handoffs." };
    }

    const workflow = new WorkflowService(supabase);
    const result = await workflow.recordAuthorityHandoff({
      spotId: formData.spotId,
      destinationName: formData.destinationName,
      handoffMethod: formData.handoffMethod,
      recordedBy: user.id,
      note: formData.note,
      officialReference: formData.officialReference,
      proofEvidenceId: formData.proofEvidenceId,
      organisationId: formData.organisationId,
    });

    revalidatePath("/dashboard");
    revalidatePath("/issues");
    return { success: true, data: result };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "An unexpected error occurred.",
    };
  }
}

/**
 * Authority Server Action: Submit Resolution Request with After-Photo
 */
export async function submitResolutionAction(formData: {
  spotId: string;
  completionNote: string;
  afterPhotoEvidenceId: string;
  completionDate?: string | null;
  workOrderReference?: string | null;
  videoEvidenceId?: string | null;
}): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Authentication required." };
    }

    const workflow = new WorkflowService(supabase);
    const result = await workflow.submitResolutionRequest({
      spotId: formData.spotId,
      submittedBy: user.id,
      completionNote: formData.completionNote,
      afterPhotoEvidenceId: formData.afterPhotoEvidenceId,
      completionDate: formData.completionDate,
      workOrderReference: formData.workOrderReference,
      videoEvidenceId: formData.videoEvidenceId,
    });

    revalidatePath("/dashboard");
    revalidatePath("/issues");
    return { success: true, data: result };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "An unexpected error occurred.",
    };
  }
}

/**
 * Super-Admin Server Action: Review Resolution Request (Approve or Reject)
 */
export async function reviewResolutionAction(formData: {
  submissionId: string;
  decision: "approved" | "rejected" | "more_info_required";
  reviewNote: string;
}): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Authentication required." };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!isSuperAdmin(profile?.role)) {
      return { success: false, error: "Only super administrators can review resolutions." };
    }

    const workflow = new WorkflowService(supabase);
    const result = await workflow.reviewResolutionRequest({
      submissionId: formData.submissionId,
      reviewedBy: user.id,
      decision: formData.decision,
      reviewNote: formData.reviewNote,
    });

    revalidatePath("/dashboard");
    revalidatePath("/issues");
    return { success: true, data: result };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "An unexpected error occurred.",
    };
  }
}

/**
 * Server Action: Create Citizen Challenge ("Still not fixed")
 */
export async function createChallengeAction(formData: {
  spotId: string;
  citizenContactId: string;
  challengeType: "still_not_fixed" | "wrong_location" | "other";
  note?: string | null;
  reportId?: string | null;
}): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabaseClient();
    const workflow = new WorkflowService(supabase);
    const result = await workflow.createCitizenChallenge({
      spotId: formData.spotId,
      citizenContactId: formData.citizenContactId,
      challengeType: formData.challengeType,
      note: formData.note,
      reportId: formData.reportId,
    });

    revalidatePath("/dashboard");
    revalidatePath("/issues");
    return { success: true, data: result };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "An unexpected error occurred.",
    };
  }
}

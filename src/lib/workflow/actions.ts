"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { WorkflowService } from "./service";
import { isSuperAdmin, isAuthorityUser } from "@/lib/permissions";
import {
  CreateSpotSchema,
  LinkReportSchema,
  TransitionSpotStatusSchema,
  RecordHandoffSchema,
  SubmitResolutionSchema,
  ReviewResolutionSchema,
  CreateChallengeSchema,
  ReviewReportSchema,
} from "./schemas";

export {
  CreateSpotSchema,
  LinkReportSchema,
  TransitionSpotStatusSchema,
  RecordHandoffSchema,
  SubmitResolutionSchema,
  ReviewResolutionSchema,
  CreateChallengeSchema,
  ReviewReportSchema,
};

export type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Super-Admin Server Action: Create Physical Spot from Report
 */
export async function createSpotAction(formData: unknown): Promise<ActionResult> {
  try {
    const parseResult = CreateSpotSchema.safeParse(formData);
    if (!parseResult.success) {
      return {
        success: false,
        error: parseResult.error.errors[0]?.message || "Invalid input parameters.",
      };
    }
    const data = parseResult.data;

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
      reportId: data.reportId,
      actorUserId: user.id,
      severityLabel: data.severityLabel,
      assignedOrganisationId: data.assignedOrganisationId,
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
export async function linkReportAction(formData: unknown): Promise<ActionResult> {
  try {
    const parseResult = LinkReportSchema.safeParse(formData);
    if (!parseResult.success) {
      return {
        success: false,
        error: parseResult.error.errors[0]?.message || "Invalid input parameters.",
      };
    }
    const data = parseResult.data;

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
      reportId: data.reportId,
      spotId: data.spotId,
      actorUserId: user.id,
      matchDistanceM: data.matchDistanceM,
      matchNote: data.matchNote,
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
export async function transitionSpotStatusAction(formData: unknown): Promise<ActionResult> {
  try {
    const parseResult = TransitionSpotStatusSchema.safeParse(formData);
    if (!parseResult.success) {
      return {
        success: false,
        error: parseResult.error.errors[0]?.message || "Invalid input parameters.",
      };
    }
    const data = parseResult.data;

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
      spotId: data.spotId,
      newStatus: data.newStatus,
      actorType,
      actorUserId: user.id,
      note: data.note,
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
export async function recordHandoffAction(formData: unknown): Promise<ActionResult> {
  try {
    const parseResult = RecordHandoffSchema.safeParse(formData);
    if (!parseResult.success) {
      return {
        success: false,
        error: parseResult.error.errors[0]?.message || "Invalid input parameters.",
      };
    }
    const data = parseResult.data;

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
      spotId: data.spotId,
      destinationName: data.destinationName,
      handoffMethod: data.handoffMethod,
      recordedBy: user.id,
      note: data.note,
      officialReference: data.officialReference,
      proofEvidenceId: data.proofEvidenceId,
      organisationId: data.organisationId,
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
export async function submitResolutionAction(formData: unknown): Promise<ActionResult> {
  try {
    const parseResult = SubmitResolutionSchema.safeParse(formData);
    if (!parseResult.success) {
      return {
        success: false,
        error: parseResult.error.errors[0]?.message || "Invalid input parameters.",
      };
    }
    const data = parseResult.data;

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
      spotId: data.spotId,
      submittedBy: user.id,
      completionNote: data.completionNote,
      afterPhotoEvidenceId: data.afterPhotoEvidenceId,
      completionDate: data.completionDate,
      workOrderReference: data.workOrderReference,
      videoEvidenceId: data.videoEvidenceId,
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
export async function reviewResolutionAction(formData: unknown): Promise<ActionResult> {
  try {
    const parseResult = ReviewResolutionSchema.safeParse(formData);
    if (!parseResult.success) {
      return {
        success: false,
        error: parseResult.error.errors[0]?.message || "Invalid input parameters.",
      };
    }
    const data = parseResult.data;

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
      submissionId: data.submissionId,
      reviewedBy: user.id,
      decision: data.decision,
      reviewNote: data.reviewNote,
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
export async function createChallengeAction(formData: unknown): Promise<ActionResult> {
  try {
    const parseResult = CreateChallengeSchema.safeParse(formData);
    if (!parseResult.success) {
      return {
        success: false,
        error: parseResult.error.errors[0]?.message || "Invalid input parameters.",
      };
    }
    const data = parseResult.data;

    const supabase = await createServerSupabaseClient();
    const workflow = new WorkflowService(supabase);
    const result = await workflow.createCitizenChallenge({
      spotId: data.spotId,
      citizenContactId: data.citizenContactId,
      challengeType: data.challengeType,
      note: data.note,
      reportId: data.reportId,
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
 * Super-Admin Server Action: Review Report Status (mark under_review or rejected)
 */
export async function reviewReportAction(formData: unknown): Promise<ActionResult> {
  try {
    const parseResult = ReviewReportSchema.safeParse(formData);
    if (!parseResult.success) {
      return {
        success: false,
        error: parseResult.error.errors[0]?.message || "Invalid input parameters.",
      };
    }
    const data = parseResult.data;

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Authentication required." };
    }

    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!isSuperAdmin(profile?.role)) {
      return { success: false, error: "Only super administrators can review reports." };
    }

    const { error: updateError } = await (supabase as any)
      .from("reports")
      .update({
        review_status: data.reviewStatus,
        match_note: data.rejectionReason || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.reportId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    revalidatePath("/dashboard");
    return { success: true, data: { reportId: data.reportId, reviewStatus: data.reviewStatus } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "An unexpected error occurred.",
    };
  }
}

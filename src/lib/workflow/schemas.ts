import { z } from "zod";

// ============================================================================
// RUNTIME ZOD INPUT VALIDATION SCHEMAS
// Authority: Phase 4C Security Remediation & Input Guardrails
// ============================================================================

export const CreateSpotSchema = z.object({
  reportId: z.string().uuid("Invalid report UUID"),
  severityLabel: z.enum(["low", "medium", "high", "critical"]).nullish(),
  assignedOrganisationId: z.string().uuid("Invalid organisation UUID").nullish(),
});

export const LinkReportSchema = z.object({
  reportId: z.string().uuid("Invalid report UUID"),
  spotId: z.string().uuid("Invalid spot UUID"),
  matchDistanceM: z
    .number()
    .min(0, "Distance cannot be negative")
    .max(50000, "Distance exceeds pilot boundary"),
  matchNote: z.string().max(500, "Note exceeds maximum length of 500 characters").nullish(),
});

export const TransitionSpotStatusSchema = z.object({
  spotId: z.string().uuid("Invalid spot UUID"),
  newStatus: z.enum(
    [
      "NEW",
      "UNDER_REVIEW",
      "VERIFIED",
      "ASSIGNED",
      "HANDED_OFF",
      "AUTHORITY_ACKNOWLEDGED",
      "IN_PROGRESS",
      "RESOLUTION_SUBMITTED",
      "RESOLVED",
      "REOPENED",
      "REJECTED",
    ],
    { errorMap: () => ({ message: "Invalid spot status value" }) }
  ),
  note: z
    .string()
    .min(1, "Note cannot be empty")
    .max(1000, "Note exceeds maximum length of 1000 characters"),
});

export const RecordHandoffSchema = z.object({
  spotId: z.string().uuid("Invalid spot UUID"),
  destinationName: z
    .string()
    .min(1, "Destination name is mandatory")
    .max(200, "Destination name exceeds 200 characters"),
  handoffMethod: z
    .string()
    .min(1, "Handoff method is mandatory")
    .max(100, "Handoff method exceeds 100 characters"),
  note: z
    .string()
    .min(1, "Handoff note is mandatory")
    .max(1000, "Handoff note exceeds 1000 characters"),
  officialReference: z
    .string()
    .max(100, "Official reference exceeds 100 characters")
    .nullish(),
  proofEvidenceId: z.string().uuid("Invalid proof evidence UUID").nullish(),
  organisationId: z.string().uuid("Invalid organisation UUID").nullish(),
});

export const SubmitResolutionSchema = z.object({
  spotId: z.string().uuid("Invalid spot UUID"),
  completionNote: z
    .string()
    .min(1, "Completion note is mandatory")
    .max(1000, "Completion note exceeds 1000 characters"),
  afterPhotoEvidenceId: z.string().uuid("Invalid after-photo evidence UUID"),
  completionDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)")
    .nullish(),
  workOrderReference: z
    .string()
    .max(100, "Work order reference exceeds 100 characters")
    .nullish(),
  videoEvidenceId: z.string().uuid("Invalid video evidence UUID").nullish(),
});

export const ReviewResolutionSchema = z
  .object({
    submissionId: z.string().uuid("Invalid submission UUID"),
    decision: z.enum(["approved", "rejected", "more_info_required"], {
      errorMap: () => ({ message: "Invalid decision value" }),
    }),
    reviewNote: z.string().max(1000, "Review note exceeds 1000 characters"),
  })
  .refine(
    (data) => {
      if (data.decision !== "approved" && data.reviewNote.trim().length === 0) {
        return false;
      }
      return true;
    },
    {
      message: "Review note is mandatory when rejecting or requesting more info",
      path: ["reviewNote"],
    }
  );

export const CreateChallengeSchema = z.object({
  spotId: z.string().uuid("Invalid spot UUID"),
  citizenContactId: z.string().uuid("Invalid citizen contact UUID"),
  challengeType: z.enum(["still_not_fixed", "wrong_location", "other"], {
    errorMap: () => ({ message: "Invalid challenge type" }),
  }),
  note: z.string().max(500, "Note exceeds 500 characters").nullish(),
  reportId: z.string().uuid("Invalid report UUID").nullish(),
});

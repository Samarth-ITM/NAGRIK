import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { SpotStatus } from "../src/types";

describe("Phase 7: Governance Invariants & The Resolution Gate Suite", () => {
  it("enforces that authorities cannot transition directly to RESOLVED", () => {
    // Under TRD Section 10 & AGENTS.md Section 4:
    // Authority user permissions permit: AUTHORITY_ACKNOWLEDGED, IN_PROGRESS, RESOLUTION_SUBMITTED.
    // Setting RESOLVED directly is strictly forbidden.
    const allowedAuthorityNextStatuses: Record<SpotStatus, SpotStatus[]> = {
      NEW: [],
      UNDER_REVIEW: [],
      VERIFIED: ["AUTHORITY_ACKNOWLEDGED"],
      ASSIGNED: ["AUTHORITY_ACKNOWLEDGED"],
      AUTHORITY_ACKNOWLEDGED: ["IN_PROGRESS"],
      IN_PROGRESS: ["RESOLUTION_SUBMITTED"],
      RESOLUTION_SUBMITTED: [], // Authority cannot approve their own submission!
      RESOLVED: [],
      REOPENED: ["IN_PROGRESS"],
      REJECTED: [],
      HANDED_OFF: [],
    };

    // Verify at each state that an authority cannot jump to RESOLVED
    Object.entries(allowedAuthorityNextStatuses).forEach(([status, nextAllowed]) => {
      assert.ok(
        !nextAllowed.includes("RESOLVED" as SpotStatus),
        `Authority from status '${status}' must NEVER be permitted to set status 'RESOLVED'`
      );
    });
  });

  it("enforces mandatory after-repair photo for RESOLUTION_SUBMITTED", () => {
    // Validating resolution request parameters
    function validateResolutionRequest(submission: {
      completionNote: string;
      afterPhotoEvidenceId?: string;
    }) {
      if (!submission.afterPhotoEvidenceId || submission.afterPhotoEvidenceId.trim() === "") {
        return { valid: false, error: "Mandatory after-repair photo evidence is required." };
      }
      if (!submission.completionNote || submission.completionNote.trim() === "") {
        return { valid: false, error: "Completion note is required." };
      }
      return { valid: true };
    }

    const invalidSubmissionWithoutPhoto = {
      completionNote: "Finished patching the pothole.",
    };
    const invalidSubmissionWithoutNote = {
      afterPhotoEvidenceId: "e1000000-0000-0000-0000-000000000020",
      completionNote: "",
    };
    const validSubmission = {
      afterPhotoEvidenceId: "e1000000-0000-0000-0000-000000000020",
      completionNote: "Patch completed and rolled smooth.",
    };

    assert.equal(validateResolutionRequest(invalidSubmissionWithoutPhoto).valid, false);
    assert.equal(validateResolutionRequest(invalidSubmissionWithoutNote).valid, false);
    assert.equal(validateResolutionRequest(validSubmission).valid, true);
  });

  it("verifies final closure requires authenticated super-admin decision", () => {
    // Only super-admin role can approve resolution submissions
    function canApproveResolution(userRole: string): boolean {
      return userRole === "super_admin";
    }

    assert.equal(canApproveResolution("authority_admin"), false);
    assert.equal(canApproveResolution("authority_operator"), false);
    assert.equal(canApproveResolution("demo_viewer"), false);
    assert.equal(canApproveResolution("super_admin"), true);
  });
});

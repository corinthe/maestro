/**
 * Input validation helpers for API routes.
 * Lightweight schema validation — no external dependencies.
 */
import {
  FEATURE_STATUSES,
  AGENT_STATUSES,
  type FeatureStatus,
  type AgentStatus,
} from "@/lib/types";

type ValidationResult =
  | { ok: true }
  | { ok: false; message: string };

function fail(message: string): ValidationResult {
  return { ok: false, message };
}

const OK: ValidationResult = { ok: true };

// --- String validators ---

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isWithinLength(value: string, max: number): boolean {
  return value.length <= max;
}

// --- Shared limits ---

const MAX_NAME_LENGTH = 100;
const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_PROMPT_LENGTH = 50000;
const MAX_CONTENT_LENGTH = 10000;
const MAX_BRANCH_LENGTH = 200;

// --- Validators per entity ---

export function validateAgentCreate(body: Record<string, unknown>): ValidationResult {
  if (!isNonEmptyString(body.name)) return fail("name is required and must be a non-empty string");
  if (!isWithinLength(body.name, MAX_NAME_LENGTH)) return fail(`name must be at most ${MAX_NAME_LENGTH} characters`);
  if (body.description !== undefined && typeof body.description !== "string") return fail("description must be a string");
  if (typeof body.description === "string" && !isWithinLength(body.description, MAX_DESCRIPTION_LENGTH)) {
    return fail(`description must be at most ${MAX_DESCRIPTION_LENGTH} characters`);
  }
  if (body.config !== undefined && (typeof body.config !== "object" || body.config === null || Array.isArray(body.config))) {
    return fail("config must be an object");
  }
  return OK;
}

export function validateAgentUpdate(body: Record<string, unknown>): ValidationResult {
  if (body.name !== undefined) {
    if (!isNonEmptyString(body.name)) return fail("name must be a non-empty string");
    if (!isWithinLength(body.name, MAX_NAME_LENGTH)) return fail(`name must be at most ${MAX_NAME_LENGTH} characters`);
  }
  if (body.description !== undefined && typeof body.description !== "string") return fail("description must be a string");
  if (body.status !== undefined) {
    if (!AGENT_STATUSES.includes(body.status as AgentStatus)) {
      return fail(`status must be one of: ${AGENT_STATUSES.join(", ")}`);
    }
  }
  if (body.config !== undefined && (typeof body.config !== "object" || body.config === null || Array.isArray(body.config))) {
    return fail("config must be an object");
  }
  return OK;
}

export function validateFeatureCreate(body: Record<string, unknown>): ValidationResult {
  if (!isNonEmptyString(body.title)) return fail("title is required and must be a non-empty string");
  if (!isWithinLength(body.title, MAX_TITLE_LENGTH)) return fail(`title must be at most ${MAX_TITLE_LENGTH} characters`);
  if (body.description !== undefined && typeof body.description !== "string") return fail("description must be a string");
  if (typeof body.description === "string" && !isWithinLength(body.description, MAX_DESCRIPTION_LENGTH)) {
    return fail(`description must be at most ${MAX_DESCRIPTION_LENGTH} characters`);
  }
  if (body.priority !== undefined && (typeof body.priority !== "number" || !Number.isInteger(body.priority))) {
    return fail("priority must be an integer");
  }
  return OK;
}

export function validateFeatureUpdate(body: Record<string, unknown>): ValidationResult {
  if (body.title !== undefined) {
    if (!isNonEmptyString(body.title)) return fail("title must be a non-empty string");
    if (!isWithinLength(body.title, MAX_TITLE_LENGTH)) return fail(`title must be at most ${MAX_TITLE_LENGTH} characters`);
  }
  if (body.description !== undefined && typeof body.description !== "string") return fail("description must be a string");
  if (body.status !== undefined) {
    if (!FEATURE_STATUSES.includes(body.status as FeatureStatus)) {
      return fail(`status must be one of: ${FEATURE_STATUSES.join(", ")}`);
    }
  }
  if (body.priority !== undefined && (typeof body.priority !== "number" || !Number.isInteger(body.priority))) {
    return fail("priority must be an integer");
  }
  if (body.branch !== undefined && typeof body.branch !== "string") return fail("branch must be a string");
  if (typeof body.branch === "string" && !isWithinLength(body.branch, MAX_BRANCH_LENGTH)) {
    return fail(`branch must be at most ${MAX_BRANCH_LENGTH} characters`);
  }
  return OK;
}

export function validateRunStart(body: Record<string, unknown>): ValidationResult {
  if (!isNonEmptyString(body.agentId)) return fail("agentId is required");
  if (!isNonEmptyString(body.prompt)) return fail("prompt is required and must be a non-empty string");
  if (typeof body.prompt === "string" && !isWithinLength(body.prompt, MAX_PROMPT_LENGTH)) {
    return fail(`prompt must be at most ${MAX_PROMPT_LENGTH} characters`);
  }
  if (body.featureId !== undefined && typeof body.featureId !== "string") return fail("featureId must be a string");
  if (body.sessionId !== undefined && typeof body.sessionId !== "string") return fail("sessionId must be a string");
  return OK;
}

export function validateMessageCreate(body: Record<string, unknown>): ValidationResult {
  if (!isNonEmptyString(body.content)) return fail("content is required and must be a non-empty string");
  if (typeof body.content === "string" && !isWithinLength(body.content, MAX_CONTENT_LENGTH)) {
    return fail(`content must be at most ${MAX_CONTENT_LENGTH} characters`);
  }
  if (body.targetAgent !== undefined && typeof body.targetAgent !== "string") return fail("targetAgent must be a string");
  if (body.featureId !== undefined && typeof body.featureId !== "string") return fail("featureId must be a string");
  return OK;
}

export function validateHeartbeatConfig(body: Record<string, unknown>): ValidationResult {
  if (body.enabled !== undefined && typeof body.enabled !== "boolean") return fail("enabled must be a boolean");
  if (body.intervalSec !== undefined) {
    if (typeof body.intervalSec !== "number" || !Number.isInteger(body.intervalSec)) {
      return fail("intervalSec must be an integer");
    }
    if (body.intervalSec < 10 || body.intervalSec > 86400) {
      return fail("intervalSec must be between 10 and 86400");
    }
  }
  return OK;
}

export class JobPilotError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, message: string, retryable = false) {
    super(message);
    this.name = "JobPilotError";
    this.code = code;
    this.retryable = retryable;
  }
}

export class ValidationError extends JobPilotError {
  constructor(message: string) {
    super("VALIDATION_ERROR", message, false);
    this.name = "ValidationError";
  }
}

export class ExtractionError extends JobPilotError {
  constructor(message: string) {
    super("EXTRACTION_FAILED", message, true);
    this.name = "ExtractionError";
  }
}

export class AnalysisError extends JobPilotError {
  constructor(message: string) {
    super("ANALYSIS_FAILED", message, true);
    this.name = "AnalysisError";
  }
}

export class AutomationError extends JobPilotError {
  constructor(message: string, retryable = true) {
    super("AUTOMATION_FAILED", message, retryable);
    this.name = "AutomationError";
  }
}

export class ForbiddenActionError extends JobPilotError {
  constructor(action: string) {
    super("FORBIDDEN_ACTION", `Refused to perform forbidden action: ${action}`, false);
    this.name = "ForbiddenActionError";
  }
}

export class StateTransitionError extends JobPilotError {
  constructor(from: string, to: string) {
    super("INVALID_TRANSITION", `Cannot transition from ${from} to ${to}`, false);
    this.name = "StateTransitionError";
  }
}

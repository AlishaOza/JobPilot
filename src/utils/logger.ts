type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

const SECRET_PATTERNS: RegExp[] = [
  /sk-[a-zA-Z0-9_-]{10,}/g,
  /(api[_-]?key|password|token|secret|authorization)\s*[=:]\s*\S+/gi,
  /bearer\s+[a-zA-Z0-9._-]+/gi,
];

export function redactSecrets(value: string): string {
  let redacted = value;
  for (const pattern of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, "[REDACTED]");
  }
  return redacted;
}

function write(level: LogLevel, message: string): void {
  const line = `[${level}] ${redactSecrets(message)}`;
  if (level === "ERROR") {
    console.error(line);
    return;
  }
  if (level === "WARN") {
    console.warn(line);
    return;
  }
  console.log(line);
}

export const logger = {
  info(message: string): void {
    write("INFO", message);
  },
  warn(message: string): void {
    write("WARN", message);
  },
  error(message: string): void {
    write("ERROR", message);
  },
  debug(message: string): void {
    if (process.env.DEBUG === "true") {
      write("DEBUG", message);
    }
  },
};

import { getEnv } from "../config/env";
import type { UserProfile } from "../profile/profile.schema";
import type { DiscoveryQuery } from "./job-source";

const DEFAULT_ROLES = ["Software Developer", "Frontend Developer", "Full-Stack Developer"];

export function primaryLocation(profile: UserProfile): string {
  const fromProfile = profile.location.split(",")[0]?.trim();
  return fromProfile || profile.preferences.locations[0] || "Remote";
}

export function discoveryLocations(profile: UserProfile, maxLocations: number): string[] {
  const locations: string[] = [];
  const primary = primaryLocation(profile);
  if (primary) {
    locations.push(primary);
  }
  const prefersRemote =
    profile.preferences.locations.some((item) => /remote/i.test(item)) ||
    profile.preferences.workModes.some((item) => /remote/i.test(item));
  if (prefersRemote && !locations.some((item) => /remote/i.test(item))) {
    locations.push("Remote");
  }
  for (const extra of profile.preferences.locations) {
    if (locations.length >= maxLocations) {
      break;
    }
    if (!locations.some((item) => item.toLowerCase() === extra.toLowerCase())) {
      locations.push(extra);
    }
  }
  return locations.slice(0, maxLocations);
}

export function discoveryRoles(profile: UserProfile, maxRoles: number): string[] {
  const preferred = profile.preferences.roles.filter((role) => role.trim().length > 0);
  const roles = preferred.length > 0 ? preferred : DEFAULT_ROLES;
  const unique: string[] = [];
  for (const role of roles) {
    if (!unique.some((item) => item.toLowerCase() === role.toLowerCase())) {
      unique.push(role);
    }
    if (unique.length >= maxRoles) {
      break;
    }
  }
  return unique;
}

export function buildDiscoveryQuery(profile: UserProfile): DiscoveryQuery {
  const env = getEnv();
  return {
    roles: discoveryRoles(profile, env.DISCOVERY_MAX_ROLES),
    locations: discoveryLocations(profile, env.DISCOVERY_MAX_LOCATIONS),
    skills: profile.skills.slice(0, 4),
    experienceBand: profile.preferences.experienceBand,
    experienceMonths: profile.experienceMonths,
    workModes: profile.preferences.workModes,
    maxAgeDays: env.MAX_JOB_AGE_DAYS,
    maxSearches: env.DISCOVERY_MAX_SEARCHES,
    maxJobs: env.DISCOVERY_MAX_JOBS,
    country: env.JOB_SOURCE_COUNTRY,
  };
}

export function isEntryLevel(query: Pick<DiscoveryQuery, "experienceBand" | "experienceMonths">): boolean {
  if (query.experienceMonths <= 24) {
    return true;
  }
  return /0\s*[-–to]+\s*2|entry|junior|intern/i.test(query.experienceBand);
}

export function indeedFromAge(maxAgeDays: number): number {
  if (maxAgeDays <= 1) return 1;
  if (maxAgeDays <= 3) return 3;
  if (maxAgeDays <= 7) return 7;
  return 14;
}

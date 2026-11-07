import { getUserProfiles } from "@agent-native/core/user-profile/server";
import { isEmailDerivedName } from "@agent-native/core/user-profile/shared";

/** Display names for the people behind a set of emails; emails with no real name are left out. */
export async function namesFor(emails: Iterable<string | null | undefined>): Promise<Record<string, string>> {
  const wanted = [...new Set([...emails].filter((e): e is string => Boolean(e)).map((e) => e.toLowerCase()))];
  if (wanted.length === 0) return {};
  const people: Record<string, string> = {};
  try {
    const profiles = await getUserProfiles(wanted);
    for (const [email, profile] of profiles) {
      if (profile.name && !isEmailDerivedName(profile.name, email)) people[email] = profile.name;
    }
  } catch (error) {
    console.warn("[cordon] names were not resolved:", error instanceof Error ? error.message : error);
  }
  return people;
}

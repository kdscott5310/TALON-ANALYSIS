/**
 * Project draft library — Milestone 9B.
 *
 * Named saved versions of a `Project` so engineers can keep several drafts and
 * pull up the latest one to continue optimizing. Pure data + immutable
 * operations (no React, Rule 7); persistence and UI live elsewhere.
 *
 * Sharing model (D-017): the app is client-only. A draft is exported as
 * `talon-project` JSON, committed to a shared Git repo, pulled by a colleague,
 * and imported as a draft. Git history is the authoritative version trail; the
 * `savedOn` stamp and `revision` label below are human aids, not a merge system.
 */
import type { Project } from './model';

export const DRAFTS_SCHEMA_VERSION = 1;

export interface ProjectDraft {
  /** Stable draft id (independent of the project's own id). */
  id: string;
  /** Human name for the draft, e.g. "Baseline", "Higher pretension". */
  name: string;
  /** ISO-8601 time the draft was saved. */
  savedOn: string;
  /** Optional note describing what changed in this draft. */
  note?: string;
  /** The saved project snapshot. */
  project: Project;
}

export interface DraftLibrary {
  schemaVersion: number;
  drafts: ProjectDraft[];
}

export function createDraftLibrary(): DraftLibrary {
  return { schemaVersion: DRAFTS_SCHEMA_VERSION, drafts: [] };
}

/** Next unused id of the form `draft-<n>`. */
function nextDraftId(drafts: readonly ProjectDraft[]): string {
  let max = 0;
  for (const d of drafts) {
    const m = /^draft-(\d+)$/.exec(d.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `draft-${max + 1}`;
}

/** Drafts sorted newest-saved first — "the latest draft" is `[0]`. */
export function draftsByRecency(lib: DraftLibrary): ProjectDraft[] {
  return [...lib.drafts].sort((a, b) => (a.savedOn < b.savedOn ? 1 : a.savedOn > b.savedOn ? -1 : 0));
}

export function latestDraft(lib: DraftLibrary): ProjectDraft | undefined {
  return draftsByRecency(lib)[0];
}

export function findDraft(lib: DraftLibrary, id: string): ProjectDraft | undefined {
  return lib.drafts.find((d) => d.id === id);
}

/**
 * Saves a project as a NEW draft. The project is deep-copied so later edits to
 * the live project never mutate the saved snapshot.
 */
export function saveNewDraft(
  lib: DraftLibrary,
  project: Project,
  spec: { name: string; note?: string; savedOn: string; id?: string },
): { library: DraftLibrary; draftId: string } {
  const id = spec.id ?? nextDraftId(lib.drafts);
  const draft: ProjectDraft = {
    id,
    name: spec.name.trim() || id,
    savedOn: spec.savedOn,
    note: spec.note,
    project: JSON.parse(JSON.stringify(project)) as Project,
  };
  return { library: { ...lib, drafts: [...lib.drafts, draft] }, draftId: id };
}

/** Overwrites an existing draft's snapshot (re-saving over the same name). */
export function updateDraft(
  lib: DraftLibrary,
  id: string,
  project: Project,
  spec: { savedOn: string; note?: string },
): DraftLibrary {
  if (!lib.drafts.some((d) => d.id === id)) return lib;
  return {
    ...lib,
    drafts: lib.drafts.map((d) =>
      d.id === id
        ? {
            ...d,
            savedOn: spec.savedOn,
            note: spec.note ?? d.note,
            project: JSON.parse(JSON.stringify(project)) as Project,
          }
        : d,
    ),
  };
}

export function renameDraft(lib: DraftLibrary, id: string, name: string): DraftLibrary {
  const trimmed = name.trim();
  if (!trimmed) return lib;
  return { ...lib, drafts: lib.drafts.map((d) => (d.id === id ? { ...d, name: trimmed } : d)) };
}

export function duplicateDraft(
  lib: DraftLibrary,
  id: string,
  spec: { savedOn: string; name?: string },
): { library: DraftLibrary; draftId: string } {
  const src = findDraft(lib, id);
  if (!src) return { library: lib, draftId: '' };
  return saveNewDraft(lib, src.project, {
    name: spec.name ?? `${src.name} (copy)`,
    note: src.note,
    savedOn: spec.savedOn,
  });
}

export function deleteDraft(lib: DraftLibrary, id: string): DraftLibrary {
  return { ...lib, drafts: lib.drafts.filter((d) => d.id !== id) };
}

// ── serialization (localStorage + inspection) ───────────────────────────────

export type DraftLibraryParse =
  | { ok: true; library: DraftLibrary; notes: string[] }
  | { ok: false; errors: string[] };

export function serializeDraftLibrary(lib: DraftLibrary): string {
  return JSON.stringify(lib);
}

/**
 * Parses a stored draft library. Structurally invalid entries are DROPPED with
 * a disclosed note rather than silently accepted or silently kept (Rule 10);
 * a wholly unreadable payload is rejected so the caller can recover visibly.
 */
export function parseDraftLibrary(text: string): DraftLibraryParse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [`Not valid JSON: ${e instanceof Error ? e.message : String(e)}`] };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, errors: ['Draft library is not a JSON object.'] };
  }
  const raw = parsed as Partial<DraftLibrary>;
  if (typeof raw.schemaVersion !== 'number' || raw.schemaVersion < 1) {
    return { ok: false, errors: ['Draft library has no valid schemaVersion.'] };
  }
  if (raw.schemaVersion > DRAFTS_SCHEMA_VERSION) {
    return {
      ok: false,
      errors: [
        `Draft library schemaVersion ${raw.schemaVersion} is newer than this build ` +
          `supports (v${DRAFTS_SCHEMA_VERSION}).`,
      ],
    };
  }
  if (!Array.isArray(raw.drafts)) return { ok: false, errors: ['Draft library has no drafts array.'] };

  const notes: string[] = [];
  const drafts: ProjectDraft[] = [];
  for (const [i, d] of (raw.drafts as unknown[]).entries()) {
    const rec = d as Partial<ProjectDraft>;
    if (
      !rec || typeof rec.id !== 'string' || typeof rec.name !== 'string' ||
      typeof rec.savedOn !== 'string' || typeof rec.project !== 'object' || rec.project === null
    ) {
      notes.push(`Dropped saved draft ${i + 1}: it is missing an id, name, savedOn, or project.`);
      continue;
    }
    drafts.push({
      id: rec.id,
      name: rec.name,
      savedOn: rec.savedOn,
      note: typeof rec.note === 'string' ? rec.note : undefined,
      project: rec.project as Project,
    });
  }
  return { ok: true, library: { schemaVersion: DRAFTS_SCHEMA_VERSION, drafts }, notes };
}

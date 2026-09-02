"use client";

/**
 * @fileoverview Account-synced coach materials — TODO.md idea #8
 * ("Video-Lecture-Training Coach AI")'s "Account sync for coach materials
 * (and their version history)" follow-up: both were purely per-browser
 * localStorage, unlike most other panels in this repo.
 *
 * Local-first, like `debate-round`'s `useRoundPairings`:
 * `CoachMaterialsPanel` (the sole consumer) keeps reading/writing
 * localStorage directly through `state/coachMaterials.ts`'s existing
 * read helpers (`buildCoachMaterialLibraryFromStore`,
 * `listCoachMaterialTagsFromStore`, `listVersionsForMaterial`), which stay
 * fully usable signed out. This hook only wraps the *mutation* path
 * (`saveMaterial`/`deleteMaterial`) with a best-effort account push, and
 * runs a one-time cross-device merge on mount (deduped across instances via
 * module-level state, mirroring `useRoundPairings`) that reconciles local
 * and remote materials *and* their version history — merged by each
 * record's own id: a remote record with no local counterpart is adopted
 * locally, and a local-only record (saved before this feature existed, or
 * saved offline) is best-effort pushed up. Neither direction overwrites an
 * id both sides already have — this hook doesn't resolve edit conflicts,
 * just fills gaps, mirroring `useRoundPairings`/`useWordCountRounds`'s exact
 * merge rule.
 *
 * @module hooks/useCoachMaterialsSync
 */

import { useCallback, useEffect, useState } from "react";
import {
  adoptCoachMaterial,
  deleteCoachMaterial,
  listCoachMaterials,
  saveCoachMaterial,
} from "../state/coachMaterials";
import type { CoachMaterial } from "../coach/team-coach-materials";
import { adoptMaterialVersion, listAllCoachMaterialVersions } from "../state/coachMaterialVersions";
import {
  deleteSavedCoachMaterialFromAccount,
  listSavedCoachMaterials,
  saveCoachMaterialToAccount,
} from "../coach/coach-materials-client";
import {
  deleteSavedCoachMaterialVersionFromAccount,
  listSavedCoachMaterialVersions,
  saveCoachMaterialVersionToAccount,
} from "../coach/coach-material-versions-client";

// Module-level (not per-hook-instance) so multiple mounts of this hook in
// one page load share one pair of account fetches and one "is this browser
// signed in" flag, rather than each firing its own GET on mount.
let remoteAvailable = false;
let remoteMergePromise: Promise<boolean> | null = null;

/** Merges the account's synced materials and version history into local storage once per page load. Resolves to whether local storage changed. */
function ensureRemoteMerged(): Promise<boolean> {
  if (!remoteMergePromise) {
    remoteMergePromise = Promise.all([listSavedCoachMaterials(), listSavedCoachMaterialVersions()])
      .then(([remoteMaterials, remoteVersionsOrNull]) => {
        if (remoteMaterials === null) return false;
        remoteAvailable = true;

        let changed = false;

        const localMaterials = listCoachMaterials();
        const localMaterialIds = new Set(localMaterials.map((material) => material.id));
        const remoteMaterialIds = new Set(remoteMaterials.map((material) => material.id));
        for (const remote of remoteMaterials) {
          if (!localMaterialIds.has(remote.id)) {
            adoptCoachMaterial(remote);
            changed = true;
          }
        }
        for (const local of localMaterials) {
          if (!remoteMaterialIds.has(local.id)) {
            saveCoachMaterialToAccount(local).catch(() => {
              // Best-effort — this material stays local-only until a later
              // successful sync (e.g. the next save/mount).
            });
          }
        }

        const remoteVersions = remoteVersionsOrNull ?? [];
        const localVersions = listAllCoachMaterialVersions();
        const localVersionIds = new Set(localVersions.map((version) => version.id));
        const remoteVersionIds = new Set(remoteVersions.map((version) => version.id));
        for (const remote of remoteVersions) {
          if (!localVersionIds.has(remote.id)) {
            adoptMaterialVersion(remote);
            changed = true;
          }
        }
        for (const local of localVersions) {
          if (!remoteVersionIds.has(local.id)) {
            saveCoachMaterialVersionToAccount(local).catch(() => {
              // Best-effort, same as the materials loop above.
            });
          }
        }

        return changed;
      })
      .catch(() => false);
  }
  return remoteMergePromise;
}

export type UseCoachMaterialsSyncResult = {
  /** Whether this browser is signed in and syncing coach materials to the account. */
  synced: boolean;
  /** `true` once the initial mount merge (if any) has settled — a caller should refresh its own local-store-derived view when this flips to `true`. */
  ready: boolean;
  /** Saves a material locally and, when signed in, best-effort syncs it — and any version snapshot the save created — to the account. */
  saveMaterial: (material: CoachMaterial) => void;
  /** Deletes a material locally and, when signed in, best-effort removes it — and its whole version history — from the account too. */
  deleteMaterial: (id: string) => void;
};

/**
 * Wraps `state/coachMaterials.ts`'s mutation path with account sync. See
 * the module doc above for why this hook doesn't own the panel's rendered
 * list state itself.
 */
export function useCoachMaterialsSync(): UseCoachMaterialsSyncResult {
  const [synced, setSynced] = useState(remoteAvailable);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    ensureRemoteMerged().then(() => {
      setSynced(remoteAvailable);
      setReady(true);
    });
  }, []);

  const saveMaterial = useCallback((material: CoachMaterial) => {
    const { version } = saveCoachMaterial(material);
    if (remoteAvailable) {
      saveCoachMaterialToAccount(material).catch(() => {
        // Best-effort — the material is already saved locally above,
        // matching useRoundPairings's "local apply is never blocked by a
        // sync failure" convention.
      });
      if (version) {
        saveCoachMaterialVersionToAccount(version).catch(() => {
          // Best-effort, same as above.
        });
      }
    }
  }, []);

  const deleteMaterial = useCallback((id: string) => {
    const removedVersionIds = deleteCoachMaterial(id);
    if (remoteAvailable) {
      deleteSavedCoachMaterialFromAccount(id).catch(() => {
        // Best-effort, same as saveMaterial above.
      });
      for (const versionId of removedVersionIds) {
        deleteSavedCoachMaterialVersionFromAccount(versionId).catch(() => {
          // Best-effort — the version is already gone locally either way.
        });
      }
    }
  }, []);

  return { synced, ready, saveMaterial, deleteMaterial };
}

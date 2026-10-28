#!/usr/bin/env bash
#
# merge.sh
#
# First:
#   1. Stage all current tracked and untracked changes.
#   2. Commit them with message "." if changes exist.
#   3. Push the current branch to origin.
#
# Then, for every open PR targeting master:
#   1. Merge origin/master into the PR head branch locally.
#   2. Resolve ordinary content conflicts by taking origin/master ("theirs").
#   3. Push the updated PR branch.
#   4. Merge the PR on GitHub and delete its remote branch.
#
# The initial branch must have an open PR targeting master to be merged
# by the PR loop. This script does not create a PR.
#
# macOS compatible:
# - Bash 3.2 compatible: does not use mapfile/readarray.
# - macOS base64 compatible: uses `base64 -D`.
#

set -Eeuo pipefail

BASE_BRANCH="master"

# GitHub PR merge strategy. One of: merge, squash, rebase.
MERGE_METHOD="merge"

# If "true", request an immediate merge rather than enabling auto-merge.
# GitHub's branch protection rules determine which checks are required.
REQUIRE_GREEN_CHECKS="true"

# If "true", remove the remote PR head branch after successful merge.
DELETE_BRANCH_AFTER_MERGE="true"

# If "true", only print write operations.
DRY_RUN="false"

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Error: required command not found: $1" >&2
    exit 1
  }
}

run() {
  if [[ "$DRY_RUN" == "true" ]]; then
    printf '[dry-run]'
    printf ' %q' "$@"
    printf '\n'
  else
    "$@"
  fi
}

abort_merge_if_active() {
  if git rev-parse -q --verify MERGE_HEAD >/dev/null 2>&1; then
    git merge --abort >/dev/null 2>&1 || true
  fi
}

cleanup() {
  local exit_code=$?

  if [[ "$exit_code" -ne 0 ]]; then
    abort_merge_if_active
  fi

  exit "$exit_code"
}

require_command git
require_command gh
require_command jq
require_command base64

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || {
  echo "Error: run this from inside the target Git repository." >&2
  exit 1
}

# Confirm that GitHub CLI can identify this repository and account.
gh repo view >/dev/null

# Commit and push the current branch before processing PRs.
current_branch="$(git symbolic-ref --quiet --short HEAD)" || {
  echo "Error: HEAD is detached. Check out a branch before running this script." >&2
  exit 1
}

# Refuse an existing unfinished merge before installing cleanup traps,
# so the script does not abort a merge that it did not start.
if git rev-parse -q --verify MERGE_HEAD >/dev/null 2>&1 ||
   [[ -n "$(git ls-files --unmerged)" ]]; then
  echo "Error: an unfinished merge or unresolved conflicts already exist." >&2
  echo "Finish or abort the existing merge before running this script." >&2
  exit 1
fi

trap cleanup ERR
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'abort_merge_if_active' EXIT

echo "Preparing current branch: $current_branch"

if [[ -n "$(git status --porcelain)" ]]; then
  echo 'Committing all current changes with message "."...'
  run git add --all
  run git commit -m "."
else
  echo "No uncommitted changes found."
fi

echo "Pushing current branch: $current_branch"
run git push --set-upstream origin "$current_branch"

echo "Fetching remote branches..."
run git fetch origin --prune

echo "Updating $BASE_BRANCH..."
run git checkout "$BASE_BRANCH"
run git pull --ff-only origin "$BASE_BRANCH"

PR_COUNT=0
MERGED_COUNT=0
FAILED_COUNT=0

# Capture the PR list first so a listing failure stops the script.
pr_records="$(
  gh pr list \
    --state open \
    --base "$BASE_BRANCH" \
    --limit 1000 \
    --json number,headRefName,title \
    --jq '.[] | @base64'
)"

while IFS= read -r encoded_pr; do
  [[ -z "$encoded_pr" ]] && continue

  PR_COUNT=$((PR_COUNT + 1))

  pr_json="$(printf '%s' "$encoded_pr" | base64 -D)"
  pr_number="$(printf '%s' "$pr_json" | jq -r '.number')"
  branch="$(printf '%s' "$pr_json" | jq -r '.headRefName')"
  title="$(printf '%s' "$pr_json" | jq -r '.title')"

  echo
  echo "================================================================"
  echo "PR #$pr_number: $title"
  echo "Branch: $branch -> $BASE_BRANCH"
  echo "Conflict rule: accept incoming origin/$BASE_BRANCH for conflicts"
  echo "================================================================"

  # Each earlier PR may have changed master, so refresh before every PR.
  run git checkout "$BASE_BRANCH"
  run git pull --ff-only origin "$BASE_BRANCH"
  run git fetch origin "$branch"

  # Start from exactly the latest remote PR-head state.
  run git checkout -B "$branch" "origin/$branch"

  echo "Merging origin/$BASE_BRANCH into $branch..."

  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[dry-run] git merge --no-edit -X theirs origin/$BASE_BRANCH"
  else
    # During this merge:
    #   ours   = current checked-out PR branch
    #   theirs = origin/master
    #
    # -X theirs resolves conflicting content hunks in favor of master.
    if ! git merge --no-edit -X theirs "origin/$BASE_BRANCH"; then
      # A merge can fail for reasons other than conflicts.
      if ! git rev-parse -q --verify MERGE_HEAD >/dev/null 2>&1; then
        echo "Error: merge failed without an active merge to resolve." >&2
        exit 1
      fi

      echo "Git reported a merge failure; checking unresolved files."

      # NUL-delimited paths support spaces, tabs, and newlines in filenames.
      while IFS= read -r -d '' conflict_file; do
        printf '  Taking origin/%s version: %q\n' \
          "$BASE_BRANCH" "$conflict_file"

        # Stage 3 is the incoming/master version. If it is absent,
        # master deleted the path, so resolve by removing it.
        if [[ -n "$(git ls-files --unmerged -- "$conflict_file" |
          awk '$3 == 3 { print; exit }')" ]]; then
          if ! git checkout --theirs -- "$conflict_file"; then
            echo "Error: unable to take incoming version for: $conflict_file" >&2
            exit 1
          fi

          git add -- "$conflict_file"
        else
          git rm -f -- "$conflict_file"
        fi
      done < <(git diff --name-only --diff-filter=U -z)

      if [[ -n "$(git ls-files --unmerged)" ]]; then
        echo "Error: unresolved paths remain after automatic resolution:" >&2
        git diff --name-only --diff-filter=U >&2
        exit 1
      fi

      git commit --no-edit
    fi
  fi

  echo "Pushing updated PR branch..."
  run git push -u origin "$branch"

  echo "Merging PR #$pr_number through GitHub..."

  merge_args=(pr merge "$pr_number" "--$MERGE_METHOD")

  if [[ "$DELETE_BRANCH_AFTER_MERGE" == "true" ]]; then
    merge_args+=(--delete-branch)
  fi

  if [[ "$REQUIRE_GREEN_CHECKS" == "true" ]]; then
    merge_args+=(--auto=false)
  else
    merge_args+=(--auto)
  fi

  if run gh "${merge_args[@]}"; then
    MERGED_COUNT=$((MERGED_COUNT + 1))

    if [[ "$DRY_RUN" == "true" ]]; then
      echo "[dry-run] Would request merge for PR #$pr_number."
    elif [[ "$REQUIRE_GREEN_CHECKS" == "true" ]]; then
      echo "GitHub accepted the merge request for PR #$pr_number."
    else
      echo "GitHub accepted the merge or auto-merge request for PR #$pr_number."
    fi
  else
    FAILED_COUNT=$((FAILED_COUNT + 1))
    echo "WARNING: branch was updated, but the merge command failed for PR #$pr_number." >&2
    echo "Possible reasons: pending/failed required checks, review requirements," >&2
    echo "merge queue, or another GitHub branch-protection rule." >&2
    echo "Continuing with remaining PRs." >&2
  fi
done <<< "$pr_records"

echo

if [[ "$PR_COUNT" -eq 0 ]]; then
  echo "No open pull requests target $BASE_BRANCH."
else
  echo "Summary:"
  echo "  PRs found:              $PR_COUNT"
  echo "  Merge commands accepted: $MERGED_COUNT"
  echo "  Merge commands failed:   $FAILED_COUNT"
fi

# Leave the repository on the updated base branch.
run git checkout "$BASE_BRANCH"
run git pull --ff-only origin "$BASE_BRANCH"
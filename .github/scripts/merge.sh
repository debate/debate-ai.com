#!/usr/bin/env bash
#
# merge.sh
#
# For every open PR targeting master:
#   1. Merge origin/master into the PR head branch locally.
#   2. Resolve all ordinary conflicts by taking origin/master ("theirs").
#   3. Push the updated PR branch.
#   4. Merge the PR on GitHub and delete its remote branch.
#
# macOS compatible:
# - Bash 3.2 compatible: does not use mapfile/readarray.
# - macOS base64 compatible: uses `base64 -D`.
#

set -Eeuo pipefail

BASE_BRANCH="master"

# GitHub PR merge strategy. One of: merge, squash, rebase.
MERGE_METHOD="merge"

# If "true", GitHub must have successful required checks before it merges.
# If checks are pending, the script stops on that PR.
REQUIRE_GREEN_CHECKS="true"

# If "true", remove the remote PR head branch after successful merge.
DELETE_BRANCH_AFTER_MERGE="true"

# If "true", only print what would happen. No merge, commit, push, or PR merge.
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

  # Avoid leaving your local working tree in a partial merge state.
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

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Error: your working tree is not clean." >&2
  echo "Commit, stash, or discard local work before running this script." >&2
  exit 1
fi

# Confirm that GitHub CLI can identify this repository and account.
gh repo view >/dev/null

trap cleanup ERR INT TERM

echo "Fetching remote branches..."
run git fetch origin --prune

echo "Updating $BASE_BRANCH..."
run git checkout "$BASE_BRANCH"
run git pull --ff-only origin "$BASE_BRANCH"

PR_COUNT=0
MERGED_COUNT=0
FAILED_COUNT=0

# gh emits one base64-encoded JSON record per PR:
# { "number": 123, "headRefName": "feature/example", "title": "Example PR" }
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
  echo "Conflict rule: accept incoming origin/$BASE_BRANCH for all conflicts"
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
    # -X theirs auto-resolves content-hunk conflicts in favor of master.
    #
    # If Git cannot finish the merge (e.g. modify/delete or more unusual
    # conflict forms), the block below resolves each still-unmerged path.
    if ! git merge --no-edit -X theirs "origin/$BASE_BRANCH"; then
      echo "Git reported conflicts; accepting master for every unresolved file."

      # During this merge:
      #   ours   = current checked-out PR branch
      #   theirs = origin/master
      #
      # `git checkout --theirs -- <file>` installs master’s version.
      while IFS= read -r conflict_file; do
        [[ -z "$conflict_file" ]] && continue

        echo "  Taking origin/$BASE_BRANCH version: $conflict_file"

        # This can fail for certain pathological cases, such as an unmerged
        # submodule pointer without a corresponding working tree state.
        if ! git checkout --theirs -- "$conflict_file"; then
          echo "Error: unable to take incoming version for: $conflict_file" >&2
          echo "Resolve this file manually, then rerun." >&2
          exit 1
        fi

        git add -- "$conflict_file"
      done < <(git diff --name-only --diff-filter=U)

      # Never commit if Git still considers any path unmerged.
      if git diff --name-only --diff-filter=U | grep -q '.'; then
        echo "Error: unresolved paths remain after automatic resolution:" >&2
        git diff --name-only --diff-filter=U >&2
        exit 1
      fi

      # Complete the in-progress merge with Git's default merge message.
      git commit --no-edit
    fi
  fi

  # The PR branch now includes the current master plus the local resolution.
  echo "Pushing updated PR branch..."
  run git push -u origin "$branch"

  echo "Merging PR #$pr_number through GitHub..."

  merge_args=(pr merge "$pr_number" "--$MERGE_METHOD")

  if [[ "$DELETE_BRANCH_AFTER_MERGE" == "true" ]]; then
    merge_args+=(--delete-branch)
  fi

  # Without --auto, gh either merges immediately or returns an error due to
  # protected-branch requirements/checks. With --auto it may merge later,
  # which makes the script’s sequential behavior less predictable.
  if [[ "$REQUIRE_GREEN_CHECKS" == "true" ]]; then
    merge_args+=(--auto=false)
  else
    merge_args+=(--auto)
  fi

  if run gh "${merge_args[@]}"; then
    MERGED_COUNT=$((MERGED_COUNT + 1))
    echo "Success: merged and closed PR #$pr_number."
  else
    FAILED_COUNT=$((FAILED_COUNT + 1))
    echo "WARNING: branch was updated, but GitHub did not merge PR #$pr_number." >&2
    echo "Possible reasons: pending/failed required checks, review requirements," >&2
    echo "merge queue, or another GitHub branch-protection rule." >&2
    echo "Continue with remaining PRs." >&2
  fi

  # Make sure a failed GitHub merge does not terminate the full PR loop.
  # The local PR branch itself is already clean at this point.
done < <(
  gh pr list \
    --state open \
    --base "$BASE_BRANCH" \
    --limit 1000 \
    --json number,headRefName,title \
    --jq '.[] | @base64'
)

echo
if [[ "$PR_COUNT" -eq 0 ]]; then
  echo "No open pull requests target $BASE_BRANCH."
else
  echo "Summary:"
  echo "  PRs found:  $PR_COUNT"
  echo "  PRs merged: $MERGED_COUNT"
  echo "  PRs not merged by GitHub: $FAILED_COUNT"
fi

# Leave the repository on the updated base branch.
run git checkout "$BASE_BRANCH"
run git pull --ff-only origin "$BASE_BRANCH"

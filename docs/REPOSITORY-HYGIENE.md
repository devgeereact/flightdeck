# Repository realignment and cleanup — separately invoked workflow

This document is a procedure, not standing permission to modify Git. Work only within the selected repository on this computer, except the explicitly authorised safety-backup destination. Do not fetch/pull during the read-only snapshot. Respect AGENTS.md, .agent/PROJECT.yml and .agent/CURRENT-TASK.md.

## Safety invariants
Never use `git push --force`, `git reset --hard`, `git clean -fdx`, `git checkout -- .`, rebase on a pushed branch, `git filter-repo` or `git gc --prune=now`. Never delete remote branches. Never delete a branch/worktree/stash unless its commits and dirty/untracked changes are in the default branch or VERIFIED backup. Prefer keep over uncertain removal. One concern per conventional commit. No deployments. No secret files/values in commits or reports. Stop on ambiguity, conflict or failing checks.

## Phase 0: read-only snapshot
Verify repository root and identify default branch from the remote symbolic ref; if absent/ambiguous ask rather than assuming main. List current/default branches; staged, unstaged, untracked counts and filenames only; local branch upstream/ahead/behind/unique-commit counts and dates; remote branches and merge status against default; worktree list including .claude/worktrees/.worktrees; stashes; total/.git/node_modules/build sizes. Local stale remote refs are evidence of last fetch, not current server truth. State limitations.

## Phase 1: verified safety backup
Create `~/repo-backups/<repo>-<YYYY-MM-DD-HHMM>/` after required filesystem permission. `git bundle create repo.bundle --all`, then `git bundle verify repo.bundle`. A bundle protects refs/commits, not dirty files or per-worktree untracked data. Preserve staged and unstaged binary-safe patches separately (`git diff --cached --binary` and `git diff --binary`) and document restoration order. Export each stash with staged/untracked content where it exists; a simple stash patch alone can omit untracked stash parents. For EVERY worktree, save dirty patches AND its eligible untracked files. Exclude node_modules/regenerable builds/.env/keys/tokens; if excluded files contain valuable private work, flag the exclusion and keep the original in place until private backup is arranged. Never silently drop secret-bearing changes into a plaintext patch. Review changed paths and screen for secrets without printing values; stop for sensitive-patch handling if found.

Verify bundle, archive contents and hashes; save restore instructions; show backup size/location. Back up before editing. If no Git metadata exists, report bundle as NOT APPLICABLE and obtain approval for a verified source archive instead. Never describe a source archive as a Git bundle. If no GitHub remote exists, stop after Phase 2; creating Git/remote/push is a separate authorised step.

## Phase 2: classify with evidence
For every branch/worktree/stash: MERGE (unique wanted work), ALREADY MERGED (ancestry verified), SUPERSEDED (patch/content evidence, not name similarity), UNSURE (decision required). Include unique commits, dates, purpose and likely overlapping files. Include each worktree's dirty/untracked content. Do not guess wanted work.

## Phase 3: plan and STOP
One table: item, evidence, action (commit/merge/remove locally/keep), risk, backup coverage. Verify Phase 1 before requesting approval. Wait for explicit approval; earlier blanket task authorisation is not permission to skip this gate. Amend the plan and get approval if evidence changes materially.

## Phase 4: loose work
Commit only approved work on the right branch, explicit paths, focused conventional messages. Run project secret checks or a staged-diff secret scan before each commit without printing candidate values. Turn approved stashes into commits without dropping originals until acceptance. Never git add all blindly.

## Phase 5: merge
Update default with `git pull --ff-only` from verified origin. Merge approved branches one at a time using `git merge --no-ff`. Run required install/lint/typecheck/tests/build after each merge; NOT APPLICABLE is permitted only for checks the project genuinely doesn't define, not a failed gate. Don't invent a lint script during cleanup. On conflict run `git merge --abort` if safe/needed, stop and report. On a completed merge with failing checks, preserve it and report; do not reset it destructively.

## Phase 6: push
Only approved default/keep branches, normal `git push`. Ensure deployment workflows cannot trigger a forbidden deployment: if pushing the default branch would deploy, stop and ask for a separate approved safe way to push without deploying. Do not silently disable workflows. Fetch only within the approved mutation phase if needed to verify local/origin ahead=0 behind=0; report if remote protections block push.

## Phase 7: approved local cleanup
Use `git worktree remove` for verified safe worktrees, then `git worktree prune`; avoid --force. Use `git branch -d`, not -D unless that exact branch is approved. Drop only explicitly approved stashes after verifying content. Remove only identified regenerable build directories inside this repo, after confirming they contain no unique/tracked/user content. Keep node_modules. Never run broad deletion patterns or touch another repository. Backup inclusion is necessary but doesn't authorise an unapproved deletion.

## Phase 8: final report
Before/after branch/worktree/stash/size table; current default status and origin sync; PASS/FAIL/PARTIAL/NOT TESTED/BLOCKED checks; backup location and exclusions; remote branches eligible for later review (list only); remaining work and why. Do not claim clean/in-sync if refs weren't verified.

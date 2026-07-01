#!/usr/bin/env bash
# scripts/check-commit-msg.sh
#
# TD-1 — Conventional Commits subject validator (lightweight).
#
# Reads a commit subject from either:
#   - stdin  (e.g. `echo "feat: ok" | bash scripts/check-commit-msg.sh`)
#   - arg 1  (e.g. `bash scripts/check-commit-msg.sh "feat: ok"`)
#   - $1     (e.g. when wired to a `commit-msg` hook: `... $1`)
#
# Exits 0 when the subject matches the Conventional Commits regex
# `^(feat|fix|refactor|chore|docs|test|perf|build|ci)(\([a-z0-9-]+\))?!?: .+`
# Exits 1 (with a Vietnamese error message + example) otherwise.
#
# This script intentionally avoids Husky / commitlint / any new dependency.
# Wire it manually if desired:
#   git config core.hooksPath .githooks       # then drop a commit-msg shim there
#   OR copy scripts/check-commit-msg.sh to .git/hooks/commit-msg
#   OR call it from your CI pipeline.
# Bypass with `git commit --no-verify` once a hook is wired.

set -euo pipefail

# --- Resolve subject ----------------------------------------------------------
if [[ $# -ge 1 && -n "${1-}" ]]; then
  subject="$1"
elif [[ ! -t 0 ]]; then
  # Read all of stdin; commit-msg files contain a single line for the subject.
  subject="$(cat)"
else
  echo "TD-1: không nhận được commit subject (truyền qua stdin hoặc arg 1)." >&2
  exit 2
fi

# Trim trailing whitespace + newlines.
subject="${subject## }"
subject="${subject%%$'\n'}"

# --- Conventional Commits regex ----------------------------------------------
# Allowed types: feat, fix, refactor, chore, docs, test, perf, build, ci
# Optional scope: lowercase, digits, dash  ->  (foo-bar)
# Optional breaking-change marker:         ->  !
# Mandatory separator + space:             ->  :
# Subject text (one or more chars):        ->  .+
readonly PATTERN='^(feat|fix|refactor|chore|docs|test|perf|build|ci)(\([a-z0-9-]+\))?!?: .+$'

if [[ "${subject}" =~ ${PATTERN} ]]; then
  exit 0
fi

# --- Failure message ----------------------------------------------------------
cat >&2 <<EOF
TD-1 — Commit subject không khớp Conventional Commits.

Subject:  "${subject}"
Expected: <type>(<scope>)?!? : <mô tả ngắn>
Types:    feat | fix | refactor | chore | docs | test | perf | build | ci

Ví dụ hợp lệ:
  feat(case-detail): thêm icon-only tabs trên mobile
  fix(payments): sửa NaN khi amount = 0
  refactor!: thay đổi response shape của POST /api/payments
  docs(contributing): bổ sung hướng dẫn commit convention
  chore(deps): nâng cấp next 14.2.18 -> 14.2.19

Bypass (chỉ dành cho hotfix khẩn cấp):  git commit --no-verify
Xem chi tiết: CONTRIBUTING.md § Conventional Commits
EOF

exit 1
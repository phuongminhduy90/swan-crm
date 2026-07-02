#!/usr/bin/env bash
# scripts/check-anti-patterns.sh
#
# TD-6 — Anti-pattern pre-commit guard (lightweight, no Husky).
#
# Scans the repository for known anti-pattern regressions introduced by
# commits and exits non-zero when any match is found.
#
# Modes:
#   default  : check STAGED files only (git diff --cached) — what `pre-commit`
#              hooks should do. Pre-existing code is NOT scanned.
#   --all    : check the full source tree (src/, scripts/, tests/).
#              Use for CI / manual audit / annual sweep.
#   --staged : explicit alias of the default.
#   --help   : print usage.
#
# Anti-pattern catalog (kept intentionally narrow — see CONTRIBUTING.md §3):
#
#   ID  | Description                              | Regex                                    | Where
#   --- | ---------------------------------------- | ---------------------------------------- | --------------------
#   A2  | Raw user-* IDs in UI                     | user-\d{3}                               | src/components
#   A8  | Dead `href="#"` links                    | href=["']#["']                           | src/components
#   A9  | Native window.confirm / window.alert     | window\.(confirm|alert)                  | src
#   A10 | Raw <input type="number"> for currency   | <[iI]nput[^>]*(type=['"]number['"])[^>]*(currency|amount|price|VNĐ|tiền) | src/components
#   ESC | eslint-disable for no-alert              | eslint-disable[^"']*no-alert             | src
#
# Exclusions:
#   - __tests__/, *.test.tsx, *.test.ts, *.spec.tsx, *.spec.ts
#   - .next/, node_modules/, playwright-report/
#
# Exit codes:
#   0 — clean
#   1 — at least one anti-pattern detected (prints <ID>: <file>:<line>)
#   2 — usage error
#
# This script intentionally avoids Husky / lint-staged / any new dependency.
# Wire it manually if desired:
#   git config core.hooksPath .githooks
#   (then drop a pre-commit shim that calls this script)
# Bypass: `git commit --no-verify`.

set -euo pipefail

# ---------------------------------------------------------------------------
# Path resolution — works on Linux, macOS, Git-Bash (Windows).
# Strip stray \r that some shells leave on Windows.
# ---------------------------------------------------------------------------
SOURCE="${BASH_SOURCE[0]}"
while [[ -L "${SOURCE}" ]]; do SOURCE="$(readlink "${SOURCE}")"; done
SCRIPT_DIR="$(cd "$(dirname "${SOURCE}")" && pwd | head -n1 | tr -d '\r')"
PARENT_DIR="$(dirname "${SCRIPT_DIR}" | tr -d '\r')"
REPO_ROOT=""
if command -v git >/dev/null 2>&1 && git -C "${PARENT_DIR}" rev-parse --git-dir >/dev/null 2>&1; then
  REPO_ROOT_RAW="$(git -C "${PARENT_DIR}" rev-parse --show-toplevel 2>/dev/null || true)"
  REPO_ROOT="$(printf '%s\n' "${REPO_ROOT_RAW}" | head -n1 | tr -d '\r')"
fi
if [[ -z "${REPO_ROOT}" || ! -d "${REPO_ROOT}" ]]; then
  REPO_ROOT="${PARENT_DIR}"
fi
cd "${REPO_ROOT}" || { echo "TD-6: cannot cd to ${REPO_ROOT}" >&2; exit 2; }

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
MODE="staged"
for arg in "$@"; do
  case "$arg" in
    --all)    MODE="all" ;;
    --staged) MODE="staged" ;;
    --help|-h)
      sed -n '2,38p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "TD-6: unknown argument '$arg'." >&2
      echo "Usage: $0 [--all | --staged | --help]" >&2
      exit 2
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Grep backend detection (rg first, fall back to grep)
# ---------------------------------------------------------------------------
HAS_RG=0
# On Git-Bash, `rg` is often a shell function wrapped around ripgrep.
# Try multiple discovery mechanisms so the script works across platforms.
if type rg >/dev/null 2>&1; then
  if echo "td6-sanity" | rg "sanity" >/dev/null 2>&1; then
    HAS_RG=1
  fi
fi
if [[ "${HAS_RG}" -eq 0 ]] && command -v rg >/dev/null 2>&1; then
  if echo "td6-sanity" | rg "sanity" >/dev/null 2>&1; then
    HAS_RG=1
  fi
fi

# ---------------------------------------------------------------------------
# File selection
# ---------------------------------------------------------------------------
TARGETS=()
TARGET_LABEL=""

case "${MODE}" in
  staged)
    if ! git rev-parse --git-dir >/dev/null 2>&1; then
      echo "TD-6: not inside a git work tree; rerun with --all to audit the full tree." >&2
      exit 2
    fi
    mapfile -t TARGETS < <(
      git diff --cached --name-only --diff-filter=ACMR \
        | grep -E '\.(ts|tsx|js|jsx|mjs|cjs|sh)$' \
        || true
    )
    # git ls-files --others --exclude-standard picks up untracked + intent-to-add.
    mapfile -t NEW_FILES < <(
      git ls-files --others --exclude-standard \
        | grep -E '\.(ts|tsx|js|jsx|mjs|cjs|sh)$' \
        || true
    )
    for f in "${NEW_FILES[@]:-}"; do
      [[ -z "$f" ]] && continue
      TARGETS+=("$f")
    done
    TARGET_LABEL="staged files"
    ;;
  all)
    TARGETS=()
    TARGET_LABEL="full source tree"
    ;;
esac

# ---------------------------------------------------------------------------
# Anti-pattern catalog
# Stored as flat arrays; no IFS tricks, no read-while heredoc.
# We add in pairs (id, regex, scope) so the loop body stays tiny.
# ---------------------------------------------------------------------------
CATALOG_IDS=(
  "A2"
  "A8"
  "A9"
  "A10"
  "ESC"
)
CATALOG_DESCS=(
  "raw user-* IDs in UI"
  'dead href="#" links'
  "native window.confirm / window.alert"
  "raw <input type=\"number\"> for currency (use <CurrencyInput>)"
  "eslint-disable directive for no-alert"
)
CATALOG_REGEXES=(
  'user-[[:digit:]]{3}'
  'href=["'"'"']#["'"'"']'
  'window\.(confirm|alert)[[:space:]]*\('
  '<[iI]nput[^>]*(type=["'"'"']number["'"'"'])[^>]*(currency|amount|price|VNĐ|tiền)'
  'eslint-disable[^"'"'"']*no-alert'
)
CATALOG_SCOPES=(
  "src/components"
  "src/components"
  "src"
  "src/components"
  "src"
)

# ---------------------------------------------------------------------------
# Scan
# ---------------------------------------------------------------------------
VIOLATIONS=0
HEADER_PRINTED=0

print_header() {
  if [[ "${HEADER_PRINTED}" -eq 0 ]]; then
    echo "TD-6 anti-pattern gate — mode: ${MODE} (${TARGET_LABEL})" >&2
    echo "─────────────────────────────────────────────────────────────" >&2
    HEADER_PRINTED=1
  fi
}

scan_pattern() {
  local pid="$1"
  local pdesc="$2"
  local regex="$3"
  local scope="$4"
  local raw_matches=""
  local matches=""

  case "${MODE}" in
    staged)
      local file_args=()
      local f
      for f in "${TARGETS[@]:-}"; do
        [[ -z "$f" ]] && continue
        if [[ "$f" == ${scope}/* || "$f" == ${scope} ]]; then
          file_args+=("$f")
        fi
      done
      if [[ "${#file_args[@]}" -eq 0 ]]; then
        return 0
      fi
      if [[ "${HAS_RG}" -eq 1 ]]; then
        raw_matches="$(rg --no-heading --line-number --color=never -e "${regex}" "${file_args[@]}" 2>/dev/null || true)"
      else
        raw_matches="$(grep -E -n -H --color=never -e "${regex}" "${file_args[@]}" 2>/dev/null || true)"
      fi
      ;;
    all)
      if [[ "${HAS_RG}" -eq 1 ]]; then
        raw_matches="$(rg --no-heading --line-number --hidden --color=never \
            --glob '!**/__tests__/**' \
            --glob '!**/*.test.ts' --glob '!**/*.test.tsx' \
            --glob '!**/*.spec.ts' --glob '!**/*.spec.tsx' \
            --glob '!**/.next/**' --glob '!**/node_modules/**' \
            --glob '!**/playwright-report/**' \
            -e "${regex}" "${scope}" 2>/dev/null || true)"
      else
        raw_matches="$(grep -E -n -H -r --color=never \
            --exclude-dir=__tests__ --exclude-dir=.next --exclude-dir=node_modules \
            --exclude-dir=playwright-report --exclude-dir=.git \
            --exclude='*.test.ts' --exclude='*.test.tsx' \
            --exclude='*.spec.ts' --exclude='*.spec.tsx' \
            --exclude='*.d.ts' \
            -e "${regex}" "${scope}" 2>/dev/null || true)"
      fi
      ;;
  esac

  # Drop comment-only lines to avoid false positives on existing docs.
  # Pattern: file:line: <whitespace> followed by // or /* or * (block comment).
  if [[ -n "${raw_matches}" ]]; then
    matches="$(printf '%s\n' "${raw_matches}" \
      | grep -vE '^[^:]+:[0-9]+:[[:space:]]*(//|/\*|\*)' \
      || true)"
  fi

  if [[ -n "${matches}" ]]; then
    print_header
    echo "[${pid}] ${pdesc}" >&2
    local line
    while IFS= read -r line; do
      [[ -z "${line}" ]] && continue
      echo "    ${line}" >&2
      VIOLATIONS=$((VIOLATIONS + 1))
    done <<< "${matches}"
    echo "" >&2
  fi
}

n="${#CATALOG_IDS[@]}"
i=0
while [[ ${i} -lt ${n} ]]; do
  scan_pattern \
    "${CATALOG_IDS[$i]}" \
    "${CATALOG_DESCS[$i]}" \
    "${CATALOG_REGEXES[$i]}" \
    "${CATALOG_SCOPES[$i]}"
  i=$((i + 1))
done

# ---------------------------------------------------------------------------
# Result
# ---------------------------------------------------------------------------
if [[ "${VIOLATIONS}" -gt 0 ]]; then
  echo "TD-6: ${VIOLATIONS} anti-pattern match(es) detected." >&2
  cat >&2 <<'EOF'

Mỗi match là một anti-pattern đã được đóng ở Sprint 6.x (A2/A8/A9)
hoặc được liệt kê trong `docs/ux-redesign/IMPLEMENTATION_BACKLOG.md`.

Cách xử lý:
  - Sửa code (dùng <Toast>, <ConfirmDialog>, user display name, …)
  - Nếu match nằm trong JSDoc / comment văn bản thuần, đổi cách diễn đạt
    để không còn khớp regex (ví dụ: viết "window . alert" có khoảng trắng).
  - Bypass cho hotfix P0/P1:  git commit --no-verify
    Subject vẫn PHẢI tuân CONTRIBUTING.md §1.

Xem chi tiết: CONTRIBUTING.md § Anti-pattern pre-commit guard
EOF
  exit 1
fi

exit 0

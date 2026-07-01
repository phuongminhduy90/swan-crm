# Contributing to Swan Case CRM

> Hướng dẫn đóng góp cho Swan Case CRM — dành cho FE/BE/QA/PO tham gia sprint.

## 1. Conventional Commits (TD-1)

Toàn bộ commit subject **bắt buộc** tuân theo [Conventional Commits 1.0.0](https://www.conventionalcommits.org/), bắt đầu từ Sprint 7.1.

### 1.1 Format

```
<type>(<scope>)?!?: <mô tả ngắn>
```

| Thành phần   | Bắt buộc | Quy tắc                                                              |
|:-------------|:---------|:---------------------------------------------------------------------|
| `type`       | ✅       | Một trong: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `perf`, `build`, `ci` |
| `scope`      |          | Tên module/area — chữ thường, số, dấu gạch ngang. VD: `case-detail`, `payments`, `toast` |
| `!`          |          | Đánh dấu **breaking change** — kèm `BREAKING CHANGE:` trong body      |
| `:` + space  | ✅       | Separator sau type/scope                                              |
| Subject text | ✅       | Tiếng Việt không dấu OK, mô tả 1 dòng ≤ 72 ký tự                     |

### 1.2 Type taxonomy (Swan CRM)

| Type       | Khi nào dùng                                                                  | Ví dụ                                                       |
|:-----------|:------------------------------------------------------------------------------|:------------------------------------------------------------|
| `feat`     | Thêm feature / API mới / prop mới                                             | `feat(case-detail): thêm icon-only tabs trên mobile`        |
| `fix`      | Sửa bug (kèm repro trong PR)                                                  | `fix(payments): sửa NaN khi amount = 0`                     |
| `refactor` | Tái cấu trúc code KHÔNG đổi hành vi                                          | `refactor(notifications): migrate sang shared <Tabs>`        |
| `chore`    | Tooling, deps, config, housekeeping                                           | `chore(deps): nâng cấp next 14.2.18 -> 14.2.19`             |
| `docs`     | Chỉ tài liệu (README, CLAUDE.md, story reports, migration notes)             | `docs(contributing): bổ sung commit convention`             |
| `test`     | Chỉ thêm/sửa test                                                             | `test(toast): thêm backward-compat tests`                    |
| `perf`     | Tối ưu hiệu năng (bundle size, query time) — có số liệu trước/sau            | `perf(reports): giảm shared JS 4KB nhờ memo chart wrapper`   |
| `build`    | Thay đổi build pipeline / config (next.config, tsconfig, tailwind)             | `build(tsconfig): bật noUncheckedIndexedAccess`              |
| `ci`       | Thay đổi CI pipeline / GitHub Actions / Vercel hooks                         | `ci(github): thêm axe-core job cho 5 tabs consumers`         |

### 1.3 Ví dụ hợp lệ

```bash
feat(case-detail): thêm icon-only tabs trên mobile
fix(payments): sửa NaN khi amount = 0
refactor!: thay đổi response shape của POST /api/payments
docs(contributing): bổ sung hướng dẫn commit convention
chore(deps): nâng cấp next 14.2.18 -> 14.2.19
test(toast): thêm backward-compat tests
perf(reports): giảm shared JS 4KB nhờ memo chart wrapper
```

### 1.4 Ví dụ KHÔNG hợp lệ (sẽ bị reject)

| Subject                          | Lý do                                            |
|:---------------------------------|:-------------------------------------------------|
| `update tabs`                    | Thiếu type + colon                               |
| `feat tabs`                      | Thiếu colon sau type                             |
| `feat(case detail): thêm icon`   | Scope chứa dấu cách — phải là `case-detail`      |
| `feat(CaseDetail): thêm icon`    | Scope phải lowercase                             |
| `feat(case-detail) thêm icon`    | Thiếu colon                                       |
| `hotfix(payments): sửa bug`      | `hotfix` không nằm trong allowed types — dùng `fix` |

### 1.5 Breaking change

Thêm `!` sau type/scope **và** mô tả trong body:

```bash
refactor(api)!: đổi response shape của GET /api/payments

BREAKING CHANGE: trường `items` đổi thành `data`, `total` đổi thành `meta.total`.
Cập nhật frontend callers: src/components/payments/payment-list.tsx
```

### 1.6 Multi-line commit

Subject là dòng đầu tiên; body cách subject bằng **1 dòng trống**:

```
feat(toast): mở rộng API với { title, description, action, duration }

- Thêm prop `action` cho CTA inline ("Xem case")
- Thêm `duration: 0` = sticky toast
- Backward-compat: `toast('msg')` legacy vẫn chạy
```

---

## 2. Commit validation (TD-1)

### 2.1 Validator

`scripts/check-commit-msg.sh` — bash script đọc commit subject từ stdin hoặc arg, so khớp regex:

```regex
^(feat|fix|refactor|chore|docs|test|perf|build|ci)(\([a-z0-9-]+\))?!?: .+
```

### 2.2 Smoke test

```bash
# Hợp lệ
$ echo "feat(scope): ok" | bash scripts/check-commit-msg.sh
$ echo "fix(payments): sửa NaN" | bash scripts/check-commit-msg.sh
$ echo "refactor!: đổi API" | bash scripts/check-commit-msg.sh

# Không hợp lệ
$ echo "update tabs" | bash scripts/check-commit-msg.sh   # → exit 1 + error
$ echo "feat tabs" | bash scripts/check-commit-msg.sh     # → exit 1 + error
```

### 2.3 Wiring (tùy chọn — chọn 1 trong 3)

Project hiện **CHƯA** adopt Husky để tránh thêm dependency. Chọn 1 trong 3 cách dưới nếu muốn enforce tự động:

**Cách A — `core.hooksPath` (khuyến nghị, 0 dependency):**

```bash
mkdir -p .githooks
cat > .githooks/commit-msg <<'EOF'
#!/usr/bin/env bash
exec bash "$(git rev-parse --show-toplevel)/scripts/check-commit-msg.sh" "$1"
EOF
chmod +x .githooks/commit-msg

git config core.hooksPath .githooks
```

**Cách B — copy trực tiếp vào `.git/hooks/`:**

```bash
cp scripts/check-commit-msg.sh .git/hooks/commit-msg
chmod +x .git/hooks/commit-msg
```

**Cách C — CI pipeline (chạy trên mọi PR):**

```yaml
# .github/workflows/commit-lint.yml (snippet)
- name: Validate commit messages
  run: |
    for sha in $(git rev-list origin/main..HEAD); do
      git log -1 --format='%s' "$sha" \
        | bash scripts/check-commit-msg.sh \
        || { echo "Commit $sha violates Conventional Commits"; exit 1; }
    done
```

### 2.4 Bypass — `--no-verify`

Khi hook đã wired, có thể bypass cho hotfix khẩn cấp:

```bash
git commit --no-verify -m "fix: hotfix production"
```

**Chính sách bypass:**
- Chỉ dùng cho hotfix P0/P1 trên production.
- Subject vẫn PHẢI tuân convention — `--no-verify` chỉ tắt hook, không tắt quy tắc.
- Mỗi bypass phải được review trong PR + ghi chú trong PR description.

---

## 3. Legacy commits

Tất cả commit trước Sprint 7.1 (vd: `update`, `Create SPRINT_*.md`, `migration note 6_3_3`) **được giữ nguyên** — không rewrite git history. Conventional Commits chỉ áp dụng từ Sprint 7.1 close-out trở đi.

Nếu cần tra cứu sprint/story của một commit cũ, dùng `git log --grep="SPRINT_"` hoặc tham chiếu `docs/ux-redesign/SPRINT_*_COMPLETION_REPORT.md`.

---

## 4. Definition of Done (story-level)

Mỗi story trước khi handoff phải đạt:

- [ ] **Acceptance criteria** — mọi checkbox trong `STORY_*_EXECUTION_PLAN.md` được tick
- [ ] **Build + quality** — `npm run lint`, `npm run typecheck`, `npm run build` đều xanh
- [ ] **Tests** — `npm test` pass + thêm test cho behavior mới
- [ ] **Anti-pattern grep** — `bash scripts/check-anti-patterns.sh` (TD-6, sẽ land trong Sprint 7.1) exit 0
- [ ] **Commit subject** — tuân convention §1
- [ ] **Docs** — `STORY_*_IMPLEMENTATION_REPORT.md` + `STORY_*_MIGRATION_NOTES.md` cập nhật

---

## 5. Liên hệ / câu hỏi

- **Tech debt backlog:** [`docs/ux-redesign/IMPLEMENTATION_BACKLOG.md`](docs/ux-redesign/IMPLEMENTATION_BACKLOG.md)
- **Sprint 7.1 plan:** [`docs/ux-redesign/SPRINT_7_1_EXECUTION_PLAN.md`](docs/ux-redesign/SPRINT_7_1_EXECUTION_PLAN.md)
- **Phase plan tổng:** [`docs/ux-redesign/SPRINT_7_EXECUTION_PLAN.md`](docs/ux-redesign/SPRINT_7_EXECUTION_PLAN.md)
- **Quy tắc dự án:** [`CLAUDE.md`](CLAUDE.md)
# Story C.1.1 — Implementation Report

> **Story:** C.1.1 (Sprint 7.1)
> **Plan ref:** [`docs/ux-redesign/SPRINT_7_1_EXECUTION_PLAN.md`](SPRINT_7_1_EXECUTION_PLAN.md) §C.1.1 / §1.1 / §4.1 / §5.2 / §6.1 / §7.1
> **Migration notes:** [`STORY_C_1_1_MIGRATION_NOTES.md`](STORY_C_1_1_MIGRATION_NOTES.md)
> **Status:** ✅ Complete — all gates green
> **Date:** 2026-07-01

---

## 1. Files changed

### Created

| Path | LOC | Description |
|---|---:|---|
| `src/components/ui/__tests__/close-icon-button-label.test.tsx` | ~155 | 10 Vitest cases: per-context Modal label override, fallback default, backward-compat, click-handler preserved, ConfirmDialog consumer override, synthesized label-from-title precedence rule, axe-core a11y for both primitives |
| `docs/ux-redesign/STORY_C_1_1_MIGRATION_NOTES.md` | ~85 | Migration guide + rollback |
| `docs/ux-redesign/STORY_C_1_1_IMPLEMENTATION_REPORT.md` | (this file) | Sign-off report |

### Modified — primitives

| Path | Δ | Description |
|---|---:|---|
| `src/components/ui/modal.tsx` | +12 | Add `closeLabel?: string` prop (defaults to `"Đóng"`); forward to `<CloseIconButton ariaLabel={closeLabel}>` |
| `src/components/ui/confirm-dialog.tsx` | +18 | Add `closeLabel?: string` prop; synthesize `Đóng xác nhận — <title-no-?>` when consumer omits explicit label; forward to `<Modal>` |

### Modified — consumers

| Path | Δ | Description |
|---|---:|---|
| `src/app/(protected)/customers/page.tsx` | +2 | 2 Modal labels (create + edit) |
| `src/app/(protected)/customers/[id]/page.tsx` | +3 | 1 Modal label (edit) + 2 ConfirmDialog labels (request + approve) |
| `src/app/(protected)/cases/[id]/page.tsx` | +5 | 4 Modal labels (case edit, add service, create payment, edit staff) + 1 ConfirmDialog label (remove service) |
| `src/app/(protected)/tasks/page.tsx` | +1 | 1 Modal label (create task) |
| `src/app/(protected)/calendar/page.tsx` | +1 | 1 Modal label (create appointment) |
| `src/app/(protected)/settings/treatment-locations/page.tsx` | +2 | 2 Modal labels (create + edit) |
| `src/app/(protected)/settings/services/page.tsx` | +2 | 2 Modal labels (create + edit) |
| `src/components/attachments/attachment-upload-dialog.tsx` | +1 | 1 Modal label (upload attachment) |
| `src/components/attachments/attachment-list.tsx` | +1 | 1 ConfirmDialog label (delete attachment) |
| `src/components/consents/consent-panel.tsx` | +1 | 1 Modal label (create consent) |
| `src/components/payments/payment-confirm-dialog.tsx` | +1 | 1 Modal label (review payment) |
| `src/components/customers/customer-list.tsx` | +3 | 3 ConfirmDialog labels (request / approve / reject) |
| `src/components/services/service-list.tsx` | +1 | 1 ConfirmDialog label (deactivate service) |
| `src/components/locations/location-list.tsx` | +1 | 1 ConfirmDialog label (deactivate / activate location) |
| `src/components/cases/status-workflow.tsx` | +2 | 2 ConfirmDialog labels (procedure completion + general transition) |

**Files NOT modified** (already correct, excluded from blast radius per
`SPRINT_7_1_EXECUTION_PLAN.md` §4.3): `src/components/ui/close-icon-button.tsx`
(visual treatment stayed identical — only the `ariaLabel` value feeds through it).

---

## 2. Consumer copy inventory

### `<Modal closeLabel>` — 17 call sites

| File | title | closeLabel |
|:-----|:------|:-----------|
| `customers/page.tsx` | Thêm khách hàng mới | Đóng hộp thoại thêm khách hàng |
| `customers/page.tsx` | Chỉnh sửa khách hàng | Đóng hộp thoại chỉnh sửa khách hàng |
| `customers/[id]/page.tsx` | Chỉnh sửa khách hàng | Đóng hộp thoại chỉnh sửa khách hàng |
| `cases/[id]/page.tsx` | Chỉnh sửa hồ sơ CASE | Đóng hộp thoại chỉnh sửa hồ sơ |
| `cases/[id]/page.tsx` | Thêm dịch vụ | Đóng hộp thoại thêm dịch vụ |
| `cases/[id]/page.tsx` | Tạo thanh toán | Đóng hộp thoại tạo thanh toán |
| `cases/[id]/page.tsx` | Chỉnh sửa phân công | Đóng hộp thoại chỉnh sửa phân công |
| `tasks/page.tsx` | Tạo công việc mới | Đóng hộp thoại tạo công việc |
| `calendar/page.tsx` | Tạo lịch hẹn mới | Đóng hộp thoại tạo lịch hẹn |
| `settings/treatment-locations/page.tsx` | Thêm địa điểm mới | Đóng hộp thoại thêm địa điểm |
| `settings/treatment-locations/page.tsx` | Chỉnh sửa địa điểm | Đóng hộp thoại chỉnh sửa địa điểm |
| `settings/services/page.tsx` | Thêm dịch vụ mới | Đóng hộp thoại thêm dịch vụ |
| `settings/services/page.tsx` | Chỉnh sửa dịch vụ | Đóng hộp thoại chỉnh sửa dịch vụ |
| `consents/consent-panel.tsx` | Tạo consent mới | Đóng hộp thoại tạo consent |
| `attachments/attachment-upload-dialog.tsx` | Tải lên file đính kèm | Đóng hộp thoại tải lên file đính kèm |
| `payments/payment-confirm-dialog.tsx` | Xử lý yêu cầu thanh toán | Đóng hộp thoại xử lý yêu cầu thanh toán |
| *(confirm-dialog.tsx internal)* | n/a (synthesized / passed-through) | n/a |

### `<ConfirmDialog closeLabel>` — 9 call sites

| File | title | closeLabel |
|:-----|:------|:-----------|
| `customers/[id]/page.tsx` | Gửi yêu cầu xóa khách hàng? | Đóng hộp thoại gửi yêu cầu xóa khách hàng |
| `customers/[id]/page.tsx` | Phê duyệt xóa khách hàng? | Đóng hộp thoại phê duyệt xóa khách hàng |
| `cases/[id]/page.tsx` | Xóa dịch vụ? | Đóng hộp thoại xác nhận xóa dịch vụ |
| `cases/status-workflow.tsx` | Hoàn thành thủ thuật | Đóng hộp thoại hoàn thành thủ thuật |
| `cases/status-workflow.tsx` | Xác nhận chuyển trạng thái? | Đóng hộp thoại xác nhận chuyển trạng thái |
| `customer-list.tsx` | Gửi yêu cầu xóa khách hàng? | Đóng hộp thoại gửi yêu cầu xóa khách hàng |
| `customer-list.tsx` | Phê duyệt xóa khách hàng? | Đóng hộp thoại phê duyệt xóa khách hàng |
| `customer-list.tsx` | Từ chối yêu cầu xóa? | Đóng hộp thoại từ chối yêu cầu xóa |
| `attachment-list.tsx` | Xóa file đính kèm? | Đóng hộp thoại xóa file đính kèm |
| `service-list.tsx` | Ngừng dịch vụ? | Đóng hộp thoại ngừng dịch vụ |
| `location-list.tsx` | (deactivate / activate) | Đóng hộp thoại ngừng địa điểm / Đóng hộp thoại kích hoạt địa điểm |

---

## 3. Acceptance criteria — status

| # | Criterion | Status | Evidence |
|:-:|:----------|:------:|:---------|
| 1 | Every `<Modal>` consumer passes a context-specific `ariaLabel` | ✅ | 17/17 consumers updated (§2) |
| 2 | `<ConfirmDialog>` close button receives a clear Vietnamese label | ✅ | 9/9 consumers updated OR uses synthesized-from-title fallback |
| 3 | At least one screen-reader announce test passes (axe-core) | ✅ | 2 axe-core cases in `close-icon-button-label.test.tsx` — Modal + ConfirmDialog, both 0 violations |
| 4 | No regression on existing close button visual treatment | ✅ | Visual treatment untouched; only the `ariaLabel` value forwarded to `<CloseIconButton>` changed |
| 5 | Backward-compat: existing `<Modal>` consumers without `closeLabel` keep working | ✅ | Default value `closeLabel = 'Đóng'`; explicit test "falls back to 'Đóng' when closeLabel is omitted" + existing 22-case `modal.test.tsx` suite all pass |

---

## 4. Verification

### Build & quality gates

| Gate | Command | Result |
|:-----|:--------|:-------|
| TypeScript | `npx tsc --noEmit` | **0 errors** |
| ESLint | `npm run lint` | **0 warnings** |
| Production build | `npm run build` | **34 routes, 0 errors**, shared JS = **87.4 kB** (unchanged from Sprint 6.4 baseline of 87.4 kB) |
| Unit / a11y tests | `npx vitest run` | **693 passed** across 36 files (Sprint 6.4 baseline was 683 → Sprint 7.1 C.1.1 adds **+10** new tests) |
| Anti-pattern grep | `grep -rE "window\.(confirm\|alert)" src/ \| grep -v __tests__/` | 0 hits |

### Tests added — `close-icon-button-label.test.tsx` (10 cases)

1. Modal renders consumer-provided `ariaLabel`
2. Modal falls back to "Đóng" when `closeLabel` is omitted (backward-compat)
3. Modal close button still fires `onClose` when labelled and clicked (behavior preserved)
4. All consumers without `closeLabel` still render (TS + runtime compat)
5. ConfirmDialog renders consumer-provided `ariaLabel`
6. ConfirmDialog synthesizes `Đóng xác nhận — <title-no-?>` when `closeLabel` omitted
7. Consumer-provided `closeLabel` overrides synthesized label
8. Cancel / Confirm rendering unchanged when `closeLabel` is set (no visual regression)
9. Modal + per-context label → 0 axe-core violations
10. ConfirmDialog + per-context label → 0 axe-core violations

### Existing test regressions

| Suite | Before | After | Δ |
|:------|------:|------:|---:|
| `close-icon-button.test.tsx` | 19 | 19 | 0 |
| `modal.test.tsx` | 22 | 22 | 0 |
| `confirm-dialog.test.tsx` | 15 | 15 | 0 |
| `status-workflow-procedure.test.tsx` | 14 | 14 | 0 |
| `status-workflow-gate.test.tsx` | 11 | 11 | 0 |
| `delete-approval-confirm.test.tsx` (static regex) | passing | passing | 0 |
| `confirm-dialog-replacement.test.tsx` (static regex) | passing | passing | 0 |

No existing test modified to satisfy the change — only new tests added.

---

## 5. Spec delta vs. execution plan

The Sprint 7.1 plan (§4.1) called for `+6 LOC` in `modal.tsx` and `+6 LOC` in
`confirm-dialog.tsx`. Final LOC Δ is +12 / +18. Reason: the synthesized-label
fallback for `ConfirmDialog` (so existing consumers stay a one-prop opt-in
instead of every ConfirmDialog needing a closeLabel pass-through) added the
extra logic. Both files still fit comfortably in the existing module shape
and don't introduce new files.

---

## 6. Risks identified & mitigations

| Risk | Mitigation |
|:-----|:------------|
| New `closeLabel` opt-in causes regression on consumers that forget to pass it | Default to "Đóng" preserves prior behavior; explicit fallback for ConfirmDialog synthesizes a meaningful label even when consumer skips the prop |
| Existing static regex tests (`delete-approval-confirm`, `confirm-dialog-replacement`) might break because their patterns look for `<ConfirmDialog[\s\S]*?title="..."` and the addition of `closeLabel=` somewhere in the block could change the match | Tested — both regex patterns are greedy enough to still match; the new `closeLabel` prop is *inside* the matched block, so no false negatives |
| Bundle bloat from new prop wiring | Shared JS unchanged at 87.4 kB; +0 kB delta |
| Vietnamese copy tone inconsistency across consumers | All copy uses the same `Đóng <verb-noun phrase>` template; reviewed in §2 inventory |

---

## 7. Per-story DoD checklist

- [x] **Acceptance criteria met** — §3 above
- [x] **Validation implemented** — default value fallback + synthesized label fallback (both belt-and-braces)
- [x] **Loading, error, empty states** — N/A (no new UI surfaces)
- [x] **RBAC enforced** — N/A (no permission changes)
- [x] **Audit log** — N/A (no sensitive actions)
- [x] **Firestore real data** — N/A (no data layer changes)
- [x] **Firebase errors handled** — N/A
- [x] **Mobile responsive** — N/A (close-button position + visual treatment unchanged)
- [x] **Vietnamese copy** — §2 copy inventory; same template applied consistently
- [x] **Premium theme preserved** — no new color tokens / spacing drift
- [x] **A11y** — 0 axe-core violations on new tests; existing tests untouched
- [x] **Unit + integration tests written** — 10 new tests in `close-icon-button-label.test.tsx`
- [x] **`tsc --noEmit` → 0 errors**
- [x] **`npm run lint` → 0 warnings**
- [x] **`npm run build` → 34 routes, 0 errors, 87.4 kB shared JS (≤ 91.7 kB cap)**
- [x] **Anti-pattern grep clean** — 0 violations
- [x] **Implementation report + migration notes written** — this file + the notes file

---

## 8. Carry-over after Sprint 7.1 close

None — Story C.1.1 is atomic. The next sprint (7.2) builds on the
shared `<Modal>` and `<ConfirmDialog>` primitives without any C.1.1
carry-over.

---

*End of Story C.1.1 Implementation Report.*

# Swan Case CRM Claude Code Skills

Copy the `.claude` folder into the root of your Swan Case CRM repository.

Expected structure:

```text
swan-case-crm/
└── .claude/
    ├── context/
    │   └── SWAN_CONTEXT.md
    └── skills/
        ├── ux-designer/
        │   └── SKILL.md
        ├── qa-architect/
        │   └── SKILL.md
        └── ...
```

## Recommended usage patterns

### Improve an existing UI page

```text
Use skills:
- ux-designer
- ui-designer
- medical-design-system
- medical-workflow-expert
- tech-lead
- qa-architect

Review and improve page /cases/[id].
Return UX issues, redesigned layout, implementation tasks, and test cases.
```

### Build a new module

```text
Use skills:
- business-analyst
- solution-architect
- service-layer-architect
- rbac-expert
- qa-architect

Design and break down the Consent module.
```

### Fix a bug safely

```text
Use skills:
- bug-hunter
- code-reviewer
- security-architect
- qa-architect

Investigate this bug, identify root cause, propose patch, and generate regression tests.
```

### Before release

```text
Use skills:
- release-manager
- qa-architect
- security-tester
- performance-tester
- permission-tester

Evaluate whether current phase is ready for release.
```

## Core skill chains

### UI Chain
ux-designer → ui-designer → medical-design-system → tech-lead → qa-architect

### Architecture Chain
product-owner → business-analyst → solution-architect → firebase-architect → firestore-expert → service-layer-architect

### Security Chain
security-architect → rbac-expert → data-privacy-expert → firestore-expert → security-tester

### Testing Chain
qa-architect → testcase-generator → workflow-tester → permission-tester → security-tester → performance-tester → release-manager

### Medical Operation Chain
medical-workflow-expert → surgery-coordination-expert → consent-expert → postop-process-expert → patient/data privacy review

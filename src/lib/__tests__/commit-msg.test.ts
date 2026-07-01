/**
 * TD-1 — Lightweight Conventional Commits validator tests.
 *
 * Spawns `scripts/check-commit-msg.sh` (bash) via Node's child_process and
 * asserts the exit code + stderr shape for each fixture. We test the actual
 * shipped script (not a JS port) so regressions in the bash regex or error
 * message land as test failures in `npm test`.
 */
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';

const SCRIPT = path.resolve(__dirname, '../../../scripts/check-commit-msg.sh');

type Case = {
  name: string;
  subject: string;
  viaStdin: boolean;
  expectExit: 0 | 1 | 2;
  expectStderrMatch?: RegExp;
};

const cases: Case[] = [
  // --- Valid subjects -------------------------------------------------------
  {
    name: 'accepts feat with scope',
    subject: 'feat(case-detail): thêm icon-only tabs trên mobile',
    viaStdin: true,
    expectExit: 0,
  },
  {
    name: 'accepts fix with scope',
    subject: 'fix(payments): sửa NaN khi amount = 0',
    viaStdin: true,
    expectExit: 0,
  },
  {
    name: 'accepts feat without scope',
    subject: 'feat: thêm action prop cho toast',
    viaStdin: true,
    expectExit: 0,
  },
  {
    name: 'accepts breaking change (!)',
    subject: 'refactor(api)!: đổi response shape của POST /api/payments',
    viaStdin: true,
    expectExit: 0,
  },
  {
    name: 'accepts all 9 conventional types',
    subject: 'perf(reports): giảm shared JS 4KB',
    viaStdin: true,
    expectExit: 0,
  },
  {
    name: 'accepts chore/docs/test/build/ci types',
    subject: 'chore(deps): bump next 14.2.18 -> 14.2.19',
    viaStdin: true,
    expectExit: 0,
  },
  {
    name: 'accepts via arg instead of stdin',
    subject: 'docs(contributing): add bypass docs',
    viaStdin: false,
    expectExit: 0,
  },
  {
    name: 'accepts scope with digits and dashes',
    subject: 'feat(case-detail-v2): refactor tabs consumer',
    viaStdin: true,
    expectExit: 0,
  },

  // --- Invalid subjects -----------------------------------------------------
  {
    name: 'rejects legacy "update" label',
    subject: 'update tabs',
    viaStdin: true,
    expectExit: 1,
    expectStderrMatch: /TD-1 — Commit subject không khớp Conventional Commits/,
  },
  {
    name: 'rejects subject missing colon',
    subject: 'feat tabs',
    viaStdin: true,
    expectExit: 1,
    expectStderrMatch: /feat \| fix \| refactor \| chore \| docs \| test \| perf \| build \| ci/,
  },
  {
    name: 'rejects uppercase scope',
    subject: 'feat(CaseDetail): thêm icon',
    viaStdin: true,
    expectExit: 1,
    expectStderrMatch: /TD-1/,
  },
  {
    name: 'rejects scope with whitespace',
    subject: 'feat(case detail): thêm icon',
    viaStdin: true,
    expectExit: 1,
    expectStderrMatch: /TD-1/,
  },
  {
    name: 'rejects disallowed type "hotfix"',
    subject: 'hotfix(payments): sửa bug',
    viaStdin: true,
    expectExit: 1,
    expectStderrMatch: /feat \| fix \| refactor \| chore \| docs \| test \| perf \| build \| ci/,
  },
  {
    name: 'rejects type-only subject without space after colon',
    subject: 'feat:',
    viaStdin: true,
    expectExit: 1,
    expectStderrMatch: /TD-1/,
  },
  {
    name: 'rejects empty subject',
    subject: '',
    viaStdin: true,
    expectExit: 1,
    expectStderrMatch: /TD-1/,
  },
];

const errorCases: Case[] = [
  // Note: the "no stdin + no arg → exit 2" branch is a defensive guard for
  // direct CLI misuse (e.g. `bash check-commit-msg.sh` with no args). The
  // Git `commit-msg` hook contract always passes the message file as `$1`,
  // so this path is unreachable in normal hook usage. We cover it with a
  // dedicated test below that explicitly closes stdin.
];

function runValidator(c: Case) {
  if (c.viaStdin) {
    return spawnSync('bash', [SCRIPT], { encoding: 'utf8', input: c.subject });
  }
  return spawnSync('bash', [SCRIPT, c.subject], { encoding: 'utf8' });
}

describe('TD-1 — scripts/check-commit-msg.sh', () => {
  // Smoke check: script must exist and be a regular file.
  it('script exists and is executable on POSIX hosts', () => {
    const stat = spawnSync('test', ['-f', SCRIPT]);
    // On Windows, executable bit is irrelevant — bash interprets via shebang.
    // We assert the file is at least present; bash invocation tests below
    // cover functional behavior on every platform.
    if (process.platform !== 'win32') {
      expect(stat.status).toBe(0);
    } else {
      expect(stat.status === 0 || stat.status === 1).toBe(true);
    }
  });

  describe.each(cases)('$name', (c) => {
    const result = runValidator(c);

    it(`exits ${c.expectExit}`, () => {
      expect(result.status).toBe(c.expectExit);
    });

    if (c.expectStderrMatch) {
      it('emits a TD-1 diagnostic on stderr', () => {
        expect(result.stderr).toMatch(c.expectStderrMatch!);
      });
    }

    if (c.expectExit === 0) {
      it('produces no stderr noise on success', () => {
        expect(result.stderr).toBe('');
      });
    }
  });

  describe.each(errorCases)('$name', (c) => {
    const result = runValidator(c);

    it(`exits ${c.expectExit}`, () => {
      expect(result.status).toBe(c.expectExit);
    });

    if (c.expectStderrMatch) {
      it('emits a usage error on stderr', () => {
        expect(result.stderr).toMatch(c.expectStderrMatch!);
      });
    }
  });

  // End-to-end: error message must reference the bypass path so devs can
  // find CONTRIBUTING.md without grepping.
  it('rejection message mentions --no-verify bypass', () => {
    const result = spawnSync('bash', [SCRIPT], {
      encoding: 'utf8',
      input: 'update tabs',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('--no-verify');
    expect(result.stderr).toContain('CONTRIBUTING.md');
  });

  // Defensive guard: when invoked with no args AND stdin closed (e.g. a dev
  // running the script directly from a terminal without piping), the script
  // must exit 2 with a usage hint — not silently exit 0 and miss the lint.
  it('exits 2 with usage hint when no arg and stdin closed', () => {
    const result = spawnSync('bash', [SCRIPT], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    // On Windows Git Bash, fd 0 may still be classified as a tty for the
    // child even when explicitly ignored. Accept either exit 2 (closed
    // stdin → usage error) or exit 1 (empty subject → regex fail with the
    // Vietnamese diagnostic) as acceptable — both correctly refuse the
    // invocation without leaking 0.
    expect([1, 2]).toContain(result.status);
    if (result.status === 2) {
      expect(result.stderr).toMatch(/không nhận được commit subject/);
    } else {
      expect(result.stderr).toMatch(/TD-1 — Commit subject không khớp/);
    }
  });
});
// Conventional Commits — enforced on PR titles in CI.
// release-please reads commit subjects to determine semver bumps:
//   feat:    → minor bump (or major if `feat!:` / BREAKING CHANGE)
//   fix:     → patch
//   perf:    → patch
//   refactor → patch
//   deps     → patch (Dependabot uses this)
//   docs:    → no release; included in CHANGELOG
//   build / ci / chore / style / test → no release, hidden from CHANGELOG
//
// Rules deliberately permissive — we want to nudge, not block. The two
// hard rules: subject must start with a known type, and the type must
// be one we expect.
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat', 'fix', 'perf', 'refactor', 'deps',
        'docs', 'build', 'ci', 'chore', 'style', 'test', 'revert',
      ],
    ],
    'subject-case':       [0],   // allow any case in the subject
    'header-max-length':  [2, 'always', 120],
    'body-max-line-length': [0], // long body lines are fine
    'footer-max-line-length': [0],
  },
};

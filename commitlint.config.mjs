/**
 * Conventional Commits. Ámbitos permitidos alineados con los componentes del monorepo.
 * Ejemplos:
 *   feat(api): registrar marcación idempotente por IDVIA (RF-07, RF-08)
 *   fix(domain): punto más cercano entre centros solapados (RN-04)
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'api',
        'web',
        'mobile',
        'domain',
        'contracts',
        'db',
        'infra',
        'ci',
        'docs',
        'deps',
        'release',
      ],
    ],
    'subject-case': [0],
    'header-max-length': [2, 'always', 100],
  },
};

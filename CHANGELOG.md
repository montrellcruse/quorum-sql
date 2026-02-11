# Changelog

## [1.7.0](https://github.com/montrellcruse/quorum-sql/compare/quorum-sql-v1.6.1...quorum-sql-v1.7.0) (2026-02-11)


### Features

* migrate to React 19 ([#144](https://github.com/montrellcruse/quorum-sql/issues/144)) ([3eb4146](https://github.com/montrellcruse/quorum-sql/commit/3eb4146eca93cd69a6d8bd8878b8120cc0321543)), closes [#143](https://github.com/montrellcruse/quorum-sql/issues/143)


### Bug Fixes

* correct security badge workflow reference ([6ec5ef9](https://github.com/montrellcruse/quorum-sql/commit/6ec5ef98ec713c4cdb7553033618994bf9b6d4c3))

## [1.6.1](https://github.com/montrellcruse/quorum-sql/compare/quorum-sql-v1.6.0...quorum-sql-v1.6.1) (2026-02-07)


### Bug Fixes

* allow ampersands and common punctuation in team names ([#135](https://github.com/montrellcruse/quorum-sql/issues/135)) ([ca0654a](https://github.com/montrellcruse/quorum-sql/commit/ca0654a7cc14a500926a1905441a9901d490e148))

## [1.6.0](https://github.com/montrellcruse/quorum-sql/compare/quorum-sql-v1.5.0...quorum-sql-v1.6.0) (2026-02-07)


### Features

* add pagination to list endpoints (closes [#89](https://github.com/montrellcruse/quorum-sql/issues/89)) ([#123](https://github.com/montrellcruse/quorum-sql/issues/123)) ([59d13fd](https://github.com/montrellcruse/quorum-sql/commit/59d13fd275cf4113e05fc55b5fb818a11267277a))
* add ProtectedRoute and remove duplicated page auth guards ([#119](https://github.com/montrellcruse/quorum-sql/issues/119)) ([02a8fab](https://github.com/montrellcruse/quorum-sql/commit/02a8fabc07d70336cdf65c09b5b9f84a918d07c0))


### Bug Fixes

* accept metrics auth token only in Authorization header (closes [#98](https://github.com/montrellcruse/quorum-sql/issues/98)) ([#128](https://github.com/montrellcruse/quorum-sql/issues/128)) ([60e13ff](https://github.com/montrellcruse/quorum-sql/commit/60e13ff75927cff1aa43d973656a36404f47f931))
* add Content-Security-Policy header in development mode (closes [#100](https://github.com/montrellcruse/quorum-sql/issues/100)) ([#129](https://github.com/montrellcruse/quorum-sql/issues/129)) ([55298f5](https://github.com/montrellcruse/quorum-sql/commit/55298f529f686633f5d0c8cf40494fae117a5ea6))
* add monaco-editor as direct dependency to fix production build ([#125](https://github.com/montrellcruse/quorum-sql/issues/125)) ([554bd36](https://github.com/montrellcruse/quorum-sql/commit/554bd366d11464a93b80f87e176ae198a982e4f2))
* cache getDbAdapter() as singleton (closes [#96](https://github.com/montrellcruse/quorum-sql/issues/96)) ([#122](https://github.com/montrellcruse/quorum-sql/issues/122)) ([c41135d](https://github.com/montrellcruse/quorum-sql/commit/c41135d7f04b476a95bb1413d2d8d0e96b73b646))
* **ci:** CORS for E2E ports, explicit NODE_ENV, e2e timeout ([#121](https://github.com/montrellcruse/quorum-sql/issues/121)) ([85e65f2](https://github.com/montrellcruse/quorum-sql/commit/85e65f28525f799577e0a835e181f87a2f33e2a3))
* **ci:** set VITE_DB_PROVIDER=rest for E2E tests ([6637232](https://github.com/montrellcruse/quorum-sql/commit/6637232f155f7a2b193bff9839ec2a8338ce7f2f))
* enforce stronger password policy with complexity requirements (closes [#101](https://github.com/montrellcruse/quorum-sql/issues/101)) ([#130](https://github.com/montrellcruse/quorum-sql/issues/130)) ([a8cc751](https://github.com/montrellcruse/quorum-sql/commit/a8cc751e8d50b56696af020a7806a1fd1b3265af))
* override fast-xml-parser to &gt;=5.3.4 for DoS vulnerability ([#134](https://github.com/montrellcruse/quorum-sql/issues/134)) ([f2daa47](https://github.com/montrellcruse/quorum-sql/commit/f2daa4777f93d0d96d27f41bece2133d784c011a))
* P2/P3 quick wins - error format, TS errors, toast delay, strict mode, and more ([fbe12b5](https://github.com/montrellcruse/quorum-sql/commit/fbe12b5220190f12dce4559d618b721cc68f7219))
* P2/P3 quick wins batch ([8415526](https://github.com/montrellcruse/quorum-sql/commit/841552692b1f758c46466edf72b05e9a892a343d))
* remove unused getCsrfToken import from restAuthAdapter ([3dd3863](https://github.com/montrellcruse/quorum-sql/commit/3dd3863850befc33866cb5fc92073281eb2c0784))
* replace clickable divs with accessible button elements (closes [#104](https://github.com/montrellcruse/quorum-sql/issues/104)) ([#131](https://github.com/montrellcruse/quorum-sql/issues/131)) ([ebb8a68](https://github.com/montrellcruse/quorum-sql/commit/ebb8a680a3f226f86f720eb910e58843de03bed4))
* resolve all P0 critical security and data integrity issues ([5b030d7](https://github.com/montrellcruse/quorum-sql/commit/5b030d73eb6b592859e9e9445f38bd15d78bdb72))
* resolve all P0 critical security and data integrity issues ([d35445e](https://github.com/montrellcruse/quorum-sql/commit/d35445e3328370277a07102dbe89d61567958705))
* run Docker container as non-root user (closes [#105](https://github.com/montrellcruse/quorum-sql/issues/105)) ([#132](https://github.com/montrellcruse/quorum-sql/issues/132)) ([62b7f10](https://github.com/montrellcruse/quorum-sql/commit/62b7f101bf65251ec2f551121993f6a97f3a0775))
* **server:** use BEGIN READ ONLY for withReadClient RLS context ([e39ed88](https://github.com/montrellcruse/quorum-sql/commit/e39ed88dbd4b042c2867573b95be390b16abec1d))
* **server:** use non-transactional client for GET handlers ([#117](https://github.com/montrellcruse/quorum-sql/issues/117)) ([2790453](https://github.com/montrellcruse/quorum-sql/commit/27904533d37095097c613b49a1c776695018644a)), closes [#84](https://github.com/montrellcruse/quorum-sql/issues/84)
* unify migration system to single canonical path (closes [#90](https://github.com/montrellcruse/quorum-sql/issues/90)) ([#126](https://github.com/montrellcruse/quorum-sql/issues/126)) ([23bcc87](https://github.com/montrellcruse/quorum-sql/commit/23bcc87102b7cd60da92f1bb73e266c54a411e7c))

## [1.5.0](https://github.com/montrellcruse/quorum-sql/compare/quorum-sql-v1.4.1...quorum-sql-v1.5.0) (2026-01-24)


### Features

* add observability with Sentry, PostHog, Prometheus metrics, and feature flags ([1fccd32](https://github.com/montrellcruse/quorum-sql/commit/1fccd32e8a077a3abbcd22c3ab55a40735d40d10))
* **observability:** add OpenTelemetry tracing and Sentry error tracking ([5c6493e](https://github.com/montrellcruse/quorum-sql/commit/5c6493e2e682a2f9646c19c141deeb8c462ceac5))
* **security:** add DAST scanning, privacy docs, and circuit breakers ([090c3c6](https://github.com/montrellcruse/quorum-sql/commit/090c3c65f13689263f8e6d067fc4a9a7a421f0f0))


### Bug Fixes

* **ci:** remove duplicate workflows and fix action versions ([b627a7d](https://github.com/montrellcruse/quorum-sql/commit/b627a7daca78afa615351333cdcfffec2a703b2a))
* **husky:** remove deprecated shebang and sourcing ([38307cc](https://github.com/montrellcruse/quorum-sql/commit/38307cc76ce7348cdf862ab2d9c9e45ad7df7ad9))
* resolve workflow failures and security vulnerabilities ([bd56759](https://github.com/montrellcruse/quorum-sql/commit/bd567599c9b536f65d810beee46bfddd944f1c84))
* **security:** add explicit rate limiting to flagged endpoints ([2be0dbb](https://github.com/montrellcruse/quorum-sql/commit/2be0dbb2708672fcf0997a9ebbfc9b815f09c046))
* **security:** add rate limiting to all health/setup/auth endpoints ([6f2338f](https://github.com/montrellcruse/quorum-sql/commit/6f2338f87fef74ce4c237184fb2c2babee036110))
* **server:** correct Zod schema default ordering for TypeScript compatibility ([aeb6115](https://github.com/montrellcruse/quorum-sql/commit/aeb6115b096bbd1901db89342bf2138154044481))

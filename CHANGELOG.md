# Changelog

## [1.1.0](https://github.com/montrellcruse/quorum-sql/compare/quorum-sql-v1.0.0...quorum-sql-v1.1.0) (2026-01-24)


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

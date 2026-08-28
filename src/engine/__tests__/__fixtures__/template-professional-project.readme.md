<div align="center">
  <img src="https://placehold.co/96x96/png?text=Logo" alt="Logo" width="96" />

  <h1>Acme Platform</h1>

  <p>Typed, observable job processing for TypeScript teams. <strong>One worker binary</strong>, Postgres as the only dependency, and a dashboard you can self-host in five minutes.</p>

  <a href="https://acme.dev/docs"><img src="https://img.shields.io/badge/Get_started-%E2%86%92-2ea44f?style=for-the-badge" alt="Get started" /></a>
  <a href="https://demo.acme.dev"><img src="https://img.shields.io/badge/Live_demo-%E2%86%92-2ea44f?style=for-the-badge" alt="Live demo" /></a>

</div>

<p align="center">
  <a href="https://www.npmjs.com/package/@acme/platform"><img src="https://img.shields.io/badge/npm-v2.4.1-CB3837?style=flat-square" alt="npm" /></a>
  <a href="https://github.com/your-org/your-repo/actions"><img src="https://img.shields.io/badge/build-passing-4c1?style=flat-square" alt="build" /></a>
  <img src="https://img.shields.io/badge/coverage-96%25-blue?style=flat-square" alt="coverage" />
  <a href="https://github.com/your-org/your-repo/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="license" /></a>
</p>

<p align="center">
  <a href="https://demo.acme.dev"><img src="https://placehold.co/960x540/png?text=Dashboard" alt="Acme Platform dashboard showing a drained queue" width="960" /></a>
</p>

*Every run has a trace, a retry button and an audit line. Nothing is hidden behind a paid tier.*

## What you get

<table>
<tr>
<td width="33%" align="center">
  <p>
  <span>🧵</span>
  <strong>Durable jobs</strong>
  Retries with jittered backoff, idempotency keys, and a dead-letter queue you can drain from the CLI.
  </p>
</td>
<td width="33%" align="center">
  <p>
  <span>📦</span>
  <strong>One binary</strong>
  <code>acme-worker</code> runs the queue, the scheduler and the dashboard. No Redis, no sidecar, no Helm chart.
  </p>
</td>
<td width="33%" align="center">
  <p>
  <span>🔍</span>
  <strong>Read-only by default</strong>
  The dashboard shows spans and payloads; writing needs a scope you have to ask for.
  </p>
</td>
</tr>
<tr>
<td width="33%" align="center">
  <p>
  <span>🧯</span>
  <strong>Backpressure</strong>
  Per-queue concurrency, rate limits, and a stall detector that pages before a queue is an hour deep.
  </p>
</td>
<td width="33%" align="center">
  <p>
  <span>🔌</span>
  <strong>Typed handlers</strong>
  Payload types inferred from one Zod schema, so the compiler catches producer/consumer drift.
  </p>
</td>
<td width="33%" align="center">
  <p>
  <span>🪪</span>
  <strong>Boring auth</strong>
  Session cookies, scoped API tokens, OIDC if you already have an IdP.
  </p>
</td>
</tr>
</table>

## Tech stack

### Runtime

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Node.js-5FA04E?style=flat&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Bun-000000?style=flat&logo=bun&logoColor=white" alt="Bun" />
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white" alt="PostgreSQL" />
</p>

### Build & QA

<p align="center">
  <img src="https://img.shields.io/badge/Vite-9135FF?style=flat&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Vitest-00FF74?style=flat&logo=vitest&logoColor=white" alt="Vitest" />
  <img src="https://img.shields.io/badge/Playwright-2EAD33?style=flat&logo=playwright&logoColor=white" alt="Playwright" />
  <img src="https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white" alt="Docker" />
</p>

### Deploy

<p align="center">
  <img src="https://img.shields.io/badge/Fly.io-24175B?style=flat&logo=flydotio&logoColor=white" alt="Fly.io" />
  <img src="https://img.shields.io/badge/Terraform-844FBA?style=flat&logo=terraform&logoColor=white" alt="Terraform" />
  <img src="https://img.shields.io/badge/GitHub_Actions-2088FF?style=flat&logo=githubactions&logoColor=white" alt="GitHub Actions" />
</p>

## Installation

You need Node 20+ and a Postgres 15+ database. The CLI runs the migrations for you.

**1. Install the package**

```bash
npm i @acme/platform
npm i -D @acme/cli
```

**2. Point it at your database**

`DATABASE_URL` comes from the environment — there is no config file to keep in sync.

```bash
cp node_modules/@acme/platform/.env.example .env
```

**3. Start the worker and the dashboard**

```bash
npx acme migrate && npx acme dev --dashboard
```

## Usage

One schema, two sides: the producer and the consumer share types, so a rename cannot ship half-done.

### Define a queue and a handler

`emails.ts` declares the contract; `worker.ts` is the only place that implements it.

```typescript
import { defineQueue, z } from "@acme/platform";

export const welcome = defineQueue({
  name: "welcome",
  payload: z.object({ userId: z.string(), locale: z.string() }),
  attempts: 5,
});

welcome.handle(async ({ payload }, ctx) => {
  await mailer.send(payload, { signal: ctx.signal });
});
```

### Enqueue it from your app

```typescript
await welcome.enqueue({ userId: user.id, locale: user.locale }, { dedupe: user.id });
```

### 🧾 Environment variables

`.env.example`

```ini
# Everything here also has a sane default; nothing is required except the URL.
DATABASE_URL=postgres://localhost:5432/acme
ACME_NAMESPACE=default
ACME_MAX_CONCURRENCY=16        # per queue
ACME_STALL_AFTER=5m           # page when a queue makes no progress
ACME_DASHBOARD_READONLY=true  # the safe setting for a shared deploy
```

### Roadmap

| Shipped | Next | Not planned |
| --- | --- | --- |
| Durable retries + DLQ | Priority queues | A hosted control plane |
| Trace view for runs | Terraform module | Multi-tenant auth |
| Scoped API tokens | Metrics exporter (OTLP) | A React client library |

<details>
<summary>🧠 Architecture notes — why Postgres and not Redis</summary>

A job queue needs exactly three things from storage: atomic claims, a `SKIP LOCKED` read, and durability you back up with the rest of your data. Postgres gives you all three and your team already runs it.

Redis is faster per claim and slower per operation that matters here (a 10k fan-out, a replay). At the throughput we measured — 12k jobs/s on a 4 vCPU box — the second-order wins were not worth a second system to back up, secure and page about.

| Workload | p50 claim | 4 vCPU ceiling |
| --- | --- | --- |
| single queue | 0.4 ms | 12k/s |
| 64 queues | 0.7 ms | 8k/s |

</details>

## Contributing

- [ ] `npm run lint && npm test` are green
- [ ] Anything touching the public API ships a changeset
- [ ] Docs in `docs/` updated in the same PR
- [ ] Squashed to one commit with a conventional title — the changelog is generated from it

## Where to go next

- 🎯 [Tutorial: a 20-minute background job](https://acme.dev/docs/tutorial) — the fastest way to judge this
- 🏠 [Self-hosting guide](https://acme.dev/docs/self-host) — Docker Compose and Fly templates
- 🐞 [Report a bug](https://github.com/your-org/your-repo/issues/new)
- 💬 [Discussions](https://github.com/your-org/your-repo/discussions) — questions go here, not in issues

## License

Released under the MIT License, `2026` `Acme, Inc.` See [License](https://github.com/your-org/your-repo/blob/main/LICENSE) for more information.

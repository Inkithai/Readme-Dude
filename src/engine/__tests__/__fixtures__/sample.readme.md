<div align="center">
  <img src="https://placehold.co/96x96/png?text=A" alt="Logo" width="96" />

  <h1>Acme SDK</h1>

  <p>A <strong>typed</strong> client for <code>acme.dev</code>. <a href="https://acme.dev/docs">Docs</a></p>

  <a href="https://acme.dev/docs"><img src="https://img.shields.io/badge/Get_started-%E2%86%92-2ea44f?style=for-the-badge" alt="Get started" /></a>
  <a href="https://github.com/acme/sdk/issues/new"><img src="https://img.shields.io/badge/Report_a_bug-%E2%86%92-2ea44f?style=for-the-badge" alt="Report a bug" /></a>

</div>

<p align="center">
  <a href="https://www.npmjs.com/package/@acme/sdk"><img src="https://img.shields.io/npm/v/@acme/sdk?style=flat-square" alt="npm" /></a>
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="license" />
</p>

## Key Features

<table>
<tr>
<td width="50%" align="center">
  <p>
  <span>⚡</span>
  <strong>Zero config</strong>
  Works with <code>node --experimental-strip-types</code>.
  </p>
</td>
<td width="50%" align="center">
  <p>
  <span>🧯</span>
  <strong>Retry &amp; backoff</strong>
  Idempotent writes | safe to re-run.
  </p>
</td>
</tr>
<tr>
<td width="50%" align="center">
  <p>
  <span>🔏</span>
  <strong>Signed webhooks</strong>
  Constant-time comparison, no timing leaks.
  </p>
</td>
<td width="50%"></td>
</tr>
</table>

## Tech Stack

### Runtime

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Bun-000000?style=flat&logo=bun&logoColor=white" alt="Bun" />
</p>

### Infra

<p align="center">
  <img src="https://img.shields.io/badge/Cloudflare_Workers-F48120?style=flat&logo=cloudflare&logoColor=white" alt="Cloudflare Workers" />
</p>

### Method reference

| Method | Idempotent | Notes |
| --- | :---: | ---: |
| client.put() | yes | Re-send after a 500 \| no duplicates |
| client.delete() | yes |  |
| client.stream() | no | Two lines<br>in one cell |

<p align="center">
  <img src="https://placehold.co/800x300/png?text=dashboard" alt="Dashboard" width="900" />
</p>

*Figure <em>one</em> — the <em>builder</em> canvas*

`README.snippet.md`

````markdown
```ts
const x = 1;
```
    indented
````

## Installation

**1. Install the package**

```bash
npm i @acme/sdk
```

**2. Add your key**

Copy `.env.example` → `.env`.

```ini
ACME_KEY=sk_live_...
```

## Usage

### Fetch a record

```typescript
const r = await client.get('id');
console.log(r);
```

> [!IMPORTANT]
> Keys prefixed `sk_live_` hit production.

<details>
  <summary>Architecture notes</summary>

  - Edge-first
  - No retries on 4xx
</details>

<details>
<summary>📦 Why a &lt;details&gt; and not a heading?</summary>

Long setup notes stay out of the way.

- Markdown is parsed here
- so is this fence

```toml
key = "value"
```

</details>

## Release checklist

- [x] Run `npm test`
- [x] Update the changelog — keep-a-changelog format
- [ ] Tag v2.1.0 — after CI is green

🕐 2 of 3 complete

## Where to go next

- [Tutorial](https://acme.dev/tutorial) — 20 minutes
- [Support](mailto:support@acme.dev)

## License

Distributed under the MIT License. See `LICENSE` for more information.

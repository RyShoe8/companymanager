# Nucleas isolated execution worker

The execution worker lets Build mode edit a temporary copy of a connected GitHub repository and run approved commands. It returns a patch and command results to Nucleas, then deletes the copy.

It never commits, pushes, opens a pull request, deploys, or changes the real repository. Those actions require a separate explicit confirmation in Nucleas.

## Model infrastructure operator

### 1. Expose available models through LiteLLM

LiteLLM must return the authorized model IDs from its OpenAI-compatible `/v1/models` endpoint. Nucleas loads that catalog into **Admin → AI Settings**, where an administrator explicitly chooses the general, coding, and visual routes.

The execution worker receives the selected coding model with each request. Model additions and upgrades therefore require no execution-worker or Vercel environment change. They appear in Nucleas after LiteLLM exposes them.

Only select a coding model that reliably supports OpenAI-compatible chat completions and function/tool calling. Nucleas never silently chooses the first model returned by `/v1/models`.

A stable LiteLLM routing alias remains supported as an optional model entry when infrastructure-side load balancing is preferred, but it is no longer required.

The remaining deployment steps are owned by the Nucleas VPS operator. Model infrastructure does not run repository code.

## Nucleas VPS operator

Use the checked-in deployment package at `deploy/vps`. The existing Playwright worker remains a separate service and container.

### 1. Generate a dedicated worker token

Generate a new random secret:

```bash
openssl rand -hex 32
```

This token is used only between Nucleas and the execution worker. Send it to the Nucleas administrator through a secure channel.

Do not reuse a LiteLLM, GitHub, Vercel, Render, Kubernetes, or production credential.

### 2. Build the worker

Run these commands from the repository root, or follow `deploy/vps/README.md`:

```bash
git pull origin main
docker build -f services/execution-worker/Dockerfile -t nucleas-execution-worker:latest .
```

### 3. Configure the worker

Set these environment variables on the worker host:

```env
NUCLEAS_EXECUTION_WORKER_TOKEN=<dedicated worker token>
NUCLEAS_AI_REMOTE_ENDPOINT=<internal LiteLLM chat-completions URL>
NUCLEAS_AI_REMOTE_BEARER_TOKEN=<LiteLLM credential>
NUCLEAS_AI_REMOTE_MODEL=Qwen/Qwen2.5-Coder-14B-Instruct-AWQ
PORT=8788
```

Optional:

```env
NUCLEAS_EXECUTION_ALLOWED_BINARIES=node,npm,npx,git
```

The allowlist does not install software. Add another executable only after installing it in the worker image and reviewing its security impact.

### 4. Deploy it safely

The worker must have:

- A public HTTPS origin that Vercel can reach.
- CPU, memory, process, and request-time limits.
- A disposable writable `/tmp` directory.
- Outbound access only to GitHub, LiteLLM, and explicitly approved package registries.
- No host filesystem mounts or Docker socket.
- No privileged-container mode or broad Linux capabilities.
- No shared PID namespace or host `/proc` mount.
- No cloud metadata, production database, cluster-management, or private-service access.
- No GitHub App private key, Vercel credential, Render credential, or other platform secret.

The controller needs only `CHOWN`, `SETUID`, and `SETGID` capabilities. Model-controlled commands run as the separate unprivileged uid/gid `10001`, receive a minimal environment, and cannot write Git metadata.

The checked-in VPS compose configuration limits the service to one request, 2 CPUs, 4 GB of memory, 128 processes, and 4 GB of disposable temporary storage. Do not increase concurrency on a shared 4-core, 8 GB VPS.

### 5. Verify the deployment

Open:

```text
https://<worker-host>/health
```

Expected response:

```json
{"ok":true,"busy":false}
```

Give the Nucleas administrator only the HTTPS origin, without `/v1/execute`:

```text
https://<worker-host>
```

## Nucleas administrator

### 1. Add two Vercel variables

Add these Production environment variables to the Nucleas Vercel project:

```env
NUCLEAS_EXECUTION_WORKER_URL=https://<worker-host>
NUCLEAS_EXECUTION_WORKER_TOKEN=<same dedicated worker token>
```

Do not add `/v1/execute` to the URL. Do not use the LiteLLM key as the worker token.

Redeploy Nucleas after saving the variables.

### 2. Connect projects to GitHub

For each project that should support Build mode:

1. Connect the project to its GitHub repository.
2. Select its default branch.
3. Confirm the Nucleas GitHub App is installed for that repository.

The permanent GitHub App credentials remain in Vercel. The worker receives only a short-lived installation token for the repository being processed.

### 3. Run a safe test

In a connected project's IDE, select Build mode and request:

```text
Create execution-test.txt containing "Nucleas execution worker test". Do not change other files. Verify the file exists.
```

Success means Nucleas shows a proposed patch and command evidence. The file must not appear in GitHub until the Nucleas administrator separately requests and confirms publishing.

## Settings that should not need regular updates

These connection values remain stable:

```env
NUCLEAS_EXECUTION_WORKER_URL=https://<worker-host>
NUCLEAS_EXECUTION_WORKER_TOKEN=<dedicated worker token>
```

Choose the active coding model in **Admin → AI Settings → Model routing**. Nucleas sends it with each new execution request, so switching models does not require editing the VPS environment or rebuilding the worker.

The worker's `NUCLEAS_AI_REMOTE_MODEL` remains a required fallback for older callers. Set it to a known-good coding model. Every coding model selected in Nucleas must support OpenAI-compatible chat completions and function/tool calling through LiteLLM.

Change the shared worker token only when intentionally rotating it. During rotation, update the worker and Vercel with the same new value.

## Request lifecycle and limits

For every Build request, Nucleas creates a short-lived GitHub installation token. The worker clones the selected repository into a temporary directory, performs the task, returns an exact patch with bounded command output, and deletes the directory.

Nucleas currently waits up to 240 seconds for the worker. Longer durable background execution requires a future queue-based integration.

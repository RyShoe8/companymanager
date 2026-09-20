# Nucleas isolated execution worker

The execution worker lets Build mode edit a temporary copy of a connected GitHub repository and run approved commands. It returns a patch and command results to Nucleas, then deletes the copy.

It never commits, pushes, opens a pull request, deploys, or changes the real repository. Those actions require a separate explicit confirmation in Nucleas.

## Your friend's setup

### 1. Create one permanent LiteLLM model alias

Your friend must expose the permanent LiteLLM model name:

```text
nucleas-worker
```

Example LiteLLM configuration:

```yaml
model_list:
  - model_name: nucleas-worker
    litellm_params:
      model: hosted_vllm/<current-model-id>
      api_base: http://vllm-router-service.llm.svc.cluster.local/v1
      api_key: os.environ/VLLM_KEY
```

`nucleas-worker` must remain unchanged. When the underlying model changes, your friend updates only `litellm_params.model`. No Nucleas or Vercel setting needs to change.

Do not automatically select the first model returned by `/v1/models`. The stable alias prevents an infrastructure change from silently selecting the wrong model.

### 2. Generate a dedicated worker token

Generate a new random secret:

```bash
openssl rand -hex 32
```

This token is used only between Nucleas and the execution worker. Send it to the Nucleas owner through a secure channel.

Do not reuse a LiteLLM, GitHub, Vercel, Render, Kubernetes, or production credential.

### 3. Build the worker

Run these commands from the repository root:

```bash
git pull origin main
docker build -f services/execution-worker/Dockerfile -t nucleas-execution-worker:latest .
```

### 4. Configure the worker

Set these environment variables on the worker host:

```env
NUCLEAS_EXECUTION_WORKER_TOKEN=<dedicated worker token>
NUCLEAS_AI_REMOTE_ENDPOINT=<internal LiteLLM chat-completions URL>
NUCLEAS_AI_REMOTE_BEARER_TOKEN=<LiteLLM credential>
NUCLEAS_AI_REMOTE_MODEL=nucleas-worker
PORT=8788
```

Optional:

```env
NUCLEAS_EXECUTION_ALLOWED_BINARIES=node,npm,npx,pnpm,yarn,bun,git
```

### 5. Deploy it safely

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

The service processes one request at a time. Start with 2 CPUs, 2–4 GB of memory, a 128-process limit, and a five-minute external request limit.

### 6. Verify the deployment

Open:

```text
https://<worker-host>/health
```

Expected response:

```json
{"ok":true,"busy":false}
```

Give the Nucleas owner only the HTTPS origin, without `/v1/execute`:

```text
https://<worker-host>
```

## Your setup

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

Success means Nucleas shows a proposed patch and command evidence. The file must not appear in GitHub until you separately request and confirm publishing.

## Settings that should not need regular updates

These values remain stable:

```env
NUCLEAS_AI_REMOTE_MODEL=nucleas-worker
NUCLEAS_EXECUTION_WORKER_URL=https://<worker-host>
NUCLEAS_EXECUTION_WORKER_TOKEN=<dedicated worker token>
```

Your friend may replace or upgrade the underlying vLLM model without contacting you, provided the LiteLLM alias remains `nucleas-worker` and its tool-calling behavior remains compatible.

Change the shared worker token only when intentionally rotating it. During rotation, update the worker and Vercel with the same new value.

## Request lifecycle and limits

For every Build request, Nucleas creates a short-lived GitHub installation token. The worker clones the selected repository into a temporary directory, performs the task, returns an exact patch with bounded command output, and deletes the directory.

Nucleas currently waits up to 240 seconds for the worker. Longer durable background execution requires a future queue-based integration.

# Nucleas isolated execution worker

Build mode can use a separately deployed disposable execution worker to edit a bound GitHub repository and run commands. Vercel never executes repository code. When the worker is not configured, Build mode retains the existing inference-only behavior.

## Required deployment boundary

Deploy `services/execution-worker/Dockerfile` on an isolated container host. The container must be disposable or reset between requests, run as a non-root user, enforce CPU/memory/process/time limits, and have no host mounts, Docker socket, cloud metadata access, cluster credentials, production secrets, or access to private service networks. Restrict outbound traffic to GitHub and the configured LiteLLM endpoint. Application command filtering is defense in depth; it is not the sandbox boundary.

The worker accepts one request at a time, clones one GitHub repository with a short-lived installation token, runs an argv-only tool loop, returns the exact Git patch and bounded command output, then deletes the workspace. It never commits, pushes, opens a pull request, deploys, or changes production.

## Worker environment

- `NUCLEAS_EXECUTION_WORKER_TOKEN`: a new random secret used only between Nucleas and this worker.
- `NUCLEAS_AI_REMOTE_ENDPOINT`: the LiteLLM OpenAI-compatible chat-completions endpoint.
- `NUCLEAS_AI_REMOTE_BEARER_TOKEN`: the model credential available only inside the worker.
- `NUCLEAS_AI_REMOTE_MODEL`: the worker model id.
- `NUCLEAS_EXECUTION_ALLOWED_BINARIES`: optional comma-separated argv executables. Defaults to `node,npm,npx,pnpm,yarn,bun,git`.
- `PORT`: defaults to `8788`.

## Vercel environment

- `NUCLEAS_EXECUTION_WORKER_URL`: public HTTPS origin of the execution worker, without `/v1/execute`.
- `NUCLEAS_EXECUTION_WORKER_TOKEN`: the same dedicated worker secret.
- Existing GitHub App variables must be configured, and each project must have a bound repository plus installation id.

Never reuse the LiteLLM bearer token as the worker transport secret. Rotate either independently. The current request path has a 240-second deadline; longer durable background execution remains a separate queue integration.

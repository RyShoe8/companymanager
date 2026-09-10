# Bounded remote connection diagnostics

The AI administration page offers one plain-text chat check and one plain-text Responses check to investigate the execution probe's HTTP 403. Each is globally one-time, independent of the irrevocable execution-probe marker. There is no reset or automatic retry.

Both use the existing server-side bearer secret and fixed Qwen model at llm.rogly.net. Requests ask only “Reply with OK only.”, cap output at 16 tokens, disable streaming, send no tools or repository data, reject redirects, and time out after 45 seconds. Response bodies are cancelled without being read or stored. These requests may incur provider charges outside project budgets.

Only HTTP status, a transport outcome, whether the server header exactly reports Cloudflare, and whether an authentication challenge header exists are exposed. No raw headers, provider text, credentials, cookies or challenge values are returned. Header clues do not prove which layer rejected the request. HTTP success is not validation of generated output or proof of code execution.

POST requires a current platform administrator, same-origin explicit confirmation, and a strict chat/responses selector. The durable attempted marker is committed before dispatch, outside transaction retries. Both checks use the existing shared daily limits, minimum interval and retained 15-minute dispatch lease, and can run while planning is paused without changing settings. An ambiguous attempt remains consumed. GET only reads status. Run the checks separately after the preceding lease expires; do not clear production locks.

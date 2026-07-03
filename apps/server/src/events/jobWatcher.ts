import {
  claimAsyncJob,
  completeAuditTurnByJobId,
  getUndeliveredAsyncJobs,
  openSystemDb,
  parseAsyncJobPayload,
} from "@btl/system-db";
import { generateAgentReply } from "../ollama/agent.js";
import { buildAsyncResultSummary } from "../ollama/summary.js";
import { pushAsyncResult } from "./sseHub.js";

let interval: ReturnType<typeof setInterval> | null = null;
let pollInFlight = false;

async function processUndeliveredJobs(): Promise<void> {
  const jobs = getUndeliveredAsyncJobs();
  for (const job of jobs) {
    if (!claimAsyncJob(job.job_id)) continue;

    const payload = parseAsyncJobPayload(job.data_response_json);
    const summary = buildAsyncResultSummary({
      domain: payload.domain,
      intent: payload.intent,
      query: payload.intent === "search" ? payload.query : undefined,
      data: payload.intent === "search" ? payload.data : undefined,
      total: payload.intent === "count" ? payload.total : undefined,
    });

    let agentMessage: string | undefined;
    try {
      const reply = await generateAgentReply({
        userMessage: job.query_text,
        orchestrationSummary: summary,
      });
      agentMessage = reply.message;
    } catch {
      agentMessage = undefined;
    }

    if (payload.intent === "count") {
      pushAsyncResult(job.session_id, {
        type: "ASYNC_RESULT",
        jobId: job.job_id,
        domain: payload.domain,
        intent: "count",
        total: payload.total,
        agentMessage,
      });
    } else {
      pushAsyncResult(job.session_id, {
        type: "ASYNC_RESULT",
        jobId: job.job_id,
        domain: payload.domain,
        intent: "search",
        query: payload.query || job.query_text,
        data: payload.data,
        agentMessage,
      });
    }
    completeAuditTurnByJobId(job.job_id, payload);
  }
}

export function startAsyncJobWatcher(): void {
  openSystemDb();

  if (interval) return;

  interval = setInterval(() => {
    if (pollInFlight) return;
    pollInFlight = true;
    void processUndeliveredJobs()
      .catch((error) => {
        console.error("[jobWatcher] poll failed:", error);
      })
      .finally(() => {
        pollInFlight = false;
      });
  }, 300);
}

export function stopAsyncJobWatcher(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}

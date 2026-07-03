import type { ServerResponse } from "node:http";
import type { AsyncResultEvent } from "@btl/core";

export type SseClient = {
  id: string;
  sessionId: string;
  response: ServerResponse;
};

type SsePayload = AsyncResultEvent | { type: "CONNECTED"; sessionId: string };

const clients = new Set<SseClient>();

export function registerSseClient(sessionId: string, response: ServerResponse): string {
  const id = crypto.randomUUID();
  const client: SseClient = { id, sessionId, response };
  clients.add(client);

  response.on("close", () => {
    clients.delete(client);
  });

  sendToClient(client, { type: "CONNECTED", sessionId });
  return id;
}

function sendToClient(client: SseClient, payload: SsePayload): void {
  client.response.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export function pushAsyncResult(sessionId: string, event: AsyncResultEvent): void {
  for (const client of clients) {
    if (client.sessionId === sessionId) {
      sendToClient(client, event);
    }
  }
}

export function getSseClientCount(sessionId: string): number {
  let count = 0;
  for (const client of clients) {
    if (client.sessionId === sessionId) count++;
  }
  return count;
}

export type RawEvent = { event: string; data: string };

export function parseSseChunk(buffer: string): { events: RawEvent[]; rest: string } {
  const norm = buffer.replace(/\r\n/g, "\n");
  const frames = norm.split("\n\n");
  const rest = frames.pop() ?? "";
  const events: RawEvent[] = [];
  for (const frame of frames) {
    let event = "message";
    const data: string[] = [];
    for (const line of frame.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
    }
    if (data.length) events.push({ event, data: data.join("\n") });
  }
  return { events, rest };
}

export async function streamSse(url: string, init: RequestInit, onEvent: (e: RawEvent) => void, signal?: AbortSignal): Promise<void> {
  const res = await fetch(url, { ...init, signal, headers: { accept: "text/event-stream", ...(init.headers ?? {}) } });
  if (!res.ok || !res.body) throw new Error(`${res.status} ${res.statusText}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const { events, rest } = parseSseChunk(buffer);
    buffer = rest;
    events.forEach(onEvent);
  }
  const tail = parseSseChunk(buffer + "\n\n");
  tail.events.forEach(onEvent);
}

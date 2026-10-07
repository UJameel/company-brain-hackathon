import { describe, expect, it } from "vitest";
import { parseSseChunk } from "./sse";

describe("parseSseChunk", () => {
  it("splits complete frames and keeps the partial tail", () => {
    const buf = 'event: hermes\ndata: {"intent":"question"}\n\nevent: athena.token\ndata: {"text":"The"}\n\nevent: done\ndata: {"ans';
    const { events, rest } = parseSseChunk(buf);
    expect(events).toEqual([
      { event: "hermes", data: '{"intent":"question"}' },
      { event: "athena.token", data: '{"text":"The"}' },
    ]);
    expect(rest).toBe('event: done\ndata: {"ans');
  });
  it("handles CRLF and multi-line data", () => {
    const { events } = parseSseChunk("event: x\r\ndata: a\r\ndata: b\r\n\r\n");
    expect(events).toEqual([{ event: "x", data: "a\nb" }]);
  });
});

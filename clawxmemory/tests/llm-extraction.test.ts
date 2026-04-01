import { afterEach, describe, expect, it, vi } from "vitest";
import type { GlobalProfileRecord, L0SessionRecord, L1WindowRecord } from "../src/core/index.js";
import { LlmMemoryExtractor } from "../src/core/index.js";

function createExtractor() {
  return new LlmMemoryExtractor({}, undefined, undefined);
}

function createProfile(): GlobalProfileRecord {
  return {
    recordId: "global_profile_record",
    profileText: "User likes spicy food and speaks Chinese.",
    sourceL1Ids: ["l1-profile"],
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  };
}

function createL1(): L1WindowRecord {
  return {
    l1IndexId: "l1-1",
    sessionKey: "session-1",
    timePeriod: "2026-04-01 morning",
    startedAt: "2026-04-01T08:00:00.000Z",
    endedAt: "2026-04-01T09:00:00.000Z",
    summary: "Discussed travel and retrieval debugging.",
    facts: [],
    situationTimeInfo: "Confirmed the project plan.",
    projectTags: ["travel"],
    projectDetails: [],
    l0Source: ["l0-1"],
    createdAt: "2026-04-01T09:00:00.000Z",
  };
}

function createL0(): L0SessionRecord {
  return {
    l0IndexId: "l0-1",
    sessionKey: "session-1",
    timestamp: "2026-04-01T09:30:00.000Z",
    messages: [
      { role: "user", content: "我对于天津旅游的规划是什么" },
      { role: "assistant", content: "你在推进清明假期天津穷游攻略。" },
    ],
    source: "openclaw",
    indexed: true,
    createdAt: "2026-04-01T09:30:00.000Z",
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("LlmMemoryExtractor hop debug trace", () => {
  it("emits full prompt debug on successful hop1 parsing", async () => {
    const extractor = createExtractor();
    const debugTrace = vi.fn();
    vi.spyOn(extractor as never as { callStructuredJson: (input: unknown) => Promise<string> }, "callStructuredJson")
      .mockResolvedValue(JSON.stringify({
        memory_relevant: true,
        base_only: false,
        lookup_queries: [
          {
            target_types: ["time", "project"],
            lookup_query: "天津旅游规划",
            time_range: { start_date: "2026-04-01", end_date: "2026-04-01" },
          },
        ],
      }));

    const result = await extractor.decideMemoryLookup({
      query: "我对于天津旅游的规划是什么",
      profile: createProfile(),
      debugTrace,
    });

    expect(result.lookupQueries[0]?.lookupQuery).toBe("天津旅游规划");
    expect(debugTrace).toHaveBeenCalledWith(expect.objectContaining({
      requestLabel: "Hop1 lookup",
      systemPrompt: expect.stringContaining("第一跳规划器"),
      userPrompt: expect.stringContaining("current_local_date"),
      rawResponse: expect.stringContaining("lookup_queries"),
      parsedResult: expect.objectContaining({
        base_only: false,
      }),
    }));
  });

  it("emits errored prompt debug when raw hop output cannot be parsed", async () => {
    const extractor = createExtractor();
    const debugTrace = vi.fn();
    vi.spyOn(extractor as never as { callStructuredJson: (input: unknown) => Promise<string> }, "callStructuredJson")
      .mockResolvedValue("not-json-at-all");

    const result = await extractor.selectL1FromEvidence({
      query: "我对于天津旅游的规划是什么",
      evidenceNote: "L2 note",
      selectedL2Entries: [
        {
          id: "l2-project-1",
          type: "project",
          label: "天津穷游攻略",
          lookupKeys: ["天津", "穷游"],
          compressedContent: "正在推进天津穷游路线和预算整理。",
        },
      ],
      l1Windows: [createL1()],
      debugTrace,
    });

    expect(result.enoughAt).toBe("none");
    expect(debugTrace).toHaveBeenCalledWith(expect.objectContaining({
      requestLabel: "Hop3 L1 selection",
      errored: true,
      rawResponse: "not-json-at-all",
      errorMessage: expect.any(String),
    }));
  });

  it("marks timeout in hop debug when the model call times out", async () => {
    const extractor = createExtractor();
    const debugTrace = vi.fn();
    vi.spyOn(extractor as never as { callStructuredJson: (input: unknown) => Promise<string> }, "callStructuredJson")
      .mockRejectedValue(new Error("Hop4 L0 selection request timed out after 5000ms"));

    const result = await extractor.selectL0FromEvidence({
      query: "你上次推荐我的店叫什么",
      evidenceNote: "Need exact venue name",
      selectedL2Entries: [
        {
          id: "l2-project-1",
          type: "project",
          label: "北京烧烤推荐",
          lookupKeys: ["北京", "烧烤"],
          compressedContent: "之前讨论过几家烧烤店。",
        },
      ],
      selectedL1Windows: [createL1()],
      l0Sessions: [createL0()],
      debugTrace,
    });

    expect(result.enoughAt).toBe("none");
    expect(debugTrace).toHaveBeenCalledWith(expect.objectContaining({
      requestLabel: "Hop4 L0 selection",
      errored: true,
      timedOut: true,
    }));
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeSearchQuery } from "../search-query";
import { searchMetaculusQuestions } from "../metaculus";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("normalizeSearchQuery", () => {
  it("lowercases, trims, keeps four words, and caps length", () => {
    expect(normalizeSearchQuery("  Election Economy Bitcoin Federal Reserve Trump  ")).toBe(
      "election economy bitcoin federal",
    );
    expect(normalizeSearchQuery("A".repeat(200)).length).toBe(100);
    expect(normalizeSearchQuery("   ")).toBe("");
  });
});

describe("searchMetaculusQuestions", () => {
  it("skips upstream when METACULUS_API_KEY is unset", async () => {
    vi.stubEnv("METACULUS_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await searchMetaculusQuestions("election")).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends Token auth and maps community medians", async () => {
    vi.stubEnv("METACULUS_API_KEY", "test-token");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            id: 1,
            title: "Will X happen?",
            page_url: "https://www.metaculus.com/questions/1/",
            community_prediction: { full: { q2: 0.42 } },
            resolution_criteria: "Official source",
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const questions = await searchMetaculusQuestions("Will Something Happen Soon?");
    expect(questions).toEqual([
      {
        id: 1,
        title: "Will X happen?",
        url: "https://www.metaculus.com/questions/1/",
        communityMedian: 0.42,
        resolutionCriteria: "Official source",
      },
    ]);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("search=will%20something%20happen%20soon");
    expect(init.headers).toEqual({ Authorization: "Token test-token" });
  });
});

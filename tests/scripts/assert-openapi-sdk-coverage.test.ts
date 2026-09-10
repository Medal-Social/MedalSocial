import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { expectProcessExit, mockProcessExit } from "./test-support";

// `scripts/assert-openapi-sdk-coverage.mjs` cross-checks the bundled OpenAPI
// spec against a large hard-coded matrix of every SDK operation. Replicating
// that whole matrix in a fixture would just re-describe the real repo, so
// these tests only cover the two structural guards that fire before (or
// regardless of) the per-operation matrix: the missing-spec-file short
// circuit, and the top-level `openapi` version guard.
const SCRIPT_PATH = "../../scripts/assert-openapi-sdk-coverage.mjs";

async function runScript(fs: {
  existsSync: ReturnType<typeof vi.fn>;
  readFileSync: ReturnType<typeof vi.fn>;
}) {
  vi.doMock("node:fs", () => fs);
  vi.resetModules();
  return expectProcessExit(() => import(SCRIPT_PATH));
}

describe("scripts/assert-openapi-sdk-coverage.mjs", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    exitSpy = mockProcessExit();
  });

  afterEach(() => {
    vi.doUnmock("node:fs");
    vi.restoreAllMocks();
  });

  it("exits 1 with a clear message when the bundled OpenAPI JSON is missing", async () => {
    const readFileSync = vi.fn();

    const exitCode = await runScript({ existsSync: vi.fn(() => false), readFileSync });

    expect(exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Missing bundled OpenAPI JSON"));
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(readFileSync).not.toHaveBeenCalled();
  });

  it("exits 1 and reports the version mismatch when the spec isn't OpenAPI 3.1, without ever logging OK", async () => {
    const spec = { openapi: "3.0.0", paths: {} };

    const exitCode = await runScript({
      existsSync: vi.fn(() => true),
      readFileSync: vi.fn(() => JSON.stringify(spec)),
    });

    expect(exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("FAIL"));
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Expected openapi 3.1.0, got 3.0.0"),
    );
    expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining("[openapi-coverage] OK"));
  });
});

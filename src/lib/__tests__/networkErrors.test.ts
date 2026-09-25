import { describe, expect, it } from "vitest";
import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";
import { isNetworkError } from "../networkErrors";

describe("isNetworkError", () => {
  it.each([
    ["Chromium fetch failure", new TypeError("Failed to fetch")],
    ["Safari fetch failure", new TypeError("Load failed")],
    ["Firefox fetch failure", new TypeError("NetworkError when attempting to fetch resource.")],
    ["postgrest-js wrapper", { message: "TypeError: Failed to fetch", details: "", hint: "", code: "" }],
    ["postgrest-js wrapper of an abort", { message: "AbortError: The operation was aborted.", details: "", hint: "", code: "" }],
    ["AuthRetryableFetchError", new AuthRetryableFetchError("Failed to fetch", 0)],
    ["DOMException AbortError", new DOMException("The operation was aborted.", "AbortError")],
    ["DOMException TimeoutError", new DOMException("The operation timed out.", "TimeoutError")],
  ])("true for %s", (_label, error) => {
    expect(isNetworkError(error)).toBe(true);
  });

  it.each([
    ["PostgREST 401 (JWT expired)", { message: "JWT expired", details: null, hint: null, code: "PGRST301" }],
    ["Postgres permission denied", { message: "permission denied for table bands", code: "42501" }],
    ["auth 500", new AuthApiError("Internal error", 500, "unexpected_failure")],
    ["an unrelated TypeError", new TypeError("x is not a function")],
    ["a plain Error", new Error("User not authenticated")],
    ["null", null],
    ["a string", "Failed to fetch"],
  ])("false for %s", (_label, error) => {
    expect(isNetworkError(error)).toBe(false);
  });
});

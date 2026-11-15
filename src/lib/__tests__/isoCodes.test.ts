import { beforeAll, describe, expect, it } from "vitest";
import {
  LANGUAGE_CODES,
  REGION_CODES,
  displayName,
  isKnownCode,
  isoOptions,
  normalizeToCode,
} from "../isoCodes";

beforeAll(() => {
  // Node 22 ships full ICU; without it these tests would pass for the wrong reason.
  expect(typeof Intl.DisplayNames).toBe("function");
  expect(new Intl.DisplayNames(["es"], { type: "region" }).of("MX")).toBe("México");
});

describe("displayName (AC1)", () => {
  it("renders known codes in the UI language", () => {
    expect(displayName("region", "MX", "es")).toBe("México");
    expect(displayName("region", "MX", "en")).toBe("Mexico");
    expect(displayName("region", "us", "es")).toBe("Estados Unidos");
    expect(displayName("language", "es", "en")).toBe("Spanish");
    expect(displayName("language", "en", "es")).toBe("Inglés");
    expect(displayName("language", "es", "es-ES")).toBe("Español");
  });

  it("passes legacy values through unchanged and never throws", () => {
    expect(displayName("region", "Estados Unidos", "en")).toBe("Estados Unidos");
    expect(displayName("region", "Scotland", "es")).toBe("Scotland");
    expect(displayName("region", "", "en")).toBe("");
    expect(displayName("region", null, "en")).toBe("");
    expect(displayName("region", "12", "en")).toBe("12");
    expect(displayName("region", "MX", "not a locale!!")).toBeTruthy();
  });
});

describe("normalizeToCode (AC2, AC3)", () => {
  it("maps codes, names and aliases to the region code", () => {
    for (const value of ["US", "us", "USA", "United States", "Estados Unidos", "U.S.", "EE.UU."]) {
      expect(normalizeToCode("region", value)).toBe("US");
    }
    for (const value of ["UK", "United Kingdom", "Reino Unido", "GB"]) {
      expect(normalizeToCode("region", value)).toBe("GB");
    }
    expect(normalizeToCode("region", "México")).toBe("MX");
    expect(normalizeToCode("region", "Panama")).toBe("PA");
    expect(normalizeToCode("region", "  spain ")).toBe("ES");
  });

  it("returns null for unknown values and non-standard codes", () => {
    for (const value of ["Narnia", "Scotland", "Shakira", "XW", "XE", "SU", "", "  ", null, undefined]) {
      expect(normalizeToCode("region", value)).toBeNull();
    }
  });

  it("maps language codes, names, aliases and the typos found in production", () => {
    expect(normalizeToCode("language", "Español")).toBe("es");
    expect(normalizeToCode("language", "Spanish")).toBe("es");
    expect(normalizeToCode("language", "Spanich")).toBe("es");
    expect(normalizeToCode("language", "Inglés")).toBe("en");
    expect(normalizeToCode("language", "Engish")).toBe("en");
    expect(normalizeToCode("language", "EN")).toBe("en");
    expect(normalizeToCode("language", "Portugués")).toBe("pt");
    expect(normalizeToCode("language", "Klingon")).toBeNull();
  });
});

describe("isKnownCode and isoOptions (AC4)", () => {
  it("knows codes case-insensitively", () => {
    expect(isKnownCode("region", "mx")).toBe(true);
    expect(isKnownCode("region", "XW")).toBe(false);
    expect(isKnownCode("language", "ES")).toBe(true);
  });

  it("lists every code once, sorted by the localised name", () => {
    const regions = isoOptions("region", "es");
    expect(regions).toHaveLength(REGION_CODES.length);
    expect(new Set(regions.map((o) => o.code)).size).toBe(REGION_CODES.length);
    const names = regions.map((o) => o.name);
    expect(names).toEqual([...names].sort(new Intl.Collator("es", { sensitivity: "base" }).compare));
    expect(regions.find((o) => o.code === "DE")?.name).toBe("Alemania");

    const languages = isoOptions("language", "en");
    expect(languages).toHaveLength(LANGUAGE_CODES.length);
    expect(languages[0].name <= languages[1].name).toBe(true);
  });
});

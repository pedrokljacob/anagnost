import { expect, test } from "bun:test";
import {
  getLanguageLabel,
  getUniqueCapabilityLanguages,
  recognitionLanguage,
  supportsLanguageCode,
} from "./languages";

test("drops region and script subtags", () => {
  expect(recognitionLanguage("en-US")).toBe("en");
  expect(recognitionLanguage("zh-Hant")).toBe("zh");
  expect(recognitionLanguage("pt")).toBe("pt");
});

test("maps model-specific codes to the UI intent", () => {
  expect(recognitionLanguage("nb")).toBe("no");
  expect(recognitionLanguage("fil")).toBe("tl");
  expect(recognitionLanguage("nn")).toBe("nn");
});

test("a model advertising nb supports the Norwegian intent and vice versa", () => {
  expect(supportsLanguageCode(["nb"], "no")).toBe(true);
  expect(supportsLanguageCode(["no"], "nb")).toBe(true);
  expect(supportsLanguageCode(["nb"], "nn")).toBe(false);
});

test("collapses equivalent codes to one capability entry", () => {
  expect(getUniqueCapabilityLanguages(["en-US", "en", "nb", "no"])).toEqual([
    "en",
    "no",
  ]);
});

test("labels resolve through the alias", () => {
  expect(getLanguageLabel("no")).toBe("Norwegian");
  expect(getLanguageLabel("nb")).toBe("Norwegian");
  expect(getLanguageLabel("xx")).toBeUndefined();
});

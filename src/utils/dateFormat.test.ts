import { afterEach, expect, setSystemTime, test } from "bun:test";
import { formatDate, formatDateTime, formatRelativeTime } from "./dateFormat";

// Unix seconds, as the history entries store them.
const NOW = Date.UTC(2026, 9, 7, 12, 0, 0) / 1000;
const at = (secondsAgo: number) => String(NOW - secondsAgo);

afterEach(() => setSystemTime());

test("relative times pick the largest whole unit", () => {
  setSystemTime(new Date(NOW * 1000));
  expect(formatRelativeTime(at(5), "en")).toBe("5 seconds ago");
  expect(formatRelativeTime(at(90), "en")).toBe("1 minute ago");
  expect(formatRelativeTime(at(3 * 3600), "en")).toBe("3 hours ago");
  expect(formatRelativeTime(at(2 * 86400), "en")).toBe("2 days ago");
  expect(formatRelativeTime(at(10 * 86400), "en")).toBe("last week");
  expect(formatRelativeTime(at(45 * 86400), "en")).toBe("last month");
  expect(formatRelativeTime(at(400 * 86400), "en")).toBe("last year");
});

test("absolute formats follow the locale", () => {
  expect(formatDate(String(NOW), "en-US")).toBe("October 7, 2026");
  expect(formatDateTime(String(NOW), "en-US")).toMatch(/^October 7, 2026/);
});

test("invalid timestamps are returned unchanged", () => {
  expect(formatRelativeTime("not-a-time", "en")).toBe("not-a-time");
  expect(formatDate("", "en")).toBe("");
});

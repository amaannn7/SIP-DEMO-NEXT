import { describe, it, expect } from "vitest";
import { findMentionedUserIds, splitMessageSegments } from "./mentions";

const MEMBERS = [
  { id: "u1", displayName: "Jordan Lee" },
  { id: "u2", displayName: "Jan" },
  { id: "u3", displayName: "Priya Shah" },
];

describe("findMentionedUserIds", () => {
  it("matches a full-name mention", () => {
    expect(findMentionedUserIds("great catch @Jordan Lee", MEMBERS)).toEqual(["u1"]);
  });

  it("matches a first-name-only mention", () => {
    expect(findMentionedUserIds("thanks @Priya for the update", MEMBERS)).toEqual(["u3"]);
  });

  it("is case-insensitive", () => {
    expect(findMentionedUserIds("@JORDAN can you check this", MEMBERS)).toEqual(["u1"]);
  });

  it("does not match a name as a prefix of a longer word", () => {
    // "@Jan" should not match inside "@January" (a false substring hit).
    expect(findMentionedUserIds("scheduled for @January 5th", MEMBERS)).toEqual([]);
  });

  it("matches multiple distinct mentions in one message", () => {
    expect(findMentionedUserIds("@Jordan Lee and @Priya Shah, thoughts?", MEMBERS)).toEqual(["u1", "u3"]);
  });

  it("returns nothing when the message has no @", () => {
    expect(findMentionedUserIds("no mentions here", MEMBERS)).toEqual([]);
  });

  it("returns nothing when the @name doesn't match any member", () => {
    expect(findMentionedUserIds("hey @Nobody", MEMBERS)).toEqual([]);
  });
});

describe("splitMessageSegments", () => {
  it("returns a single text segment when there's no @", () => {
    expect(splitMessageSegments("no mentions here", MEMBERS)).toEqual([{ type: "text", text: "no mentions here" }]);
  });

  it("splits a full-name mention out as its own segment, preferring it over the first-name-only match", () => {
    expect(splitMessageSegments("great catch @Jordan Lee, thanks", MEMBERS)).toEqual([
      { type: "text", text: "great catch " },
      { type: "mention", text: "@Jordan Lee", userId: "u1" },
      { type: "text", text: ", thanks" },
    ]);
  });

  it("splits a first-name-only mention", () => {
    expect(splitMessageSegments("thanks @Priya for the update", MEMBERS)).toEqual([
      { type: "text", text: "thanks " },
      { type: "mention", text: "@Priya", userId: "u3" },
      { type: "text", text: " for the update" },
    ]);
  });

  it("does not split a name that's a prefix of a longer word", () => {
    expect(splitMessageSegments("scheduled for @January 5th", MEMBERS)).toEqual([
      { type: "text", text: "scheduled for @January 5th" },
    ]);
  });

  it("splits multiple distinct mentions in one message", () => {
    expect(splitMessageSegments("@Jordan Lee and @Priya Shah, thoughts?", MEMBERS)).toEqual([
      { type: "mention", text: "@Jordan Lee", userId: "u1" },
      { type: "text", text: " and " },
      { type: "mention", text: "@Priya Shah", userId: "u3" },
      { type: "text", text: ", thoughts?" },
    ]);
  });

  it("leaves an unmatched @ as plain text", () => {
    expect(splitMessageSegments("hey @Nobody", MEMBERS)).toEqual([{ type: "text", text: "hey @Nobody" }]);
  });
});

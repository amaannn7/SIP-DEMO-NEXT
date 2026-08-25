import { describe, it, expect } from "vitest";
import { renderSenderIdentity } from "./shared";

describe("renderSenderIdentity", () => {
  it("renders name, title, and company when all are set", () => {
    const line = renderSenderIdentity({ senderName: "Sarah Lee", senderTitle: "Account Executive", senderCompany: "Acme Co" }, "Sarah Lee");
    expect(line).toBe("SENDER: Sarah Lee, Account Executive at Acme Co");
  });

  it("falls back to the rep's account name when sender_name is blank", () => {
    const line = renderSenderIdentity({ senderName: "", senderTitle: "", senderCompany: "" }, "Jordan Lee");
    expect(line).toBe("SENDER: Jordan Lee");
  });

  it("falls back to a generic literal name only when both sender_name and the account name are blank", () => {
    const line = renderSenderIdentity({ senderName: "", senderTitle: "", senderCompany: "" }, "");
    expect(line).toBe("SENDER: Your Name");
  });

  it("uses the provided default title when sender_title is blank", () => {
    const line = renderSenderIdentity({ senderName: "Sarah", senderTitle: "", senderCompany: "" }, "Sarah", "Business Development Manager");
    expect(line).toBe("SENDER: Sarah, Business Development Manager");
  });

  it("omits title and company cleanly when neither is set and no default title is given", () => {
    const line = renderSenderIdentity({ senderName: "Sarah", senderTitle: "", senderCompany: "" }, "Sarah");
    expect(line).toBe("SENDER: Sarah");
  });
});

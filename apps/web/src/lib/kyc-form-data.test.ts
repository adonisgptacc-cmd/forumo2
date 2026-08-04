import { describe, expect, it } from "vitest";

import { buildKycFormData } from "./kyc-form-data";

describe("buildKycFormData", () => {
  it("uses the backend documents and documentTypes multipart contract", () => {
    const front = new File(["front"], "front.jpg", { type: "image/jpeg" });
    const back = new File(["back"], "back.jpg", { type: "image/jpeg" });
    const selfie = new File(["selfie"], "selfie.jpg", {
      type: "image/jpeg",
    });

    const payload = buildKycFormData({
      documentType: "national_id",
      frontImage: front,
      backImage: back,
      selfieImage: selfie,
    });

    expect(payload.getAll("documents")).toEqual([front, back, selfie]);
    expect(JSON.parse(String(payload.get("documentTypes")))).toEqual([
      "national_id_front",
      "national_id_back",
      "selfie",
    ]);
    expect(payload.has("frontImage")).toBe(false);
  });

  it("keeps files and document types aligned when the back is optional", () => {
    const front = new File(["front"], "front.jpg");
    const selfie = new File(["selfie"], "selfie.jpg");
    const payload = buildKycFormData({
      documentType: "passport",
      frontImage: front,
      selfieImage: selfie,
    });

    expect(payload.getAll("documents")).toEqual([front, selfie]);
    expect(JSON.parse(String(payload.get("documentTypes")))).toEqual([
      "passport_front",
      "selfie",
    ]);
  });
});

jest.mock("node:fs/promises", () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

import { Test } from "@nestjs/testing";
import * as fsPromises from "node:fs/promises";
import { StorageService } from "./storage.service";

const mockMkdir = fsPromises.mkdir as jest.MockedFunction<
  typeof fsPromises.mkdir
>;
const mockWriteFile = fsPromises.writeFile as jest.MockedFunction<
  typeof fsPromises.writeFile
>;

function makeFile(
  originalname: string,
  mimetype = "image/jpeg",
): Express.Multer.File {
  let buffer: Buffer;
  if (mimetype === "image/jpeg") {
    buffer = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1,
    ]);
  } else if (mimetype === "image/png") {
    buffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
    ]);
  } else if (mimetype === "application/pdf") {
    buffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
  } else {
    buffer = Buffer.from("fake-content");
  }
  return {
    originalname,
    buffer,
    mimetype,
    fieldname: "file",
    encoding: "7bit",
    size: buffer.length,
    stream: null as any,
    destination: "",
    filename: originalname,
    path: "",
  };
}

describe("StorageService", () => {
  let service: StorageService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [StorageService],
    }).compile();
    service = moduleRef.get(StorageService);
  });

  it("saveListingImage persists the file and returns a valid reference", async () => {
    const file = makeFile("photo.jpg");
    const result = await service.saveListingImage("listing-123", file);

    expect(result.bucket).toBe("local-dev");
    expect(result.key).toMatch(/^listings\/listing-123\//);
    expect(result.key).toContain("photo.jpg");
    expect(result.url).toMatch(/^s3:\/\/local-dev\/listings\/listing-123\//);
    expect(result.key).not.toContain("\\"); // forward slashes only
    expect(mockMkdir).toHaveBeenCalledTimes(1);
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
  });

  it("saveMessageAttachment persists the file under the messages path", async () => {
    const file = makeFile("attachment.png", "image/png");
    const result = await service.saveMessageAttachment("thread-456", file);

    expect(result.key).toMatch(/^messages\/thread-456\//);
    expect(result.key).toContain("attachment.png");
    expect(result.url).toMatch(/^s3:\/\/local-dev\/messages\/thread-456\//);
  });

  it("saveKycDocument persists the file under the kyc path", async () => {
    const file = makeFile("id-card.pdf", "application/pdf");
    const result = await service.saveKycDocument("user-789", file);

    expect(result.key).toMatch(/^kyc\/user-789\//);
    expect(result.key).toContain("id-card.pdf");
    expect(result.url).toMatch(/^s3:\/\/local-dev\/kyc\/user-789\//);
  });

  it("each save generates a unique key even for the same filename", async () => {
    const file = makeFile("doc.jpg");
    const r1 = await service.saveListingImage("listing-1", file);
    const r2 = await service.saveListingImage("listing-1", file);
    expect(r1.key).not.toBe(r2.key);
  });

  it("uses UPLOADS_BUCKET env var when set", async () => {
    const original = process.env.UPLOADS_BUCKET;
    process.env.UPLOADS_BUCKET = "prod-bucket";

    // Re-create service to pick up new env var
    const moduleRef = await Test.createTestingModule({
      providers: [StorageService],
    }).compile();
    const svc = moduleRef.get(StorageService);

    const result = await svc.saveListingImage("listing-1", makeFile("x.jpg"));
    expect(result.bucket).toBe("prod-bucket");
    expect(result.url).toMatch(/^s3:\/\/prod-bucket\//);

    process.env.UPLOADS_BUCKET = original;
  });

  it("url uses forward slashes regardless of OS path separator", async () => {
    const file = makeFile("test.jpg");
    const result = await service.saveListingImage("listing-1", file);
    expect(result.url).not.toContain("\\");
    expect(result.key).not.toContain("\\");
  });
});

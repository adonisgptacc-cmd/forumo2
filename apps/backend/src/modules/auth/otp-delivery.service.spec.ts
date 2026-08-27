import { ConfigService } from "@nestjs/config";
import { NotificationChannel, User } from "@prisma/client";

import { OtpDeliveryService } from "./otp-delivery.service";
import { RequestOtpDto } from "./dto/request-otp.dto";

const configService = {
  get: () => undefined,
  getOrThrow: () => {
    throw new Error("not configured in this test");
  },
} as unknown as ConfigService;

const dtoWithoutChannel: RequestOtpDto = {
  identifier: "zuri@example.com",
  purpose: "PASSWORD_RESET" as RequestOtpDto["purpose"],
  deviceFingerprint: "fp-1",
};

const userWithBoth = {
  email: "zuri@example.com",
  phone: "+27821234567",
} as User;

const userPhoneOnly = {
  email: null,
  phone: "+27821234567",
} as unknown as User;

describe("OtpDeliveryService.deliver channel preference", () => {
  let service: OtpDeliveryService;

  beforeEach(() => {
    service = new OtpDeliveryService(configService);
  });

  it("prefers EMAIL when the user has both an email and a phone", async () => {
    const result = await service.deliver(userWithBoth, dtoWithoutChannel, "123456");
    expect(result.channel).toBe(NotificationChannel.EMAIL);
  });

  it("falls back to SMS when the user has no email", async () => {
    const result = await service.deliver(userPhoneOnly, dtoWithoutChannel, "123456");
    expect(result.channel).toBe(NotificationChannel.SMS);
  });

  it("respects an explicit channel override even when email is present", async () => {
    const result = await service.deliver(
      userWithBoth,
      { ...dtoWithoutChannel, channel: NotificationChannel.SMS },
      "123456",
    );
    expect(result.channel).toBe(NotificationChannel.SMS);
  });

  it("throws rather than emailing a phone-only user forced onto the EMAIL channel", async () => {
    await expect(
      service.deliver(
        userPhoneOnly,
        { ...dtoWithoutChannel, channel: NotificationChannel.EMAIL },
        "123456",
      ),
    ).rejects.toThrow(/no email address/i);
  });
});

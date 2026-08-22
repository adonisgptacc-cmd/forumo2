import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, VerifyCallback } from "passport-google-oauth20";
import { ConfigService } from "@nestjs/config";
import { AuthService } from "../auth.service";

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  private readonly configService: ConfigService;
  private readonly authService: AuthService;

  constructor(configService: ConfigService, authService: AuthService) {
    const clientID =
      configService.get<string>("GOOGLE_CLIENT_ID") ||
      process.env.GOOGLE_CLIENT_ID ||
      "test-google-client-id";
    const clientSecret =
      configService.get<string>("GOOGLE_CLIENT_SECRET") ||
      process.env.GOOGLE_CLIENT_SECRET ||
      "test-google-client-secret";
    const callbackURL =
      configService.get<string>("GOOGLE_CALLBACK_URL") ||
      process.env.GOOGLE_CALLBACK_URL ||
      "http://localhost:4000/api/v1/auth/google/callback";

    if (
      !configService.get<string>("GOOGLE_CLIENT_ID") &&
      !process.env.GOOGLE_CLIENT_ID
    ) {
      console.warn(
        "[GoogleStrategy] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is not set. " +
          "Google OAuth will be non-functional until both env vars are configured.",
      );
    }

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ["email", "profile"],
    });

    this.configService = configService;
    this.authService = authService;
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: External SDK or dynamic payload requires flexible typing, TODO: refine to specific type
    profile: any,
    done: VerifyCallback,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: External SDK or dynamic payload requires flexible typing, TODO: refine to specific type
  ): Promise<any> {
    const { id, name, emails, photos } = profile;

    const user = await this.authService.validateOrCreateGoogleUser({
      googleId: id,
      email: emails[0].value,
      name: name.givenName + " " + name.familyName,
      avatarUrl: photos?.[0]?.value,
    });

    done(null, user);
  }
}

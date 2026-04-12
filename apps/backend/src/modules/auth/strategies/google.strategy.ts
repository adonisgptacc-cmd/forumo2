import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
    constructor(
        private readonly configService: ConfigService,
        private readonly authService: AuthService,
    ) {
        const clientID = configService.get<string>('GOOGLE_CLIENT_ID');
        const clientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET');
        if (!clientID || !clientSecret) {
            console.warn(
                '[GoogleStrategy] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is not set. ' +
                'Google OAuth will be non-functional until both env vars are configured.',
            );
        }
        super({
            clientID: clientID ?? 'not-configured',
            clientSecret: clientSecret ?? 'not-configured',
            callbackURL:
                configService.get<string>('GOOGLE_CALLBACK_URL') ??
                'http://localhost:4000/api/v1/auth/google/callback',
            scope: ['email', 'profile'],
        });
    }

    async validate(
        accessToken: string,
        refreshToken: string,
        profile: any,
        done: VerifyCallback,
    ): Promise<any> {
        const { id, name, emails, photos } = profile;

        const user = await this.authService.validateOrCreateGoogleUser({
            googleId: id,
            email: emails[0].value,
            name: name.givenName + ' ' + name.familyName,
            avatarUrl: photos?.[0]?.value,
        });

        done(null, user);
    }
}

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { Request } from 'express';
import { AccessTokenPayload } from '../jwt-payload.interface';
import { readAccessToken } from '../auth-cookies';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      // The access token arrives in an httpOnly cookie; readAccessToken still
      // falls back to the Authorization header so Swagger's Authorize button
      // keeps working.
      jwtFromRequest: (request: Request) => readAccessToken(request) ?? null,
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  validate(payload: AccessTokenPayload): AccessTokenPayload {
    return payload;
  }
}

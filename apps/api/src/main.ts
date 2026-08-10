import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { NextFunction, Request, Response } from 'express';
import { mkdirSync } from 'fs';
import helmet from 'helmet';
import { AppModule } from './app/app.module';
import { UPLOADS_ROOT } from './app/infra/uploads/uploads-path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  mkdirSync(UPLOADS_ROOT, { recursive: true });

  // Both topologies put exactly one proxy in front of the API: nginx in the
  // container, the Angular dev-server under `nx serve`. Without this Express
  // reports that proxy's address as the client IP and every user of the system
  // shares a single rate-limit bucket — ten bad logins would lock out the whole
  // business. Configurable, and disablable with 0, because trusting
  // X-Forwarded-For when nothing sets it lets a caller spoof its own address.
  const trustedProxyHops = Number(process.env.TRUSTED_PROXY_HOPS ?? 1);
  if (trustedProxyHops > 0) {
    app.set('trust proxy', trustedProxyHops);
  }

  // Swagger UI needs inline styles and its own scripts; the rest of the API serves JSON, for
  // which the defaults are right. Uploads are the exception and override this below.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          'script-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:', 'https:'],
        },
      },
    }),
  );

  // Uploads are bytes a user supplied, served back from the app's own origin — so they get
  // a policy of their own rather than the one written for JSON responses. `default-src
  // 'none'` means nothing inside an uploaded file executes or fetches anything, which is
  // what keeps an SVG logo from being a script delivery vehicle (the API's own CSP allows
  // `script-src 'self' 'unsafe-inline'` for Swagger, and an upload *is* 'self'). `nosniff`
  // stops the browser from second-guessing the declared type.
  //
  // Both of these run before useStaticAssets on purpose: Express dispatches middleware in
  // registration order and the static handler answers the request itself, so anything
  // registered after it never sees an /uploads response. That ordering is the whole point —
  // with the static mount first, uploads went out with no security headers at all.
  app.use('/uploads', (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  });
  app.useStaticAssets(UPLOADS_ROOT, { prefix: '/uploads/' });

  // The containerised deployment is same-origin — nginx proxies /api and
  // /uploads — so CORS is only needed for `nx serve`, where the dev-server sits
  // on another port. A deployment opts into cross-origin access explicitly by
  // setting CORS_ORIGIN (comma-separated); production defaults to none.
  const corsOrigin =
    process.env.CORS_ORIGIN ??
    (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4200');

  if (corsOrigin) {
    app.enableCors({
      origin: corsOrigin.split(',').map((origin) => origin.trim()),
      // Both are pagination metadata the browser cannot read unless the server says so.
      exposedHeaders: ['X-Total-Count', 'X-Total-Amount'],
      // The session lives in cookies, which a cross-origin caller only gets to
      // send when the server opts in.
      credentials: true,
    });
  }

  // Session tokens arrive as cookies; without this they are never parsed.
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Villa Management System API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(`🚀 Application is running on: http://localhost:${port}/api/v1`);
  Logger.log(`📘 Swagger docs available at: http://localhost:${port}/api/docs`);
}

bootstrap();

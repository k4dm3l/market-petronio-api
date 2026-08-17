import { Logger } from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import type { RequestWithId } from './request-id.middleware';

const logger = new Logger('HTTP');

/**
 * Structured access log: method path status duration requestId userId.
 * Never logs bodies (passwords / OTP / tokens stay out).
 */
export function httpLoggingMiddleware(
  req: RequestWithId,
  res: Response,
  next: NextFunction,
) {
  const started = Date.now();

  res.on('finish', () => {
    const user = (req as RequestWithId & { user?: { id?: string } }).user;
    const userId = user?.id ?? '-';
    logger.log(
      `${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - started}ms requestId=${req.requestId ?? '-'} userId=${userId}`,
    );
  });

  next();
}

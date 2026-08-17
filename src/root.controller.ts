import { Controller, Get, Header, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from './common/decorators/public.decorator';

@Public()
@SkipThrottle()
@Controller()
export class RootController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  @Header('Content-Type', 'text/plain; charset=utf-8')
  index(@Req() req: Request): string {
    const origin = `${req.protocol}://${req.get('host')}`;
    const apiPrefix = this.config.get<string>('app.apiPrefix', 'api');

    return [
      'Market Petronio API v0.1.0',
      '',
      'Pacific region marketplace API for cooks and customers.',
      '',
      `API base path: /${apiPrefix}`,
      `Documentation: ${origin}/docs`,
      `OpenAPI JSON: ${origin}/docs-json`,
      `Health check: ${origin}/${apiPrefix}/health`,
    ].join('\n');
  }
}

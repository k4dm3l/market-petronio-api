import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type TemplateVars = Record<string, string | undefined>;

@Injectable()
export class EmailTemplatesService {
  private readonly logger = new Logger(EmailTemplatesService.name);
  private readonly templatesDir = join(__dirname, 'templates');

  constructor(private readonly config: ConfigService) {}

  get platformUrl(): string {
    return (
      this.config.get<string>('email.platformUrl') ?? 'http://localhost:5173'
    ).replace(/\/$/, '');
  }

  render(
    templateName: string,
    title: string,
    vars: TemplateVars,
    cta?: { label: string; url: string },
  ): string {
    const content = this.fill(this.load(templateName), vars);
    const layoutVars: TemplateVars = {
      title,
      content,
      ctaUrl: cta?.url,
      ctaLabel: cta?.label,
    };
    return this.fill(this.load('layouts/base'), layoutVars);
  }

  private load(relativePath: string): string {
    const file = relativePath.endsWith('.html')
      ? relativePath
      : `${relativePath}.html`;
    try {
      return readFileSync(join(this.templatesDir, file), 'utf8');
    } catch (err) {
      this.logger.error(`Missing email template: ${file}`);
      throw err;
    }
  }

  private fill(template: string, vars: TemplateVars): string {
    let html = template.replace(
      /\{\{#cta\}\}([\s\S]*?)\{\{\/cta\}\}/g,
      (_match, block: string) =>
        vars.ctaUrl && vars.ctaLabel ? block : '',
    );

    for (const [key, value] of Object.entries(vars)) {
      html = html.replaceAll(`{{${key}}}`, value ?? '');
    }

    // Strip any leftover placeholders
    return html.replace(/\{\{[a-zA-Z0-9_]+\}\}/g, '');
  }
}

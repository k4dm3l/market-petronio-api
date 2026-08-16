import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { escapeRegex } from '../common/utils/escape-regex';
import {
  applyTextAscIdCursor,
  paginateSlice,
  resolveLimit,
} from '../common/pagination/cursor.util';
import { CreateTagDto, FindTagsQueryDto } from './dto/tag.dto';
import { Tag, TagDocument } from './schemas/tag.schema';
import { normalizeTagText } from './tag-text.util';

@Injectable()
export class TagsService {
  constructor(@InjectModel(Tag.name) private tagModel: Model<TagDocument>) {}

  /**
   * Idempotent create: returns existing tag on duplicate text (unique index).
   * `created` is true only when a new document was inserted.
   */
  async createOrGet(dto: CreateTagDto): Promise<{
    tag: ReturnType<TagsService['toResponse']>;
    created: boolean;
  }> {
    const text = normalizeTagText(dto.text);

    const existing = await this.tagModel.findOne({ text }).exec();
    if (existing) {
      return { tag: this.toResponse(existing), created: false };
    }

    try {
      const tag = await this.tagModel.create({ text });
      return { tag: this.toResponse(tag), created: true };
    } catch (err: unknown) {
      if (this.isDuplicateKey(err)) {
        const again = await this.tagModel.findOne({ text }).exec();
        if (again) {
          return { tag: this.toResponse(again), created: false };
        }
      }
      throw err;
    }
  }

  async findAll(query: FindTagsQueryDto) {
    const limit = resolveLimit(query.limit);
    const filter: Record<string, unknown> = {};

    if (query.search?.trim()) {
      const q = escapeRegex(normalizeTagText(query.search));
      filter.text = { $regex: q, $options: 'i' };
    }

    applyTextAscIdCursor(filter, query.cursor);

    const rows = await this.tagModel
      .find(filter)
      .sort({ text: 1, _id: 1 })
      .limit(limit + 1)
      .exec();

    return paginateSlice(rows, limit, (t) => this.toResponse(t), (t) => ({
      text: t.text,
      id: t.id,
    }));
  }

  /** Assert every normalized tag text exists in the global catalog. */
  async assertTagsExist(texts: string[]): Promise<void> {
    if (!texts.length) return;
    const unique = [...new Set(texts)];
    const found = await this.tagModel
      .find({ text: { $in: unique } })
      .select('text')
      .exec();
    const foundSet = new Set(found.map((t) => t.text));
    const missing = unique.filter((t) => !foundSet.has(t));
    if (missing.length) {
      throw new BadRequestException(
        `Unknown tags (create via POST /tags as admin): ${missing.join(', ')}`,
      );
    }
  }

  private isDuplicateKey(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: number }).code === 11000
    );
  }

  private toResponse(tag: TagDocument) {
    return {
      id: tag.id,
      text: tag.text,
      createdAt: (tag as TagDocument & { createdAt?: Date }).createdAt,
      updatedAt: (tag as TagDocument & { updatedAt?: Date }).updatedAt,
    };
  }
}

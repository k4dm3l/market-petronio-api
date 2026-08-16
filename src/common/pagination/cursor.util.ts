import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import {
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
} from './cursor-pagination.dto';
import { PaginatedResponse } from './paginated-response';

export type CreatedAtCursor = { createdAt: string; id: string };
export type DistanceCursor = { distance: number; id: string };
export type TextAscCursor = { text: string; id: string };

export function resolveLimit(limit?: number): number {
  const n = limit ?? DEFAULT_PAGE_LIMIT;
  if (!Number.isInteger(n) || n < 1 || n > MAX_PAGE_LIMIT) {
    throw new BadRequestException(
      `limit must be an integer between 1 and ${MAX_PAGE_LIMIT}`,
    );
  }
  return n;
}

export function encodeCursor(payload: object): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodeJson(cursor: string): unknown {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw new BadRequestException('Invalid pagination cursor');
  }
}

export function decodeCreatedAtCursor(cursor: string): CreatedAtCursor {
  const parsed = decodeJson(cursor) as CreatedAtCursor;
  if (
    !parsed?.id ||
    !parsed?.createdAt ||
    !Types.ObjectId.isValid(parsed.id) ||
    Number.isNaN(Date.parse(parsed.createdAt))
  ) {
    throw new BadRequestException('Invalid pagination cursor');
  }
  return parsed;
}

export function decodeDistanceCursor(cursor: string): DistanceCursor {
  const parsed = decodeJson(cursor) as DistanceCursor;
  if (
    !parsed?.id ||
    typeof parsed.distance !== 'number' ||
    !Number.isFinite(parsed.distance) ||
    !Types.ObjectId.isValid(parsed.id)
  ) {
    throw new BadRequestException('Invalid pagination cursor');
  }
  return parsed;
}

export function decodeTextAscCursor(cursor: string): TextAscCursor {
  const parsed = decodeJson(cursor) as TextAscCursor;
  if (
    !parsed?.id ||
    typeof parsed.text !== 'string' ||
    !parsed.text ||
    !Types.ObjectId.isValid(parsed.id)
  ) {
    throw new BadRequestException('Invalid pagination cursor');
  }
  return parsed;
}

/** Mutates filter for text ASC, _id ASC continuation. */
export function applyTextAscIdCursor(
  filter: Record<string, unknown>,
  cursor?: string,
): void {
  if (!cursor) return;
  const decoded = decodeTextAscCursor(cursor);
  const cursorId = new Types.ObjectId(decoded.id);
  const cursorClause = {
    $or: [
      { text: { $gt: decoded.text } },
      { text: decoded.text, _id: { $gt: cursorId } },
    ],
  };

  if (filter.$or) {
    const existingOr = filter.$or;
    delete filter.$or;
    filter.$and = [
      ...((filter.$and as Record<string, unknown>[]) ?? []),
      { $or: existingOr },
      cursorClause,
    ];
    return;
  }

  if (filter.$and) {
    (filter.$and as Record<string, unknown>[]).push(cursorClause);
    return;
  }

  Object.assign(filter, cursorClause);
}

/** Mutates filter for createdAt DESC, _id DESC continuation (composes with existing $or). */
export function applyCreatedAtIdCursor(
  filter: Record<string, unknown>,
  cursor?: string,
): void {
  if (!cursor) return;
  const decoded = decodeCreatedAtCursor(cursor);
  const cursorDate = new Date(decoded.createdAt);
  const cursorId = new Types.ObjectId(decoded.id);
  const cursorClause = {
    $or: [
      { createdAt: { $lt: cursorDate } },
      { createdAt: cursorDate, _id: { $lt: cursorId } },
    ],
  };

  if (filter.$or) {
    const existingOr = filter.$or;
    delete filter.$or;
    filter.$and = [
      ...((filter.$and as Record<string, unknown>[]) ?? []),
      { $or: existingOr },
      cursorClause,
    ];
    return;
  }

  if (filter.$and) {
    (filter.$and as Record<string, unknown>[]).push(cursorClause);
    return;
  }

  Object.assign(filter, cursorClause);
}

/**
 * Slice limit+1 docs into a page and build nextCursor from the last item.
 * `getCursorPayload` receives the last document of the page.
 */
export function paginateSlice<TDoc, TOut>(
  docs: TDoc[],
  limit: number,
  mapItem: (doc: TDoc) => TOut,
  getCursorPayload: (doc: TDoc) => object,
): PaginatedResponse<TOut> {
  const hasMore = docs.length > limit;
  const page = hasMore ? docs.slice(0, limit) : docs;
  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last != null ? encodeCursor(getCursorPayload(last)) : null;
  return {
    data: page.map(mapItem),
    pagination: { nextCursor, hasMore },
  };
}

export function createdAtIdPayload(doc: {
  id?: string;
  _id?: Types.ObjectId;
  createdAt?: Date;
}): CreatedAtCursor {
  const id = doc.id ?? String(doc._id);
  return {
    id,
    createdAt: (doc.createdAt ?? new Date(0)).toISOString(),
  };
}

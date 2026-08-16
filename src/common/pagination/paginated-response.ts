import { PaginationMetaDto } from './cursor-pagination.dto';

export type PaginationMeta = PaginationMetaDto;

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

export function emptyPage<T>(): PaginatedResponse<T> {
  return { data: [], pagination: { nextCursor: null, hasMore: false } };
}

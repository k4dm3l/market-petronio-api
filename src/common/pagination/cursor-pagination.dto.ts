import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

/** Shared `?limit=` + `?cursor=` for collection GET endpoints. */
export class CursorPaginationQueryDto {
  @ApiPropertyOptional({
    example: DEFAULT_PAGE_LIMIT,
    default: DEFAULT_PAGE_LIMIT,
    description: `Page size (1–${MAX_PAGE_LIMIT})`,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_LIMIT)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Opaque cursor from the previous page `pagination.nextCursor`',
    example: 'eyJjcmVhdGVkQXQiOiIyMDI2LTA4LTE2VDEyOjAwOjAwLjAwMFoiLCJpZCI6IjY4YWYifQ',
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}

export class PaginationMetaDto {
  @ApiPropertyOptional({
    nullable: true,
    example: 'eyJjcmVhdGVkQXQiOiIyMDI2LTA4LTE2VDEyOjAwOjAwLjAwMFoiLCJpZCI6IjY4YWYifQ',
  })
  nextCursor: string | null;

  @ApiProperty({ example: true })
  hasMore: boolean;
}

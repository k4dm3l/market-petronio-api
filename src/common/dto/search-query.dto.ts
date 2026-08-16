import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CursorPaginationQueryDto } from '../pagination/cursor-pagination.dto';

/** `?search=` + cursor pagination for collection list endpoints. */
export class SearchQueryDto extends CursorPaginationQueryDto {
  @ApiPropertyOptional({
    example: 'maría',
    description:
      'Case-insensitive partial text match (fields depend on the resource).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

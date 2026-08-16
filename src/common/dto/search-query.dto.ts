import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Shared optional `?search=` for list endpoints. */
export class SearchQueryDto {
  @ApiPropertyOptional({
    example: 'maría',
    description: 'Case-insensitive partial text match (fields depend on the resource).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

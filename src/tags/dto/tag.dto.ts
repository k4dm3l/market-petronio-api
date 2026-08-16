import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { SearchQueryDto } from '../../common/dto/search-query.dto';
import { PaginationMetaDto } from '../../common/pagination/cursor-pagination.dto';

export class CreateTagDto {
  @ApiProperty({ example: 'Seafood', maxLength: 50 })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  text: string;
}

/** GET /tags — cursor pagination + optional search (extends SearchQueryDto). */
export class FindTagsQueryDto extends SearchQueryDto {}

export class TagResponseDto {
  @ApiProperty({ example: '68af1a2b3c4d5e6f78901234' })
  id: string;

  @ApiProperty({ example: 'seafood' })
  text: string;

  @ApiPropertyOptional({ example: '2026-08-16T20:00:00.000Z' })
  createdAt?: Date;

  @ApiPropertyOptional({ example: '2026-08-16T20:00:00.000Z' })
  updatedAt?: Date;
}

export class TagsListResponseDto {
  @ApiProperty({ type: [TagResponseDto] })
  data: TagResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination: PaginationMetaDto;
}

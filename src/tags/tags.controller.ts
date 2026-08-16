import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import {
  CreateTagDto,
  FindTagsQueryDto,
  TagResponseDto,
  TagsListResponseDto,
} from './dto/tag.dto';
import { TagsService } from './tags.service';

@ApiTags('tags')
@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'List tags (global catalog)',
    description:
      'Cursor pagination ordered by `text` ASC. Optional `search` (normalized) matches tag text. Spec 009.',
  })
  @ApiOkResponse({ type: TagsListResponseDto })
  findAll(@Query() query: FindTagsQueryDto) {
    return this.tagsService.findAll(query);
  }

  @ApiBearerAuth()
  @Roles(Role.Admin)
  @Post()
  @ApiOperation({
    summary: 'Create tag (admin, idempotent)',
    description:
      'Normalizes text (trim + lowercase). Returns **201** when created, **200** when the tag already exists. Unique index on `text`.',
  })
  @ApiCreatedResponse({ type: TagResponseDto })
  @ApiOkResponse({ type: TagResponseDto })
  async create(
    @Body() dto: CreateTagDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { tag, created } = await this.tagsService.createOrGet(dto);
    res.status(created ? 201 : 200);
    return tag;
  }
}

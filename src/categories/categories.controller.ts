import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { SearchQueryDto } from '../common/dto/search-query.dto';
import { Role } from '../common/enums/role.enum';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'List active categories',
    description:
      'Cursor pagination (`limit`, `cursor`). Optional `search` matches name or description.',
  })
  findAll(@Query() query: SearchQueryDto) {
    return this.categoriesService.findAll(false, query);
  }

  @ApiBearerAuth()
  @Roles(Role.Admin)
  @Get('all')
  @ApiOperation({
    summary: 'List all categories including inactive (admin)',
    description:
      'Cursor pagination (`limit`, `cursor`). Optional `search` matches name or description.',
  })
  findAllAdmin(@Query() query: SearchQueryDto) {
    return this.categoriesService.findAll(true, query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get active category by id' })
  findOne(@Param('id') id: string) {
    return this.categoriesService.findOne(id, false);
  }

  @ApiBearerAuth()
  @Roles(Role.Admin)
  @Post()
  @ApiOperation({ summary: 'Create category (admin)' })
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @ApiBearerAuth()
  @Roles(Role.Admin)
  @Patch(':id')
  @ApiOperation({ summary: 'Update / activate-deactivate category (admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.update(id, dto);
  }
}

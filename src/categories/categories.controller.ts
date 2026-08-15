import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List active categories' })
  findAll() {
    return this.categoriesService.findAll(false);
  }

  @ApiBearerAuth()
  @Roles(Role.Admin)
  @Get('all')
  @ApiOperation({ summary: 'List all categories including inactive (admin)' })
  findAllAdmin() {
    return this.categoriesService.findAll(true);
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

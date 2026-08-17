import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { CooksService } from './cooks.service';
import { CreateCookDto, QueryCooksDto, UpdateCookDto } from './dto/cook.dto';

@ApiTags('cooks')
@ApiBearerAuth()
@Controller('cooks')
export class CooksController {
  constructor(private readonly cooksService: CooksService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary:
      'List active cooks (optional proximity: lat, lng, radius meters)',
    description:
      'Cursor pagination (`limit`, `cursor`). Optional `tags` filters specialties with `$in` (any match).',
  })
  findAll(@Query() query: QueryCooksDto) {
    return this.cooksService.findAll(query);
  }

  @Roles(Role.Cook)
  @Get('me/dashboard')
  @ApiOperation({
    summary:
      'Cook dashboard: pending/preparing/shipped counts, monthly sales, product stock',
  })
  dashboard(@CurrentUser() user: AuthUser) {
    return this.cooksService.getDashboard(user);
  }

  @Public()
  @Get(':id')
  @ApiOperation({
    summary:
      'Get cook profile (exact coordinates only for owner/admin; public sees city label)',
  })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.cooksService.findOne(id, user);
  }

  @Roles(Role.Admin)
  @Post()
  @ApiOperation({
    summary: 'Create cook profile for an existing user (admin only)',
  })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCookDto) {
    return this.cooksService.create(user, dto);
  }

  @Roles(Role.Cook, Role.Admin)
  @Patch(':id')
  @ApiOperation({
    summary: 'Update cook profile (owner or admin; isActive is admin-only)',
  })
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateCookDto,
  ) {
    return this.cooksService.update(id, user, dto);
  }
}

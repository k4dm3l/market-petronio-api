import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CursorPaginationQueryDto } from '../common/pagination/cursor-pagination.dto';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary:
      'List email notifications for the current user (MVP inbox for order events)',
    description:
      'Cursor pagination (`limit`, `cursor`). Spec §12: emails on order created/confirmed/paid/shipped/delivered.',
  })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query() query: CursorPaginationQueryDto,
  ) {
    return this.notificationsService.listForUser(user.id, query);
  }
}

import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
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
      'Spec §12: emails on order created/confirmed/paid/shipped/delivered. Records are stored for history.',
  })
  findAll(@CurrentUser() user: AuthUser) {
    return this.notificationsService.listForUser(user.id);
  }
}

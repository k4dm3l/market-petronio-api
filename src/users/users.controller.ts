import {
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { ImageUploadResponseDto, ImageDeletedResponseDto } from '../images/dto/image-upload-response.dto';
import { UpsertDeliveryInformationDto } from './dto/delivery-information.dto';
import { UserMeResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles(Role.Customer, Role.Cook, Role.Admin)
  @Get('me')
  @ApiOperation({
    summary: 'Get current user profile',
    description:
      'Includes `image` (`{ url }`) and `deliveryInformation` when set.',
  })
  @ApiOkResponse({ type: UserMeResponseDto })
  getMe(@CurrentUser() user: AuthUser) {
    return this.usersService.getMe(user.id);
  }

  @Roles(Role.Customer)
  @Patch('me/delivery-information')
  @ApiOperation({
    summary: 'Set or replace default delivery information',
    description:
      'Single default address for MVP. Used when creating orders with `delivery.source = CUSTOMER_PROFILE`.',
  })
  @ApiOkResponse({ type: UserMeResponseDto })
  upsertDelivery(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpsertDeliveryInformationDto,
  ) {
    return this.usersService.upsertDeliveryInformation(user.id, dto);
  }

  @Roles(Role.Customer, Role.Cook, Role.Admin)
  @Post('me/image')
  @ApiOperation({
    summary: 'Upload or replace profile image',
    description:
      'multipart field `file`. JPEG/PNG/WEBP, max 5 MB. Replaces any existing profile image and deletes the previous Cloudinary asset.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'JPEG, PNG, or WEBP image (max 5 MB)',
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Public URL of the uploaded profile image',
    type: ImageUploadResponseDto,
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadImage(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.usersService.uploadProfileImage(user.id, file);
  }

  @Roles(Role.Customer, Role.Cook, Role.Admin)
  @Delete('me/image')
  @ApiOperation({
    summary: 'Delete profile image',
    description: 'Removes the Cloudinary asset and clears `user.image`.',
  })
  @ApiOkResponse({ type: ImageDeletedResponseDto })
  deleteImage(@CurrentUser() user: AuthUser) {
    return this.usersService.deleteProfileImage(user.id);
  }
}

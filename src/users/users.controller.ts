import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import {
  ImageDeletedResponseDto,
  ImageUploadResponseDto,
} from '../images/dto/image-upload-response.dto';
import { UpsertDeliveryInformationDto } from './dto/delivery-information.dto';
import {
  CreateAddressDto,
  UpdateAddressDto,
} from './dto/update-address.dto';
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
      'Includes `image` (`{ url }`), `addresses`, and legacy `deliveryInformation` when set.',
  })
  @ApiOkResponse({ type: UserMeResponseDto })
  getMe(@CurrentUser() user: AuthUser) {
    return this.usersService.getMe(user.id);
  }

  @Roles(Role.Customer)
  @Post('me/addresses')
  @ApiOperation({
    summary: 'Add a saved address',
    description:
      'First address is always primary. Setting `isPrimary: true` demotes any previous primary atomically.',
  })
  @ApiOkResponse({ type: UserMeResponseDto })
  createAddress(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateAddressDto,
  ) {
    return this.usersService.createAddress(user.id, dto);
  }

  @Roles(Role.Customer)
  @Patch('me/addresses/:addressId')
  @ApiOperation({
    summary: 'Partially update a saved address',
    description:
      "Updates fields on the authenticated user's address by `addressId`. Setting `isPrimary: true` demotes other primaries atomically. Unsetting the only primary returns 400.",
  })
  @ApiParam({ name: 'addressId', example: '01K2ABC...' })
  @ApiOkResponse({ type: UserMeResponseDto })
  updateAddress(
    @CurrentUser() user: AuthUser,
    @Param('addressId') addressId: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.usersService.updateAddress(user.id, addressId, dto);
  }

  @Roles(Role.Customer)
  @Delete('me/addresses/:addressId')
  @ApiOperation({
    summary: 'Delete a saved address',
    description:
      'Removes the address by id. If the deleted address was primary and others remain, the first remaining address becomes primary.',
  })
  @ApiParam({ name: 'addressId', example: '01K2ABC...' })
  @ApiOkResponse({ type: UserMeResponseDto })
  deleteAddress(
    @CurrentUser() user: AuthUser,
    @Param('addressId') addressId: string,
  ) {
    return this.usersService.deleteAddress(user.id, addressId);
  }

  @Roles(Role.Customer)
  @Patch('me/delivery-information')
  @ApiOperation({
    summary: 'Set or replace default delivery information (legacy)',
    description:
      'Single default address for MVP. Prefer `POST /users/me/addresses`. Still used when creating orders with `delivery.source = CUSTOMER_PROFILE` if no saved addresses exist.',
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

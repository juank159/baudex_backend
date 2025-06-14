import {
  Controller,
  Get,
  Patch,
  Body,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  Post,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TransformInterceptor } from 'src/common/interceptors/transform.interceptor';

import { UserResponseDto } from './dto/user-response.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UsersService } from './users.service';

@Controller('profile')
@UseInterceptors(new TransformInterceptor(UserResponseDto))
export class UserProfileController {
  constructor(private readonly userService: UsersService) {}

  @Get()
  async getProfile(/* @CurrentUser() user */): Promise<UserResponseDto> {
    // TODO: Implementar después de la autenticación
    // return this.userService.findOne(user.id);
    throw new Error('Requires authentication implementation');
  }

  @Patch()
  async updateProfile(
    /* @CurrentUser() user, */
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    // TODO: Implementar después de la autenticación
    // return this.userService.update(user.id, updateUserDto);
    throw new Error('Requires authentication implementation');
  }

  @Patch('password')
  async changePassword(
    /* @CurrentUser() user, */
    @Body() changePasswordDto: ChangePasswordDto,
  ): Promise<void> {
    // TODO: Implementar después de la autenticación
    // return this.userService.changePassword(user.id, changePasswordDto);
    throw new Error('Requires authentication implementation');
  }

  @Post('avatar')
  @UseInterceptors(FileInterceptor('avatar'))
  async uploadAvatar(
    /* @CurrentUser() user, */
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|webp)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ): Promise<UserResponseDto> {
    // TODO: Implementar después de la autenticación y file upload
    // const avatarUrl = await this.fileUploadService.uploadFile(file, 'avatars');
    // return this.userService.update(user.id, { avatar: avatarUrl });
    throw new Error('Requires authentication and file upload implementation');
  }
}

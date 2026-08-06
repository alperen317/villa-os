import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccessTokenPayload } from '../auth/jwt-payload.interface';
import { RequirePermission } from '../permissions/decorators/require-permission.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SafeUser } from './users.repository';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
@RequirePermission('users.manage')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a user' })
  create(@Body() dto: CreateUserDto): Promise<SafeUser> {
    return this.usersService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List users (paginated)' })
  async findAll(
    @Query() query: ListUsersQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SafeUser[]> {
    const { data, total } = await this.usersService.findAll(query);
    res.setHeader('X-Total-Count', String(total));
    return data;
  }

  @Patch(':id')
  @ApiOperation({ summary: "Change a user's role" })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto): Promise<SafeUser> {
    return this.usersService.update(id, dto);
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate a user' })
  activate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AccessTokenPayload,
  ): Promise<SafeUser> {
    return this.usersService.setActive(id, true, currentUser.sub);
  }

  @Post(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate a user' })
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AccessTokenPayload,
  ): Promise<SafeUser> {
    return this.usersService.setActive(id, false, currentUser.sub);
  }

  @Post(':id/reset-password')
  @ApiOperation({ summary: "Reset a user's password" })
  resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetPasswordDto,
  ): Promise<SafeUser> {
    return this.usersService.resetPassword(id, dto);
  }
}

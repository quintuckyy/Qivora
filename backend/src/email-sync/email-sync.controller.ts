import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { EmailSyncService } from './email-sync.service';
import { ExchangeCodeDto } from './dto/exchange-code.dto';
import { ConfirmSuggestionDto } from './dto/confirm-suggestion.dto';

type JwtUser = {
  sub: string;
};

@ApiTags('email-sync')
@ApiBearerAuth()
@Controller('email-sync')
@UseGuards(JwtAuthGuard)
export class EmailSyncController {
  constructor(private readonly emailSyncService: EmailSyncService) {}

  @ApiOperation({ summary: 'Get the Google OAuth consent URL to connect Gmail' })
  @Get('gmail/auth-url')
  getAuthUrl() {
    return this.emailSyncService.getAuthUrl();
  }

  @ApiOperation({ summary: 'Exchange a Google OAuth authorization code for a Gmail connection' })
  @Post('gmail/exchange')
  exchangeCode(@CurrentUser() user: JwtUser, @Body() dto: ExchangeCodeDto) {
    return this.emailSyncService.exchangeCode(user.sub, dto.code);
  }

  @ApiOperation({ summary: 'Get the caller\'s Gmail connection status' })
  @Get('gmail/status')
  getStatus(@CurrentUser() user: JwtUser) {
    return this.emailSyncService.getStatus(user.sub);
  }

  @ApiOperation({ summary: 'Disconnect Gmail and revoke the stored token' })
  @Post('gmail/disconnect')
  disconnect(@CurrentUser() user: JwtUser) {
    return this.emailSyncService.disconnect(user.sub);
  }

  @ApiOperation({ summary: 'Scan recent Gmail messages for application-related updates' })
  @Post('gmail/sync')
  sync(@CurrentUser() user: JwtUser) {
    return this.emailSyncService.sync(user.sub);
  }

  @ApiOperation({ summary: 'List pending email-derived suggestions awaiting review' })
  @Get('suggestions')
  listSuggestions(@CurrentUser() user: JwtUser) {
    return this.emailSyncService.listSuggestions(user.sub);
  }

  @ApiOperation({ summary: 'Confirm a suggestion — creates or updates the matched application' })
  @Post('suggestions/:id/confirm')
  confirmSuggestion(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ConfirmSuggestionDto,
  ) {
    return this.emailSyncService.confirmSuggestion(user.sub, id, dto);
  }

  @ApiOperation({ summary: 'Dismiss a suggestion without changing any application' })
  @Post('suggestions/:id/dismiss')
  dismissSuggestion(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.emailSyncService.dismissSuggestion(user.sub, id);
  }
}

import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ApplicationsModule } from '../applications/applications.module';
import { EmailSyncController } from './email-sync.controller';
import { EmailSyncService } from './email-sync.service';
import { GmailOAuthClient } from './gmail/gmail-oauth.client';
import { GmailApiClient } from './gmail/gmail-api.client';

@Module({
  imports: [AuthModule, ApplicationsModule],
  controllers: [EmailSyncController],
  providers: [EmailSyncService, GmailOAuthClient, GmailApiClient],
})
export class EmailSyncModule {}

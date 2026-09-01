import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { buildThrottlerOptions } from './config/throttling';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { ApplicationsModule } from './applications/applications.module';
import { InterviewsModule } from './interviews/interviews.module';
import { NotesModule } from './notes/notes.module';
import { ResumesModule } from './resumes/resumes.module';
import { EmailSyncModule } from './email-sync/email-sync.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot(buildThrottlerOptions()),
    DatabaseModule,
    AuthModule,
    ApplicationsModule,
    InterviewsModule,
    NotesModule,
    ResumesModule,
    EmailSyncModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Applies the baseline rate limit to every route; individual routes tighten
    // it with @Throttle() (see AuthController).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}

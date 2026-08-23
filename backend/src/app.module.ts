import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
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
    DatabaseModule,
    AuthModule,
    ApplicationsModule,
    InterviewsModule,
    NotesModule,
    ResumesModule,
    EmailSyncModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
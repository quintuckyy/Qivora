import { IsUUID } from 'class-validator';

export class AssignResumeDto {
  @IsUUID()
  resumeId!: string;
}
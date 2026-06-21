import { IsIn } from 'class-validator';

export class UpdateMeetingStatusDto {
  @IsIn(['Scheduled', 'Active', 'Ended'] as const)
  status!: 'Scheduled' | 'Active' | 'Ended';
}

import { IsString, IsNotEmpty, IsOptional, IsEnum, IsDateString } from 'class-validator';

export class CreateMeetingDto {
  @IsString()
  @IsNotEmpty()
  dealId!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}
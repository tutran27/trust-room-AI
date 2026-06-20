import { IsString, MinLength } from 'class-validator';

export class CreateDisputeDto {
  @IsString()
  dealId!: string;

  @IsString()
  @MinLength(10)
  description!: string;

  @IsString()
  @MinLength(3)
  reason!: string;
}

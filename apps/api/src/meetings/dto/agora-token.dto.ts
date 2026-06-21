import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsPositive } from 'class-validator';

export class GetAgoraTokenDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  uid!: number;

  @IsOptional()
  @Type(() => Number)
  @IsIn([1, 2] as const)
  role?: 1 | 2;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  expiry?: number;
}

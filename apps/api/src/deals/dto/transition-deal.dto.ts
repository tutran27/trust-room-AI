import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { dealActionSchema } from '@trustroom/types';

const dealActions = dealActionSchema.options;

export class TransitionDealDto {
  @IsEnum(dealActions)
  action!: (typeof dealActions)[number];

  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedVersion!: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

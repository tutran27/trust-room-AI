import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

export class UpdateDealDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedVersion!: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(?:0|[1-9]\d{0,19})(?:\.\d{1,18})?$/, {
    message: 'amount must be a positive decimal string with up to 20 integer and 18 fractional digits.',
  })
  amount?: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;
}

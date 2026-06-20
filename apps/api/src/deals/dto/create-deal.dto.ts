import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { dealTypeSchema, tokenSchema } from '@trustroom/types';

const dealTypes = dealTypeSchema.options;
const tokens = tokenSchema.options;

export class CreateDealDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  title!: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  description?: string;

  @IsEnum(dealTypes)
  type!: (typeof dealTypes)[number];

  @IsString()
  @Matches(/^(?:0|[1-9]\d{0,19})(?:\.\d{1,18})?$/, {
    message: 'amount must be a positive decimal string with up to 20 integer and 18 fractional digits.',
  })
  amount!: string;

  @IsEnum(tokens)
  token!: (typeof tokens)[number];

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, { message: 'Invalid Solana wallet address.' })
  sellerWallet?: string;
}

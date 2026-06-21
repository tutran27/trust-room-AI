import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Raise-dispute payload. The disputing party (actor wallet) comes from the JWT,
 * not the body. Reason / evidenceHash are optional context captured at the
 * moment a dispute is opened.
 */
export class RaiseDisputeDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  evidenceHash?: string;
}

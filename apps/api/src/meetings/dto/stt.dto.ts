import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class StartMeetingSttDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsString({ each: true })
  languages?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  targetLanguages?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  maxIdleTime?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(32)
  @IsString({ each: true })
  subscribeAudioUids?: string[];

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  enableTranslation?: boolean;
}

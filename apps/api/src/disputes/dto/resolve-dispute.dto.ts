import { IsEnum } from 'class-validator';

export class ResolveDisputeDto {
  @IsEnum(['ReleaseToSeller', 'RefundToBuyer', 'SplitPayment'])
  resolution!: 'ReleaseToSeller' | 'RefundToBuyer' | 'SplitPayment';
}
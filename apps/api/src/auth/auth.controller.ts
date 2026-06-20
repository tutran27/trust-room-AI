import {
  Inject,
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedRequest } from '../common/authenticated-request';
import { AuthService } from './auth.service';
import { isValidSignature, isValidSolanaAddress } from './auth.utils';
import { NonceRequestDto } from './dto/nonce.dto';
import { VerifyRequestDto } from './dto/verify.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post('nonce')
  async getNonce(@Body() dto: NonceRequestDto) {
    if (!isValidSolanaAddress(dto.walletAddress)) {
      throw new BadRequestException('walletAddress must be a valid Solana address.');
    }
    return this.authService.getNonce(dto.walletAddress);
  }

  @Post('verify-signature')
  async verify(@Body() dto: VerifyRequestDto) {
    if (!isValidSolanaAddress(dto.walletAddress)) {
      throw new BadRequestException('walletAddress must be a valid Solana address.');
    }
    if (!isValidSignature(dto.signature)) {
      throw new BadRequestException('signature must be a valid base58 Ed25519 signature.');
    }
    return this.authService.verifySignature(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('session')
  async getSession(@Req() req: AuthenticatedRequest) {
    return req.user;
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@Req() req: AuthenticatedRequest) {
    return req.user;
  }
}

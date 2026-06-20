import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AppException } from '../common/app-exception';
import { PrismaService } from '../database/prisma.service';
import { VerifyRequestDto } from './dto/verify.dto';
import {
  buildAuthMessage,
  constantTimeHexEqual,
  createNonce,
  hashNonce,
  verifyDetachedSignature,
} from './auth.utils';

@Injectable()
export class AuthService {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwt: JwtService,
  ) {}

  async getNonce(walletAddress: string): Promise<{
    challengeId: string;
    nonce: string;
    message: string;
    expiresAt: string;
  }> {
    const issuedAt = new Date();
    const expiresAt = new Date(
      issuedAt.getTime() +
        this.config.getOrThrow<number>('AUTH_NONCE_TTL_SECONDS') * 1000,
    );
    const nonce = createNonce();
    const challenge = await this.prisma.authNonce.create({
      data: {
        wallet: walletAddress,
        nonceHash: hashNonce(nonce),
        domain: this.config.getOrThrow<string>('AUTH_DOMAIN'),
        uri: this.config.getOrThrow<string>('AUTH_URI'),
        issuedAt,
        expiresAt,
      },
    });

    return {
      challengeId: challenge.challengeId,
      nonce,
      message: buildAuthMessage({
        domain: challenge.domain,
        uri: challenge.uri,
        wallet: walletAddress,
        nonce,
        issuedAt,
        expiresAt,
      }),
      expiresAt: expiresAt.toISOString(),
    };
  }

  async verifySignature(dto: VerifyRequestDto): Promise<{
    accessToken: string;
    userId: string;
    walletAddress: string;
  }> {
    const challenge = await this.prisma.authNonce.findUnique({
      where: { challengeId: dto.challengeId },
    });

    if (!challenge || challenge.wallet !== dto.walletAddress) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        'AUTH_INVALID',
        'Challenge is invalid for this wallet.',
      );
    }

    if (challenge.usedAt) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        'AUTH_REPLAYED',
        'Challenge has already been used.',
      );
    }

    if (challenge.expiresAt.getTime() <= Date.now()) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        'AUTH_EXPIRED',
        'Challenge has expired.',
      );
    }

    const providedHash = hashNonce(dto.nonce);
    if (!constantTimeHexEqual(challenge.nonceHash, providedHash)) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        'AUTH_INVALID',
        'Challenge nonce does not match.',
      );
    }

    const message = buildAuthMessage({
      domain: challenge.domain,
      uri: challenge.uri,
      wallet: challenge.wallet,
      nonce: dto.nonce,
      issuedAt: challenge.issuedAt,
      expiresAt: challenge.expiresAt,
    });

    if (
      !verifyDetachedSignature({
        message,
        signature: dto.signature,
        wallet: dto.walletAddress,
      })
    ) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        'AUTH_INVALID',
        'Signature verification failed.',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const consume = await tx.authNonce.updateMany({
        where: {
          challengeId: dto.challengeId,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });

      if (consume.count !== 1) {
        throw new AppException(
          HttpStatus.UNAUTHORIZED,
          'AUTH_REPLAYED',
          'Challenge was already consumed.',
        );
      }

      const wallet = await tx.wallet.findUnique({
        where: { address: dto.walletAddress },
      });

      if (wallet) {
        return { userId: wallet.userId, walletAddress: wallet.address };
      }

      const user = await tx.user.create({
        data: {
          wallets: {
            create: {
              address: dto.walletAddress,
            },
          },
        },
        include: {
          wallets: true,
        },
      });

      return {
        userId: user.id,
        walletAddress: user.wallets[0]?.address ?? dto.walletAddress,
      };
    });

    return {
      accessToken: this.jwt.sign({
        sub: result.userId,
        wallet: result.walletAddress,
      }),
      userId: result.userId,
      walletAddress: result.walletAddress,
    };
  }
}

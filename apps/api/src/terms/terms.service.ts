import { HttpStatus, Inject, Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { join, extname } from 'node:path';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class TermsService {
  private readonly uploadDir: string;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {
    // Files stored on disk under apps/api/uploads/terms/
    this.uploadDir = join(__dirname, '..', '..', 'uploads', 'terms');
    if (!existsSync(this.uploadDir)) {
      mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  /**
   * Upload a terms file for a deal. Only the seller can upload.
   * Stores the file on disk and returns the saved metadata.
   */
  async uploadTerms(
    dealId: string,
    actorWallet: string,
    file: Express.Multer.File,
  ) {
    // Verify deal exists and actor is the seller
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      include: { participants: true },
    });
    if (!deal) throw new NotFoundException('Deal not found');

    const seller = deal.participants.find((p) => p.role === 'seller');
    if (!seller || seller.walletAddress !== actorWallet) {
      throw new ForbiddenException('Only the seller can upload terms files');
    }

    // Only allow upload when escrow is in Funded state
    const escrow = await this.prisma.escrow.findFirst({ where: { dealId } });
    if (!escrow) {
      throw new BadRequestException('Escrow not found for this deal');
    }
    if (escrow.status !== 'Funded') {
      throw new BadRequestException(
        `Cannot upload terms in escrow status ${escrow.status}. Expected Funded.`,
      );
    }

    // Compute SHA-256 hash of the uploaded file
    const sha256Hash = createHash('sha256')
      .update(file.buffer)
      .digest('hex');

    // Save file to disk
    const ext = extname(file.originalname) || '.bin';
    const fileName = `${dealId}_${Date.now()}${ext}`;
    const filePath = join(this.uploadDir, fileName);

    writeFileSync(filePath, file.buffer);

    // Store metadata in DB
    const termFile = await this.prisma.dealTermFile.create({
      data: {
        dealId,
        uploadedBy: actorWallet,
        fileName,
        originalName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        sha256Hash,
        filePath: `/uploads/terms/${fileName}`,
        storageType: 'local',
      },
    });

    return {
      id: termFile.id,
      originalName: termFile.originalName,
      mimeType: termFile.mimeType,
      fileSize: termFile.fileSize,
      sha256Hash: termFile.sha256Hash,
      createdAt: termFile.createdAt.toISOString(),
    };
  }

  /**
   * List all term files for a deal.
   */
  async listTerms(dealId: string, actorWallet: string) {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      include: { participants: true },
    });
    if (!deal) throw new NotFoundException('Deal not found');
    if (!deal.participants.some((p) => p.walletAddress === actorWallet)) {
      throw new ForbiddenException('Not a participant in this deal');
    }

    const files = await this.prisma.dealTermFile.findMany({
      where: { dealId },
      orderBy: { createdAt: 'desc' },
    });

    return files.map((f) => ({
      id: f.id,
      originalName: f.originalName,
      mimeType: f.mimeType,
      fileSize: f.fileSize,
      sha256Hash: f.sha256Hash,
      uploadedBy: f.uploadedBy,
      createdAt: f.createdAt.toISOString(),
    }));
  }

  /**
   * Get metadata for a single term file. Participants can view it.
   */
  async getTermFile(dealId: string, fileId: string, actorWallet: string) {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      include: { participants: true },
    });
    if (!deal) throw new NotFoundException('Deal not found');
    if (!deal.participants.some((p) => p.walletAddress === actorWallet)) {
      throw new ForbiddenException('Not a participant in this deal');
    }

    const file = await this.prisma.dealTermFile.findFirst({
      where: { id: fileId, dealId },
    });
    if (!file) throw new NotFoundException('Term file not found');

    return {
      id: file.id,
      originalName: file.originalName,
      mimeType: file.mimeType,
      fileSize: file.fileSize,
      sha256Hash: file.sha256Hash,
      uploadedBy: file.uploadedBy,
      filePath: file.filePath,
      createdAt: file.createdAt.toISOString(),
    };
  }

  /**
   * Get the actual file path on disk (for serving the file).
   */
  getFilePath(fileName: string): string {
    return join(this.uploadDir, fileName);
  }

  /**
   * Delete a term file. Only the uploader (seller) can delete.
   */
  async deleteTermFile(dealId: string, fileId: string, actorWallet: string) {
    const file = await this.prisma.dealTermFile.findFirst({
      where: { id: fileId, dealId },
    });
    if (!file) throw new NotFoundException('Term file not found');
    if (file.uploadedBy !== actorWallet) {
      throw new ForbiddenException('Only the uploader can delete this file');
    }

    // Delete from disk
    const fullPath = join(this.uploadDir, file.fileName);
    if (existsSync(fullPath)) {
      unlinkSync(fullPath);
    }

    await this.prisma.dealTermFile.delete({ where: { id: fileId } });

    return { success: true };
  }
}

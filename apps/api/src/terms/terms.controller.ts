import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  MaxFileSizeValidator,
  ParseFilePipe,
  StreamableFile,
  Res,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { createReadStream, existsSync } from 'node:fs';
import { join } from 'node:path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TermsService } from './terms.service';

@Controller('deals/:dealId/terms')
@UseGuards(JwtAuthGuard)
export class TermsController {
  constructor(
    @Inject(TermsService) private readonly termsService: TermsService,
  ) {}

  /**
   * Upload a terms/contract file (PDF, DOCX, image, etc.).
   * Only the seller can upload. File is stored on disk and metadata in DB.
   * Accepts up to 10MB.
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @Param('dealId') dealId: string,
    @Req() req: any,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.termsService.uploadTerms(dealId, req.user.wallet, file);
  }

  @Get()
  async list(@Param('dealId') dealId: string, @Req() req: any) {
    return this.termsService.listTerms(dealId, req.user.wallet);
  }

  @Get(':fileId')
  async get(
    @Param('dealId') dealId: string,
    @Param('fileId') fileId: string,
    @Req() req: any,
  ) {
    return this.termsService.getTermFile(dealId, fileId, req.user.wallet);
  }

  @Get(':fileId/download')
  async download(
    @Param('dealId') dealId: string,
    @Param('fileId') fileId: string,
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    const file = await this.termsService.getTermFile(dealId, fileId, req.user.wallet);
    const fullPath = join(
      __dirname, '..', '..', 'uploads', 'terms',
      file.filePath.replace('/uploads/terms/', ''),
    );
    if (!existsSync(fullPath)) {
      throw new NotFoundException('File not found on disk');
    }
    const stream = createReadStream(fullPath);
    res.set({
      'Content-Type': file.mimeType,
      'Content-Disposition': `attachment; filename="${file.originalName}"`,
      'Content-Length': file.fileSize.toString(),
    });
    return new StreamableFile(stream);
  }

  @Delete(':fileId')
  async delete(
    @Param('dealId') dealId: string,
    @Param('fileId') fileId: string,
    @Req() req: any,
  ) {
    return this.termsService.deleteTermFile(dealId, fileId, req.user.wallet);
  }
}

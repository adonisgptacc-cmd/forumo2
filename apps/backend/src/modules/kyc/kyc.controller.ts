import {
    Controller,
    Post,
    Get,
    Patch,
    Body,
    Param,
    UseGuards,
    Request,
    UseInterceptors,
    UploadedFiles,
    BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { KycService } from './kyc.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { StorageService } from '../storage/storage.service';

@ApiTags('kyc')
@Controller('kyc')
export class KycController {
    constructor(
        private readonly kycService: KycService,
        private readonly storageService: StorageService,
    ) { }

    @Post('submit')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @UseInterceptors(FilesInterceptor('documents', 5))
    @ApiConsumes('multipart/form-data')
    async submitKyc(
        @Request() req: any,
        @UploadedFiles() files: Express.Multer.File[],
        @Body() body: { documentTypes: string; metadata?: string },
    ) {
        if (!files || files.length === 0) {
            throw new BadRequestException('At least one document is required');
        }

        const userId = req.user.id;
        const documentTypes = body.documentTypes ? JSON.parse(body.documentTypes) : [];
        const metadata = body.metadata ? JSON.parse(body.metadata) : {};

        if (documentTypes.length !== files.length) {
            throw new BadRequestException('Document types must match number of files');
        }

        // Upload files to storage
        const uploadedDocs = await Promise.all(
            files.map(async (file, index) => {
                const uploaded = await this.storageService.saveKycDocument(userId, file);
                return {
                    type: documentTypes[index] || 'unknown',
                    url: uploaded.url,
                    bucket: uploaded.bucket,
                    storageKey: uploaded.key,
                    metadata: metadata[index] || {},
                };
            }),
        );

        return this.kycService.submitKyc(userId, uploadedDocs);
    }

    @Get('status')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    async getStatus(@Request() req: any) {
        return this.kycService.getSubmission(req.user.id);
    }

    @Get('submissions')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN', 'MODERATOR')
    @ApiBearerAuth()
    async listSubmissions() {
        return this.kycService.listPendingSubmissions();
    }

    @Get('submissions/:id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN', 'MODERATOR')
    @ApiBearerAuth()
    async getSubmission(@Param('id') id: string) {
        return this.kycService.getSubmissionById(id);
    }

    @Patch('submissions/:id/review')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN', 'MODERATOR')
    @ApiBearerAuth()
    async reviewSubmission(
        @Param('id') id: string,
        @Request() req: any,
        @Body() body: { status: 'APPROVED' | 'REJECTED'; rejectionReason?: string },
    ) {
        return this.kycService.reviewSubmission(
            id,
            req.user.id,
            body.status,
            body.rejectionReason,
        );
    }
}

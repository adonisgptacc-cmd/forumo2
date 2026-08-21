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
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { ApiTags, ApiBearerAuth, ApiConsumes } from "@nestjs/swagger";
import { KycService } from "./kyc.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { StorageService } from "../storage/storage.service";
import {
  MAX_UPLOAD_FILES,
  uploadLimits,
} from "../../common/config/upload-limits";

type KycDocumentMetadata = Record<string, unknown>;

function parseJsonField(value: string, fieldName: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new BadRequestException(`${fieldName} must contain valid JSON`);
  }
}

function parseDocumentTypes(value?: string): string[] {
  if (!value) return [];

  const parsed = parseJsonField(value, "documentTypes");
  if (
    !Array.isArray(parsed) ||
    !parsed.every(
      (item) =>
        typeof item === "string" && item.trim().length > 0 && item.length <= 64,
    )
  ) {
    throw new BadRequestException(
      "documentTypes must be an array of non-empty strings",
    );
  }
  return parsed;
}

function parseMetadata(value?: string): KycDocumentMetadata[] | undefined {
  if (!value) return undefined;

  const parsed = parseJsonField(value, "metadata");
  if (
    !Array.isArray(parsed) ||
    !parsed.every(
      (item) =>
        item !== null && typeof item === "object" && !Array.isArray(item),
    )
  ) {
    throw new BadRequestException("metadata must be an array of objects");
  }
  return parsed as KycDocumentMetadata[];
}

@ApiTags("kyc")
@Controller("kyc")
export class KycController {
  constructor(
    private readonly kycService: KycService,
    private readonly storageService: StorageService,
  ) {}

  @Post("submit")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(
    FilesInterceptor("documents", MAX_UPLOAD_FILES, { limits: uploadLimits }),
  )
  @ApiConsumes("multipart/form-data")
  async submitKyc(
    @Request() req: any,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: { documentTypes: string; metadata?: string },
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException("At least one document is required");
    }

    const userId = req.user.id;
    const documentTypes = parseDocumentTypes(body.documentTypes);
    const metadata = parseMetadata(body.metadata);

    if (documentTypes.length !== files.length) {
      throw new BadRequestException(
        "Document types must match number of files",
      );
    }
    if (metadata && metadata.length !== files.length) {
      throw new BadRequestException("Metadata must match number of files");
    }

    // Upload files to storage
    const uploadedDocs = await Promise.all(
      files.map(async (file, index) => {
        const uploaded = await this.storageService.saveKycDocument(
          userId,
          file,
        );
        return {
          type: documentTypes[index] || "unknown",
          url: uploaded.url,
          bucket: uploaded.bucket,
          storageKey: uploaded.key,
          metadata: metadata?.[index] ?? {},
        };
      }),
    );

    return this.kycService.submitKyc(userId, uploadedDocs);
  }

  @Get("status")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getStatus(@Request() req: any) {
    return this.kycService.getSubmission(req.user.id);
  }

  @Get("submissions")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "MODERATOR")
  @ApiBearerAuth()
  async listSubmissions() {
    return this.kycService.listPendingSubmissions();
  }

  @Get("submissions/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "MODERATOR")
  @ApiBearerAuth()
  async getSubmission(@Param("id") id: string) {
    return this.kycService.getSubmissionById(id);
  }

  @Patch("submissions/:id/review")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "MODERATOR")
  @ApiBearerAuth()
  async reviewSubmission(
    @Param("id") id: string,
    @Request() req: any,
    @Body() body: { status: string; rejectionReason?: string },
  ) {
    const allowed: Record<string, string> = {
      APPROVED: "APPROVED",
      REJECTED: "REJECTED",
    };
    const normalized = allowed[body.status?.toUpperCase?.() as string];
    if (!normalized) {
      throw new BadRequestException("status must be APPROVED or REJECTED");
    }
    return this.kycService.reviewSubmission(
      id,
      req.user.id,
      normalized as "APPROVED" | "REJECTED",
      body.rejectionReason,
    );
  }
}

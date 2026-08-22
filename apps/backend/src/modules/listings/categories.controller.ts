import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { createZodDto } from "nestjs-zod";
import {
  createCategorySchema,
  updateCategorySchema,
  createTagSchema,
  updateTagSchema,
} from "@forumo/shared";
import { CategoriesService } from "./categories.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { RolesGuard } from "../../common/guards/roles.guard";

class CreateCategoryDto extends createZodDto(createCategorySchema) {}
class UpdateCategoryDto extends createZodDto(updateCategorySchema) {}
class CreateTagDto extends createZodDto(createTagSchema) {}
class UpdateTagDto extends createZodDto(updateTagSchema) {}

const assignCategoriesSchema = z.object({
  categoryIds: z.array(z.string().uuid()),
  primaryCategoryId: z.string().uuid().nullable().optional(),
});
class AssignCategoriesDto extends createZodDto(assignCategoriesSchema) {}

const assignTagsSchema = z.object({
  tagIds: z.array(z.string().uuid()),
});
class AssignTagsDto extends createZodDto(assignTagsSchema) {}

@Controller("categories")
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  // Public: list categories and tags
  @Get()
  listCategories() {
    return this.categoriesService.listCategories();
  }

  @Get("tags")
  listTags() {
    return this.categoriesService.listTags();
  }

  // Admin-only: create/update/delete categories
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  createCategory(@Body() dto: CreateCategoryDto) {
    const { parentId, ...rest } = dto as CreateCategoryDto & {
      parentId?: string | null;
    };
    return this.categoriesService.createCategory({
      ...rest,
      parentId: parentId ?? undefined,
    });
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  updateCategory(@Param("id") id: string, @Body() dto: UpdateCategoryDto) {
    const { parentId, ...rest } = dto as UpdateCategoryDto & {
      parentId?: string | null;
    };
    return this.categoriesService.updateCategory(id, {
      ...rest,
      parentId: parentId ?? undefined,
    });
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  deleteCategory(@Param("id") id: string) {
    return this.categoriesService.deleteCategory(id);
  }

  // Admin-only: tags
  @Post("tags")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  createTag(@Body() dto: CreateTagDto) {
    return this.categoriesService.createTag(dto);
  }

  @Patch("tags/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  updateTag(@Param("id") id: string, @Body() dto: UpdateTagDto) {
    return this.categoriesService.updateTag(id, dto);
  }

  @Delete("tags/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  deleteTag(@Param("id") id: string) {
    return this.categoriesService.deleteTag(id);
  }

  // Listing assignments — only the listing's owner may reassign
  @Post("listings/:listingId/categories")
  @UseGuards(JwtAuthGuard)
  assignCategories(
    @Param("listingId") listingId: string,
    @Body() dto: AssignCategoriesDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.categoriesService.assignCategoriesToListing(
      listingId,
      req.user.id,
      dto.categoryIds,
      dto.primaryCategoryId ?? undefined,
    );
  }

  @Post("listings/:listingId/tags")
  @UseGuards(JwtAuthGuard)
  assignTags(
    @Param("listingId") listingId: string,
    @Body() dto: AssignTagsDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.categoriesService.assignTagsToListing(
      listingId,
      req.user.id,
      dto.tagIds,
    );
  }
}

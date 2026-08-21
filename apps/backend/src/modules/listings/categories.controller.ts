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
import { CategoriesService } from "./categories.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { RolesGuard } from "../../common/guards/roles.guard";

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
  createCategory(
    @Body()
    body: {
      slug: string;
      name: string;
      description?: string;
      parentId?: string;
      position?: number;
    },
  ) {
    return this.categoriesService.createCategory(body);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  updateCategory(
    @Param("id") id: string,
    @Body()
    body: {
      name?: string;
      description?: string;
      parentId?: string;
      position?: number;
    },
  ) {
    return this.categoriesService.updateCategory(id, body);
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
  createTag(@Body() body: { slug: string; label: string }) {
    return this.categoriesService.createTag(body);
  }

  @Patch("tags/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  updateTag(@Param("id") id: string, @Body() body: { label?: string }) {
    return this.categoriesService.updateTag(id, body);
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
    @Body() body: { categoryIds: string[]; primaryCategoryId?: string },
    @Request() req: { user: { id: string } },
  ) {
    return this.categoriesService.assignCategoriesToListing(
      listingId,
      req.user.id,
      body.categoryIds,
      body.primaryCategoryId,
    );
  }

  @Post("listings/:listingId/tags")
  @UseGuards(JwtAuthGuard)
  assignTags(
    @Param("listingId") listingId: string,
    @Body() body: { tagIds: string[] },
    @Request() req: { user: { id: string } },
  ) {
    return this.categoriesService.assignTagsToListing(
      listingId,
      req.user.id,
      body.tagIds,
    );
  }
}

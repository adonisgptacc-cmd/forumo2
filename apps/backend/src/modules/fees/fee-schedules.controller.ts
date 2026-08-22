import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
} from "@nestjs/common";
import { Roles } from "../../common/decorators/roles.decorator";
import { RolesGuard } from "../../common/guards/roles.guard";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { FeeService } from "./fee.service";
import type { Request as ExpressRequest } from "express";
import {
  createFeeScheduleSchema,
  updateFeeScheduleSchema,
} from "@forumo/shared";

@Controller("admin/fee-schedules")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
export class FeeSchedulesController {
  constructor(private readonly feeService: FeeService) {}

  @Get()
  list() {
    return this.feeService.listSchedules();
  }

  @Post()
  async create(
    @Body() body: unknown,
    @Request()
    req: ExpressRequest & { user: { id: string; role: string } },
  ) {
    const parsed = await createFeeScheduleSchema.parseAsync(body);
    return this.feeService.createSchedule({
      ...parsed,
      createdBy: req.user.id,
    });
  }

  @Put(":id")
  async update(@Param("id") id: string, @Body() body: unknown) {
    const parsed = await updateFeeScheduleSchema.parseAsync(body);
    return this.feeService.updateSchedule(id, parsed);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.feeService.softDeleteSchedule(id);
  }
}

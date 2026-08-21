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
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from "class-validator";

import { Roles } from "../../common/decorators/roles.decorator";
import { RolesGuard } from "../../common/guards/roles.guard";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { FeeService } from "./fee.service";

class CreateFeeScheduleDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @IsNumber()
  @Min(0)
  @Max(50)
  feePercent!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  fixedFeeCents?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minFeeCents?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxFeeCents?: number | null;
}

class UpdateFeeScheduleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(50)
  feePercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  fixedFeeCents?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minFeeCents?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxFeeCents?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

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
  create(@Body() dto: CreateFeeScheduleDto, @Request() req: any) {
    return this.feeService.createSchedule({ ...dto, createdBy: req.user.id });
  }

  @Put(":id")
  update(@Param("id") id: string, @Body() dto: UpdateFeeScheduleDto) {
    return this.feeService.updateSchedule(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.feeService.softDeleteSchedule(id);
  }
}

import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import {
  ShippingService,
  ShippoAddress,
  ShippoParcel,
  ShippingRate,
  AddressValidationResult,
} from "./shipping.service";

interface GetRatesBody {
  fromAddress: ShippoAddress;
  toAddress: ShippoAddress;
  parcel: ShippoParcel;
}

interface ValidateAddressBody {
  address: ShippoAddress;
}

@Controller("shipping")
@UseGuards(JwtAuthGuard)
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  /**
   * POST /shipping/rates
   * Called during checkout to display carrier options and add shipping cost to order total.
   */
  @Post("rates")
  @HttpCode(HttpStatus.OK)
  getRates(@Body() body: GetRatesBody): Promise<ShippingRate[]> {
    return this.shippingService.getRates(
      body.fromAddress,
      body.toAddress,
      body.parcel,
    );
  }

  /**
   * POST /shipping/validate
   * Validate a buyer or seller address before checkout to catch typos early.
   */
  @Post("validate")
  @HttpCode(HttpStatus.OK)
  validateAddress(
    @Body() body: ValidateAddressBody,
  ): Promise<AddressValidationResult> {
    return this.shippingService.validateAddress(body.address);
  }
}

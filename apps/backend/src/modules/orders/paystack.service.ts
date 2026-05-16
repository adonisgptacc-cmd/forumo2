import { createHmac, timingSafeEqual } from 'crypto';

import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

interface PaystackInitData {
  authorization_url: string;
  access_code: string;
  reference: string;
}

interface PaystackVerifyData {
  status: string;
  reference: string;
  amount: number;
  currency: string;
  metadata: Record<string, unknown>;
}

interface PaystackApiResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

@Injectable()
export class PaystackService {
  private readonly logger = new Logger(PaystackService.name);
  private readonly baseUrl = 'https://api.paystack.co';

  constructor(private readonly http: HttpService) {
    if (!process.env.PAYSTACK_SECRET_KEY) {
      this.logger.warn('PAYSTACK_SECRET_KEY not set — Paystack payments will use mock mode');
    }
  }

  private get secretKey(): string | undefined {
    return process.env.PAYSTACK_SECRET_KEY;
  }

  private get authHeaders() {
    return { Authorization: `Bearer ${this.secretKey}` };
  }

  async initializeTransaction(
    amountKobo: number,
    email: string,
    metadata: Record<string, unknown>,
    callbackUrl: string,
  ): Promise<{ authorizationUrl: string; reference: string }> {
    if (!this.secretKey) {
      const reference = `mock_ps_${Date.now()}`;
      return { authorizationUrl: `${callbackUrl}?reference=${reference}&mock=true`, reference };
    }

    const { data } = await firstValueFrom(
      this.http.post<PaystackApiResponse<PaystackInitData>>(
        `${this.baseUrl}/transaction/initialize`,
        { amount: amountKobo, email, metadata, callback_url: callbackUrl },
        { headers: this.authHeaders },
      ),
    );

    return {
      authorizationUrl: data.data.authorization_url,
      reference: data.data.reference,
    };
  }

  async verifyTransaction(reference: string): Promise<{
    success: boolean;
    amountKobo: number;
    currency: string;
    metadata: Record<string, unknown>;
  }> {
    if (!this.secretKey) {
      return { success: true, amountKobo: 0, currency: 'NGN', metadata: {} };
    }

    const { data } = await firstValueFrom(
      this.http.get<PaystackApiResponse<PaystackVerifyData>>(
        `${this.baseUrl}/transaction/verify/${encodeURIComponent(reference)}`,
        { headers: this.authHeaders },
      ),
    );

    const tx = data.data;
    return {
      success: tx.status === 'success',
      amountKobo: tx.amount,
      currency: tx.currency,
      metadata: tx.metadata ?? {},
    };
  }

  async refundTransaction(reference: string, amountKobo?: number): Promise<void> {
    if (!this.secretKey) {
      this.logger.warn(`[Paystack] Not configured — skipping refund for ${reference}`);
      return;
    }

    try {
      await firstValueFrom(
        this.http.post<PaystackApiResponse<unknown>>(
          `${this.baseUrl}/refund`,
          { transaction: reference, ...(amountKobo !== undefined && { amount: amountKobo }) },
          { headers: this.authHeaders },
        ),
      );
    } catch (err) {
      this.logger.error(`[Paystack] Refund failed for ${reference}:`, err);
    }
  }

  async createTransferRecipient(
    bankCode: string,
    accountNumber: string,
    name: string,
    currency: string,
  ): Promise<string> {
    const { data } = await firstValueFrom(
      this.http.post<PaystackApiResponse<{ recipient_code: string }>>(
        `${this.baseUrl}/transferrecipient`,
        { type: 'nuban', bank_code: bankCode, account_number: accountNumber, name, currency },
        { headers: this.authHeaders },
      ),
    );
    return data.data.recipient_code;
  }

  async initiateTransfer(
    amountKobo: number,
    recipientCode: string,
    reason: string,
    reference: string,
  ): Promise<{ transferCode: string; status: string }> {
    const { data } = await firstValueFrom(
      this.http.post<PaystackApiResponse<{ transfer_code: string; status: string }>>(
        `${this.baseUrl}/transfer`,
        { source: 'balance', amount: amountKobo, recipient: recipientCode, reason, reference },
        { headers: this.authHeaders },
      ),
    );
    return { transferCode: data.data.transfer_code, status: data.data.status };
  }

  async listBanks(currency: string): Promise<unknown[]> {
    if (!this.secretKey) {
      return [];
    }
    const { data } = await firstValueFrom(
      this.http.get<PaystackApiResponse<unknown[]>>(
        `${this.baseUrl}/bank?currency=${currency.toUpperCase()}`,
        { headers: this.authHeaders },
      ),
    );
    return data.data;
  }

  validateWebhookSignature(rawBody: Buffer | string, signature: string): boolean {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) {
      this.logger.warn('PAYSTACK_SECRET_KEY is not configured — webhook signature cannot be verified');
      return false;
    }
    const hash = createHmac('sha512', secret)
      .update(rawBody)
      .digest('hex');
    try {
      return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(signature, 'hex'));
    } catch {
      // Buffer lengths differ — signature is malformed
      return false;
    }
  }
}

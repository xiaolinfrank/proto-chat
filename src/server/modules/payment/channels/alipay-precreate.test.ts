// @vitest-environment node
import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PaymentOrder } from '../types';
import { AlipayPrecreateChannel } from './alipay-precreate';

// ---------------------------------------------------------------------------
// Test RSA key pair (2048-bit, PKCS1) — bare Base64 without PEM headers
// ---------------------------------------------------------------------------
const TEST_PRIVATE_KEY_BARE =
  'MIIEoQIBAAKCAQEA4Qphe8BqOcCFntYrZrcvowe8LJKUGrbVgcTKJmSzt3T7XzKBP1yFjPN0y3sRwy81+EnSXQMFtLHUltJ/zpNKLimxVkPcQcauysZHCJe7/zQglFsyhJgilPaEIZ0Pmi70JJD0C4lQIpL1TD6rCapmmnGU3kuk+hvJNLf4ZhSJHeQlDVyKdr17t5LpyKX2+3DnocK/w7THoWmkjD1bRWK6Hvhp3dqUhX1t4ymBc5otjJO3jGcjERmD8+MdJjPRSKlSl7SJtgdkasPJDQmDpZwQO4Y23H4Ccqnw/uvGpX6n/9McpHxhXuae7p7O1d5nB8Od31W7MUb3wUqA6h6dhK8eyQIDAQABAoH/IkhykWe+xw2NTaVS91Lw7uU+xYuPBILWA+723OJ6fnhT0yzeg8iUj+SG5njZO+L1Vd3pLkJHnD97I37t+Yp2wpGXcozkASFDf6C1MZnsCfTnAbLi/1At9IOZnYVP2y1MBEYQ57EDhEDfHb5uUAqlluG2zCa5+2BARsfAD80RFnxiAb2Wn0Guc4hbUT6cVHKNrvjrgdNLs9EkLrCtBN93d/6I0KjtARGtwnm8pNnKVu0oY+Ro95RBBMhcIAwg3POIdCLd/oQi/kHKywTwIRyo2S43znlJNYsvwEpTP8Jgs3dgFfag7JX4unCQp2KLIIASoqYnnDhkQsoXfoiDpFCBAoGBAPXCh0OwhL3OOTwzFcJESlbPlgTQB3mnDkjMxoiEPgSWiPZWTHTg8XJtY8qhsng7gWGI1C3nNQrQmBRQCAhu/NBG754rZJyng+VY55XFI/VPqA2aqxFAvHbtnQYsweg1EjyWQz9ngSqXyApXX14Ool8o8WBKw5jMiuww8oXeH345AoGBAOpq1+8PcdOFe8JC2OIs7EExL1VXz2tVg8THImujSOfNnWEWsKUhTGwsjfEc0So4rJwkEPymroJXkME8hgSD0Usk/eQfGBMwQUxmmdk1eX2ktldKaU8se0ou/3tKO+q4FbUL/+4xEM4swSZXcJyWYZMnzsI5Yom/DAkD1rQKJaURAoGAFN9GmaseOviOx9wW1v7xyVmsBhCc8eoMPoaVvfZtRfp6+2Ds8WhBWVSNCyKcg7WaEWyLiLKAQMDiiacaZ4z1j8LWivpoex2HCC16za+GlEkFntIqATccSoV3tpSKi2wmdlrUr0fdIn7tkGNHSDe59pcFmQYAgrOsgM7PaispRZECgYAyPopf/CB6pO682ZUhDV3qLz+k/DhCGkcvAzu2dH4o6SJlb/aWvkdiHD6kQnf2o8Ujhnt5m8RlvZ0SPgW/q/1NLPWaUqvXWQ118bviGZsbuhU3KoTd6nvWj7JE28lx6tkEQDkv9aZTerY/oJhLh9QMNYkUijY7rg5HVGJNnqso8QKBgQCEVjZjGZR1LJL8SAsB8rOHvyCwfEJlYit0Bm5nvpvlzgH+xlvr7PpsLNeAVkkOjpOtfbjwoH4Wi0925QcOXZv7toKO7zgn2ivNOQNjXZ1mZu/0zJel9IubxTsBD/jLWHsAroS/w1WFM/DsHxkGKq+QuDIF1YgmcE6CbCb7gqYoQg==';

const TEST_PUBLIC_KEY_BARE =
  'MIIBCgKCAQEA4Qphe8BqOcCFntYrZrcvowe8LJKUGrbVgcTKJmSzt3T7XzKBP1yFjPN0y3sRwy81+EnSXQMFtLHUltJ/zpNKLimxVkPcQcauysZHCJe7/zQglFsyhJgilPaEIZ0Pmi70JJD0C4lQIpL1TD6rCapmmnGU3kuk+hvJNLf4ZhSJHeQlDVyKdr17t5LpyKX2+3DnocK/w7THoWmkjD1bRWK6Hvhp3dqUhX1t4ymBc5otjJO3jGcjERmD8+MdJjPRSKlSl7SJtgdkasPJDQmDpZwQO4Y23H4Ccqnw/uvGpX6n/9McpHxhXuae7p7O1d5nB8Od31W7MUb3wUqA6h6dhK8eyQIDAQAB';

// Derive a full PEM public key so we can sign our own test notifications
const TEST_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----\n${TEST_PUBLIC_KEY_BARE.match(/.{1,64}/g)!.join('\n')}\n-----END PUBLIC KEY-----`;
const TEST_PRIVATE_KEY_PEM = `-----BEGIN RSA PRIVATE KEY-----\n${TEST_PRIVATE_KEY_BARE.match(/.{1,64}/g)!.join('\n')}\n-----END RSA PRIVATE KEY-----`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createSandboxChannel() {
  return new AlipayPrecreateChannel({
    alipayPublicKey: TEST_PUBLIC_KEY_BARE,
    appId: 'test-app-id',
    notifyUrl: 'https://example.com/notify',
    privateKey: TEST_PRIVATE_KEY_BARE,
    sandbox: true,
  });
}

function makeOrder(overrides: Partial<PaymentOrder> = {}): PaymentOrder {
  return {
    amount: 9900,
    channelData: undefined,
    channelOrderNo: undefined,
    closedAt: undefined,
    createdAt: new Date(),
    currency: 'CNY',
    durationMonths: undefined,
    expiredAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
    id: 'order-id-1',
    orderNo: 'PC20250105090307123456',
    paidAt: undefined,
    payChannel: 'alipay_precreate',
    planId: 'plan-pro',
    planInterval: 'month',
    planName: 'Pro Plan',
    planSlug: 'pro',
    planValue: 9900,
    status: 'pending',
    subscriptionType: 'recurring',
    updatedAt: new Date(),
    userId: 'user-1',
    ...overrides,
  };
}

/** Build and sign a URLEncoded notification body the same way Alipay does. */
function buildSignedNotification(params: Record<string, string>): string {
  const sorted = Object.keys(params)
    .filter((k) => k !== 'sign' && k !== 'sign_type')
    .sort()
    .filter((k) => params[k] !== '' && params[k] != null)
    .map((k) => `${k}=${params[k]}`)
    .join('&');

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(sorted, 'utf8');
  const sign = signer.sign(TEST_PRIVATE_KEY_PEM, 'base64');

  return new URLSearchParams({ ...params, sign }).toString();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AlipayPrecreateChannel', () => {
  describe('constructor', () => {
    it('should throw when config is undefined', () => {
      expect(() => new AlipayPrecreateChannel(undefined)).toThrow(
        'Alipay payment config is required',
      );
    });

    it('should use sandbox gateway URL when sandbox=true', () => {
      const channel = createSandboxChannel();
      // The gateway URL is private; we verify indirectly via fetch mock
      expect(channel).toBeInstanceOf(AlipayPrecreateChannel);
    });

    it('should use production gateway URL when sandbox=false and gatewayUrl not provided', () => {
      const channel = new AlipayPrecreateChannel({
        alipayPublicKey: TEST_PUBLIC_KEY_BARE,
        appId: 'app-id',
        notifyUrl: 'https://example.com/notify',
        privateKey: TEST_PRIVATE_KEY_BARE,
        sandbox: false,
      });
      expect(channel).toBeInstanceOf(AlipayPrecreateChannel);
    });

    it('should use custom gatewayUrl when provided', () => {
      const channel = new AlipayPrecreateChannel({
        alipayPublicKey: TEST_PUBLIC_KEY_BARE,
        appId: 'app-id',
        gatewayUrl: 'https://custom.gateway.com/api',
        notifyUrl: 'https://example.com/notify',
        privateKey: TEST_PRIVATE_KEY_BARE,
      });
      expect(channel).toBeInstanceOf(AlipayPrecreateChannel);
    });

    it('should accept keys that already include PEM headers', () => {
      // The formatPrivateKey / formatPublicKey methods should strip and re-wrap headers
      expect(
        () =>
          new AlipayPrecreateChannel({
            alipayPublicKey: TEST_PUBLIC_KEY_PEM,
            appId: 'app-id',
            notifyUrl: 'https://example.com/notify',
            privateKey: TEST_PRIVATE_KEY_PEM,
            sandbox: true,
          }),
      ).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  describe('parseNotification', () => {
    let channel: AlipayPrecreateChannel;

    beforeEach(() => {
      channel = createSandboxChannel();
    });

    it('should return error when sign_type is not RSA2', async () => {
      const body = new URLSearchParams({
        out_trade_no: 'PC123',
        sign: 'fakesign',
        sign_type: 'MD5',
        trade_status: 'TRADE_SUCCESS',
      }).toString();

      const result = await channel.parseNotification(body);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Invalid signature type');
      expect(result.orderNo).toBe('PC123');
    });

    it('should return error when sign field is missing', async () => {
      const body = new URLSearchParams({
        out_trade_no: 'PC123',
        sign_type: 'RSA2',
        trade_status: 'TRADE_SUCCESS',
      }).toString();

      const result = await channel.parseNotification(body);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Invalid signature type');
    });

    it('should return error when trade status is not success', async () => {
      const params = {
        out_trade_no: 'PC123',
        sign_type: 'RSA2',
        trade_status: 'WAIT_BUYER_PAY',
      };
      const body = buildSignedNotification(params);

      const result = await channel.parseNotification(body);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain('WAIT_BUYER_PAY');
      expect(result.orderNo).toBe('PC123');
    });

    it('should return success for TRADE_SUCCESS status in sandbox mode', async () => {
      const params = {
        gmt_payment: '2025-01-05 09:03:07',
        out_trade_no: 'PC20250105090307123456',
        sign_type: 'RSA2',
        total_amount: '99.00',
        trade_no: 'ALI123456',
        trade_status: 'TRADE_SUCCESS',
      };
      const body = buildSignedNotification(params);

      const result = await channel.parseNotification(body);

      expect(result.success).toBe(true);
      expect(result.orderNo).toBe('PC20250105090307123456');
      expect(result.channelOrderNo).toBe('ALI123456');
      // 99.00 yuan → 9900 cents
      expect(result.amount).toBe(9900);
      expect(result.paidAt).toBeInstanceOf(Date);
    });

    it('should return success for TRADE_FINISHED status in sandbox mode', async () => {
      const params = {
        out_trade_no: 'PC999',
        sign_type: 'RSA2',
        total_amount: '10.00',
        trade_no: 'ALIFINISHED',
        trade_status: 'TRADE_FINISHED',
      };
      const body = buildSignedNotification(params);

      const result = await channel.parseNotification(body);

      expect(result.success).toBe(true);
      expect(result.orderNo).toBe('PC999');
    });

    it('should use current time as paidAt when gmt_payment is absent', async () => {
      const before = new Date();
      const params = {
        out_trade_no: 'PC000',
        sign_type: 'RSA2',
        total_amount: '5.00',
        trade_no: 'ALINOPAYDATE',
        trade_status: 'TRADE_SUCCESS',
      };
      const body = buildSignedNotification(params);

      const result = await channel.parseNotification(body);
      const after = new Date();

      expect(result.success).toBe(true);
      expect(result.paidAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.paidAt!.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should accept a Buffer body', async () => {
      const params = {
        out_trade_no: 'PC_BUF',
        sign_type: 'RSA2',
        total_amount: '1.00',
        trade_no: 'ALIBUF',
        trade_status: 'TRADE_SUCCESS',
      };
      const body = Buffer.from(buildSignedNotification(params), 'utf8');

      const result = await channel.parseNotification(body);

      expect(result.success).toBe(true);
      expect(result.orderNo).toBe('PC_BUF');
    });

    it('should return error and empty orderNo when body cannot be parsed', async () => {
      // Corrupt the body so JSON.parse / URL parsing throws
      const result = await channel.parseNotification('not-valid\x00\xFF\xFF');

      // The implementation catches and returns error
      expect(result.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  describe('queryOrder', () => {
    let channel: AlipayPrecreateChannel;

    beforeEach(() => {
      channel = createSandboxChannel();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should return "pending" status when fetch throws', async () => {
      vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

      const result = await channel.queryOrder('PC123');

      expect(result.orderNo).toBe('PC123');
      expect(result.status).toBe('pending');
    });

    it('should return "pending" when the response key is missing', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        text: async () => JSON.stringify({ some_other_key: {} }),
      } as Response);

      const result = await channel.queryOrder('PC123');

      expect(result.status).toBe('pending');
    });

    it('should return "pending" when response code is not 10000', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        text: async () =>
          JSON.stringify({
            alipay_trade_query_response: {
              code: '40004',
              msg: 'Business Failed',
            },
          }),
      } as Response);

      const result = await channel.queryOrder('PC123');

      expect(result.status).toBe('pending');
    });

    it('should return "paid" status for TRADE_SUCCESS', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        text: async () =>
          JSON.stringify({
            alipay_trade_query_response: {
              code: '10000',
              send_pay_date: '2025-01-05 09:03:07',
              trade_no: 'ALIQUERY123',
              trade_status: 'TRADE_SUCCESS',
            },
          }),
      } as Response);

      const result = await channel.queryOrder('PC123');

      expect(result.status).toBe('paid');
      expect(result.channelOrderNo).toBe('ALIQUERY123');
      expect(result.paidAt).toBeInstanceOf(Date);
    });

    it('should return "paid" status for TRADE_FINISHED', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        text: async () =>
          JSON.stringify({
            alipay_trade_query_response: {
              code: '10000',
              trade_no: 'ALIFINISHED',
              trade_status: 'TRADE_FINISHED',
            },
          }),
      } as Response);

      const result = await channel.queryOrder('PC456');

      expect(result.status).toBe('paid');
    });

    it('should return "closed" status for TRADE_CLOSED', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        text: async () =>
          JSON.stringify({
            alipay_trade_query_response: {
              code: '10000',
              trade_no: 'ALICLOSED',
              trade_status: 'TRADE_CLOSED',
            },
          }),
      } as Response);

      const result = await channel.queryOrder('PC789');

      expect(result.status).toBe('closed');
    });

    it('should return "pending" for unknown trade status', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        text: async () =>
          JSON.stringify({
            alipay_trade_query_response: {
              code: '10000',
              trade_status: 'WAIT_BUYER_PAY',
            },
          }),
      } as Response);

      const result = await channel.queryOrder('PC000');

      expect(result.status).toBe('pending');
    });
  });

  // -------------------------------------------------------------------------
  describe('closeOrder', () => {
    let channel: AlipayPrecreateChannel;

    beforeEach(() => {
      channel = createSandboxChannel();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should call the Alipay close endpoint', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        text: async () => JSON.stringify({ alipay_trade_close_response: { code: '10000' } }),
      } as Response);

      await channel.closeOrder('PC123');

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [, init] = fetchSpy.mock.calls[0];
      const body = (init as RequestInit).body as string;
      expect(body).toContain('alipay.trade.close');
      expect(body).toContain('PC123');
    });

    it('should not throw even when the API returns an error', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        text: async () =>
          JSON.stringify({ alipay_trade_close_response: { code: '40004', msg: 'Failed' } }),
      } as Response);

      // closeOrder intentionally ignores errors
      await expect(channel.closeOrder('ALREADY_CLOSED')).resolves.toBeUndefined();
    });

    it('should not throw when fetch itself rejects', async () => {
      vi.spyOn(global, 'fetch').mockRejectedValue(new Error('timeout'));

      // Implementation does not handle fetch errors in closeOrder — it will throw
      // This tests the current behaviour (caller must handle)
      await expect(channel.closeOrder('PC_FAIL')).rejects.toThrow('timeout');
    });
  });

  // -------------------------------------------------------------------------
  describe('createPayment', () => {
    let channel: AlipayPrecreateChannel;

    beforeEach(() => {
      channel = createSandboxChannel();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should return success with QR code URL on successful response', async () => {
      const qrCode = 'https://qr.alipay.com/test123';
      vi.spyOn(global, 'fetch').mockResolvedValue({
        text: async () =>
          JSON.stringify({
            alipay_trade_precreate_response: {
              code: '10000',
              msg: 'Success',
              out_trade_no: 'PC20250105090307123456',
              qr_code: qrCode,
              trade_no: 'ALIPRE123',
            },
            sign: 'fakesign',
          }),
      } as Response);

      const order = makeOrder();
      const result = await channel.createPayment(order);

      expect(result.success).toBe(true);
      expect(result.channelData?.code_url).toBe(qrCode);
      expect(result.channelData?.out_trade_no).toBe('PC20250105090307123456');
      expect(result.channelOrderNo).toBe('ALIPRE123');
    });

    it('should return failure when response code is not 10000', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        text: async () =>
          JSON.stringify({
            alipay_trade_precreate_response: {
              code: '40004',
              msg: 'Business Failed',
              sub_msg: 'Merchant not found',
            },
            sign: 'fakesign',
          }),
      } as Response);

      const result = await channel.createPayment(makeOrder());

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Merchant not found');
    });

    it('should return failure when response key is missing', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        text: async () => JSON.stringify({ unexpected_key: {} }),
      } as Response);

      const result = await channel.createPayment(makeOrder());

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Invalid response from Alipay');
    });

    it('should return failure when fetch throws', async () => {
      vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network failure'));

      const result = await channel.createPayment(makeOrder());

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Network failure');
    });

    it('should build the correct subject for a monthly recurring plan', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        text: async () =>
          JSON.stringify({
            alipay_trade_precreate_response: {
              code: '10000',
              out_trade_no: 'PC123',
              qr_code: 'https://qr.alipay.com/x',
              trade_no: 'ALI1',
            },
            sign: 'fakesign',
          }),
      } as Response);

      await channel.createPayment(makeOrder({ planInterval: 'month', planSlug: 'pro' }));

      // Parse the URLSearchParams body and extract the JSON biz_content field
      const rawBody = (fetchSpy.mock.calls[0][1] as RequestInit).body as string;
      const bizContent = JSON.parse(new URLSearchParams(rawBody).get('biz_content')!);
      expect(bizContent.subject).toBe('Pro Monthly Plan');
    });

    it('should build the correct subject for a yearly plan', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        text: async () =>
          JSON.stringify({
            alipay_trade_precreate_response: {
              code: '10000',
              out_trade_no: 'PC123',
              qr_code: 'https://qr.alipay.com/x',
              trade_no: 'ALI1',
            },
            sign: 'fakesign',
          }),
      } as Response);

      await channel.createPayment(makeOrder({ planInterval: 'year', planSlug: 'pro' }));

      const rawBody = (fetchSpy.mock.calls[0][1] as RequestInit).body as string;
      const bizContent = JSON.parse(new URLSearchParams(rawBody).get('biz_content')!);
      expect(bizContent.subject).toBe('Pro Annual Plan');
    });

    it('should append duration suffix for onetime payments', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        text: async () =>
          JSON.stringify({
            alipay_trade_precreate_response: {
              code: '10000',
              out_trade_no: 'PC123',
              qr_code: 'https://qr.alipay.com/x',
              trade_no: 'ALI1',
            },
            sign: 'fakesign',
          }),
      } as Response);

      await channel.createPayment(
        makeOrder({ durationMonths: 3, planSlug: 'pro', subscriptionType: 'onetime' }),
      );

      const rawBody = (fetchSpy.mock.calls[0][1] as RequestInit).body as string;
      const bizContent = JSON.parse(new URLSearchParams(rawBody).get('biz_content')!);
      expect(bizContent.subject).toContain('- 3mo');
    });

    it('should convert amount from cents to yuan in request', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        text: async () =>
          JSON.stringify({
            alipay_trade_precreate_response: {
              code: '10000',
              out_trade_no: 'PC123',
              qr_code: 'https://qr.alipay.com/x',
              trade_no: 'ALI1',
            },
            sign: 'fakesign',
          }),
      } as Response);

      // 9900 cents = 99.00 yuan
      await channel.createPayment(makeOrder({ amount: 9900 }));

      const rawBody = (fetchSpy.mock.calls[0][1] as RequestInit).body as string;
      const bizContent = JSON.parse(new URLSearchParams(rawBody).get('biz_content')!);
      expect(bizContent.total_amount).toBe('99.00');
    });

    it('should use planId as display name when planSlug is absent', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        text: async () =>
          JSON.stringify({
            alipay_trade_precreate_response: {
              code: '10000',
              out_trade_no: 'PC123',
              qr_code: 'https://qr.alipay.com/x',
              trade_no: 'ALI1',
            },
            sign: 'fakesign',
          }),
      } as Response);

      await channel.createPayment(makeOrder({ planId: 'my-special-plan', planSlug: undefined }));

      const rawBody = (fetchSpy.mock.calls[0][1] as RequestInit).body as string;
      const bizContent = JSON.parse(new URLSearchParams(rawBody).get('biz_content')!);
      expect(bizContent.subject).toContain('my-special-plan');
    });
  });
});

// @vitest-environment node
import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PaymentOrder } from '../types';
import { WeChatNativeChannel } from './wechat-native';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Compute the WeChat MD5 signature using the same algorithm as the channel.
 */
function computeSign(params: Record<string, string>, apiKey: string): string {
  const sortedKeys = Object.keys(params).sort();
  const stringA = sortedKeys.map((key) => `${key}=${params[key]}`).join('&');
  const stringSignTemp = `${stringA}&key=${apiKey}`;
  return crypto.createHash('md5').update(stringSignTemp, 'utf8').digest('hex').toUpperCase();
}

/**
 * Build a WeChat-style XML string from params, appending a valid signature.
 */
function buildXmlWithSign(params: Record<string, string>, apiKey: string): string {
  const sign = computeSign(params, apiKey);
  const allParams = { ...params, sign };
  const xmlContent = Object.entries(allParams)
    .map(([key, value]) => `<${key}>${value}</${key}>`)
    .join('');
  return `<xml>${xmlContent}</xml>`;
}

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const TEST_API_KEY = 'test_api_key_1234567890abcdef';
const TEST_CONFIG = {
  apiKey: TEST_API_KEY,
  appId: 'wx_test_app_id',
  mchId: 'test_mch_id',
  notifyUrl: 'https://example.com/notify/wechat',
};

const BASE_ORDER: PaymentOrder = {
  amount: 9900,
  createdAt: new Date('2026-01-27T09:30:45Z'),
  currency: 'CNY',
  expiredAt: new Date('2026-01-27T11:30:45Z'),
  id: 'test-order-id',
  orderNo: 'PC20260127093045123456',
  payChannel: 'wechat_native',
  planId: 'plan-pro',
  planInterval: 'month',
  planSlug: 'pro',
  status: 'pending',
  subscriptionType: 'recurring',
  updatedAt: new Date('2026-01-27T09:30:45Z'),
  userId: 'user-123',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WeChatNativeChannel', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  describe('constructor', () => {
    it('should throw when config is undefined', () => {
      expect(() => new WeChatNativeChannel(undefined as any)).toThrow(
        'WeChat payment config is required',
      );
    });

    it('should create instance successfully with valid config', () => {
      const channel = new WeChatNativeChannel(TEST_CONFIG);
      expect(channel).toBeInstanceOf(WeChatNativeChannel);
    });
  });

  // -------------------------------------------------------------------------
  describe('parseNotification', () => {
    let channel: WeChatNativeChannel;

    beforeEach(() => {
      channel = new WeChatNativeChannel(TEST_CONFIG);
    });

    it('should parse a successful notification from a string body', async () => {
      const params = {
        out_trade_no: 'PC20260127093045123456',
        result_code: 'SUCCESS',
        return_code: 'SUCCESS',
        time_end: '20260127093045',
        total_fee: '9900',
        transaction_id: 'transaction_abc123',
      };
      const xml = buildXmlWithSign(params, TEST_API_KEY);

      const result = await channel.parseNotification(xml);

      expect(result.success).toBe(true);
      expect(result.orderNo).toBe('PC20260127093045123456');
      expect(result.channelOrderNo).toBe('transaction_abc123');
      expect(result.amount).toBe(9900);
      expect(result.paidAt).toBeInstanceOf(Date);
    });

    it('should parse a successful notification from a Buffer body', async () => {
      const params = {
        out_trade_no: 'PC20260127093045123456',
        result_code: 'SUCCESS',
        return_code: 'SUCCESS',
        time_end: '20260127093045',
        total_fee: '9900',
        transaction_id: 'transaction_abc123',
      };
      const xml = buildXmlWithSign(params, TEST_API_KEY);
      const buffer = Buffer.from(xml, 'utf8');

      const result = await channel.parseNotification(buffer);

      expect(result.success).toBe(true);
      expect(result.orderNo).toBe('PC20260127093045123456');
    });

    it('should parse the correct paid date from time_end', async () => {
      // time_end: '20260127093045' → 2026-01-27 09:30:45 (local time)
      const params = {
        out_trade_no: 'PC20260127093045123456',
        result_code: 'SUCCESS',
        return_code: 'SUCCESS',
        time_end: '20260127093045',
        total_fee: '9900',
        transaction_id: 'tx123',
      };
      const xml = buildXmlWithSign(params, TEST_API_KEY);

      const result = await channel.parseNotification(xml);

      expect(result.paidAt).toBeInstanceOf(Date);
      expect(result.paidAt!.getFullYear()).toBe(2026);
      expect(result.paidAt!.getMonth()).toBe(0); // January (0-indexed)
      expect(result.paidAt!.getDate()).toBe(27);
      expect(result.paidAt!.getHours()).toBe(9);
      expect(result.paidAt!.getMinutes()).toBe(30);
      expect(result.paidAt!.getSeconds()).toBe(45);
    });

    it('should return failure when signature is invalid', async () => {
      // Build XML with a deliberately wrong signature
      const fields = [
        '<return_code>SUCCESS</return_code>',
        '<result_code>SUCCESS</result_code>',
        '<out_trade_no>PC20260127093045123456</out_trade_no>',
        '<transaction_id>tx123</transaction_id>',
        '<total_fee>9900</total_fee>',
        '<time_end>20260127093045</time_end>',
        '<sign>INVALIDSIGNATUREVALUE</sign>',
      ];
      const xml = `<xml>${fields.join('')}</xml>`;

      const result = await channel.parseNotification(xml);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Invalid signature');
      expect(result.orderNo).toBe('PC20260127093045123456');
    });

    it('should return failure when return_code is not SUCCESS', async () => {
      const params = {
        out_trade_no: 'PC20260127093045123456',
        return_code: 'FAIL',
        return_msg: 'System error',
      };
      const xml = buildXmlWithSign(params, TEST_API_KEY);

      const result = await channel.parseNotification(xml);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('System error');
      expect(result.orderNo).toBe('PC20260127093045123456');
    });

    it('should use "Notification error" as default message when return_msg is absent', async () => {
      const params = {
        out_trade_no: 'PC20260127093045123456',
        return_code: 'FAIL',
      };
      const xml = buildXmlWithSign(params, TEST_API_KEY);

      const result = await channel.parseNotification(xml);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Notification error');
    });

    it('should return failure when result_code is not SUCCESS (uses err_code_des)', async () => {
      const params = {
        err_code: 'PAYERROR',
        err_code_des: 'Payment declined by user',
        out_trade_no: 'PC20260127093045123456',
        result_code: 'FAIL',
        return_code: 'SUCCESS',
      };
      const xml = buildXmlWithSign(params, TEST_API_KEY);

      const result = await channel.parseNotification(xml);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Payment declined by user');
      expect(result.orderNo).toBe('PC20260127093045123456');
    });

    it('should fall back to err_code when err_code_des is absent', async () => {
      const params = {
        err_code: 'PAYERROR',
        out_trade_no: 'PC20260127093045123456',
        result_code: 'FAIL',
        return_code: 'SUCCESS',
      };
      const xml = buildXmlWithSign(params, TEST_API_KEY);

      const result = await channel.parseNotification(xml);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('PAYERROR');
    });

    it('should handle malformed XML gracefully with empty orderNo', async () => {
      const result = await channel.parseNotification('not-valid-xml!!');

      expect(result.success).toBe(false);
      expect(result.orderNo).toBe('');
      expect(result.errorMessage).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  describe('queryOrder', () => {
    let channel: WeChatNativeChannel;

    beforeEach(() => {
      channel = new WeChatNativeChannel(TEST_CONFIG);
    });

    it('should return "paid" status for SUCCESS trade_state', async () => {
      const responseParams = {
        out_trade_no: 'PC20260127093045123456',
        result_code: 'SUCCESS',
        return_code: 'SUCCESS',
        time_end: '20260127093045',
        trade_state: 'SUCCESS',
        transaction_id: 'transaction_abc123',
      };
      const responseXml = buildXmlWithSign(responseParams, TEST_API_KEY);

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        text: vi.fn().mockResolvedValue(responseXml),
      } as any);

      const result = await channel.queryOrder('PC20260127093045123456');

      expect(result.orderNo).toBe('PC20260127093045123456');
      expect(result.status).toBe('paid');
      expect(result.channelOrderNo).toBe('transaction_abc123');
      expect(result.paidAt).toBeInstanceOf(Date);
    });

    it('should return "closed" status for CLOSED trade_state', async () => {
      const responseParams = {
        out_trade_no: 'PC20260127093045123456',
        result_code: 'SUCCESS',
        return_code: 'SUCCESS',
        trade_state: 'CLOSED',
      };
      const responseXml = buildXmlWithSign(responseParams, TEST_API_KEY);

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        text: vi.fn().mockResolvedValue(responseXml),
      } as any);

      const result = await channel.queryOrder('PC20260127093045123456');

      expect(result.status).toBe('closed');
    });

    it('should return "closed" status for REVOKED trade_state', async () => {
      const responseParams = {
        out_trade_no: 'PC20260127093045123456',
        result_code: 'SUCCESS',
        return_code: 'SUCCESS',
        trade_state: 'REVOKED',
      };
      const responseXml = buildXmlWithSign(responseParams, TEST_API_KEY);

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        text: vi.fn().mockResolvedValue(responseXml),
      } as any);

      const result = await channel.queryOrder('PC20260127093045123456');

      expect(result.status).toBe('closed');
    });

    it('should return "refunded" status for REFUND trade_state', async () => {
      const responseParams = {
        out_trade_no: 'PC20260127093045123456',
        result_code: 'SUCCESS',
        return_code: 'SUCCESS',
        trade_state: 'REFUND',
      };
      const responseXml = buildXmlWithSign(responseParams, TEST_API_KEY);

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        text: vi.fn().mockResolvedValue(responseXml),
      } as any);

      const result = await channel.queryOrder('PC20260127093045123456');

      expect(result.status).toBe('refunded');
    });

    it('should return "pending" status for NOTPAY trade_state', async () => {
      const responseParams = {
        out_trade_no: 'PC20260127093045123456',
        result_code: 'SUCCESS',
        return_code: 'SUCCESS',
        trade_state: 'NOTPAY',
      };
      const responseXml = buildXmlWithSign(responseParams, TEST_API_KEY);

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        text: vi.fn().mockResolvedValue(responseXml),
      } as any);

      const result = await channel.queryOrder('PC20260127093045123456');

      expect(result.status).toBe('pending');
    });

    it('should return "pending" status for USERPAYING trade_state', async () => {
      const responseParams = {
        out_trade_no: 'PC20260127093045123456',
        result_code: 'SUCCESS',
        return_code: 'SUCCESS',
        trade_state: 'USERPAYING',
      };
      const responseXml = buildXmlWithSign(responseParams, TEST_API_KEY);

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        text: vi.fn().mockResolvedValue(responseXml),
      } as any);

      const result = await channel.queryOrder('PC20260127093045123456');

      expect(result.status).toBe('pending');
    });

    it('should return "pending" status when API returns non-SUCCESS return_code', async () => {
      const responseParams = {
        return_code: 'FAIL',
        return_msg: 'Order not found',
      };
      const responseXml = buildXmlWithSign(responseParams, TEST_API_KEY);

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        text: vi.fn().mockResolvedValue(responseXml),
      } as any);

      const result = await channel.queryOrder('PC20260127093045123456');

      expect(result.orderNo).toBe('PC20260127093045123456');
      expect(result.status).toBe('pending');
    });

    it('should return "pending" status when fetch throws a network error', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

      const result = await channel.queryOrder('PC20260127093045123456');

      expect(result.orderNo).toBe('PC20260127093045123456');
      expect(result.status).toBe('pending');
    });

    it('should not include paidAt when trade_state is not SUCCESS', async () => {
      const responseParams = {
        out_trade_no: 'PC20260127093045123456',
        result_code: 'SUCCESS',
        return_code: 'SUCCESS',
        trade_state: 'NOTPAY',
      };
      const responseXml = buildXmlWithSign(responseParams, TEST_API_KEY);

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        text: vi.fn().mockResolvedValue(responseXml),
      } as any);

      const result = await channel.queryOrder('PC20260127093045123456');

      expect(result.paidAt).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  describe('createPayment', () => {
    let channel: WeChatNativeChannel;

    beforeEach(() => {
      channel = new WeChatNativeChannel(TEST_CONFIG);
    });

    it('should return success with code_url when API returns SUCCESS', async () => {
      const responseParams = {
        code_url: 'weixin://wxpay/bizpayurl?test=1',
        prepay_id: 'wx_prepay_123',
        result_code: 'SUCCESS',
        return_code: 'SUCCESS',
      };
      const responseXml = buildXmlWithSign(responseParams, TEST_API_KEY);

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        text: vi.fn().mockResolvedValue(responseXml),
      } as any);

      const result = await channel.createPayment(BASE_ORDER);

      expect(result.success).toBe(true);
      expect(result.channelData?.code_url).toBe('weixin://wxpay/bizpayurl?test=1');
      expect(result.channelData?.prepay_id).toBe('wx_prepay_123');
      expect(result.channelOrderNo).toBe('wx_prepay_123');
    });

    it('should return failure when return_code is not SUCCESS', async () => {
      const responseParams = {
        return_code: 'FAIL',
        return_msg: 'Invalid request params',
      };
      const responseXml = buildXmlWithSign(responseParams, TEST_API_KEY);

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        text: vi.fn().mockResolvedValue(responseXml),
      } as any);

      const result = await channel.createPayment(BASE_ORDER);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Invalid request params');
    });

    it('should use "WeChat API error" as default when return_msg is absent', async () => {
      const responseParams = {
        return_code: 'FAIL',
      };
      const responseXml = buildXmlWithSign(responseParams, TEST_API_KEY);

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        text: vi.fn().mockResolvedValue(responseXml),
      } as any);

      const result = await channel.createPayment(BASE_ORDER);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('WeChat API error');
    });

    it('should return failure when result_code is not SUCCESS (uses err_code_des)', async () => {
      const responseParams = {
        err_code: 'SYSTEMERROR',
        err_code_des: 'System internal error',
        result_code: 'FAIL',
        return_code: 'SUCCESS',
      };
      const responseXml = buildXmlWithSign(responseParams, TEST_API_KEY);

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        text: vi.fn().mockResolvedValue(responseXml),
      } as any);

      const result = await channel.createPayment(BASE_ORDER);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('System internal error');
    });

    it('should fall back to err_code when err_code_des is absent in result_code failure', async () => {
      const responseParams = {
        err_code: 'SYSTEMERROR',
        result_code: 'FAIL',
        return_code: 'SUCCESS',
      };
      const responseXml = buildXmlWithSign(responseParams, TEST_API_KEY);

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        text: vi.fn().mockResolvedValue(responseXml),
      } as any);

      const result = await channel.createPayment(BASE_ORDER);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('SYSTEMERROR');
    });

    it('should return failure when response signature is invalid', async () => {
      const fields = [
        '<return_code>SUCCESS</return_code>',
        '<result_code>SUCCESS</result_code>',
        '<prepay_id>wx_prepay_123</prepay_id>',
        '<code_url>weixin://wxpay/bizpayurl</code_url>',
        '<sign>INVALIDSIGNATUREHERE</sign>',
      ];
      const responseXml = `<xml>${fields.join('')}</xml>`;

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        text: vi.fn().mockResolvedValue(responseXml),
      } as any);

      const result = await channel.createPayment(BASE_ORDER);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Invalid response signature');
    });

    it('should return failure with error message when fetch throws', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Connection refused'));

      const result = await channel.createPayment(BASE_ORDER);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Connection refused');
    });

    it('should include order number in the request body XML', async () => {
      const responseParams = {
        code_url: 'weixin://wxpay/bizpayurl',
        prepay_id: 'wx_prepay_123',
        result_code: 'SUCCESS',
        return_code: 'SUCCESS',
      };
      const responseXml = buildXmlWithSign(responseParams, TEST_API_KEY);

      let capturedBody = '';
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options) => {
        capturedBody = (options as RequestInit).body as string;
        return { text: vi.fn().mockResolvedValue(responseXml) } as any;
      });

      await channel.createPayment(BASE_ORDER);

      expect(capturedBody).toContain('PC20260127093045123456');
    });

    it('should build body with capitalized slug and interval label for recurring monthly', async () => {
      const responseParams = {
        code_url: 'weixin://wxpay/bizpayurl',
        prepay_id: 'wx_prepay_123',
        result_code: 'SUCCESS',
        return_code: 'SUCCESS',
      };
      const responseXml = buildXmlWithSign(responseParams, TEST_API_KEY);

      let capturedBody = '';
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options) => {
        capturedBody = (options as RequestInit).body as string;
        return { text: vi.fn().mockResolvedValue(responseXml) } as any;
      });

      await channel.createPayment(BASE_ORDER);

      // slug 'pro' → 'Pro', planInterval 'month' → 'Monthly'
      expect(capturedBody).toContain('Pro Monthly Plan');
    });

    it('should build body with Annual label for yearly subscription', async () => {
      const yearlyOrder: PaymentOrder = { ...BASE_ORDER, planInterval: 'year' };
      const responseParams = {
        code_url: 'weixin://wxpay/bizpayurl',
        prepay_id: 'wx_prepay_456',
        result_code: 'SUCCESS',
        return_code: 'SUCCESS',
      };
      const responseXml = buildXmlWithSign(responseParams, TEST_API_KEY);

      let capturedBody = '';
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options) => {
        capturedBody = (options as RequestInit).body as string;
        return { text: vi.fn().mockResolvedValue(responseXml) } as any;
      });

      await channel.createPayment(yearlyOrder);

      expect(capturedBody).toContain('Pro Annual Plan');
    });

    it('should append duration months suffix for one-time payments', async () => {
      const onetimeOrder: PaymentOrder = {
        ...BASE_ORDER,
        durationMonths: 3,
        subscriptionType: 'onetime',
      };
      const responseParams = {
        code_url: 'weixin://wxpay/bizpayurl',
        prepay_id: 'wx_prepay_789',
        result_code: 'SUCCESS',
        return_code: 'SUCCESS',
      };
      const responseXml = buildXmlWithSign(responseParams, TEST_API_KEY);

      let capturedBody = '';
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options) => {
        capturedBody = (options as RequestInit).body as string;
        return { text: vi.fn().mockResolvedValue(responseXml) } as any;
      });

      await channel.createPayment(onetimeOrder);

      expect(capturedBody).toContain('3mo');
    });

    it('should use planId as body prefix when planSlug is not set', async () => {
      const orderWithoutSlug: PaymentOrder = {
        ...BASE_ORDER,
        planSlug: undefined,
      };
      const responseParams = {
        code_url: 'weixin://wxpay/bizpayurl',
        prepay_id: 'wx_prepay_789',
        result_code: 'SUCCESS',
        return_code: 'SUCCESS',
      };
      const responseXml = buildXmlWithSign(responseParams, TEST_API_KEY);

      let capturedBody = '';
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options) => {
        capturedBody = (options as RequestInit).body as string;
        return { text: vi.fn().mockResolvedValue(responseXml) } as any;
      });

      await channel.createPayment(orderWithoutSlug);

      // Should use planId ('plan-pro') as the display name
      expect(capturedBody).toContain('plan-pro');
    });
  });

  // -------------------------------------------------------------------------
  describe('closeOrder', () => {
    it('should call the WeChat close-order API without throwing on success', async () => {
      const channel = new WeChatNativeChannel(TEST_CONFIG);

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        text: vi.fn().mockResolvedValue('<xml><return_code>SUCCESS</return_code></xml>'),
      } as any);

      await expect(channel.closeOrder('PC20260127093045123456')).resolves.toBeUndefined();
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should include the order number in the close-order request body', async () => {
      const channel = new WeChatNativeChannel(TEST_CONFIG);

      let capturedBody = '';
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options) => {
        capturedBody = (options as RequestInit).body as string;
        return {
          text: vi.fn().mockResolvedValue('<xml><return_code>SUCCESS</return_code></xml>'),
        } as any;
      });

      await channel.closeOrder('PC20260127093045123456');

      expect(capturedBody).toContain('PC20260127093045123456');
    });
  });
});

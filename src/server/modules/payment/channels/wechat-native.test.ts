// @vitest-environment node
import crypto from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WeChatNativeChannel } from './wechat-native';
import type { PaymentOrder } from '../types';

const TEST_CONFIG = {
  apiKey: 'test_api_key_123456789012345678',
  appId: 'wx_test_app_id',
  mchId: 'test_mch_id',
  notifyUrl: 'https://example.com/wechat/notify',
};

function computeWeChatSign(params: Record<string, string>, apiKey: string): string {
  const sortedKeys = Object.keys(params).sort();
  const stringA = sortedKeys.map((k) => `${k}=${params[k]}`).join('&');
  const stringSignTemp = `${stringA}&key=${apiKey}`;
  return crypto.createHash('md5').update(stringSignTemp, 'utf8').digest('hex').toUpperCase();
}

function buildXml(params: Record<string, string>): string {
  const fields = Object.entries(params)
    .map(([k, v]) => `<${k}>${v}</${k}>`)
    .join('');
  return `<xml>${fields}</xml>`;
}

describe('WeChatNativeChannel', () => {
  let channel: WeChatNativeChannel;

  beforeEach(() => {
    channel = new WeChatNativeChannel(TEST_CONFIG);
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should throw if config is not provided', () => {
      expect(() => new WeChatNativeChannel(undefined as any)).toThrow(
        'WeChat payment config is required',
      );
    });

    it('should create instance with valid config', () => {
      expect(channel).toBeInstanceOf(WeChatNativeChannel);
    });
  });

  describe('parseNotification', () => {
    it('should return failure when sign field is missing', async () => {
      const xmlWithoutSign = buildXml({
        appid: 'wx_test_app_id',
        out_trade_no: 'PC202601270930451234567',
        return_code: 'SUCCESS',
      });

      const result = await channel.parseNotification(xmlWithoutSign);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Invalid signature');
      expect(result.orderNo).toBe('PC202601270930451234567');
    });

    it('should return failure when signature is invalid', async () => {
      const params = {
        appid: 'wx_test_app_id',
        mch_id: 'test_mch_id',
        out_trade_no: 'PC202601270930451234567',
        result_code: 'SUCCESS',
        return_code: 'SUCCESS',
      };

      const xmlWithBadSign = buildXml({ ...params, sign: 'INVALID_SIGN_VALUE' });

      const result = await channel.parseNotification(xmlWithBadSign);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Invalid signature');
    });

    it('should return failure when return_code is not SUCCESS', async () => {
      const params = {
        appid: 'wx_test_app_id',
        mch_id: 'test_mch_id',
        out_trade_no: 'PC202601270930451234567',
        return_msg: 'Communication error',
      };
      const sign = computeWeChatSign({ ...params, return_code: 'FAIL' }, TEST_CONFIG.apiKey);
      const xml = buildXml({ ...params, return_code: 'FAIL', sign });

      const result = await channel.parseNotification(xml);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Communication error');
      expect(result.orderNo).toBe('PC202601270930451234567');
    });

    it('should return failure when result_code is not SUCCESS', async () => {
      const params = {
        appid: 'wx_test_app_id',
        err_code_des: 'Insufficient balance',
        mch_id: 'test_mch_id',
        out_trade_no: 'PC202601270930451234567',
        result_code: 'FAIL',
        return_code: 'SUCCESS',
      };
      const sign = computeWeChatSign(params, TEST_CONFIG.apiKey);
      const xml = buildXml({ ...params, sign });

      const result = await channel.parseNotification(xml);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Insufficient balance');
    });

    it('should accept Buffer as input', async () => {
      const xmlWithoutSign = buildXml({
        out_trade_no: 'PC202601270930451234567',
        return_code: 'FAIL',
      });

      const result = await channel.parseNotification(Buffer.from(xmlWithoutSign, 'utf8'));

      expect(result.success).toBe(false);
    });

    it('should return success for a valid notification with correct signature', async () => {
      const params = {
        appid: 'wx_test_app_id',
        mch_id: 'test_mch_id',
        out_trade_no: 'PC202601270930451234567',
        result_code: 'SUCCESS',
        return_code: 'SUCCESS',
        time_end: '20260127093045',
        total_fee: '9900',
        transaction_id: '4200001234202601271234567890',
      };
      const sign = computeWeChatSign(params, TEST_CONFIG.apiKey);
      const xml = buildXml({ ...params, sign });

      const result = await channel.parseNotification(xml);

      expect(result.success).toBe(true);
      expect(result.orderNo).toBe('PC202601270930451234567');
      expect(result.channelOrderNo).toBe('4200001234202601271234567890');
      expect(result.amount).toBe(9900);
      expect(result.paidAt).toBeInstanceOf(Date);
    });

    it('should return failure and empty orderNo for invalid XML', async () => {
      const result = await channel.parseNotification('not-xml-at-all<<<');

      expect(result.success).toBe(false);
      expect(result.orderNo).toBe('');
      expect(result.errorMessage).toBeDefined();
    });
  });

  describe('createPayment', () => {
    const mockOrder: PaymentOrder = {
      amount: 9900,
      createdAt: new Date(),
      currency: 'CNY',
      expiredAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      id: 'order-1',
      orderNo: 'PC202601270930451234567',
      payChannel: 'wechat_native',
      planId: 'plan-pro',
      planInterval: 'month',
      planName: 'Pro',
      planSlug: 'pro',
      status: 'pending',
      subscriptionType: 'recurring',
      updatedAt: new Date(),
      userId: 'user-1',
    };

    it('should return success result with code_url on valid response', async () => {
      const responseParams = {
        appid: 'wx_test_app_id',
        code_url: 'weixin://wxpay/bizpayurl?pr=test',
        mch_id: 'test_mch_id',
        prepay_id: 'wx2026012709304512345',
        result_code: 'SUCCESS',
        return_code: 'SUCCESS',
      };
      const sign = computeWeChatSign(responseParams, TEST_CONFIG.apiKey);
      const xml = buildXml({ ...responseParams, sign });

      global.fetch = vi.fn().mockResolvedValue({
        text: vi.fn().mockResolvedValue(xml),
      });

      const result = await channel.createPayment(mockOrder);

      expect(result.success).toBe(true);
      expect(result.channelData?.code_url).toBe('weixin://wxpay/bizpayurl?pr=test');
      expect(result.channelOrderNo).toBe('wx2026012709304512345');
    });

    it('should return failure when return_code is FAIL', async () => {
      const responseParams = {
        return_code: 'FAIL',
        return_msg: 'System error',
      };
      const xml = buildXml(responseParams);

      global.fetch = vi.fn().mockResolvedValue({
        text: vi.fn().mockResolvedValue(xml),
      });

      const result = await channel.createPayment(mockOrder);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('System error');
    });

    it('should return failure when result_code is FAIL', async () => {
      const responseParams = {
        err_code: 'ORDERPAID',
        err_code_des: 'Order already paid',
        result_code: 'FAIL',
        return_code: 'SUCCESS',
      };
      const xml = buildXml(responseParams);

      global.fetch = vi.fn().mockResolvedValue({
        text: vi.fn().mockResolvedValue(xml),
      });

      const result = await channel.createPayment(mockOrder);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Order already paid');
    });

    it('should return failure when fetch throws', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await channel.createPayment(mockOrder);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Network error');
    });

    it('should include durationMonths suffix for onetime payment', async () => {
      const onetimeOrder: PaymentOrder = {
        ...mockOrder,
        durationMonths: 3,
        subscriptionType: 'onetime',
      };

      const responseParams = {
        result_code: 'FAIL',
        return_code: 'SUCCESS',
      };
      const xml = buildXml(responseParams);

      global.fetch = vi.fn().mockResolvedValue({
        text: vi.fn().mockResolvedValue(xml),
      });

      await channel.createPayment(onetimeOrder);

      const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = fetchCall[1].body as string;
      expect(body).toContain('3mo');
    });
  });

  describe('queryOrder', () => {
    it('should return pending status when fetch fails', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await channel.queryOrder('PC202601270930451234567');

      expect(result.status).toBe('pending');
      expect(result.orderNo).toBe('PC202601270930451234567');
    });

    it('should return pending status when return_code is FAIL', async () => {
      const xml = buildXml({ return_code: 'FAIL' });
      global.fetch = vi.fn().mockResolvedValue({
        text: vi.fn().mockResolvedValue(xml),
      });

      const result = await channel.queryOrder('PC202601270930451234567');

      expect(result.status).toBe('pending');
    });

    it('should return paid status for SUCCESS trade_state', async () => {
      const responseParams = {
        appid: 'wx_test_app_id',
        mch_id: 'test_mch_id',
        out_trade_no: 'PC202601270930451234567',
        result_code: 'SUCCESS',
        return_code: 'SUCCESS',
        time_end: '20260127093045',
        trade_state: 'SUCCESS',
        transaction_id: '4200001234202601271234567890',
      };
      const sign = computeWeChatSign(responseParams, TEST_CONFIG.apiKey);
      const xml = buildXml({ ...responseParams, sign });

      global.fetch = vi.fn().mockResolvedValue({
        text: vi.fn().mockResolvedValue(xml),
      });

      const result = await channel.queryOrder('PC202601270930451234567');

      expect(result.status).toBe('paid');
      expect(result.channelOrderNo).toBe('4200001234202601271234567890');
      expect(result.paidAt).toBeInstanceOf(Date);
    });

    it('should return closed status for CLOSED trade_state', async () => {
      const responseParams = {
        out_trade_no: 'PC202601270930451234567',
        result_code: 'SUCCESS',
        return_code: 'SUCCESS',
        trade_state: 'CLOSED',
      };
      const sign = computeWeChatSign(responseParams, TEST_CONFIG.apiKey);
      const xml = buildXml({ ...responseParams, sign });

      global.fetch = vi.fn().mockResolvedValue({
        text: vi.fn().mockResolvedValue(xml),
      });

      const result = await channel.queryOrder('PC202601270930451234567');

      expect(result.status).toBe('closed');
    });

    it('should return refunded status for REFUND trade_state', async () => {
      const responseParams = {
        out_trade_no: 'PC202601270930451234567',
        result_code: 'SUCCESS',
        return_code: 'SUCCESS',
        trade_state: 'REFUND',
      };
      const sign = computeWeChatSign(responseParams, TEST_CONFIG.apiKey);
      const xml = buildXml({ ...responseParams, sign });

      global.fetch = vi.fn().mockResolvedValue({
        text: vi.fn().mockResolvedValue(xml),
      });

      const result = await channel.queryOrder('PC202601270930451234567');

      expect(result.status).toBe('refunded');
    });
  });

  describe('closeOrder', () => {
    it('should call WeChat close order API without throwing', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        text: vi.fn().mockResolvedValue('<xml><return_code>SUCCESS</return_code></xml>'),
      });

      await expect(channel.closeOrder('PC202601270930451234567')).resolves.toBeUndefined();
      expect(global.fetch).toHaveBeenCalledOnce();
    });

    it('should not throw even when fetch fails', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(channel.closeOrder('PC202601270930451234567')).rejects.toThrow('Network error');
    });
  });
});

// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AlipayPrecreateChannel } from './channels/alipay-precreate';
import { AlipayCycleChannel } from './channels/alipay-cycle';
import { WeChatNativeChannel } from './channels/wechat-native';
import { PaymentService } from './index';

// Mock channel implementations
vi.mock('./channels/wechat-native');
vi.mock('./channels/alipay-precreate');
vi.mock('./channels/alipay-cycle');

// Mock order number generation for deterministic tests
vi.mock('./utils/order-no', () => ({
  generateOrderNo: vi.fn().mockReturnValue('PC202601010000001234'),
}));

const MOCK_ORDER_NO = 'PC202601010000001234';

const mockPlan = {
  id: 'plan-pro',
  name: 'Pro Plan',
  slug: 'pro',
  monthlyPrice: 999,
  yearlyPrice: 9999,
};

const wechatConfig = {
  appId: 'wx_app_id',
  mchId: 'mch_id',
  apiKey: 'api_key',
  notifyUrl: 'https://example.com/notify/wechat',
};

const alipayConfig = {
  appId: 'alipay_app_id',
  privateKey: 'private_key',
  alipayPublicKey: 'public_key',
  notifyUrl: 'https://example.com/notify/alipay',
};

/**
 * Creates a mock Drizzle ORM database object.
 * Supports chained select/insert/update patterns used by the PaymentService.
 */
const createMockDb = () => {
  const limitFn = vi.fn();
  const whereFn = vi.fn().mockReturnValue({ limit: limitFn });
  const fromFn = vi.fn().mockReturnValue({ where: whereFn });
  const selectFn = vi.fn().mockReturnValue({ from: fromFn });

  const insertValuesFn = vi.fn().mockResolvedValue([]);
  const insertFn = vi.fn().mockReturnValue({ values: insertValuesFn });

  const updateWhereFn = vi.fn().mockResolvedValue([]);
  const updateSetFn = vi.fn().mockReturnValue({ where: updateWhereFn });
  const updateFn = vi.fn().mockReturnValue({ set: updateSetFn });

  const db = {
    insert: insertFn,
    select: selectFn,
    update: updateFn,
  } as any;

  return { db, insertFn, insertValuesFn, limitFn, updateFn, updateSetFn, updateWhereFn };
};

describe('PaymentService', () => {
  let mockWechatChannel: any;
  let mockAlipayChannel: any;
  let mockCycleChannel: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockWechatChannel = {
      closeOrder: vi.fn().mockResolvedValue(undefined),
      createPayment: vi.fn(),
      parseNotification: vi.fn(),
      queryOrder: vi.fn(),
    };

    mockAlipayChannel = {
      closeOrder: vi.fn().mockResolvedValue(undefined),
      createPayment: vi.fn(),
      parseNotification: vi.fn(),
      queryOrder: vi.fn(),
    };

    mockCycleChannel = {
      createSignPayment: vi.fn(),
      deductPayment: vi.fn(),
      unsignAgreement: vi.fn(),
    };

    vi.mocked(WeChatNativeChannel).mockImplementation(() => mockWechatChannel);
    vi.mocked(AlipayPrecreateChannel).mockImplementation(() => mockAlipayChannel);
    vi.mocked(AlipayCycleChannel).mockImplementation(() => mockCycleChannel);
  });

  describe('constructor', () => {
    it('should register wechat channel when wechat config is provided', () => {
      const { db } = createMockDb();
      const service = new PaymentService(db, { wechat: wechatConfig });
      expect(service.getChannel('wechat_native')).toBeDefined();
    });

    it('should register alipay channels when alipay config is provided', () => {
      const { db } = createMockDb();
      const service = new PaymentService(db, { alipay: alipayConfig });
      expect(service.getChannel('alipay_precreate')).toBeDefined();
      expect(service.getCycleChannel()).toBeDefined();
    });

    it('should not register channels when no config is provided', () => {
      const { db } = createMockDb();
      const service = new PaymentService(db, {});
      expect(service.getChannel('wechat_native')).toBeUndefined();
      expect(service.getChannel('alipay_precreate')).toBeUndefined();
      expect(service.getCycleChannel()).toBeNull();
    });

    it('should return undefined for an unknown channel name', () => {
      const { db } = createMockDb();
      const service = new PaymentService(db, { wechat: wechatConfig });
      expect(service.getChannel('unknown_channel')).toBeUndefined();
    });
  });

  describe('createOrder', () => {
    const baseOnetimeInput = {
      durationMonths: 1,
      payChannel: 'wechat_native' as const,
      planId: 'plan-pro',
      planInterval: 'month' as const,
      subscriptionType: 'onetime' as const,
      userId: 'user-123',
    };

    it('should throw if onetime payment is missing durationMonths', async () => {
      const { db } = createMockDb();
      const service = new PaymentService(db, { wechat: wechatConfig });

      await expect(
        service.createOrder({ ...baseOnetimeInput, durationMonths: undefined }),
      ).rejects.toThrow('durationMonths is required for one-time payment');
    });

    it('should throw if durationMonths is not 1, 3, 6, or 12', async () => {
      const { db } = createMockDb();
      const service = new PaymentService(db, { wechat: wechatConfig });

      await expect(
        service.createOrder({ ...baseOnetimeInput, durationMonths: 2 }),
      ).rejects.toThrow('durationMonths must be 1, 3, 6, or 12');
    });

    it('should throw if recurring payment has durationMonths', async () => {
      const { db } = createMockDb();
      const service = new PaymentService(db, { wechat: wechatConfig });

      await expect(
        service.createOrder({ ...baseOnetimeInput, durationMonths: 1, subscriptionType: 'recurring' }),
      ).rejects.toThrow('durationMonths should not be provided for recurring subscriptions');
    });

    it('should throw if payment channel is not supported', async () => {
      const { db } = createMockDb();
      const service = new PaymentService(db, {}); // no channels configured

      await expect(service.createOrder(baseOnetimeInput)).rejects.toThrow(
        'Payment channel wechat_native not supported',
      );
    });

    it('should throw if plan is not found', async () => {
      const { db, limitFn } = createMockDb();
      const service = new PaymentService(db, { wechat: wechatConfig });

      limitFn.mockResolvedValueOnce([]); // plan not found

      await expect(service.createOrder(baseOnetimeInput)).rejects.toThrow('Plan not found');
    });

    it('should calculate amount using yearlyPrice for 12-month onetime payment', async () => {
      const { db, limitFn } = createMockDb();
      const service = new PaymentService(db, { wechat: wechatConfig });

      limitFn.mockResolvedValueOnce([mockPlan]); // plan
      limitFn.mockResolvedValueOnce([]); // no existing order

      mockWechatChannel.createPayment.mockResolvedValue({
        channelData: { code_url: 'weixin://pay' },
        channelOrderNo: 'CH123',
        success: true,
      });

      const result = await service.createOrder({ ...baseOnetimeInput, durationMonths: 12 });

      expect(result.amount).toBe(mockPlan.yearlyPrice); // 9999
    });

    it('should calculate amount using monthlyPrice * duration for 3-month onetime payment', async () => {
      const { db, limitFn } = createMockDb();
      const service = new PaymentService(db, { wechat: wechatConfig });

      limitFn.mockResolvedValueOnce([mockPlan]);
      limitFn.mockResolvedValueOnce([]);

      mockWechatChannel.createPayment.mockResolvedValue({
        channelData: { code_url: 'weixin://pay' },
        channelOrderNo: 'CH123',
        success: true,
      });

      const result = await service.createOrder({ ...baseOnetimeInput, durationMonths: 3 });

      expect(result.amount).toBe(mockPlan.monthlyPrice * 3); // 2997
    });

    it('should calculate amount using monthlyPrice for recurring/month subscription', async () => {
      const { db, limitFn } = createMockDb();
      const service = new PaymentService(db, { wechat: wechatConfig });

      limitFn.mockResolvedValueOnce([mockPlan]);
      limitFn.mockResolvedValueOnce([]);

      mockWechatChannel.createPayment.mockResolvedValue({
        channelData: { code_url: 'weixin://pay' },
        channelOrderNo: 'CH123',
        success: true,
      });

      const result = await service.createOrder({
        payChannel: 'wechat_native',
        planId: 'plan-pro',
        planInterval: 'month',
        subscriptionType: 'recurring',
        userId: 'user-123',
      });

      expect(result.amount).toBe(mockPlan.monthlyPrice); // 999
    });

    it('should calculate amount using yearlyPrice for recurring/year subscription', async () => {
      const { db, limitFn } = createMockDb();
      const service = new PaymentService(db, { wechat: wechatConfig });

      limitFn.mockResolvedValueOnce([mockPlan]);
      limitFn.mockResolvedValueOnce([]);

      mockWechatChannel.createPayment.mockResolvedValue({
        channelData: { code_url: 'weixin://pay' },
        channelOrderNo: 'CH123',
        success: true,
      });

      const result = await service.createOrder({
        payChannel: 'wechat_native',
        planId: 'plan-pro',
        planInterval: 'year',
        subscriptionType: 'recurring',
        userId: 'user-123',
      });

      expect(result.amount).toBe(mockPlan.yearlyPrice); // 9999
    });

    it('should apply discountAmount to reduce the final payment amount', async () => {
      const { db, limitFn } = createMockDb();
      const service = new PaymentService(db, { wechat: wechatConfig });

      limitFn.mockResolvedValueOnce([mockPlan]);
      limitFn.mockResolvedValueOnce([]);

      mockWechatChannel.createPayment.mockResolvedValue({
        channelData: { code_url: 'weixin://pay' },
        channelOrderNo: 'CH123',
        success: true,
      });

      const result = await service.createOrder({ ...baseOnetimeInput, discountAmount: 200 });

      // 999 - 200 = 799
      expect(result.amount).toBe(799);
    });

    it('should apply residualValue to reduce the final payment amount', async () => {
      const { db, limitFn } = createMockDb();
      const service = new PaymentService(db, { wechat: wechatConfig });

      limitFn.mockResolvedValueOnce([mockPlan]);
      limitFn.mockResolvedValueOnce([]);

      mockWechatChannel.createPayment.mockResolvedValue({
        channelData: { code_url: 'weixin://pay' },
        channelOrderNo: 'CH123',
        success: true,
      });

      const result = await service.createOrder({ ...baseOnetimeInput, residualValue: 300 });

      // 999 - 300 = 699
      expect(result.amount).toBe(699);
    });

    it('should clamp amount to 0 when discounts exceed plan price', async () => {
      const { db, limitFn } = createMockDb();
      const service = new PaymentService(db, { wechat: wechatConfig });

      limitFn.mockResolvedValueOnce([mockPlan]);
      limitFn.mockResolvedValueOnce([]);

      mockWechatChannel.createPayment.mockResolvedValue({
        channelData: { code_url: 'weixin://pay' },
        channelOrderNo: 'CH123',
        success: true,
      });

      const result = await service.createOrder({
        ...baseOnetimeInput,
        discountAmount: 600,
        residualValue: 600,
      });

      // 999 - 600 - 600 would be -201, clamped to 0
      expect(result.amount).toBe(0);
    });

    it('should reuse unexpired pending order instead of creating a new one', async () => {
      const { db, limitFn } = createMockDb();
      const service = new PaymentService(db, { wechat: wechatConfig });

      const futureDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
      const existingOrder = {
        amount: 999,
        channelData: { code_url: 'weixin://existing' },
        expiredAt: futureDate,
        orderNo: 'PC_EXISTING',
      };

      limitFn.mockResolvedValueOnce([mockPlan]);
      limitFn.mockResolvedValueOnce([existingOrder]);

      const result = await service.createOrder(baseOnetimeInput);

      expect(result.orderNo).toBe('PC_EXISTING');
      expect(result.amount).toBe(999);
      expect(result.codeUrl).toBe('weixin://existing');
      // Channel should NOT be called when reusing an existing order
      expect(mockWechatChannel.createPayment).not.toHaveBeenCalled();
    });

    it('should create a new order if existing pending order has expired', async () => {
      const { db, limitFn } = createMockDb();
      const service = new PaymentService(db, { wechat: wechatConfig });

      const pastDate = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      const expiredOrder = {
        amount: 999,
        channelData: { code_url: 'weixin://expired' },
        expiredAt: pastDate,
        orderNo: 'PC_EXPIRED',
      };

      limitFn.mockResolvedValueOnce([mockPlan]);
      limitFn.mockResolvedValueOnce([expiredOrder]);

      mockWechatChannel.createPayment.mockResolvedValue({
        channelData: { code_url: 'weixin://new' },
        channelOrderNo: 'CH456',
        success: true,
      });

      const result = await service.createOrder(baseOnetimeInput);

      // Should create a new order, not reuse the expired one
      expect(result.orderNo).toBe(MOCK_ORDER_NO);
      expect(mockWechatChannel.createPayment).toHaveBeenCalled();
    });

    it('should update order to closed and throw if channel creation fails', async () => {
      const { db, limitFn, updateWhereFn } = createMockDb();
      const service = new PaymentService(db, { wechat: wechatConfig });

      limitFn.mockResolvedValueOnce([mockPlan]);
      limitFn.mockResolvedValueOnce([]);

      mockWechatChannel.createPayment.mockResolvedValue({
        errorMessage: 'Channel error',
        success: false,
      });

      await expect(service.createOrder(baseOnetimeInput)).rejects.toThrow('Channel error');
      expect(updateWhereFn).toHaveBeenCalled(); // order should be closed in DB
    });

    it('should return correct order data including codeUrl on success', async () => {
      const { db, limitFn } = createMockDb();
      const service = new PaymentService(db, { wechat: wechatConfig });

      limitFn.mockResolvedValueOnce([mockPlan]);
      limitFn.mockResolvedValueOnce([]);

      mockWechatChannel.createPayment.mockResolvedValue({
        channelData: { code_url: 'weixin://pay' },
        channelOrderNo: 'CH123',
        success: true,
      });

      const result = await service.createOrder(baseOnetimeInput);

      expect(result).toMatchObject({
        amount: mockPlan.monthlyPrice,
        codeUrl: 'weixin://pay',
        orderNo: MOCK_ORDER_NO,
      });
      expect(result.expiredAt).toBeInstanceOf(Date);
      // expiredAt should be ~2 hours from now
      expect(result.expiredAt.getTime()).toBeGreaterThan(Date.now() + 1.9 * 60 * 60 * 1000);
    });
  });

  describe('queryOrder', () => {
    it('should return order status and amount', async () => {
      const { db, limitFn } = createMockDb();
      const service = new PaymentService(db, {});

      const mockOrder = {
        amount: 999,
        orderNo: 'PC123',
        paidAt: new Date('2026-01-01'),
        status: 'paid',
      };
      limitFn.mockResolvedValueOnce([mockOrder]);

      const result = await service.queryOrder('PC123');

      expect(result).toMatchObject({
        amount: 999,
        orderNo: 'PC123',
        status: 'paid',
      });
      expect(result.paidAt).toBeInstanceOf(Date);
    });

    it('should return undefined paidAt when order is not paid', async () => {
      const { db, limitFn } = createMockDb();
      const service = new PaymentService(db, {});

      const mockOrder = { amount: 999, orderNo: 'PC123', paidAt: null, status: 'pending' };
      limitFn.mockResolvedValueOnce([mockOrder]);

      const result = await service.queryOrder('PC123');

      expect(result.paidAt).toBeUndefined();
    });

    it('should throw if order is not found', async () => {
      const { db, limitFn } = createMockDb();
      const service = new PaymentService(db, {});

      limitFn.mockResolvedValueOnce([]);

      await expect(service.queryOrder('PC_NOT_FOUND')).rejects.toThrow('Order not found');
    });
  });

  describe('closeOrder', () => {
    it('should throw if order is not found', async () => {
      const { db, limitFn } = createMockDb();
      const service = new PaymentService(db, {});

      limitFn.mockResolvedValueOnce([]);

      await expect(service.closeOrder('PC123', 'user-1')).rejects.toThrow('Order not found');
    });

    it('should throw Unauthorized if user does not own the order', async () => {
      const { db, limitFn } = createMockDb();
      const service = new PaymentService(db, {});

      limitFn.mockResolvedValueOnce([
        { orderNo: 'PC123', payChannel: 'wechat_native', status: 'pending', userId: 'other-user' },
      ]);

      await expect(service.closeOrder('PC123', 'user-1')).rejects.toThrow('Unauthorized');
    });

    it('should return without action if order is already paid', async () => {
      const { db, limitFn, updateWhereFn } = createMockDb();
      const service = new PaymentService(db, { wechat: wechatConfig });

      limitFn.mockResolvedValueOnce([
        { orderNo: 'PC123', payChannel: 'wechat_native', status: 'paid', userId: 'user-1' },
      ]);

      await service.closeOrder('PC123', 'user-1');

      expect(updateWhereFn).not.toHaveBeenCalled();
      expect(mockWechatChannel.closeOrder).not.toHaveBeenCalled();
    });

    it('should close pending order via channel and update status in DB', async () => {
      const { db, limitFn, updateWhereFn } = createMockDb();
      const service = new PaymentService(db, { wechat: wechatConfig });

      limitFn.mockResolvedValueOnce([
        { orderNo: 'PC123', payChannel: 'wechat_native', status: 'pending', userId: 'user-1' },
      ]);

      await service.closeOrder('PC123', 'user-1');

      expect(mockWechatChannel.closeOrder).toHaveBeenCalledWith('PC123');
      expect(updateWhereFn).toHaveBeenCalled();
    });
  });

  describe('processSignNotification', () => {
    const baseNotification = {
      agreementNo: 'AGR_ALIPAY_123',
      alipayLogonId: 'user@example.com',
      alipayOpenId: 'alipay-open-1',
      alipayUserId: 'alipay-user-1',
      externalAgreementNo: 'AGRPC202601010000001234',
      signScene: 'INDUSTRY|DIGITAL_MEDIA',
      signTime: new Date('2026-01-10T10:00:00Z'),
      status: 'NORMAL' as const,
    };

    it('should return { success: false } if agreement is not found', async () => {
      const { db, limitFn } = createMockDb();
      const service = new PaymentService(db, {});

      limitFn.mockResolvedValueOnce([]);

      const result = await service.processSignNotification(baseNotification);

      expect(result).toEqual({ success: false });
    });

    it('should update agreement to signed status when status is NORMAL', async () => {
      const { db, limitFn, updateSetFn } = createMockDb();
      const service = new PaymentService(db, {});

      const mockAgreement = {
        externalAgreementNo: 'AGRPC202601010000001234',
        id: 'agreement-1',
        period: 1,
        periodType: 'MONTH',
      };
      limitFn.mockResolvedValueOnce([mockAgreement]);

      const result = await service.processSignNotification(baseNotification);

      expect(result).toEqual({ success: true });
      const setCall = updateSetFn.mock.calls[0][0];
      expect(setCall.status).toBe('signed');
      expect(setCall.agreementNo).toBe('AGR_ALIPAY_123');
    });

    it('should calculate next monthly deduct date correctly', async () => {
      const { db, limitFn, updateSetFn } = createMockDb();
      const service = new PaymentService(db, {});

      const mockAgreement = {
        externalAgreementNo: 'AGRPC202601010000001234',
        id: 'agreement-1',
        period: 1,
        periodType: 'MONTH',
      };
      limitFn.mockResolvedValueOnce([mockAgreement]);

      // signTime = Jan 10, 2026. Next deduct = Feb 10, 2026.
      await service.processSignNotification(baseNotification);

      const setCall = updateSetFn.mock.calls[0][0];
      expect(setCall.nextDeductDate).toBe('2026-02-10');
    });

    it('should update agreement to unsigned status when status is UNSIGN', async () => {
      const { db, limitFn, updateSetFn } = createMockDb();
      const service = new PaymentService(db, {});

      const mockAgreement = {
        externalAgreementNo: 'AGRPC202601010000001234',
        id: 'agreement-1',
        period: 1,
        periodType: 'MONTH',
      };
      limitFn.mockResolvedValueOnce([mockAgreement]);

      const result = await service.processSignNotification({
        ...baseNotification,
        status: 'UNSIGN',
      });

      expect(result).toEqual({ success: true });
      const setCall = updateSetFn.mock.calls[0][0];
      expect(setCall.status).toBe('unsigned');
      expect(setCall.unsignReason).toBe('user_unsign');
    });
  });

  describe('createSignPaymentOrder', () => {
    it('should throw if alipay cycle channel is not configured', async () => {
      const { db } = createMockDb();
      const service = new PaymentService(db, {}); // no alipay config

      await expect(
        service.createSignPaymentOrder({ billingInterval: 'month', planId: 'plan-pro', userId: 'user-1' }),
      ).rejects.toThrow('Alipay cycle payment is not configured');
    });

    it('should throw if plan is not found', async () => {
      const { db, limitFn } = createMockDb();
      const service = new PaymentService(db, { alipay: alipayConfig });

      limitFn.mockResolvedValueOnce([]); // plan not found

      await expect(
        service.createSignPaymentOrder({ billingInterval: 'month', planId: 'plan-not-found', userId: 'user-1' }),
      ).rejects.toThrow('Plan not found');
    });

    it('should create sign payment order and return all required fields', async () => {
      const { db, limitFn } = createMockDb();
      const service = new PaymentService(db, { alipay: alipayConfig });

      limitFn.mockResolvedValueOnce([mockPlan]);

      mockCycleChannel.createSignPayment.mockResolvedValue({
        codeUrl: 'alipay://qr-code',
        success: true,
      });

      const result = await service.createSignPaymentOrder({
        billingInterval: 'month',
        planId: 'plan-pro',
        userId: 'user-1',
      });

      expect(result.orderNo).toBe(MOCK_ORDER_NO);
      expect(result.amount).toBe(mockPlan.monthlyPrice);
      expect(result.codeUrl).toBe('alipay://qr-code');
      expect(result.agreementId).toBeDefined();
      expect(result.externalAgreementNo).toBe(`AGR${MOCK_ORDER_NO}`);
      expect(result.expiredAt).toBeInstanceOf(Date);
    });

    it('should use yearlyPrice for yearly billing interval', async () => {
      const { db, limitFn } = createMockDb();
      const service = new PaymentService(db, { alipay: alipayConfig });

      limitFn.mockResolvedValueOnce([mockPlan]);

      mockCycleChannel.createSignPayment.mockResolvedValue({
        codeUrl: 'alipay://qr-code',
        success: true,
      });

      const result = await service.createSignPaymentOrder({
        billingInterval: 'year',
        planId: 'plan-pro',
        userId: 'user-1',
      });

      expect(result.amount).toBe(mockPlan.yearlyPrice); // 9999
    });

    it('should update order and agreement to closed/unsigned if channel creation fails', async () => {
      const { db, limitFn, updateSetFn } = createMockDb();
      const service = new PaymentService(db, { alipay: alipayConfig });

      limitFn.mockResolvedValueOnce([mockPlan]);

      mockCycleChannel.createSignPayment.mockResolvedValue({
        errorMessage: 'Alipay channel error',
        success: false,
      });

      await expect(
        service.createSignPaymentOrder({ billingInterval: 'month', planId: 'plan-pro', userId: 'user-1' }),
      ).rejects.toThrow('Alipay channel error');

      // Both order and agreement should be updated
      expect(updateSetFn).toHaveBeenCalledTimes(2);
      const orderUpdateCall = updateSetFn.mock.calls[0][0];
      const agreementUpdateCall = updateSetFn.mock.calls[1][0];
      expect(orderUpdateCall.status).toBe('closed');
      expect(agreementUpdateCall.status).toBe('unsigned');
    });
  });

  describe('deductPayment', () => {
    it('should throw if alipay cycle channel is not configured', async () => {
      const { db } = createMockDb();
      const service = new PaymentService(db, {}); // no alipay config

      await expect(
        service.deductPayment({ agreementNo: 'AGR123', amount: 999, planName: 'Pro', userId: 'user-1' }),
      ).rejects.toThrow('Alipay cycle payment is not configured');
    });

    it('should create payment order and call channel deduct payment', async () => {
      const { db, insertValuesFn } = createMockDb();
      const service = new PaymentService(db, { alipay: alipayConfig });

      mockCycleChannel.deductPayment.mockResolvedValue({
        channelOrderNo: 'CH_DEDUCT_123',
        status: 'success',
      });

      await service.deductPayment({ agreementNo: 'AGR123', amount: 999, planName: 'Pro', userId: 'user-1' });

      expect(insertValuesFn).toHaveBeenCalled();
      expect(mockCycleChannel.deductPayment).toHaveBeenCalledWith({
        agreementNo: 'AGR123',
        amount: 999,
        orderNo: MOCK_ORDER_NO,
        subject: 'Pro 自动续费',
      });
    });

    it('should update order to paid status on successful deduction', async () => {
      const { db, updateSetFn } = createMockDb();
      const service = new PaymentService(db, { alipay: alipayConfig });

      mockCycleChannel.deductPayment.mockResolvedValue({
        channelOrderNo: 'CH_DEDUCT_123',
        status: 'success',
      });

      const result = await service.deductPayment({
        agreementNo: 'AGR123',
        amount: 999,
        planName: 'Pro',
        userId: 'user-1',
      });

      const setCall = updateSetFn.mock.calls[0][0];
      expect(setCall.status).toBe('paid');
      expect(result.status).toBe('success');
      expect(result.orderNo).toBe(MOCK_ORDER_NO);
    });

    it('should update order to closed status on failed deduction', async () => {
      const { db, updateSetFn } = createMockDb();
      const service = new PaymentService(db, { alipay: alipayConfig });

      mockCycleChannel.deductPayment.mockResolvedValue({
        errorCode: 'BALANCE_INSUFFICIENT',
        errorMessage: 'Insufficient balance',
        status: 'failed',
      });

      const result = await service.deductPayment({
        agreementNo: 'AGR123',
        amount: 999,
        planName: 'Pro',
        userId: 'user-1',
      });

      const setCall = updateSetFn.mock.calls[0][0];
      expect(setCall.status).toBe('closed');
      expect(result.status).toBe('failed');
      expect(result.errorCode).toBe('BALANCE_INSUFFICIENT');
      expect(result.errorMessage).toBe('Insufficient balance');
    });

    it('should return orderNo and pending status for pending deduction', async () => {
      const { db } = createMockDb();
      const service = new PaymentService(db, { alipay: alipayConfig });

      mockCycleChannel.deductPayment.mockResolvedValue({ status: 'pending' });

      const result = await service.deductPayment({
        agreementNo: 'AGR123',
        amount: 999,
        planName: 'Pro',
        userId: 'user-1',
      });

      expect(result.status).toBe('pending');
      expect(result.orderNo).toBe(MOCK_ORDER_NO);
    });
  });

  describe('unsignAgreement', () => {
    it('should throw if alipay cycle channel is not configured', async () => {
      const { db } = createMockDb();
      const service = new PaymentService(db, {}); // no alipay config

      await expect(service.unsignAgreement('agr-1', 'user-1')).rejects.toThrow(
        'Alipay cycle payment is not configured',
      );
    });

    it('should throw if agreement is not found', async () => {
      const { db, limitFn } = createMockDb();
      const service = new PaymentService(db, { alipay: alipayConfig });

      limitFn.mockResolvedValueOnce([]);

      await expect(service.unsignAgreement('agr-not-found', 'user-1')).rejects.toThrow(
        'Agreement not found',
      );
    });

    it('should throw if agreement has not been signed yet (no agreementNo)', async () => {
      const { db, limitFn } = createMockDb();
      const service = new PaymentService(db, { alipay: alipayConfig });

      limitFn.mockResolvedValueOnce([{ agreementNo: null, id: 'agr-1', status: 'pending' }]);

      await expect(service.unsignAgreement('agr-1', 'user-1')).rejects.toThrow(
        'Agreement not signed yet',
      );
    });

    it('should throw if agreement is not in active signed status', async () => {
      const { db, limitFn } = createMockDb();
      const service = new PaymentService(db, { alipay: alipayConfig });

      limitFn.mockResolvedValueOnce([
        { agreementNo: 'ALIPAY_AGR_123', id: 'agr-1', status: 'unsigned' },
      ]);

      await expect(service.unsignAgreement('agr-1', 'user-1')).rejects.toThrow(
        'Agreement is not active',
      );
    });

    it('should unsign agreement via channel and update DB to unsigned status', async () => {
      const { db, limitFn, updateSetFn } = createMockDb();
      const service = new PaymentService(db, { alipay: alipayConfig });

      limitFn.mockResolvedValueOnce([
        { agreementNo: 'ALIPAY_AGR_123', id: 'agr-1', status: 'signed' },
      ]);
      mockCycleChannel.unsignAgreement.mockResolvedValue({ success: true });

      const result = await service.unsignAgreement('agr-1', 'user-1');

      expect(mockCycleChannel.unsignAgreement).toHaveBeenCalledWith('ALIPAY_AGR_123');
      const setCall = updateSetFn.mock.calls[0][0];
      expect(setCall.status).toBe('unsigned');
      expect(setCall.unsignReason).toBe('merchant_unsign');
      expect(result).toEqual({ success: true });
    });

    it('should not update DB if channel unsign call fails', async () => {
      const { db, limitFn, updateSetFn } = createMockDb();
      const service = new PaymentService(db, { alipay: alipayConfig });

      limitFn.mockResolvedValueOnce([
        { agreementNo: 'ALIPAY_AGR_123', id: 'agr-1', status: 'signed' },
      ]);
      mockCycleChannel.unsignAgreement.mockResolvedValue({ success: false });

      const result = await service.unsignAgreement('agr-1', 'user-1');

      expect(updateSetFn).not.toHaveBeenCalled();
      expect(result).toEqual({ success: false });
    });
  });
});

// @vitest-environment node
import { paymentOrders, subscriptionPlans, userAgreements } from '@lobechat/database';
import type { LobeChatDatabase } from '@lobechat/database';
import { eq, and } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PaymentService } from './index';
import type { PaymentConfig, ChannelPaymentResult, PaymentChannel } from './types';
import { generateOrderNo } from './utils/order-no';

// Mock dependencies
vi.mock('./utils/order-no', () => ({
  generateOrderNo: vi.fn(),
}));

vi.mock('./channels/wechat-native', () => ({
  WeChatNativeChannel: vi.fn().mockImplementation(() => ({
    createPayment: vi.fn(),
    closeOrder: vi.fn(),
    parseNotification: vi.fn(),
    queryOrder: vi.fn(),
  })),
}));

vi.mock('./channels/alipay-precreate', () => ({
  AlipayPrecreateChannel: vi.fn().mockImplementation(() => ({
    createPayment: vi.fn(),
    closeOrder: vi.fn(),
    parseNotification: vi.fn(),
    queryOrder: vi.fn(),
  })),
}));

vi.mock('./channels/alipay-cycle', () => ({
  AlipayCycleChannel: vi.fn().mockImplementation(() => ({
    createSignPayment: vi.fn(),
    deductPayment: vi.fn(),
    unsignAgreement: vi.fn(),
  })),
}));

describe('PaymentService', () => {
  let service: PaymentService;
  let mockDb: LobeChatDatabase;
  let mockChannel: PaymentChannel;

  const mockConfig: PaymentConfig = {
    wechat: {
      apiKey: 'test-key',
      appId: 'test-app-id',
      mchId: 'test-mch-id',
      notifyUrl: 'https://test.com/notify',
    },
    alipay: {
      appId: 'test-alipay-app',
      privateKey: 'test-private-key',
      alipayPublicKey: 'test-public-key',
      notifyUrl: 'https://test.com/alipay-notify',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock database operations
    const mockDbChain = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    };

    mockDb = mockDbChain as unknown as LobeChatDatabase;

    mockChannel = {
      createPayment: vi.fn(),
      closeOrder: vi.fn(),
      parseNotification: vi.fn(),
      queryOrder: vi.fn(),
    };

    service = new PaymentService(mockDb, mockConfig);
  });

  describe('constructor', () => {
    it('should initialize payment channels based on config', () => {
      expect(service.getChannel('wechat_native')).toBeDefined();
      expect(service.getChannel('alipay_precreate')).toBeDefined();
      expect(service.getCycleChannel()).toBeDefined();
    });

    it('should not initialize channels if config is missing', () => {
      const serviceWithoutChannels = new PaymentService(mockDb, {});
      expect(serviceWithoutChannels.getChannel('wechat_native')).toBeUndefined();
      expect(serviceWithoutChannels.getChannel('alipay_precreate')).toBeUndefined();
      expect(serviceWithoutChannels.getCycleChannel()).toBeNull();
    });
  });

  describe('createOrder', () => {
    const mockPlan = {
      id: 'plan-123',
      name: 'Premium Plan',
      slug: 'premium',
      monthlyPrice: 1000,
      yearlyPrice: 10000,
      currency: 'CNY',
    };

    beforeEach(() => {
      vi.mocked(generateOrderNo).mockReturnValue('ORDER12345678');

      // Mock plan query
      (mockDb as any).limit = vi.fn().mockResolvedValue([mockPlan]);
    });

    it('should throw error if durationMonths is missing for one-time payment', async () => {
      await expect(
        service.createOrder({
          userId: 'user-123',
          planId: 'plan-123',
          planInterval: 'month',
          payChannel: 'wechat_native',
          subscriptionType: 'onetime',
        }),
      ).rejects.toThrow('durationMonths is required for one-time payment');
    });

    it('should throw error if durationMonths is invalid for one-time payment', async () => {
      await expect(
        service.createOrder({
          userId: 'user-123',
          planId: 'plan-123',
          planInterval: 'month',
          payChannel: 'wechat_native',
          subscriptionType: 'onetime',
          durationMonths: 5,
        }),
      ).rejects.toThrow('durationMonths must be 1, 3, 6, or 12');
    });

    it('should throw error if durationMonths is provided for recurring subscription', async () => {
      await expect(
        service.createOrder({
          userId: 'user-123',
          planId: 'plan-123',
          planInterval: 'month',
          payChannel: 'wechat_native',
          subscriptionType: 'recurring',
          durationMonths: 6,
        }),
      ).rejects.toThrow('durationMonths should not be provided for recurring subscriptions');
    });

    it('should throw error if payment channel is not supported', async () => {
      await expect(
        service.createOrder({
          userId: 'user-123',
          planId: 'plan-123',
          planInterval: 'month',
          payChannel: 'unsupported_channel' as any,
          subscriptionType: 'recurring',
        }),
      ).rejects.toThrow('Payment channel unsupported_channel not supported');
    });

    it('should throw error if plan is not found', async () => {
      // @ts-expect-error - mock
      mockDb.limit = vi.fn().mockResolvedValue([]);

      await expect(
        service.createOrder({
          userId: 'user-123',
          planId: 'non-existent',
          planInterval: 'month',
          payChannel: 'wechat_native',
          subscriptionType: 'recurring',
        }),
      ).rejects.toThrow('Plan not found');
    });

    it('should calculate amount correctly for one-time monthly payment', async () => {
      const channel = service.getChannel('wechat_native')!;
      vi.mocked(channel.createPayment).mockResolvedValue({
        success: true,
        channelOrderNo: 'WX123',
        channelData: { code_url: 'weixin://pay' },
      });

      await service.createOrder({
        userId: 'user-123',
        planId: 'plan-123',
        planInterval: 'month',
        payChannel: 'wechat_native',
        subscriptionType: 'onetime',
        durationMonths: 3,
      });

      const insertCall = vi.mocked(mockDb.insert).mock.calls[0];
      // @ts-expect-error - mock
      const valuesCall = vi.mocked(mockDb.values).mock.calls[0][0];
      expect(valuesCall.amount).toBe(3000); // 1000 * 3
    });

    it('should calculate amount correctly for one-time 12-month payment using yearly price', async () => {
      const channel = service.getChannel('wechat_native')!;
      vi.mocked(channel.createPayment).mockResolvedValue({
        success: true,
        channelOrderNo: 'WX123',
        channelData: { code_url: 'weixin://pay' },
      });

      await service.createOrder({
        userId: 'user-123',
        planId: 'plan-123',
        planInterval: 'month',
        payChannel: 'wechat_native',
        subscriptionType: 'onetime',
        durationMonths: 12,
      });

      // @ts-expect-error - mock
      const valuesCall = vi.mocked(mockDb.values).mock.calls[0][0];
      expect(valuesCall.amount).toBe(10000); // yearly price
    });

    it('should calculate amount correctly for recurring monthly subscription', async () => {
      const channel = service.getChannel('wechat_native')!;
      vi.mocked(channel.createPayment).mockResolvedValue({
        success: true,
        channelOrderNo: 'WX123',
        channelData: { code_url: 'weixin://pay' },
      });

      await service.createOrder({
        userId: 'user-123',
        planId: 'plan-123',
        planInterval: 'month',
        payChannel: 'wechat_native',
        subscriptionType: 'recurring',
      });

      // @ts-expect-error - mock
      const valuesCall = vi.mocked(mockDb.values).mock.calls[0][0];
      expect(valuesCall.amount).toBe(1000); // monthly price
    });

    it('should calculate amount correctly for recurring yearly subscription', async () => {
      const channel = service.getChannel('wechat_native')!;
      vi.mocked(channel.createPayment).mockResolvedValue({
        success: true,
        channelOrderNo: 'WX123',
        channelData: { code_url: 'weixin://pay' },
      });

      await service.createOrder({
        userId: 'user-123',
        planId: 'plan-123',
        planInterval: 'year',
        payChannel: 'wechat_native',
        subscriptionType: 'recurring',
      });

      // @ts-expect-error - mock
      const valuesCall = vi.mocked(mockDb.values).mock.calls[0][0];
      expect(valuesCall.amount).toBe(10000); // yearly price
    });

    it('should throw error if calculated amount is invalid', async () => {
      // @ts-expect-error - mock
      mockDb.limit = vi.fn().mockResolvedValue([{ ...mockPlan, monthlyPrice: 0 }]);

      await expect(
        service.createOrder({
          userId: 'user-123',
          planId: 'plan-123',
          planInterval: 'month',
          payChannel: 'wechat_native',
          subscriptionType: 'recurring',
        }),
      ).rejects.toThrow('Invalid amount calculated for plan plan-123');
    });

    it('should reuse existing unexpired pending order', async () => {
      const existingOrder = {
        orderNo: 'EXISTING123',
        amount: 1000,
        expiredAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        channelData: { code_url: 'weixin://existing' },
      };

      // Mock limit to return plan first time, existing order second time
      let callCount = 0;
      // @ts-expect-error - mock
      mockDb.limit = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.resolve([mockPlan]);
        if (callCount === 2) return Promise.resolve([existingOrder]);
        return Promise.resolve([]);
      });

      const result = await service.createOrder({
        userId: 'user-123',
        planId: 'plan-123',
        planInterval: 'month',
        payChannel: 'wechat_native',
        subscriptionType: 'recurring',
      });

      expect(result.orderNo).toBe('EXISTING123');
      expect(result.codeUrl).toBe('weixin://existing');
      expect(vi.mocked(mockDb.insert)).not.toHaveBeenCalled();
    });

    it('should create new order if existing order is expired', async () => {
      const existingOrder = {
        orderNo: 'EXISTING123',
        amount: 1000,
        expiredAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        channelData: { code_url: 'weixin://existing' },
      };

      let callCount = 0;
      // @ts-expect-error - mock
      mockDb.limit = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.resolve([mockPlan]);
        if (callCount === 2) return Promise.resolve([existingOrder]);
        return Promise.resolve([]);
      });

      const channel = service.getChannel('wechat_native')!;
      vi.mocked(channel.createPayment).mockResolvedValue({
        success: true,
        channelOrderNo: 'WX123',
        channelData: { code_url: 'weixin://new' },
      });

      const result = await service.createOrder({
        userId: 'user-123',
        planId: 'plan-123',
        planInterval: 'month',
        payChannel: 'wechat_native',
        subscriptionType: 'recurring',
      });

      expect(result.orderNo).toBe('ORDER12345678');
      expect(vi.mocked(mockDb.insert)).toHaveBeenCalled();
    });

    it('should create order with 2-hour expiration', async () => {
      const channel = service.getChannel('wechat_native')!;
      vi.mocked(channel.createPayment).mockResolvedValue({
        success: true,
        channelOrderNo: 'WX123',
        channelData: { code_url: 'weixin://pay' },
      });

      const before = Date.now();
      await service.createOrder({
        userId: 'user-123',
        planId: 'plan-123',
        planInterval: 'month',
        payChannel: 'wechat_native',
        subscriptionType: 'recurring',
      });
      const after = Date.now();

      // @ts-expect-error - mock
      const valuesCall = vi.mocked(mockDb.values).mock.calls[0][0];
      const expiredAt = valuesCall.expiredAt as Date;
      const expirationTime = expiredAt.getTime();

      expect(expirationTime).toBeGreaterThanOrEqual(before + 2 * 60 * 60 * 1000);
      expect(expirationTime).toBeLessThanOrEqual(after + 2 * 60 * 60 * 1000);
    });

    it('should update order to closed if channel creation fails', async () => {
      const channel = service.getChannel('wechat_native')!;
      vi.mocked(channel.createPayment).mockResolvedValue({
        success: false,
        errorMessage: 'Channel error',
      });

      await expect(
        service.createOrder({
          userId: 'user-123',
          planId: 'plan-123',
          planInterval: 'month',
          payChannel: 'wechat_native',
          subscriptionType: 'recurring',
        }),
      ).rejects.toThrow('Channel error');

      expect(vi.mocked(mockDb.update)).toHaveBeenCalled();
      // @ts-expect-error - mock
      const setCall = vi.mocked(mockDb.set).mock.calls[0][0];
      expect(setCall.status).toBe('closed');
      expect(setCall.closedAt).toBeInstanceOf(Date);
    });

    it('should update order with channel data after successful creation', async () => {
      const channel = service.getChannel('wechat_native')!;
      vi.mocked(channel.createPayment).mockResolvedValue({
        success: true,
        channelOrderNo: 'WX123',
        channelData: { code_url: 'weixin://pay', extra: 'data' },
      });

      await service.createOrder({
        userId: 'user-123',
        planId: 'plan-123',
        planInterval: 'month',
        payChannel: 'wechat_native',
        subscriptionType: 'recurring',
      });

      // Second update call should have channel data
      const updateCalls = vi.mocked(mockDb.update).mock.calls;
      // @ts-expect-error - mock
      const lastSetCall = vi.mocked(mockDb.set).mock.calls[updateCalls.length - 1][0];
      expect(lastSetCall.channelData).toEqual({ code_url: 'weixin://pay', extra: 'data' });
      expect(lastSetCall.channelOrderNo).toBe('WX123');
    });

    it('should return order details with code URL', async () => {
      const channel = service.getChannel('wechat_native')!;
      vi.mocked(channel.createPayment).mockResolvedValue({
        success: true,
        channelOrderNo: 'WX123',
        channelData: { code_url: 'weixin://pay' },
      });

      const result = await service.createOrder({
        userId: 'user-123',
        planId: 'plan-123',
        planInterval: 'month',
        payChannel: 'wechat_native',
        subscriptionType: 'recurring',
      });

      expect(result.orderNo).toBe('ORDER12345678');
      expect(result.amount).toBe(1000);
      expect(result.codeUrl).toBe('weixin://pay');
      expect(result.expiredAt).toBeInstanceOf(Date);
    });
  });

  describe('queryOrder', () => {
    it('should return order status for existing order', async () => {
      const mockOrder = {
        orderNo: 'ORDER123',
        amount: 1000,
        status: 'paid',
        paidAt: new Date(),
      };

      // @ts-expect-error - mock
      mockDb.limit = vi.fn().mockResolvedValue([mockOrder]);

      const result = await service.queryOrder('ORDER123');

      expect(result.orderNo).toBe('ORDER123');
      expect(result.amount).toBe(1000);
      expect(result.status).toBe('paid');
      expect(result.paidAt).toEqual(mockOrder.paidAt);
    });

    it('should throw error if order is not found', async () => {
      // @ts-expect-error - mock
      mockDb.limit = vi.fn().mockResolvedValue([]);

      await expect(service.queryOrder('NON-EXISTENT')).rejects.toThrow('Order not found');
    });

    it('should return undefined paidAt for unpaid order', async () => {
      const mockOrder = {
        orderNo: 'ORDER123',
        amount: 1000,
        status: 'pending',
        paidAt: null,
      };

      // @ts-expect-error - mock
      mockDb.limit = vi.fn().mockResolvedValue([mockOrder]);

      const result = await service.queryOrder('ORDER123');

      expect(result.paidAt).toBeUndefined();
    });
  });

  describe('closeOrder', () => {
    it('should close order for authorized user', async () => {
      const mockOrder = {
        orderNo: 'ORDER123',
        userId: 'user-123',
        status: 'pending',
        payChannel: 'wechat_native',
      };

      // @ts-expect-error - mock
      mockDb.limit = vi.fn().mockResolvedValue([mockOrder]);

      const channel = service.getChannel('wechat_native')!;

      await service.closeOrder('ORDER123', 'user-123');

      expect(vi.mocked(channel.closeOrder)).toHaveBeenCalledWith('ORDER123');
      expect(vi.mocked(mockDb.update)).toHaveBeenCalled();
      // @ts-expect-error - mock
      const setCall = vi.mocked(mockDb.set).mock.calls[0][0];
      expect(setCall.status).toBe('closed');
      expect(setCall.closedAt).toBeInstanceOf(Date);
    });

    it('should throw error if order is not found', async () => {
      // @ts-expect-error - mock
      mockDb.limit = vi.fn().mockResolvedValue([]);

      await expect(service.closeOrder('NON-EXISTENT', 'user-123')).rejects.toThrow(
        'Order not found',
      );
    });

    it('should throw error if user is not authorized', async () => {
      const mockOrder = {
        orderNo: 'ORDER123',
        userId: 'user-123',
        status: 'pending',
        payChannel: 'wechat_native',
      };

      // @ts-expect-error - mock
      mockDb.limit = vi.fn().mockResolvedValue([mockOrder]);

      await expect(service.closeOrder('ORDER123', 'wrong-user')).rejects.toThrow('Unauthorized');
    });

    it('should not close order if already paid', async () => {
      const mockOrder = {
        orderNo: 'ORDER123',
        userId: 'user-123',
        status: 'paid',
        payChannel: 'wechat_native',
      };

      // @ts-expect-error - mock
      mockDb.limit = vi.fn().mockResolvedValue([mockOrder]);

      const channel = service.getChannel('wechat_native')!;

      await service.closeOrder('ORDER123', 'user-123');

      expect(vi.mocked(channel.closeOrder)).not.toHaveBeenCalled();
      expect(vi.mocked(mockDb.update)).not.toHaveBeenCalled();
    });

    it('should not close order if already closed', async () => {
      const mockOrder = {
        orderNo: 'ORDER123',
        userId: 'user-123',
        status: 'closed',
        payChannel: 'wechat_native',
      };

      // @ts-expect-error - mock
      mockDb.limit = vi.fn().mockResolvedValue([mockOrder]);

      const channel = service.getChannel('wechat_native')!;

      await service.closeOrder('ORDER123', 'user-123');

      expect(vi.mocked(channel.closeOrder)).not.toHaveBeenCalled();
      expect(vi.mocked(mockDb.update)).not.toHaveBeenCalled();
    });
  });

  describe('getChannel', () => {
    it('should return channel if it exists', () => {
      const channel = service.getChannel('wechat_native');
      expect(channel).toBeDefined();
    });

    it('should return undefined for non-existent channel', () => {
      const channel = service.getChannel('non_existent');
      expect(channel).toBeUndefined();
    });
  });

  describe('getCycleChannel', () => {
    it('should return cycle channel if alipay is configured', () => {
      const cycleChannel = service.getCycleChannel();
      expect(cycleChannel).toBeDefined();
    });

    it('should return null if alipay is not configured', () => {
      const serviceWithoutAlipay = new PaymentService(mockDb, {
        wechat: mockConfig.wechat,
      });
      const cycleChannel = serviceWithoutAlipay.getCycleChannel();
      expect(cycleChannel).toBeNull();
    });
  });

  describe('createSignPaymentOrder', () => {
    const mockPlan = {
      id: 'plan-123',
      name: 'Premium Plan',
      slug: 'premium',
      monthlyPrice: 1000,
      yearlyPrice: 10000,
      currency: 'CNY',
    };

    beforeEach(() => {
      vi.mocked(generateOrderNo).mockReturnValue('ORDER12345678');
      // @ts-expect-error - mock
      mockDb.limit = vi.fn().mockResolvedValue([mockPlan]);
    });

    it('should throw error if cycle channel is not configured', async () => {
      const serviceWithoutAlipay = new PaymentService(mockDb, {
        wechat: mockConfig.wechat,
      });

      await expect(
        serviceWithoutAlipay.createSignPaymentOrder({
          userId: 'user-123',
          planId: 'plan-123',
          billingInterval: 'month',
        }),
      ).rejects.toThrow('Alipay cycle payment is not configured');
    });

    it('should throw error if plan is not found', async () => {
      // @ts-expect-error - mock
      mockDb.limit = vi.fn().mockResolvedValue([]);

      await expect(
        service.createSignPaymentOrder({
          userId: 'user-123',
          planId: 'non-existent',
          billingInterval: 'month',
        }),
      ).rejects.toThrow('Plan not found');
    });

    it('should throw error if amount is invalid', async () => {
      // @ts-expect-error - mock
      mockDb.limit = vi.fn().mockResolvedValue([{ ...mockPlan, monthlyPrice: 0 }]);

      await expect(
        service.createSignPaymentOrder({
          userId: 'user-123',
          planId: 'plan-123',
          billingInterval: 'month',
        }),
      ).rejects.toThrow('Invalid amount calculated for plan plan-123');
    });

    it('should create sign payment order for monthly billing', async () => {
      const cycleChannel = service.getCycleChannel()!;
      vi.mocked(cycleChannel.createSignPayment).mockResolvedValue({
        success: true,
        codeUrl: 'alipay://sign',
      });

      const result = await service.createSignPaymentOrder({
        userId: 'user-123',
        planId: 'plan-123',
        billingInterval: 'month',
      });

      expect(result.orderNo).toBe('ORDER12345678');
      expect(result.externalAgreementNo).toBe('AGRORDER12345678');
      expect(result.amount).toBe(1000);
      expect(result.codeUrl).toBe('alipay://sign');
      expect(result.agreementId).toBeDefined();
      expect(result.expiredAt).toBeInstanceOf(Date);
    });

    it('should create sign payment order for yearly billing', async () => {
      const cycleChannel = service.getCycleChannel()!;
      vi.mocked(cycleChannel.createSignPayment).mockResolvedValue({
        success: true,
        codeUrl: 'alipay://sign',
      });

      const result = await service.createSignPaymentOrder({
        userId: 'user-123',
        planId: 'plan-123',
        billingInterval: 'year',
      });

      expect(result.amount).toBe(10000);

      // Check that period is set to 12 for yearly
      // @ts-expect-error - mock
      const agreementCall = vi.mocked(mockDb.values).mock.calls[0][0];
      expect(agreementCall.period).toBe(12);
    });

    it('should update order and agreement status if channel creation fails', async () => {
      const cycleChannel = service.getCycleChannel()!;
      vi.mocked(cycleChannel.createSignPayment).mockResolvedValue({
        success: false,
        errorMessage: 'Alipay error',
      });

      await expect(
        service.createSignPaymentOrder({
          userId: 'user-123',
          planId: 'plan-123',
          billingInterval: 'month',
        }),
      ).rejects.toThrow('Alipay error');

      // Should have two updates: one for order, one for agreement
      expect(vi.mocked(mockDb.update).mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('processSignNotification', () => {
    const mockAgreement = {
      id: 'agreement-123',
      externalAgreementNo: 'AGR123',
      period: 1,
      periodType: 'MONTH' as const,
    };

    beforeEach(() => {
      // @ts-expect-error - mock
      mockDb.limit = vi.fn().mockResolvedValue([mockAgreement]);
    });

    it('should return false if agreement is not found', async () => {
      // @ts-expect-error - mock
      mockDb.limit = vi.fn().mockResolvedValue([]);

      const result = await service.processSignNotification({
        externalAgreementNo: 'NON-EXISTENT',
        agreementNo: 'ALIPAY123',
        status: 'NORMAL',
        signTime: new Date(),
        signScene: 'INDUSTRY|DIGITAL_MEDIA',
      });

      expect(result.success).toBe(false);
    });

    it('should update agreement to signed status on NORMAL status', async () => {
      const signTime = new Date();

      const result = await service.processSignNotification({
        externalAgreementNo: 'AGR123',
        agreementNo: 'ALIPAY123',
        status: 'NORMAL',
        signTime,
        signScene: 'INDUSTRY|DIGITAL_MEDIA',
        alipayUserId: 'alipay-user-123',
        alipayOpenId: 'alipay-open-123',
        alipayLogonId: 'test@alipay.com',
      });

      expect(result.success).toBe(true);
      expect(vi.mocked(mockDb.update)).toHaveBeenCalled();

      // @ts-expect-error - mock
      const setCall = vi.mocked(mockDb.set).mock.calls[0][0];
      expect(setCall.status).toBe('signed');
      expect(setCall.agreementNo).toBe('ALIPAY123');
      expect(setCall.signTime).toEqual(signTime);
      expect(setCall.alipayUserId).toBe('alipay-user-123');
      expect(setCall.nextDeductDate).toBeDefined();
    });

    it('should calculate next deduct date correctly for monthly period', async () => {
      const signTime = new Date('2024-01-15T10:00:00Z');

      await service.processSignNotification({
        externalAgreementNo: 'AGR123',
        agreementNo: 'ALIPAY123',
        status: 'NORMAL',
        signTime,
        signScene: 'INDUSTRY|DIGITAL_MEDIA',
      });

      // @ts-expect-error - mock
      const setCall = vi.mocked(mockDb.set).mock.calls[0][0];
      expect(setCall.nextDeductDate).toBe('2024-02-15');
    });

    it('should handle month overflow correctly for monthly period', async () => {
      const signTime = new Date('2024-01-31T10:00:00Z');
      // @ts-expect-error - mock
      mockDb.limit = vi.fn().mockResolvedValue([{ ...mockAgreement, period: 1 }]);

      await service.processSignNotification({
        externalAgreementNo: 'AGR123',
        agreementNo: 'ALIPAY123',
        status: 'NORMAL',
        signTime,
        signScene: 'INDUSTRY|DIGITAL_MEDIA',
      });

      // @ts-expect-error - mock
      const setCall = vi.mocked(mockDb.set).mock.calls[0][0];
      // When adding 1 month to Jan 31, JS automatically gives us Mar 2 (Feb overflow)
      // Since 2 is not > 28, it stays as Mar 2
      expect(setCall.nextDeductDate).toBe('2024-03-02');
    });

    it('should cap next deduct date at 28th for dates 29-31', async () => {
      const signTime = new Date('2024-03-29T10:00:00Z');
      // @ts-expect-error - mock
      mockDb.limit = vi.fn().mockResolvedValue([{ ...mockAgreement, period: 1 }]);

      await service.processSignNotification({
        externalAgreementNo: 'AGR123',
        agreementNo: 'ALIPAY123',
        status: 'NORMAL',
        signTime,
        signScene: 'INDUSTRY|DIGITAL_MEDIA',
      });

      // @ts-expect-error - mock
      const setCall = vi.mocked(mockDb.set).mock.calls[0][0];
      // April 29 -> 29 > 28, so capped to April 28
      expect(setCall.nextDeductDate).toBe('2024-04-28');
    });

    it('should calculate next deduct date correctly for daily period', async () => {
      const signTime = new Date('2024-01-15T10:00:00Z');
      // @ts-expect-error - mock
      mockDb.limit = vi.fn().mockResolvedValue([
        { ...mockAgreement, periodType: 'DAY', period: 7 },
      ]);

      await service.processSignNotification({
        externalAgreementNo: 'AGR123',
        agreementNo: 'ALIPAY123',
        status: 'NORMAL',
        signTime,
        signScene: 'INDUSTRY|DIGITAL_MEDIA',
      });

      // @ts-expect-error - mock
      const setCall = vi.mocked(mockDb.set).mock.calls[0][0];
      expect(setCall.nextDeductDate).toBe('2024-01-22');
    });

    it('should update agreement to unsigned status on UNSIGN status', async () => {
      const result = await service.processSignNotification({
        externalAgreementNo: 'AGR123',
        agreementNo: 'ALIPAY123',
        status: 'UNSIGN',
        signTime: new Date(),
        signScene: 'INDUSTRY|DIGITAL_MEDIA',
      });

      expect(result.success).toBe(true);
      expect(vi.mocked(mockDb.update)).toHaveBeenCalled();

      // @ts-expect-error - mock
      const setCall = vi.mocked(mockDb.set).mock.calls[0][0];
      expect(setCall.status).toBe('unsigned');
      expect(setCall.unsignReason).toBe('user_unsign');
      expect(setCall.unsignTime).toBeInstanceOf(Date);
    });
  });

  describe('deductPayment', () => {
    beforeEach(() => {
      vi.mocked(generateOrderNo).mockReturnValue('DEDUCT123');
    });

    it('should throw error if cycle channel is not configured', async () => {
      const serviceWithoutAlipay = new PaymentService(mockDb, {
        wechat: mockConfig.wechat,
      });

      await expect(
        serviceWithoutAlipay.deductPayment({
          userId: 'user-123',
          agreementNo: 'ALIPAY123',
          amount: 1000,
          planName: 'Premium Plan',
        }),
      ).rejects.toThrow('Alipay cycle payment is not configured');
    });

    it('should deduct payment successfully', async () => {
      const cycleChannel = service.getCycleChannel()!;
      vi.mocked(cycleChannel.deductPayment).mockResolvedValue({
        status: 'success',
        orderNo: 'DEDUCT123',
        channelOrderNo: 'ALIPAY-DEDUCT-123',
      });

      const result = await service.deductPayment({
        userId: 'user-123',
        agreementNo: 'ALIPAY123',
        amount: 1000,
        planName: 'Premium Plan',
      });

      expect(result.status).toBe('success');
      expect(result.orderNo).toBe('DEDUCT123');

      // Check order was created
      expect(vi.mocked(mockDb.insert)).toHaveBeenCalled();

      // Check order was updated to paid
      expect(vi.mocked(mockDb.update)).toHaveBeenCalled();
      // @ts-expect-error - mock
      const setCall = vi.mocked(mockDb.set).mock.calls[0][0];
      expect(setCall.status).toBe('paid');
      expect(setCall.paidAt).toBeInstanceOf(Date);
    });

    it('should update order to closed if deduction fails', async () => {
      const cycleChannel = service.getCycleChannel()!;
      vi.mocked(cycleChannel.deductPayment).mockResolvedValue({
        status: 'failed',
        orderNo: 'DEDUCT123',
        errorCode: 'INSUFFICIENT_BALANCE',
        errorMessage: 'Insufficient balance',
      });

      const result = await service.deductPayment({
        userId: 'user-123',
        agreementNo: 'ALIPAY123',
        amount: 1000,
        planName: 'Premium Plan',
      });

      expect(result.status).toBe('failed');
      expect(result.errorCode).toBe('INSUFFICIENT_BALANCE');
      expect(result.errorMessage).toBe('Insufficient balance');

      // @ts-expect-error - mock
      const setCall = vi.mocked(mockDb.set).mock.calls[0][0];
      expect(setCall.status).toBe('closed');
      expect(setCall.closedAt).toBeInstanceOf(Date);
    });

    it('should handle pending deduction status', async () => {
      const cycleChannel = service.getCycleChannel()!;
      vi.mocked(cycleChannel.deductPayment).mockResolvedValue({
        status: 'pending',
        orderNo: 'DEDUCT123',
      });

      const result = await service.deductPayment({
        userId: 'user-123',
        agreementNo: 'ALIPAY123',
        amount: 1000,
        planName: 'Premium Plan',
      });

      expect(result.status).toBe('pending');
      // Should not update order status for pending
      expect(vi.mocked(mockDb.update)).not.toHaveBeenCalled();
    });
  });

  describe('unsignAgreement', () => {
    const mockAgreement = {
      id: 'agreement-123',
      userId: 'user-123',
      agreementNo: 'ALIPAY123',
      status: 'signed',
    };

    beforeEach(() => {
      // @ts-expect-error - mock
      mockDb.limit = vi.fn().mockResolvedValue([mockAgreement]);
    });

    it('should throw error if cycle channel is not configured', async () => {
      const serviceWithoutAlipay = new PaymentService(mockDb, {
        wechat: mockConfig.wechat,
      });

      await expect(
        serviceWithoutAlipay.unsignAgreement('agreement-123', 'user-123'),
      ).rejects.toThrow('Alipay cycle payment is not configured');
    });

    it('should throw error if agreement is not found', async () => {
      // @ts-expect-error - mock
      mockDb.limit = vi.fn().mockResolvedValue([]);

      await expect(service.unsignAgreement('NON-EXISTENT', 'user-123')).rejects.toThrow(
        'Agreement not found',
      );
    });

    it('should throw error if agreement is not signed yet', async () => {
      // @ts-expect-error - mock
      mockDb.limit = vi.fn().mockResolvedValue([
        { ...mockAgreement, agreementNo: null },
      ]);

      await expect(service.unsignAgreement('agreement-123', 'user-123')).rejects.toThrow(
        'Agreement not signed yet',
      );
    });

    it('should throw error if agreement is not active', async () => {
      // @ts-expect-error - mock
      mockDb.limit = vi.fn().mockResolvedValue([
        { ...mockAgreement, status: 'unsigned' },
      ]);

      await expect(service.unsignAgreement('agreement-123', 'user-123')).rejects.toThrow(
        'Agreement is not active',
      );
    });

    it('should unsign agreement successfully', async () => {
      const cycleChannel = service.getCycleChannel()!;
      vi.mocked(cycleChannel.unsignAgreement).mockResolvedValue({
        success: true,
      });

      const result = await service.unsignAgreement('agreement-123', 'user-123');

      expect(result.success).toBe(true);
      expect(vi.mocked(cycleChannel.unsignAgreement)).toHaveBeenCalledWith('ALIPAY123');

      expect(vi.mocked(mockDb.update)).toHaveBeenCalled();
      // @ts-expect-error - mock
      const setCall = vi.mocked(mockDb.set).mock.calls[0][0];
      expect(setCall.status).toBe('unsigned');
      expect(setCall.unsignReason).toBe('merchant_unsign');
      expect(setCall.unsignTime).toBeInstanceOf(Date);
    });

    it('should not update agreement if unsign fails', async () => {
      const cycleChannel = service.getCycleChannel()!;
      vi.mocked(cycleChannel.unsignAgreement).mockResolvedValue({
        success: false,
      });

      const result = await service.unsignAgreement('agreement-123', 'user-123');

      expect(result.success).toBe(false);
      expect(vi.mocked(mockDb.update)).not.toHaveBeenCalled();
    });
  });
});

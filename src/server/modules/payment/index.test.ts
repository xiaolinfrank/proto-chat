// @vitest-environment node
import { paymentOrders, subscriptionPlans, userAgreements } from '@lobechat/database';
import type { LobeChatDatabase } from '@lobechat/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PaymentConfig } from './types';
import { PaymentService } from './index';

// Mock channel implementations
vi.mock('./channels/wechat-native', () => ({
  WeChatNativeChannel: vi.fn().mockImplementation(() => ({
    closeOrder: vi.fn().mockResolvedValue(undefined),
    createPayment: vi.fn().mockResolvedValue({
      channelData: { code_url: 'weixin://pay/qrcode/test' },
      channelOrderNo: 'WX123456',
      success: true,
    }),
    parseNotification: vi.fn(),
    queryOrder: vi.fn(),
  })),
}));

vi.mock('./channels/alipay-precreate', () => ({
  AlipayPrecreateChannel: vi.fn().mockImplementation(() => ({
    closeOrder: vi.fn().mockResolvedValue(undefined),
    createPayment: vi.fn().mockResolvedValue({
      channelData: { code_url: 'https://qr.alipay.com/test' },
      channelOrderNo: 'ALI123456',
      success: true,
    }),
    parseNotification: vi.fn(),
    queryOrder: vi.fn(),
  })),
}));

vi.mock('./channels/alipay-cycle', () => ({
  AlipayCycleChannel: vi.fn().mockImplementation(() => ({
    createSignPayment: vi.fn().mockResolvedValue({
      codeUrl: 'https://qr.alipay.com/sign-test',
      success: true,
    }),
    deductPayment: vi.fn().mockResolvedValue({
      channelOrderNo: 'DEDUCT123',
      status: 'success',
    }),
    unsignAgreement: vi.fn().mockResolvedValue({ success: true }),
  })),
}));

vi.mock('./utils/order-no', () => ({
  generateOrderNo: vi.fn(() => 'PC20240115123000123456'),
}));

describe('PaymentService', () => {
  let mockDB: LobeChatDatabase;
  let service: PaymentService;
  let mockSelect: ReturnType<typeof vi.fn>;
  let mockInsert: ReturnType<typeof vi.fn>;
  let mockUpdate: ReturnType<typeof vi.fn>;
  let mockWhere: ReturnType<typeof vi.fn>;
  let mockLimit: ReturnType<typeof vi.fn>;
  let mockFrom: ReturnType<typeof vi.fn>;
  let mockSet: ReturnType<typeof vi.fn>;
  let mockValues: ReturnType<typeof vi.fn>;

  const mockConfig: PaymentConfig = {
    alipay: {
      alipayPublicKey: 'test-alipay-public-key',
      appId: 'test-alipay-app-id',
      notifyUrl: 'https://example.com/notify/alipay',
      privateKey: 'test-alipay-private-key',
    },
    wechat: {
      apiKey: 'test-wechat-api-key',
      appId: 'test-wechat-app-id',
      mchId: 'test-wechat-mch-id',
      notifyUrl: 'https://example.com/notify/wechat',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock database query chain
    mockLimit = vi.fn().mockResolvedValue([]);
    mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    mockFrom = vi.fn().mockReturnValue({ where: mockWhere, limit: mockLimit });
    mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

    mockSet = vi.fn().mockReturnValue({ where: mockWhere });
    mockUpdate = vi.fn().mockReturnValue({ set: mockSet });

    mockValues = vi.fn().mockResolvedValue(undefined);
    mockInsert = vi.fn().mockReturnValue({ values: mockValues });

    mockDB = {
      delete: vi.fn(),
      insert: mockInsert,
      select: mockSelect,
      update: mockUpdate,
    } as unknown as LobeChatDatabase;

    service = new PaymentService(mockDB, mockConfig);
  });

  describe('constructor', () => {
    it('should initialize payment channels when config is provided', () => {
      expect(service).toBeDefined();
      expect(service.getChannel('wechat_native')).toBeDefined();
      expect(service.getChannel('alipay_precreate')).toBeDefined();
      expect(service.getCycleChannel()).toBeDefined();
    });

    it('should not initialize channels when config is missing', () => {
      const emptyService = new PaymentService(mockDB, {});

      expect(emptyService.getChannel('wechat_native')).toBeUndefined();
      expect(emptyService.getChannel('alipay_precreate')).toBeUndefined();
      expect(emptyService.getCycleChannel()).toBeNull();
    });
  });

  describe('createOrder', () => {
    const mockPlan = {
      id: 'plan-1',
      monthlyPrice: 1000,
      name: 'Premium Plan',
      slug: 'premium',
      yearlyPrice: 10_000,
    };

    beforeEach(() => {
      // Mock plan query to return a plan
      mockLimit.mockResolvedValue([mockPlan]);
    });

    describe('input validation', () => {
      it('should throw error when durationMonths is missing for onetime subscription', async () => {
        await expect(
          service.createOrder({
            payChannel: 'wechat_native',
            planId: 'plan-1',
            planInterval: 'month',
            subscriptionType: 'onetime',
            userId: 'user-1',
          }),
        ).rejects.toThrow('durationMonths is required for one-time payment');
      });

      it('should throw error when durationMonths is invalid for onetime subscription', async () => {
        await expect(
          service.createOrder({
            durationMonths: 5,
            payChannel: 'wechat_native',
            planId: 'plan-1',
            planInterval: 'month',
            subscriptionType: 'onetime',
            userId: 'user-1',
          }),
        ).rejects.toThrow('durationMonths must be 1, 3, 6, or 12');
      });

      it('should throw error when durationMonths is provided for recurring subscription', async () => {
        await expect(
          service.createOrder({
            durationMonths: 1,
            payChannel: 'wechat_native',
            planId: 'plan-1',
            planInterval: 'month',
            subscriptionType: 'recurring',
            userId: 'user-1',
          }),
        ).rejects.toThrow('durationMonths should not be provided for recurring subscriptions');
      });

      it('should throw error when payment channel is not supported', async () => {
        await expect(
          service.createOrder({
            payChannel: 'invalid_channel' as any,
            planId: 'plan-1',
            planInterval: 'month',
            subscriptionType: 'recurring',
            userId: 'user-1',
          }),
        ).rejects.toThrow('Payment channel invalid_channel not supported');
      });

      it('should throw error when plan is not found', async () => {
        mockLimit.mockResolvedValueOnce([]);

        await expect(
          service.createOrder({
            payChannel: 'wechat_native',
            planId: 'non-existent',
            planInterval: 'month',
            subscriptionType: 'recurring',
            userId: 'user-1',
          }),
        ).rejects.toThrow('Plan not found');
      });

      it('should throw error when plan has invalid pricing', async () => {
        mockLimit.mockResolvedValueOnce([{ ...mockPlan, monthlyPrice: 0 }]);

        await expect(
          service.createOrder({
            payChannel: 'wechat_native',
            planId: 'plan-1',
            planInterval: 'month',
            subscriptionType: 'recurring',
            userId: 'user-1',
          }),
        ).rejects.toThrow('Invalid amount calculated for plan plan-1');
      });
    });

    describe('amount calculation', () => {
      it('should calculate monthly price for recurring monthly subscription', async () => {
        mockLimit.mockResolvedValueOnce([mockPlan]).mockResolvedValueOnce([]);

        const result = await service.createOrder({
          payChannel: 'wechat_native',
          planId: 'plan-1',
          planInterval: 'month',
          subscriptionType: 'recurring',
          userId: 'user-1',
        });

        expect(result.amount).toBe(1000);
      });

      it('should calculate yearly price for recurring yearly subscription', async () => {
        mockLimit.mockResolvedValueOnce([mockPlan]).mockResolvedValueOnce([]);

        const result = await service.createOrder({
          payChannel: 'wechat_native',
          planId: 'plan-1',
          planInterval: 'year',
          subscriptionType: 'recurring',
          userId: 'user-1',
        });

        expect(result.amount).toBe(10_000);
      });

      it('should calculate correct amount for 1-month onetime payment', async () => {
        mockLimit.mockResolvedValueOnce([mockPlan]).mockResolvedValueOnce([]);

        const result = await service.createOrder({
          durationMonths: 1,
          payChannel: 'wechat_native',
          planId: 'plan-1',
          planInterval: 'month',
          subscriptionType: 'onetime',
          userId: 'user-1',
        });

        expect(result.amount).toBe(1000); // 1 * monthlyPrice
      });

      it('should calculate correct amount for 3-month onetime payment', async () => {
        mockLimit.mockResolvedValueOnce([mockPlan]).mockResolvedValueOnce([]);

        const result = await service.createOrder({
          durationMonths: 3,
          payChannel: 'wechat_native',
          planId: 'plan-1',
          planInterval: 'month',
          subscriptionType: 'onetime',
          userId: 'user-1',
        });

        expect(result.amount).toBe(3000); // 3 * monthlyPrice
      });

      it('should calculate correct amount for 6-month onetime payment', async () => {
        mockLimit.mockResolvedValueOnce([mockPlan]).mockResolvedValueOnce([]);

        const result = await service.createOrder({
          durationMonths: 6,
          payChannel: 'wechat_native',
          planId: 'plan-1',
          planInterval: 'month',
          subscriptionType: 'onetime',
          userId: 'user-1',
        });

        expect(result.amount).toBe(6000); // 6 * monthlyPrice
      });

      it('should use yearly price for 12-month onetime payment', async () => {
        mockLimit.mockResolvedValueOnce([mockPlan]).mockResolvedValueOnce([]);

        const result = await service.createOrder({
          durationMonths: 12,
          payChannel: 'wechat_native',
          planId: 'plan-1',
          planInterval: 'month',
          subscriptionType: 'onetime',
          userId: 'user-1',
        });

        expect(result.amount).toBe(10_000); // yearlyPrice (same discount as yearly)
      });
    });

    describe('duplicate order handling', () => {
      it('should reuse existing pending order if not expired', async () => {
        const existingOrder = {
          amount: 1000,
          channelData: { code_url: 'weixin://pay/existing' },
          expiredAt: new Date(Date.now() + 60 * 60 * 1000),
          orderNo: 'PC20240115120000111111',
        };

        mockLimit.mockResolvedValueOnce([mockPlan]).mockResolvedValueOnce([existingOrder]);

        const result = await service.createOrder({
          payChannel: 'wechat_native',
          planId: 'plan-1',
          planInterval: 'month',
          subscriptionType: 'recurring',
          userId: 'user-1',
        });

        expect(result.orderNo).toBe('PC20240115120000111111');
        expect(result.codeUrl).toBe('weixin://pay/existing');
        expect(mockInsert).not.toHaveBeenCalled();
      });

      it('should create new order if existing order is expired', async () => {
        const existingOrder = {
          amount: 1000,
          channelData: { code_url: 'weixin://pay/expired' },
          expiredAt: new Date(Date.now() - 1000),
          orderNo: 'PC20240115120000111111',
        };

        mockLimit.mockResolvedValueOnce([mockPlan]).mockResolvedValueOnce([existingOrder]);

        const result = await service.createOrder({
          payChannel: 'wechat_native',
          planId: 'plan-1',
          planInterval: 'month',
          subscriptionType: 'recurring',
          userId: 'user-1',
        });

        expect(result.orderNo).toBe('PC20240115123000123456');
        expect(mockInsert).toHaveBeenCalled();
      });
    });

    describe('order creation flow', () => {
      beforeEach(() => {
        mockLimit.mockResolvedValueOnce([mockPlan]).mockResolvedValueOnce([]);
      });

      it('should create order with correct data in database', async () => {
        await service.createOrder({
          payChannel: 'wechat_native',
          planId: 'plan-1',
          planInterval: 'month',
          subscriptionType: 'recurring',
          userId: 'user-1',
        });

        expect(mockInsert).toHaveBeenCalled();
        expect(mockValues).toHaveBeenCalledWith(
          expect.objectContaining({
            amount: 1000,
            currency: 'CNY',
            orderNo: 'PC20240115123000123456',
            payChannel: 'wechat_native',
            planId: 'plan-1',
            planInterval: 'month',
            status: 'pending',
            subscriptionType: 'recurring',
            userId: 'user-1',
          }),
        );
      });

      it('should set expiration time to 2 hours from now', async () => {
        const beforeCreate = Date.now();

        await service.createOrder({
          payChannel: 'wechat_native',
          planId: 'plan-1',
          planInterval: 'month',
          subscriptionType: 'recurring',
          userId: 'user-1',
        });

        const afterCreate = Date.now();
        const callArgs = mockValues.mock.calls[0][0];
        const expiredAt = new Date(callArgs.expiredAt);

        const twoHoursInMs = 2 * 60 * 60 * 1000;
        const expectedMin = beforeCreate + twoHoursInMs;
        const expectedMax = afterCreate + twoHoursInMs;

        expect(expiredAt.getTime()).toBeGreaterThanOrEqual(expectedMin);
        expect(expiredAt.getTime()).toBeLessThanOrEqual(expectedMax);
      });

      it('should call payment channel to create payment', async () => {
        const channel = service.getChannel('wechat_native');

        await service.createOrder({
          payChannel: 'wechat_native',
          planId: 'plan-1',
          planInterval: 'month',
          subscriptionType: 'recurring',
          userId: 'user-1',
        });

        expect(channel?.createPayment).toHaveBeenCalledWith(
          expect.objectContaining({
            amount: 1000,
            orderNo: 'PC20240115123000123456',
            planName: 'Premium Plan',
            planSlug: 'premium',
          }),
        );
      });

      it('should update order with channel data after successful payment creation', async () => {
        await service.createOrder({
          payChannel: 'wechat_native',
          planId: 'plan-1',
          planInterval: 'month',
          subscriptionType: 'recurring',
          userId: 'user-1',
        });

        expect(mockUpdate).toHaveBeenCalled();
        expect(mockSet).toHaveBeenCalledWith(
          expect.objectContaining({
            channelData: { code_url: 'weixin://pay/qrcode/test' },
            channelOrderNo: 'WX123456',
          }),
        );
      });

      it('should return order info with QR code URL', async () => {
        const result = await service.createOrder({
          payChannel: 'wechat_native',
          planId: 'plan-1',
          planInterval: 'month',
          subscriptionType: 'recurring',
          userId: 'user-1',
        });

        expect(result).toMatchObject({
          amount: 1000,
          codeUrl: 'weixin://pay/qrcode/test',
          orderNo: 'PC20240115123000123456',
        });
        expect(result.expiredAt).toBeInstanceOf(Date);
      });
    });

    describe('channel failure handling', () => {
      it('should close order and throw error when channel creation fails', async () => {
        mockLimit.mockResolvedValueOnce([mockPlan]).mockResolvedValueOnce([]);

        const channel = service.getChannel('wechat_native');
        vi.mocked(channel!.createPayment).mockResolvedValueOnce({
          errorMessage: 'Channel error',
          success: false,
        });

        await expect(
          service.createOrder({
            payChannel: 'wechat_native',
            planId: 'plan-1',
            planInterval: 'month',
            subscriptionType: 'recurring',
            userId: 'user-1',
          }),
        ).rejects.toThrow('Channel error');

        expect(mockUpdate).toHaveBeenCalled();
        expect(mockSet).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'closed',
          }),
        );
      });
    });
  });

  describe('queryOrder', () => {
    it('should return order status for existing order', async () => {
      const mockOrder = {
        amount: 1000,
        orderNo: 'PC20240115123000123456',
        paidAt: new Date('2024-01-15T12:35:00Z'),
        status: 'paid',
      };

      mockLimit.mockResolvedValue([mockOrder]);

      const result = await service.queryOrder('PC20240115123000123456');

      expect(result).toEqual({
        amount: 1000,
        orderNo: 'PC20240115123000123456',
        paidAt: mockOrder.paidAt,
        status: 'paid',
      });
    });

    it('should return undefined for paidAt if order is not paid', async () => {
      const mockOrder = {
        amount: 1000,
        orderNo: 'PC20240115123000123456',
        paidAt: null,
        status: 'pending',
      };

      mockLimit.mockResolvedValue([mockOrder]);

      const result = await service.queryOrder('PC20240115123000123456');

      expect(result.paidAt).toBeUndefined();
    });

    it('should throw error when order is not found', async () => {
      mockLimit.mockResolvedValue([]);

      await expect(service.queryOrder('non-existent')).rejects.toThrow('Order not found');
    });
  });

  describe('closeOrder', () => {
    const mockOrder = {
      orderNo: 'PC20240115123000123456',
      payChannel: 'wechat_native',
      status: 'pending',
      userId: 'user-1',
    };

    it('should close pending order for authorized user', async () => {
      mockLimit.mockResolvedValue([mockOrder]);

      await service.closeOrder('PC20240115123000123456', 'user-1');

      const channel = service.getChannel('wechat_native');
      expect(channel?.closeOrder).toHaveBeenCalledWith('PC20240115123000123456');
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'closed',
        }),
      );
    });

    it('should throw error when order is not found', async () => {
      mockLimit.mockResolvedValue([]);

      await expect(service.closeOrder('non-existent', 'user-1')).rejects.toThrow('Order not found');
    });

    it('should throw error when user is not authorized', async () => {
      mockLimit.mockResolvedValue([mockOrder]);

      await expect(service.closeOrder('PC20240115123000123456', 'wrong-user')).rejects.toThrow(
        'Unauthorized',
      );
    });

    it('should not update already paid order', async () => {
      mockLimit.mockResolvedValue([{ ...mockOrder, status: 'paid' }]);

      await service.closeOrder('PC20240115123000123456', 'user-1');

      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('should not update already closed order', async () => {
      mockLimit.mockResolvedValue([{ ...mockOrder, status: 'closed' }]);

      await service.closeOrder('PC20240115123000123456', 'user-1');

      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe('createSignPaymentOrder', () => {
    const mockPlan = {
      id: 'plan-1',
      monthlyPrice: 1000,
      name: 'Premium Plan',
      slug: 'premium',
      yearlyPrice: 10_000,
    };

    beforeEach(() => {
      mockLimit.mockResolvedValue([mockPlan]);
    });

    it('should throw error when cycle channel is not configured', async () => {
      const emptyService = new PaymentService(mockDB, {});

      await expect(
        emptyService.createSignPaymentOrder({
          billingInterval: 'month',
          planId: 'plan-1',
          userId: 'user-1',
        }),
      ).rejects.toThrow('Alipay cycle payment is not configured');
    });

    it('should create sign payment order with monthly billing', async () => {
      const result = await service.createSignPaymentOrder({
        billingInterval: 'month',
        planId: 'plan-1',
        userId: 'user-1',
      });

      expect(result).toMatchObject({
        amount: 1000,
        codeUrl: 'https://qr.alipay.com/sign-test',
        externalAgreementNo: 'AGRPC20240115123000123456',
        orderNo: 'PC20240115123000123456',
      });
      expect(result.agreementId).toBeDefined();
    });

    it('should create sign payment order with yearly billing', async () => {
      const result = await service.createSignPaymentOrder({
        billingInterval: 'year',
        planId: 'plan-1',
        userId: 'user-1',
      });

      expect(result.amount).toBe(10_000);
    });

    it('should insert agreement record with correct data', async () => {
      await service.createSignPaymentOrder({
        billingInterval: 'month',
        planId: 'plan-1',
        userId: 'user-1',
      });

      expect(mockInsert).toHaveBeenCalledWith(userAgreements);
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          billingInterval: 'month',
          externalAgreementNo: 'AGRPC20240115123000123456',
          period: 1,
          periodType: 'MONTH',
          planId: 'plan-1',
          planName: 'Premium Plan',
          signChannel: 'alipay',
          singleAmount: 1000,
          status: 'pending',
          userId: 'user-1',
        }),
      );
    });

    it('should set period to 12 for yearly billing', async () => {
      await service.createSignPaymentOrder({
        billingInterval: 'year',
        planId: 'plan-1',
        userId: 'user-1',
      });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          period: 12,
          periodType: 'MONTH',
        }),
      );
    });

    it('should close order and update agreement when channel creation fails', async () => {
      const cycleChannel = service.getCycleChannel();
      vi.mocked(cycleChannel!.createSignPayment).mockResolvedValueOnce({
        errorMessage: 'Sign payment failed',
        success: false,
      });

      await expect(
        service.createSignPaymentOrder({
          billingInterval: 'month',
          planId: 'plan-1',
          userId: 'user-1',
        }),
      ).rejects.toThrow('Sign payment failed');

      expect(mockUpdate).toHaveBeenCalledTimes(2);
    });
  });

  describe('processSignNotification', () => {
    const mockAgreement = {
      id: 'agreement-1',
      period: 1,
      periodType: 'MONTH',
    };

    beforeEach(() => {
      mockLimit.mockResolvedValue([mockAgreement]);
    });

    it('should update agreement to signed status on NORMAL status', async () => {
      const signTime = new Date('2024-01-15T12:00:00Z');

      const result = await service.processSignNotification({
        agreementNo: 'AGR123456',
        alipayLogonId: 'test@alipay.com',
        alipayOpenId: 'open-id-123',
        alipayUserId: 'user-id-123',
        externalAgreementNo: 'AGRPC20240115123000123456',
        signScene: 'INDUSTRY|DIGITAL_MEDIA',
        signTime,
        status: 'NORMAL',
      });

      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          agreementNo: 'AGR123456',
          alipayLogonId: 'test@alipay.com',
          alipayOpenId: 'open-id-123',
          alipayUserId: 'user-id-123',
          signTime,
          status: 'signed',
        }),
      );
    });

    it('should calculate next deduct date for monthly period', async () => {
      const signTime = new Date('2024-01-15T12:00:00Z');

      await service.processSignNotification({
        agreementNo: 'AGR123456',
        externalAgreementNo: 'AGRPC20240115123000123456',
        signScene: 'INDUSTRY|DIGITAL_MEDIA',
        signTime,
        status: 'NORMAL',
      });

      const setCall = mockSet.mock.calls[0][0];
      expect(setCall.nextDeductDate).toBe('2024-02-15');
    });

    it('should cap next deduct date at 28th for dates beyond 28', async () => {
      // When adding a month to a date > 28, JS may overflow to next month
      // The code caps the final result if it ends up > 28
      const signTime = new Date('2024-12-31T12:00:00Z');

      await service.processSignNotification({
        agreementNo: 'AGR123456',
        externalAgreementNo: 'AGRPC20240115123000123456',
        signScene: 'INDUSTRY|DIGITAL_MEDIA',
        signTime,
        status: 'NORMAL',
      });

      const setCall = mockSet.mock.calls[0][0];
      // Dec 31 + 1 month = Jan 31, which is > 28, so it should be capped to 28
      expect(setCall.nextDeductDate).toBe('2025-01-28');
    });

    it('should update agreement to unsigned status on UNSIGN status', async () => {
      const result = await service.processSignNotification({
        agreementNo: 'AGR123456',
        externalAgreementNo: 'AGRPC20240115123000123456',
        signScene: 'INDUSTRY|DIGITAL_MEDIA',
        signTime: new Date(),
        status: 'UNSIGN',
      });

      expect(result.success).toBe(true);
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'unsigned',
          unsignReason: 'user_unsign',
        }),
      );
    });

    it('should return false when agreement is not found', async () => {
      mockLimit.mockResolvedValue([]);

      const result = await service.processSignNotification({
        agreementNo: 'AGR123456',
        externalAgreementNo: 'non-existent',
        signScene: 'INDUSTRY|DIGITAL_MEDIA',
        signTime: new Date(),
        status: 'NORMAL',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('deductPayment', () => {
    it('should throw error when cycle channel is not configured', async () => {
      const emptyService = new PaymentService(mockDB, {});

      await expect(
        emptyService.deductPayment({
          agreementNo: 'AGR123456',
          amount: 1000,
          planName: 'Premium Plan',
          userId: 'user-1',
        }),
      ).rejects.toThrow('Alipay cycle payment is not configured');
    });

    it('should create deduct payment order and update on success', async () => {
      const result = await service.deductPayment({
        agreementNo: 'AGR123456',
        amount: 1000,
        planName: 'Premium Plan',
        userId: 'user-1',
      });

      expect(result).toMatchObject({
        orderNo: 'PC20240115123000123456',
        status: 'success',
      });

      expect(mockInsert).toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          channelOrderNo: 'DEDUCT123',
          status: 'paid',
        }),
      );
    });

    it('should update order to closed on deduct failure', async () => {
      const cycleChannel = service.getCycleChannel();
      vi.mocked(cycleChannel!.deductPayment).mockResolvedValueOnce({
        errorCode: 'INSUFFICIENT_BALANCE',
        errorMessage: 'Insufficient balance',
        orderNo: 'PC20240115123000123456',
        status: 'failed',
      });

      const result = await service.deductPayment({
        agreementNo: 'AGR123456',
        amount: 1000,
        planName: 'Premium Plan',
        userId: 'user-1',
      });

      expect(result.status).toBe('failed');
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'closed',
        }),
      );
    });

    it('should set expiration time to 24 hours for deduct orders', async () => {
      const beforeCreate = Date.now();

      await service.deductPayment({
        agreementNo: 'AGR123456',
        amount: 1000,
        planName: 'Premium Plan',
        userId: 'user-1',
      });

      const afterCreate = Date.now();
      const callArgs = mockValues.mock.calls[0][0];
      const expiredAt = new Date(callArgs.expiredAt);

      const twentyFourHoursInMs = 24 * 60 * 60 * 1000;
      const expectedMin = beforeCreate + twentyFourHoursInMs;
      const expectedMax = afterCreate + twentyFourHoursInMs;

      expect(expiredAt.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(expiredAt.getTime()).toBeLessThanOrEqual(expectedMax);
    });
  });

  describe('unsignAgreement', () => {
    const mockAgreement = {
      agreementNo: 'AGR123456',
      id: 'agreement-1',
      status: 'signed',
      userId: 'user-1',
    };

    beforeEach(() => {
      mockLimit.mockResolvedValue([mockAgreement]);
    });

    it('should throw error when cycle channel is not configured', async () => {
      const emptyService = new PaymentService(mockDB, {});

      await expect(emptyService.unsignAgreement('agreement-1', 'user-1')).rejects.toThrow(
        'Alipay cycle payment is not configured',
      );
    });

    it('should unsign agreement and update status', async () => {
      const result = await service.unsignAgreement('agreement-1', 'user-1');

      const cycleChannel = service.getCycleChannel();
      expect(cycleChannel?.unsignAgreement).toHaveBeenCalledWith('AGR123456');
      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'unsigned',
          unsignReason: 'merchant_unsign',
        }),
      );
    });

    it('should throw error when agreement is not found', async () => {
      mockLimit.mockResolvedValue([]);

      await expect(service.unsignAgreement('non-existent', 'user-1')).rejects.toThrow(
        'Agreement not found',
      );
    });

    it('should throw error when agreement has no agreementNo', async () => {
      mockLimit.mockResolvedValue([{ ...mockAgreement, agreementNo: null }]);

      await expect(service.unsignAgreement('agreement-1', 'user-1')).rejects.toThrow(
        'Agreement not signed yet',
      );
    });

    it('should throw error when agreement is not in signed status', async () => {
      mockLimit.mockResolvedValue([{ ...mockAgreement, status: 'pending' }]);

      await expect(service.unsignAgreement('agreement-1', 'user-1')).rejects.toThrow(
        'Agreement is not active',
      );
    });

    it('should not update status if unsign call fails', async () => {
      const cycleChannel = service.getCycleChannel();
      vi.mocked(cycleChannel!.unsignAgreement).mockResolvedValueOnce({ success: false });

      const result = await service.unsignAgreement('agreement-1', 'user-1');

      expect(result.success).toBe(false);
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe('getChannel', () => {
    it('should return registered channel', () => {
      const channel = service.getChannel('wechat_native');

      expect(channel).toBeDefined();
    });

    it('should return undefined for unregistered channel', () => {
      const channel = service.getChannel('unknown_channel');

      expect(channel).toBeUndefined();
    });
  });

  describe('getCycleChannel', () => {
    it('should return cycle channel when alipay is configured', () => {
      const cycleChannel = service.getCycleChannel();

      expect(cycleChannel).toBeDefined();
    });

    it('should return null when alipay is not configured', () => {
      const emptyService = new PaymentService(mockDB, {});
      const cycleChannel = emptyService.getCycleChannel();

      expect(cycleChannel).toBeNull();
    });
  });
});

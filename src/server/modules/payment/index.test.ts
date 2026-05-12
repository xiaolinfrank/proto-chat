// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LobeChatDatabase } from '@lobechat/database';

import { PaymentService } from './index';
import type { PaymentConfig } from './types';

// --- DB mock helpers ---

function createSelectChain(resolveValue: any[] = []) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(resolveValue),
    where: vi.fn().mockReturnThis(),
  };
  return chain;
}

function createInsertChain() {
  return {
    values: vi.fn().mockResolvedValue(undefined),
  };
}

function createUpdateChain() {
  const chain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  };
  return chain;
}

function createMockDb() {
  return {
    insert: vi.fn().mockReturnValue(createInsertChain()),
    select: vi.fn().mockReturnValue(createSelectChain()),
    update: vi.fn().mockReturnValue(createUpdateChain()),
  } as unknown as LobeChatDatabase;
}

// --- Channel mock helpers ---

function createMockChannel() {
  return {
    closeOrder: vi.fn().mockResolvedValue(undefined),
    createPayment: vi.fn().mockResolvedValue({ success: true, channelData: { code_url: 'weixin://test' }, channelOrderNo: 'ch-order-1' }),
    parseNotification: vi.fn(),
    queryOrder: vi.fn(),
  };
}

const WECHAT_CONFIG: PaymentConfig = {
  wechat: {
    apiKey: 'test_api_key_123456789012345678',
    appId: 'wx_test',
    mchId: 'mch_test',
    notifyUrl: 'https://example.com/wechat/notify',
  },
};

const PLAN_DATA = {
  id: 'plan-pro',
  monthlyPrice: 9900,
  name: 'Pro Plan',
  slug: 'pro',
  yearlyPrice: 99900,
};

describe('PaymentService', () => {
  let mockDb: LobeChatDatabase;

  beforeEach(() => {
    mockDb = createMockDb();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should register wechat_native channel when wechat config is provided', () => {
      const service = new PaymentService(mockDb, WECHAT_CONFIG);
      expect(service.getChannel('wechat_native')).toBeDefined();
    });

    it('should not register wechat_native channel when wechat config is absent', () => {
      const service = new PaymentService(mockDb, {});
      expect(service.getChannel('wechat_native')).toBeUndefined();
    });

    it('should return null for cycleChannel when alipay config is absent', () => {
      const service = new PaymentService(mockDb, WECHAT_CONFIG);
      expect(service.getCycleChannel()).toBeNull();
    });
  });

  describe('createOrder', () => {
    describe('input validation', () => {
      let service: PaymentService;

      beforeEach(() => {
        service = new PaymentService(mockDb, WECHAT_CONFIG);
      });

      it('should throw when subscriptionType is onetime and durationMonths is missing', async () => {
        await expect(
          service.createOrder({
            payChannel: 'wechat_native',
            planId: 'plan-pro',
            planInterval: 'month',
            subscriptionType: 'onetime',
            userId: 'user-1',
          }),
        ).rejects.toThrow('durationMonths is required for one-time payment');
      });

      it('should throw when durationMonths is not in [1, 3, 6, 12]', async () => {
        await expect(
          service.createOrder({
            durationMonths: 2,
            payChannel: 'wechat_native',
            planId: 'plan-pro',
            planInterval: 'month',
            subscriptionType: 'onetime',
            userId: 'user-1',
          }),
        ).rejects.toThrow('durationMonths must be 1, 3, 6, or 12');
      });

      it('should throw when subscriptionType is recurring and durationMonths is provided', async () => {
        await expect(
          service.createOrder({
            durationMonths: 3,
            payChannel: 'wechat_native',
            planId: 'plan-pro',
            planInterval: 'month',
            subscriptionType: 'recurring',
            userId: 'user-1',
          }),
        ).rejects.toThrow('durationMonths should not be provided for recurring subscriptions');
      });

      it('should throw when payment channel is not supported', async () => {
        await expect(
          service.createOrder({
            payChannel: 'alipay_precreate',
            planId: 'plan-pro',
            planInterval: 'month',
            subscriptionType: 'recurring',
            userId: 'user-1',
          }),
        ).rejects.toThrow('Payment channel alipay_precreate not supported');
      });
    });

    describe('plan lookup', () => {
      it('should throw when plan is not found', async () => {
        const service = new PaymentService(mockDb, WECHAT_CONFIG);

        // DB returns empty array for plan query
        (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(createSelectChain([]));

        await expect(
          service.createOrder({
            payChannel: 'wechat_native',
            planId: 'nonexistent-plan',
            planInterval: 'month',
            subscriptionType: 'recurring',
            userId: 'user-1',
          }),
        ).rejects.toThrow('Plan not found');
      });
    });

    describe('amount calculation', () => {
      it('should calculate monthly recurring amount correctly', async () => {
        const service = new PaymentService(mockDb, WECHAT_CONFIG);

        const db = mockDb as any;
        db.select
          .mockReturnValueOnce(createSelectChain([PLAN_DATA]))  // plan query
          .mockReturnValueOnce(createSelectChain([]));           // existing order query

        const mockChannel = createMockChannel();
        // @ts-ignore - accessing private property for testing
        service.channels.set('wechat_native', mockChannel);

        const result = await service.createOrder({
          payChannel: 'wechat_native',
          planId: 'plan-pro',
          planInterval: 'month',
          subscriptionType: 'recurring',
          userId: 'user-1',
        });

        expect(result.amount).toBe(9900);
        expect(mockChannel.createPayment).toHaveBeenCalledWith(
          expect.objectContaining({ amount: 9900, planId: 'plan-pro' }),
        );
      });

      it('should calculate yearly recurring amount correctly', async () => {
        const service = new PaymentService(mockDb, WECHAT_CONFIG);

        const db = mockDb as any;
        db.select
          .mockReturnValueOnce(createSelectChain([PLAN_DATA]))
          .mockReturnValueOnce(createSelectChain([]));

        const mockChannel = createMockChannel();
        // @ts-ignore
        service.channels.set('wechat_native', mockChannel);

        const result = await service.createOrder({
          payChannel: 'wechat_native',
          planId: 'plan-pro',
          planInterval: 'year',
          subscriptionType: 'recurring',
          userId: 'user-1',
        });

        expect(result.amount).toBe(99900);
      });

      it('should calculate 3-month onetime amount as monthlyPrice × 3', async () => {
        const service = new PaymentService(mockDb, WECHAT_CONFIG);

        const db = mockDb as any;
        db.select
          .mockReturnValueOnce(createSelectChain([PLAN_DATA]))
          .mockReturnValueOnce(createSelectChain([]));

        const mockChannel = createMockChannel();
        // @ts-ignore
        service.channels.set('wechat_native', mockChannel);

        const result = await service.createOrder({
          durationMonths: 3,
          payChannel: 'wechat_native',
          planId: 'plan-pro',
          planInterval: 'month',
          subscriptionType: 'onetime',
          userId: 'user-1',
        });

        expect(result.amount).toBe(9900 * 3); // 29700
      });

      it('should use yearlyPrice for 12-month onetime payment', async () => {
        const service = new PaymentService(mockDb, WECHAT_CONFIG);

        const db = mockDb as any;
        db.select
          .mockReturnValueOnce(createSelectChain([PLAN_DATA]))
          .mockReturnValueOnce(createSelectChain([]));

        const mockChannel = createMockChannel();
        // @ts-ignore
        service.channels.set('wechat_native', mockChannel);

        const result = await service.createOrder({
          durationMonths: 12,
          payChannel: 'wechat_native',
          planId: 'plan-pro',
          planInterval: 'year',
          subscriptionType: 'onetime',
          userId: 'user-1',
        });

        expect(result.amount).toBe(99900);
      });

      it('should subtract discountAmount from final amount', async () => {
        const service = new PaymentService(mockDb, WECHAT_CONFIG);

        const db = mockDb as any;
        db.select
          .mockReturnValueOnce(createSelectChain([PLAN_DATA]))
          .mockReturnValueOnce(createSelectChain([]));

        const mockChannel = createMockChannel();
        // @ts-ignore
        service.channels.set('wechat_native', mockChannel);

        const result = await service.createOrder({
          discountAmount: 1000,
          payChannel: 'wechat_native',
          planId: 'plan-pro',
          planInterval: 'month',
          subscriptionType: 'recurring',
          userId: 'user-1',
        });

        expect(result.amount).toBe(9900 - 1000); // 8900
      });

      it('should subtract residualValue from final amount', async () => {
        const service = new PaymentService(mockDb, WECHAT_CONFIG);

        const db = mockDb as any;
        db.select
          .mockReturnValueOnce(createSelectChain([PLAN_DATA]))
          .mockReturnValueOnce(createSelectChain([]));

        const mockChannel = createMockChannel();
        // @ts-ignore
        service.channels.set('wechat_native', mockChannel);

        const result = await service.createOrder({
          payChannel: 'wechat_native',
          planId: 'plan-pro',
          planInterval: 'month',
          residualValue: 3000,
          subscriptionType: 'recurring',
          userId: 'user-1',
        });

        expect(result.amount).toBe(9900 - 3000); // 6900
      });

      it('should clamp amount to 0 when discounts exceed price', async () => {
        const service = new PaymentService(mockDb, WECHAT_CONFIG);

        const db = mockDb as any;
        db.select
          .mockReturnValueOnce(createSelectChain([PLAN_DATA]))
          .mockReturnValueOnce(createSelectChain([]));

        const mockChannel = createMockChannel();
        // @ts-ignore
        service.channels.set('wechat_native', mockChannel);

        const result = await service.createOrder({
          discountAmount: 5000,
          payChannel: 'wechat_native',
          planId: 'plan-pro',
          planInterval: 'month',
          residualValue: 9000,
          subscriptionType: 'recurring',
          userId: 'user-1',
        });

        expect(result.amount).toBe(0);
      });
    });

    describe('existing pending order reuse', () => {
      it('should return existing unexpired pending order without creating new one', async () => {
        const service = new PaymentService(mockDb, WECHAT_CONFIG);

        const futureDate = new Date(Date.now() + 60 * 60 * 1000);
        const existingOrder = {
          amount: 9900,
          channelData: { code_url: 'weixin://existing' },
          expiredAt: futureDate,
          orderNo: 'PC_EXISTING_ORDER',
          planId: 'plan-pro',
          planInterval: 'month',
          status: 'pending',
          subscriptionType: 'recurring',
          userId: 'user-1',
        };

        const db = mockDb as any;
        db.select
          .mockReturnValueOnce(createSelectChain([PLAN_DATA]))
          .mockReturnValueOnce(createSelectChain([existingOrder]));

        const mockChannel = createMockChannel();
        // @ts-ignore
        service.channels.set('wechat_native', mockChannel);

        const result = await service.createOrder({
          payChannel: 'wechat_native',
          planId: 'plan-pro',
          planInterval: 'month',
          subscriptionType: 'recurring',
          userId: 'user-1',
        });

        expect(result.orderNo).toBe('PC_EXISTING_ORDER');
        expect(result.codeUrl).toBe('weixin://existing');
        expect(mockChannel.createPayment).not.toHaveBeenCalled();
      });
    });

    describe('channel failure', () => {
      it('should close the order and throw when channel createPayment fails', async () => {
        const service = new PaymentService(mockDb, WECHAT_CONFIG);

        const db = mockDb as any;
        const updateChain = createUpdateChain();
        db.select
          .mockReturnValueOnce(createSelectChain([PLAN_DATA]))
          .mockReturnValueOnce(createSelectChain([]));
        db.update.mockReturnValue(updateChain);

        const mockChannel = createMockChannel();
        mockChannel.createPayment.mockResolvedValue({
          errorMessage: 'Gateway timeout',
          success: false,
        });
        // @ts-ignore
        service.channels.set('wechat_native', mockChannel);

        await expect(
          service.createOrder({
            payChannel: 'wechat_native',
            planId: 'plan-pro',
            planInterval: 'month',
            subscriptionType: 'recurring',
            userId: 'user-1',
          }),
        ).rejects.toThrow('Gateway timeout');

        // Verify order was closed
        expect(db.update).toHaveBeenCalled();
        expect(updateChain.set).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'closed' }),
        );
      });
    });
  });

  describe('queryOrder', () => {
    it('should throw when order is not found', async () => {
      const service = new PaymentService(mockDb, WECHAT_CONFIG);
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(createSelectChain([]));

      await expect(service.queryOrder('NONEXISTENT')).rejects.toThrow('Order not found');
    });

    it('should return order data when found', async () => {
      const service = new PaymentService(mockDb, WECHAT_CONFIG);
      const orderData = {
        amount: 9900,
        orderNo: 'PC202601270930451234567',
        paidAt: new Date('2026-01-27T09:30:45Z'),
        status: 'paid',
      };

      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        createSelectChain([orderData]),
      );

      const result = await service.queryOrder('PC202601270930451234567');

      expect(result.orderNo).toBe('PC202601270930451234567');
      expect(result.amount).toBe(9900);
      expect(result.status).toBe('paid');
      expect(result.paidAt).toEqual(new Date('2026-01-27T09:30:45Z'));
    });

    it('should return undefined paidAt when order is not yet paid', async () => {
      const service = new PaymentService(mockDb, WECHAT_CONFIG);
      const orderData = {
        amount: 9900,
        orderNo: 'PC202601270930451234567',
        paidAt: null,
        status: 'pending',
      };

      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        createSelectChain([orderData]),
      );

      const result = await service.queryOrder('PC202601270930451234567');

      expect(result.paidAt).toBeUndefined();
    });
  });

  describe('closeOrder', () => {
    it('should throw when order is not found', async () => {
      const service = new PaymentService(mockDb, WECHAT_CONFIG);
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(createSelectChain([]));

      await expect(service.closeOrder('NONEXISTENT', 'user-1')).rejects.toThrow('Order not found');
    });

    it('should throw Unauthorized when userId does not match', async () => {
      const service = new PaymentService(mockDb, WECHAT_CONFIG);
      const orderData = {
        orderNo: 'PC202601270930451234567',
        payChannel: 'wechat_native',
        status: 'pending',
        userId: 'other-user',
      };

      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        createSelectChain([orderData]),
      );

      await expect(service.closeOrder('PC202601270930451234567', 'user-1')).rejects.toThrow(
        'Unauthorized',
      );
    });

    it('should silently return when order is already paid', async () => {
      const service = new PaymentService(mockDb, WECHAT_CONFIG);
      const orderData = {
        orderNo: 'PC202601270930451234567',
        payChannel: 'wechat_native',
        status: 'paid',
        userId: 'user-1',
      };

      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        createSelectChain([orderData]),
      );

      await expect(service.closeOrder('PC202601270930451234567', 'user-1')).resolves.toBeUndefined();
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('should call channel closeOrder and update DB for pending order', async () => {
      const service = new PaymentService(mockDb, WECHAT_CONFIG);
      const orderData = {
        orderNo: 'PC202601270930451234567',
        payChannel: 'wechat_native',
        status: 'pending',
        userId: 'user-1',
      };

      const db = mockDb as any;
      db.select.mockReturnValue(createSelectChain([orderData]));
      const updateChain = createUpdateChain();
      db.update.mockReturnValue(updateChain);

      const mockChannel = createMockChannel();
      // @ts-ignore
      service.channels.set('wechat_native', mockChannel);

      await service.closeOrder('PC202601270930451234567', 'user-1');

      expect(mockChannel.closeOrder).toHaveBeenCalledWith('PC202601270930451234567');
      expect(db.update).toHaveBeenCalled();
      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'closed' }),
      );
    });
  });

  describe('getChannel', () => {
    it('should return channel when it exists', () => {
      const service = new PaymentService(mockDb, WECHAT_CONFIG);
      expect(service.getChannel('wechat_native')).toBeDefined();
    });

    it('should return undefined for unknown channel name', () => {
      const service = new PaymentService(mockDb, WECHAT_CONFIG);
      expect(service.getChannel('unknown_channel')).toBeUndefined();
    });
  });

  describe('processSignNotification', () => {
    it('should return failure when agreement is not found', async () => {
      const service = new PaymentService(mockDb, WECHAT_CONFIG);
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(createSelectChain([]));

      const result = await service.processSignNotification({
        agreementNo: 'AGR123',
        externalAgreementNo: 'AGRNONE',
        signScene: 'INDUSTRY|DIGITAL_MEDIA',
        signTime: new Date(),
        status: 'NORMAL',
      });

      expect(result.success).toBe(false);
    });

    it('should update agreement to signed status on NORMAL notification', async () => {
      const service = new PaymentService(mockDb, WECHAT_CONFIG);
      const agreementData = {
        id: 'agreement-1',
        period: 1,
        periodType: 'MONTH',
        status: 'pending',
      };

      const db = mockDb as any;
      db.select.mockReturnValue(createSelectChain([agreementData]));
      const updateChain = createUpdateChain();
      db.update.mockReturnValue(updateChain);

      const signTime = new Date('2026-01-27T09:30:45Z');
      const result = await service.processSignNotification({
        agreementNo: 'AGR_ALIPAY_123',
        alipayUserId: 'ali-user-1',
        externalAgreementNo: 'AGRPC202601270930451234567',
        signScene: 'INDUSTRY|DIGITAL_MEDIA',
        signTime,
        status: 'NORMAL',
      });

      expect(result.success).toBe(true);
      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          agreementNo: 'AGR_ALIPAY_123',
          status: 'signed',
        }),
      );
    });

    it('should update agreement to unsigned status on UNSIGN notification', async () => {
      const service = new PaymentService(mockDb, WECHAT_CONFIG);
      const agreementData = {
        id: 'agreement-1',
        period: 1,
        periodType: 'MONTH',
        status: 'signed',
      };

      const db = mockDb as any;
      db.select.mockReturnValue(createSelectChain([agreementData]));
      const updateChain = createUpdateChain();
      db.update.mockReturnValue(updateChain);

      const result = await service.processSignNotification({
        agreementNo: 'AGR_ALIPAY_123',
        externalAgreementNo: 'AGRPC202601270930451234567',
        signScene: 'INDUSTRY|DIGITAL_MEDIA',
        signTime: new Date(),
        status: 'UNSIGN',
      });

      expect(result.success).toBe(true);
      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'unsigned',
          unsignReason: 'user_unsign',
        }),
      );
    });
  });
});

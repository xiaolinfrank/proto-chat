import dayjs from 'dayjs';
import debug from 'debug';
import { and, desc, eq, gte, lte } from 'drizzle-orm';

import { messages, userTransactions } from '@/database/schemas';
import { LobeChatDatabase } from '@/database/type';
import { UsageLog, UsageRecordItem } from '@/types/usage/usageRecord';
import { formatDate } from '@/utils/format';

const log = debug('lobe-usage:service');

export class UsageRecordService {
  private userId: string;
  private db: LobeChatDatabase;
  constructor(db: LobeChatDatabase, userId: string) {
    this.userId = userId;
    this.db = db;
  }

  /**
   * @description Find usage records since a specific date.
   * @param startAt Start date
   * @returns UsageRecordItem[]
   */
  findUsageSince = async (startAt: Date): Promise<UsageRecordItem[]> => {
    const spends = await this.db
      .select({
        message: messages,
        transaction: userTransactions,
      })
      .from(userTransactions)
      .leftJoin(messages, eq(userTransactions.refId, messages.id))
      .where(
        and(
          eq(userTransactions.userId, this.userId),
          eq(userTransactions.type, 'CONSUMPTION'),
          gte(userTransactions.createdAt, startAt),
        ),
      )
      .orderBy(desc(userTransactions.createdAt));

    return spends.map(({ transaction: spend, message: m }) => {
      const metadata = (spend.metadata as any) || {};
      const msgMetadata = (m?.metadata as any) || {};

      const model = metadata.model || m?.model || '-';
      const provider = metadata.provider || m?.provider || '-';
      const inputTokens = metadata.totalInputTokens || msgMetadata.totalInputTokens || 0;
      const outputTokens = metadata.totalOutputTokens || msgMetadata.totalOutputTokens || 0;

      return {
        createdAt: spend.createdAt,
        id: spend.id,
        metadata: spend.metadata,
        model,
        provider,
        spend: Math.abs(Number(spend.amount)),
        totalInputTokens: inputTokens,
        totalOutputTokens: outputTokens,
        totalTokens: inputTokens + outputTokens,
        type: 'chat',
        updatedAt: spend.createdAt,
        userId: spend.userId,
      } as UsageRecordItem;
    });
  };

  /**
   * @description Find usage records by month.
   * @param mo Month
   * @returns UsageRecordItem[]
   */
  findByMonth = async (mo?: string): Promise<UsageRecordItem[]> => {
    // Set startAt and endAt
    let startAt: Date;
    let endAt: Date;
    if (mo) {
      // mo format: "YYYY-MM"
      startAt = dayjs(mo, 'YYYY-MM').startOf('month').toDate();
      endAt = dayjs(mo, 'YYYY-MM').endOf('month').toDate();
    } else {
      startAt = dayjs().startOf('month').toDate();
      endAt = dayjs().endOf('month').toDate();
    }

    const spends = await this.db
      .select({
        message: messages,
        transaction: userTransactions,
      })
      .from(userTransactions)
      .leftJoin(messages, eq(userTransactions.refId, messages.id))
      .where(
        and(
          eq(userTransactions.userId, this.userId),
          eq(userTransactions.type, 'CONSUMPTION'),
          gte(userTransactions.createdAt, startAt),
          lte(userTransactions.createdAt, endAt),
        ),
      )
      .orderBy(desc(userTransactions.createdAt));

    return spends.map(({ transaction: spend, message: m }) => {
      const metadata = (spend.metadata as any) || {};
      const msgMetadata = (m?.metadata as any) || {};

      const model = metadata.model || m?.model || '-';
      const provider = metadata.provider || m?.provider || '-';
      const inputTokens = metadata.totalInputTokens || msgMetadata.totalInputTokens || 0;
      const outputTokens = metadata.totalOutputTokens || msgMetadata.totalOutputTokens || 0;

      return {
        createdAt: spend.createdAt,
        id: spend.id,
        metadata: spend.metadata,
        model,
        provider,
        spend: Math.abs(Number(spend.amount)),
        totalInputTokens: inputTokens,
        totalOutputTokens: outputTokens,
        totalTokens: inputTokens + outputTokens,
        type: 'chat',
        updatedAt: spend.createdAt,
        userId: spend.userId,
      } as UsageRecordItem;
    });
  };

  findAndGroupByDay = async (mo?: string): Promise<UsageLog[]> => {
    // Set startAt and endAt
    let startAt: string;
    let endAt: string;
    if (mo) {
      // mo format: "YYYY-MM"
      startAt = dayjs(mo, 'YYYY-MM').startOf('month').format('YYYY-MM-DD');
      endAt = dayjs(mo, 'YYYY-MM').endOf('month').format('YYYY-MM-DD');
    } else {
      startAt = dayjs().startOf('month').format('YYYY-MM-DD');
      endAt = dayjs().endOf('month').format('YYYY-MM-DD');
    }
    const spends = await this.findByMonth(mo);
    // Clustering by time
    let usages = new Map<string, { date: Date; logs: UsageRecordItem[] }>();
    spends.forEach((spend) => {
      if (!usages.has(formatDate(spend.createdAt))) {
        usages.set(formatDate(spend.createdAt), { date: spend.createdAt, logs: [spend] });
        return;
      }
      usages.get(formatDate(spend.createdAt))?.logs.push(spend);
    });
    // Calculate usage
    let usageLogs: UsageLog[] = [];
    usages.forEach((spends, date) => {
      const totalSpend = spends.logs.reduce((acc, spend) => acc + spend.spend, 0);
      const totalTokens = spends.logs.reduce((acc, spend) => (spend.totalTokens || 0) + acc, 0);
      const totalRequests = spends.logs?.length ?? 0;
      log(
        'date',
        date,
        'totalSpend',
        totalSpend,
        'totalTokens',
        totalTokens,
        'totalRequests',
        totalRequests,
      );
      usageLogs.push({
        date: spends.date.getTime(),
        day: date,
        records: spends.logs,
        totalRequests,
        totalSpend,
        totalTokens, // Store the formatted date as a string
      });
    });
    // Padding to ensure the date range is complete
    const startDate = dayjs(startAt);
    const endDate = dayjs(endAt);
    const paddedUsageLogs: UsageLog[] = [];
    // For every day in the range, check if it exists in usageLogs
    // If exists, use it; if not, create a new log with 0 values
    log(
      'Padding usage logs from',
      startDate.format('YYYY-MM-DD'),
      'to',
      endDate.format('YYYY-MM-DD'),
    );
    for (let date = startDate; date.isBefore(endDate); date = date.add(1, 'day')) {
      const log = usageLogs.find((log) => log.day === date.format('YYYY-MM-DD'));
      if (log) {
        paddedUsageLogs.push(log);
      } else {
        paddedUsageLogs.push({
          date: date.toDate().getTime(),
          day: date.format('YYYY-MM-DD'),
          records: [],
          totalRequests: 0,
          totalSpend: 0,
          totalTokens: 0,
        });
      }
    }
    return paddedUsageLogs;
  };
}

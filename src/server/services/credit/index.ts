import { LobeChatDatabase } from '@/database/type';
import { userBalances, userTransactions, modelPricings } from '@/database/schemas';
import { eq, and } from 'drizzle-orm';
import { idGenerator } from '@/database/utils/idGenerator';

export class CreditService {
    private userId: string;
    private db: LobeChatDatabase;

    constructor(db: LobeChatDatabase, userId: string) {
        this.userId = userId;
        this.db = db;
    }

    /**
     * Calculate credits needed for a chat completion
     *
     * Unified billing logic: All providers (including ProtoChat) query user pricing from the modelPricings table,
     * User pricing is pre-calculated (cost price × multiplier) and used directly, no runtime calculation needed, improving performance
     *
     * @param model - Model ID (original model ID, e.g. 'deepseek/deepseek-chat-v3.1')
     * @param provider - Provider ID (e.g. 'openai', 'protochat', etc.)
     * @param inputTokens - Number of input tokens
     * @param outputTokens - Number of output tokens
     * @param isUserConfig - Whether user is using their own API key (if true, no charge)
     */
    async calculateCost(
        model: string,
        provider: string,
        inputTokens: number,
        outputTokens: number,
        isUserConfig: boolean = false
    ) {
        // If user is using their own API key, don't charge
        if (isUserConfig) {
            console.log(`[Credit] User using own config for ${provider}, no charge`);
            return 0;
        }

        // Query modelPricings table uniformly (including ProtoChat)
        const pricing = await this.db.query.modelPricings.findFirst({
            where: and(eq(modelPricings.model, model), eq(modelPricings.provider, provider)),
        });

        if (!pricing) {
            console.warn(`[Credit] No pricing found for ${provider}::${model}, no charge`);
            return 0;
        }

        // Directly use pre-calculated user pricing, no runtime calculation needed (performance optimization)
        const userInputPrice = parseFloat(pricing.userInputPrice || '0');
        const userOutputPrice = parseFloat(pricing.userOutputPrice || '0');
        const perRequestPrice = parseFloat(pricing.perRequestPrice || '0');

        // Price is in credits per 1,000,000 tokens
        const cost = (inputTokens / 1_000_000) * userInputPrice + (outputTokens / 1_000_000) * userOutputPrice + perRequestPrice;

        const subProviderInfo = pricing.subProvider ? ` (via ${pricing.subProvider})` : '';
        console.log(`[Credit] Charging for ${provider}::${model}${subProviderInfo}, cost: ${cost.toFixed(4)} credits`);

        return cost;
    }

    /**
     * Deduct credits from user balance
     */
    async deductCredits(amount: number, description: string, refId?: string, metadata?: any) {
        if (amount <= 0) return;

        return this.db.transaction(async (tx) => {
            const balance = await tx.query.userBalances.findFirst({
                where: eq(userBalances.userId, this.userId),
            });

            if (!balance) {
                throw new Error('User balance not found');
            }

            if (!balance.isUnlimited && parseFloat(balance.balance) < amount) {
                throw new Error('Insufficient credits');
            }

            const newBalance = parseFloat(balance.balance) - amount;

            await tx
                .update(userBalances)
                .set({
                    balance: newBalance.toFixed(4),
                    updatedAt: new Date(),
                })
                .where(eq(userBalances.userId, this.userId));

            await tx.insert(userTransactions).values({
                amount: (-amount).toFixed(4),
                balanceAfter: newBalance.toFixed(4),
                category: 'CONSUMPTION',
                description,
                id: idGenerator('tx'),
                metadata,
                refId,
                type: 'CONSUMPTION',
                userId: this.userId,
            });

            return newBalance;
        });
    }

    /**
     * Check if user has enough credits
     */
    async hasEnoughCredits(estimatedAmount: number = 0) {
        const balance = await this.db.query.userBalances.findFirst({
            where: eq(userBalances.userId, this.userId),
        });

        if (!balance) return false;
        if (balance.isUnlimited) return true;

        const currentBalance = parseFloat(balance.balance);
        if (estimatedAmount === 0) return currentBalance > 0;

        return currentBalance >= estimatedAmount;
    }
}

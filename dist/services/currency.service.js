"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
class CurrencyService {
    constructor() {
        this.cache = null;
        this.CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 hours in milliseconds
        this.API_URL = 'https://api.exchangerate-api.com/v4/latest/USD';
        this.isFetching = false;
    }
    /**
     * Get USD to NPR exchange rate with stale-while-revalidate strategy
     * Returns cached rate immediately, fetches new rate in background if stale
     */
    async getUSDtoNPRRate() {
        const now = Date.now();
        // If cache exists and is not expired, return it immediately
        if (this.cache && now < this.cache.expiresAt) {
            console.log('[CurrencyService] Returning cached rate:', this.cache.rate);
            return this.cache.rate;
        }
        // If cache is stale but exists, return it and fetch new rate in background
        if (this.cache && now >= this.cache.expiresAt && !this.isFetching) {
            console.log('[CurrencyService] Cache stale, returning cached rate and fetching new one in background');
            this.fetchRateInBackground(); // Don't await - fire and forget
            return this.cache.rate;
        }
        // No cache exists, fetch synchronously
        console.log('[CurrencyService] No cache, fetching rate synchronously');
        return await this.fetchRate();
    }
    /**
     * Fetch exchange rate from API
     */
    async fetchRate() {
        try {
            this.isFetching = true;
            console.log('[CurrencyService] Fetching exchange rate from API...');
            const response = await axios_1.default.get(this.API_URL, {
                timeout: 5000 // 5 second timeout
            });
            const rate = response.data.rates.NPR;
            if (!rate || typeof rate !== 'number') {
                throw new Error('Invalid rate received from API');
            }
            const now = Date.now();
            this.cache = {
                rate,
                lastFetched: now,
                expiresAt: now + this.CACHE_DURATION
            };
            console.log('[CurrencyService] Successfully fetched rate:', rate);
            console.log('[CurrencyService] Cache expires at:', new Date(this.cache.expiresAt).toISOString());
            return rate;
        }
        catch (error) {
            console.error('[CurrencyService] Error fetching exchange rate:', error.message);
            // If we have a cached rate (even if expired), return it as fallback
            if (this.cache) {
                console.log('[CurrencyService] Using stale cache as fallback:', this.cache.rate);
                return this.cache.rate;
            }
            // Last resort: return a default rate
            const defaultRate = 132.5; // Approximate USD to NPR rate
            console.log('[CurrencyService] Using default rate:', defaultRate);
            return defaultRate;
        }
        finally {
            this.isFetching = false;
        }
    }
    /**
     * Fetch rate in background without blocking
     */
    fetchRateInBackground() {
        this.fetchRate().catch(error => {
            console.error('[CurrencyService] Background fetch failed:', error.message);
        });
    }
    /**
     * Convert amount from one currency to another
     */
    async convertCurrency(amount, fromCurrency, toCurrency) {
        // Same currency, no conversion needed
        if (fromCurrency === toCurrency) {
            return amount;
        }
        const rate = await this.getUSDtoNPRRate();
        if (fromCurrency === 'USD' && toCurrency === 'NPR') {
            // USD to NPR: multiply by rate
            return amount * rate;
        }
        else {
            // NPR to USD: divide by rate
            return amount / rate;
        }
    }
    /**
     * Get cache info for debugging
     */
    getCacheInfo() {
        if (!this.cache) {
            return { hasCache: false };
        }
        const now = Date.now();
        return {
            hasCache: true,
            rate: this.cache.rate,
            expiresAt: new Date(this.cache.expiresAt).toISOString(),
            isExpired: now >= this.cache.expiresAt
        };
    }
    /**
     * Force refresh the cache (for admin use)
     */
    async forceRefresh() {
        console.log('[CurrencyService] Force refreshing exchange rate...');
        this.cache = null; // Clear cache
        return await this.fetchRate();
    }
}
// Export singleton instance
exports.default = new CurrencyService();

import crypto from 'crypto';
import { logger } from './utils/logger';
import { Candle, Ticker } from './utils/types';

/**
 * Binance US API client for public and private endpoints
 * Handles rate limiting, retries, and error handling
 */
/**
 * Exchange info for a symbol (lot size and step size)
 */
interface SymbolInfo {
  minQty: number;
  stepSize: number;
  minNotional: number;
}

export class BinanceClient {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl = 'https://api.binance.us';
  private lastCallTime = 0;
  private timeOffset = 0;
  private lastTimeSync = 0;
  private symbolInfoCache: Map<string, SymbolInfo> = new Map();

  private readonly REQUEST_DELAY_MS = 100;
  private readonly MAX_RETRIES = 2;
  private readonly TIMEOUT_MS = 10000;
  private readonly TIME_SYNC_INTERVAL_MS = 60_000;

  constructor(apiKey: string, apiSecret: string) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }

  private async withRetry<T>(fn: () => Promise<T>, retries: number = this.MAX_RETRIES): Promise<T> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const timeSinceLastCall = Date.now() - this.lastCallTime;
        if (timeSinceLastCall < this.REQUEST_DELAY_MS) {
          await new Promise((resolve) => setTimeout(resolve, this.REQUEST_DELAY_MS - timeSinceLastCall));
        }

        this.lastCallTime = Date.now();
        return await this.withTimeout(fn(), this.TIMEOUT_MS);
      } catch (error: any) {
        if (error?.status === 429) {
          logger.warn('Binance API rate limit exceeded', { attempt });
          throw error;
        }

        if (error?.status === 401 || error?.status === 403) {
          throw error;
        }

        if (attempt === retries) {
          throw error;
        }

        const backoffMs = Math.pow(2, attempt) * 1000;
        logger.debug(`Binance API request failed, retrying in ${backoffMs}ms`, {
          attempt,
          error: error?.message,
        });
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }

    throw new Error('Max retries exceeded');
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject({ status: 408, message: 'Request timeout' }), timeoutMs)),
    ]);
  }

  private buildQuery(params: Record<string, string | number>): string {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      search.append(key, String(value));
    });
    return search.toString();
  }

  private mapSymbol(pair: string): string {
    const normalized = pair.toUpperCase();
    const mappings: Record<string, string> = {
      'BTC/USD': 'BTCUSD',
      'ETH/USD': 'ETHUSD',
      'BTC/USDT': 'BTCUSDT',
      'ETH/USDT': 'ETHUSDT',
    };

    if (mappings[normalized]) return mappings[normalized];
    return normalized.replace('/', '');
  }

  private async publicRequest<T>(endpoint: string, params: Record<string, string | number> = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, String(value));
    });

    return this.withRetry(async () => {
      const response = await fetch(url.toString());
      if (!response.ok) {
        const text = await response.text();
        throw { status: response.status, message: text || response.statusText };
      }
      return (await response.json()) as T;
    });
  }

  /**
   * Sync time offset with Binance server
   */
  private async syncTime(): Promise<void> {
    try {
      const data = await this.publicRequest<{ serverTime: number }>('/api/v3/time');
      if (data?.serverTime) {
        this.timeOffset = data.serverTime - Date.now();
        this.lastTimeSync = Date.now();
        logger.debug('Synced Binance server time', { offsetMs: this.timeOffset });
      }
    } catch (error) {
      logger.warn('Failed to sync Binance server time', { error });
    }
  }

  private async signedRequest<T>(
    method: 'GET' | 'POST' | 'DELETE',
    endpoint: string,
    params: Record<string, string | number> = {}
  ): Promise<T> {
    const now = Date.now();
    if (now - this.lastTimeSync > this.TIME_SYNC_INTERVAL_MS) {
      await this.syncTime().catch(() => undefined);
    }

    const timestamp = Date.now() + this.timeOffset;
    const query = this.buildQuery({ recvWindow: 20000, timestamp, ...params });
    const signature = crypto.createHmac('sha256', this.apiSecret).update(query).digest('hex');
    const signedQuery = `${query}&signature=${signature}`;

    const url = method === 'GET' ? `${this.baseUrl}${endpoint}?${signedQuery}` : `${this.baseUrl}${endpoint}`;
    const options: any = {
      method,
      headers: {
        'X-MBX-APIKEY': this.apiKey,
      },
    };

    if (method !== 'GET') {
      options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      options.body = signedQuery;
    }

    return this.withRetry(async () => {
      const response = await fetch(url, options);
      if (!response.ok) {
        const text = await response.text();
        let body: any = text;
        try {
          body = JSON.parse(text);
        } catch (e) {
          /* ignore */
        }
        throw { status: response.status, message: body?.msg || text || response.statusText, body };
      }
      return (await response.json()) as T;
    });
  }

  /**
   * Get OHLC candlestick data
   */
  async getOHLC(pair: string, interval: number = 15): Promise<Candle[]> {
    try {
      const symbol = this.mapSymbol(pair);
      const data = await this.publicRequest<any[]>(
        '/api/v3/klines',
        { symbol, interval: `${interval}m`, limit: 200 }
      );

      return data
        .slice(0, -1)
        .map((candle) => ({
          timestamp: Number(candle[0]),
          open: parseFloat(candle[1]),
          high: parseFloat(candle[2]),
          low: parseFloat(candle[3]),
          close: parseFloat(candle[4]),
          volume: parseFloat(candle[5]),
        }));
    } catch (error) {
      logger.logAPIError('getOHLC', error);
      return [];
    }
  }

  /**
   * Get current ticker data
   */
  async getTicker(pair: string): Promise<Ticker | null> {
    try {
      const symbol = this.mapSymbol(pair);

      const [book, stats] = await Promise.all([
        this.publicRequest<any>('/api/v3/ticker/bookTicker', { symbol }),
        this.publicRequest<any>('/api/v3/ticker/24hr', { symbol }),
      ]);

      const bid = parseFloat(book.bidPrice);
      const ask = parseFloat(book.askPrice);
      const price = parseFloat(stats.lastPrice || book.askPrice || book.bidPrice);
      const volume = parseFloat(stats.volume || '0');
      const spread = ask - bid;

      return { bid, ask, price, volume, spread };
    } catch (error) {
      logger.logAPIError('getTicker', error);
      return null;
    }
  }

  /**
   * Get symbol exchange info (min quantity, step size, etc.)
   * Caches result for performance
   */
  private async getSymbolInfo(symbol: string): Promise<SymbolInfo | null> {
    // Check cache first
    if (this.symbolInfoCache.has(symbol)) {
      return this.symbolInfoCache.get(symbol) || null;
    }

    try {
      const data = await this.publicRequest<any>('/api/v3/exchangeInfo', { symbol });
      if (!data?.symbols || data.symbols.length === 0) {
        logger.warn(`Symbol ${symbol} not found in exchange info`);
        return null;
      }

      const symbolData = data.symbols[0];
      let minQty = 0;
      let stepSize = 0;
      let minNotional = 0;

      // Extract LOT_SIZE filter
      const lotSizeFilter = symbolData.filters?.find((f: any) => f.filterType === 'LOT_SIZE');
      if (lotSizeFilter) {
        minQty = parseFloat(lotSizeFilter.minQty);
        stepSize = parseFloat(lotSizeFilter.stepSize);
      }

      // Extract MIN_NOTIONAL filter (minimum USD value)
      const minNotionalFilter = symbolData.filters?.find((f: any) => f.filterType === 'MIN_NOTIONAL');
      if (minNotionalFilter) {
        minNotional = parseFloat(minNotionalFilter.minNotional);
      }

      const info: SymbolInfo = { minQty, stepSize, minNotional };
      this.symbolInfoCache.set(symbol, info);

      logger.debug(`Cached symbol info for ${symbol}`, {
        minQty: minQty.toFixed(8),
        stepSize: stepSize.toFixed(8),
        minNotional: minNotional.toFixed(2),
      });

      return info;
    } catch (error) {
      logger.warn(`Failed to fetch symbol info for ${symbol}`, { error });
      return null;
    }
  }

  /**
   * Validate and round quantity to meet LOT_SIZE requirements
   * Returns rounded quantity or null if quantity is below minimum
   */
  private roundQuantityToStepSize(quantity: number, stepSize: number, minQty: number): number | null {
    if (stepSize === 0) {
      logger.warn('Step size is 0, cannot round quantity');
      return null;
    }

    // Round to step size
    const rounded = Math.floor(quantity / stepSize) * stepSize;

    // Check if below minimum
    if (rounded < minQty) {
      logger.warn(`Quantity ${quantity} rounds to ${rounded} which is below minimum ${minQty}`);
      return null;
    }

    return rounded;
  }

  /**
   * Get account balance
   */
  async getBalance(): Promise<Record<string, number> | null> {
    try {
      const data = await this.signedRequest<any>('GET', '/api/v3/account');

      const balance: Record<string, number> = {};
      if (Array.isArray(data?.balances)) {
        for (const asset of data.balances) {
          const total = parseFloat(asset.free || '0') + parseFloat(asset.locked || '0');
          balance[asset.asset] = total;
        }
      }

      logger.debug('Binance balance fetched successfully', {
        assets: Object.keys(balance).length,
        usd: balance.USD ? `$${balance.USD.toFixed(2)}` : 'N/A',
      });

      return balance;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String((error as any)?.message || error);
      logger.error('Failed to fetch Binance balance', { error: errorMsg });
      return null;
    }
  }

  /**
   * Place market order with LOT_SIZE validation
   */
  async placeOrder(
    pair: string,
    side: 'buy' | 'sell',
    volume: number,
    orderType: string = 'MARKET'
  ): Promise<string | null> {
    try {
      if (!this.apiKey || !this.apiSecret) {
        logger.error('API credentials not configured');
        return null;
      }

      const symbol = this.mapSymbol(pair);

      // Fetch symbol info and validate quantity
      const symbolInfo = await this.getSymbolInfo(symbol);
      let finalQuantity = volume;

      if (symbolInfo) {
        // Round to step size
        const rounded = this.roundQuantityToStepSize(volume, symbolInfo.stepSize, symbolInfo.minQty);
        if (rounded === null) {
          logger.error(
            `Order quantity ${volume} does not meet LOT_SIZE requirements for ${pair}`,
            {
              pair,
              requestedQuantity: volume,
              minimumQuantity: symbolInfo.minQty,
              stepSize: symbolInfo.stepSize,
            }
          );
          return null;
        }
        finalQuantity = rounded;

        if (Math.abs(finalQuantity - volume) > 0.00000001) {
          logger.debug(`Quantity rounded for LOT_SIZE compliance`, {
            pair,
            original: volume,
            rounded: finalQuantity,
            stepSize: symbolInfo.stepSize,
          });
        }
      }

      const params: Record<string, string | number> = {
        symbol,
        side: side.toUpperCase(),
        type: orderType.toUpperCase(),
        quantity: finalQuantity.toFixed(8),
        newOrderRespType: 'FULL',
      };

      const data = await this.signedRequest<any>('POST', '/api/v3/order', params);

      if (data.orderId) {
        logger.info(`Order placed: ${side.toUpperCase()} ${finalQuantity} ${pair}`, {
          pair,
          side,
          volume: finalQuantity,
          orderId: data.orderId,
        });
        return String(data.orderId);
      }

      return null;
    } catch (error) {
      logger.logAPIError('placeOrder', error);
      return null;
    }
  }

  /**
   * Get open orders
   */
  async getOpenOrders(): Promise<Record<string, any>[] | null> {
    try {
      const data = await this.signedRequest<Record<string, any>[]>('GET', '/api/v3/openOrders');
      return data;
    } catch (error) {
      logger.logAPIError('getOpenOrders', error);
      return null;
    }
  }

  /**
   * Cancel order (attempts to infer symbol from open orders)
   */
  async cancelOrder(orderId: string): Promise<boolean> {
    try {
      const openOrders = await this.getOpenOrders();
      const matching = openOrders?.find((o) => String(o.orderId) === String(orderId));

      if (!matching) {
        logger.warn('Order not found among open orders', { orderId });
        return false;
      }

      await this.signedRequest('DELETE', '/api/v3/order', {
        symbol: matching.symbol,
        orderId,
      });

      logger.info('Order cancelled', { orderId });
      return true;
    } catch (error) {
      logger.logAPIError('cancelOrder', error);
      return false;
    }
  }

  /**
   * Get closed orders for a symbol
   */
  async getClosedOrders(pair?: string): Promise<Record<string, any>[] | null> {
    try {
      if (!pair) return [];
      const symbol = this.mapSymbol(pair);
      const data = await this.signedRequest<Record<string, any>[]>('GET', '/api/v3/allOrders', { symbol, limit: 50 });
      return data.filter((order) => order.status !== 'NEW' && order.status !== 'PARTIALLY_FILLED');
    } catch (error) {
      logger.logAPIError('getClosedOrders', error);
      return null;
    }
  }

  /**
   * Get specific orders by ID for a symbol
   */
  async queryOrders(txids: string[], pair?: string): Promise<Record<string, any>[] | null> {
    try {
      if (!pair) return null;
      const symbol = this.mapSymbol(pair);
      const orders = await this.signedRequest<Record<string, any>[]>('GET', '/api/v3/allOrders', {
        symbol,
        limit: 100,
      });
      return orders.filter((order) => txids.includes(String(order.orderId)));
    } catch (error) {
      logger.logAPIError('queryOrders', error);
      return null;
    }
  }
}

export default BinanceClient;

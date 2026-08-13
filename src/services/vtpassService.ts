import axios, { AxiosInstance } from 'axios';
import logger from '../lib/log/winston.log';

export type VtpassServiceItem = {
  serviceID: string;
  name: string;
  minimium_amount?: string;
  maximum_amount?: string;
  convinience_fee?: string;
  product_type?: string;
  image?: string;
};

export type VtpassVariation = {
  variation_code: string;
  name: string;
  variation_amount: string;
  fixedPrice?: string;
};

export type VtpassVerifyResult = {
  valid: boolean;
  customerName?: string;
  customerAddress?: string;
  customerNumber?: string;
  minPurchaseAmount?: number;
  canVend?: boolean;
  currentBouquet?: string;
  renewalAmount?: number;
  raw?: Record<string, unknown>;
};

export type VtpassPayResult = {
  requestId: string;
  status: string;
  transactionId?: string;
  token?: string;
  units?: string;
  purchasedCode?: string;
  raw: Record<string, unknown>;
};

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw Object.assign(
      new Error(`${name} is required to load live billers. Add it to the backend .env.`),
      { status: 503 }
    );
  }
  return value;
}

/** YYYYMMDDHHmm in Africa/Lagos, then alphanumeric. https://vtpass.com/documentation/how-to-generate-request-id/ */
function requestId() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  const stamp = `${get('year')}${get('month')}${get('day')}${get('hour')}${get('minute')}`;
  if (stamp.length !== 12 || !/^\d{12}$/.test(stamp)) {
    throw Object.assign(new Error('Could not generate a valid VTpass request ID'), { status: 500 });
  }
  return `${stamp}${Math.random().toString(36).slice(2, 10)}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractToken(data: any): string | undefined {
  const token =
    data?.Token ||
    data?.token ||
    data?.purchased_code ||
    data?.content?.transactions?.extras;
  if (!token) return undefined;
  return String(token).replace(/^Token\s*:\s*/i, '').trim() || undefined;
}

class VtpassClient {
  private cache = new Map<string, { at: number; data: unknown }>();
  private ttlMs = 10 * 60 * 1000;

  /**
   * GET uses api-key + public-key.
   * POST uses api-key + secret-key.
   * https://vtpass.com/documentation/authentication/
   */
  private client(method: 'GET' | 'POST'): AxiosInstance {
    const apiKey = requiredEnv('VTPASS_API_KEY');
    const baseURL = process.env.VTPASS_BASE_URL || 'https://sandbox.vtpass.com/api';
    const headers: Record<string, string> = {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    };
    if (method === 'GET') {
      headers['public-key'] = requiredEnv('VTPASS_PUBLIC_KEY');
    } else {
      headers['secret-key'] = requiredEnv('VTPASS_SECRET_KEY');
    }

    return axios.create({
      baseURL,
      timeout: 25000,
      headers,
    });
  }

  private async cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < this.ttlMs) {
      return hit.data as T;
    }
    const data = await loader();
    this.cache.set(key, { at: Date.now(), data });
    return data;
  }

  async listServices(identifier: string): Promise<VtpassServiceItem[]> {
    return this.cached(`services:${identifier}`, async () => {
      const response = await this.client('GET').get('/services', { params: { identifier } });
      const content = response.data?.content;
      if (!Array.isArray(content)) {
        logger.error('Unexpected VTpass services payload', { identifier, data: response.data });
        throw Object.assign(new Error('Could not load providers right now'), { status: 502 });
      }
      return content as VtpassServiceItem[];
    });
  }

  async listVariations(serviceID: string): Promise<VtpassVariation[]> {
    return this.cached(`variations:${serviceID}`, async () => {
      const response = await this.client('GET').get('/service-variations', {
        params: { serviceID },
      });
      const variations = response.data?.content?.variations;
      if (!Array.isArray(variations)) {
        logger.error('Unexpected VTpass variations payload', { serviceID, data: response.data });
        throw Object.assign(new Error('Could not load plans right now'), { status: 502 });
      }
      return variations as VtpassVariation[];
    });
  }

  async verifyCustomer(input: {
    serviceID: string;
    billersCode: string;
    type?: 'prepaid' | 'postpaid';
  }): Promise<VtpassVerifyResult> {
    const payload: Record<string, string> = {
      serviceID: input.serviceID,
      billersCode: input.billersCode,
    };
    if (input.type) payload.type = input.type;

    const response = await this.client('POST').post('/merchant-verify', payload);
    const data = response.data ?? {};
    const content = data.content ?? {};
    const code = String(data.code ?? '');
    const wrong = content.WrongBillersCode === true || content.WrongBillersCode === 'true';
    const canVend = String(content.Can_Vend ?? 'yes').toLowerCase() !== 'no';
    const customerName =
      content.Customer_Name ||
      content.customer_name ||
      content.CustomerName ||
      content.name;

    if (wrong || !canVend || !customerName || (code && !['000', '020'].includes(code))) {
      return { valid: false, raw: content };
    }

    return {
      valid: true,
      customerName: String(customerName),
      customerAddress: content.Address || content.Customer_Address,
      customerNumber: content.Customer_Number || content.MeterNumber || input.billersCode,
      minPurchaseAmount: Number(content.Min_Purchase_Amount) || undefined,
      canVend,
      currentBouquet: content.Current_Bouquet || content.Customer_Type,
      renewalAmount: Number(content.Renewal_Amount) || undefined,
      raw: content,
    };
  }

  async requery(id: string) {
    const response = await this.client('POST').post('/requery', { request_id: id });
    return response.data;
  }

  async pay(input: {
    kind: 'AIRTIME' | 'DATA' | 'ELECTRICITY' | 'TELEVISION';
    serviceID: string;
    billersCode: string;
    amount: number;
    phone: string;
    variationCode?: string;
    subscriptionType?: 'change' | 'renew';
  }): Promise<VtpassPayResult> {
    const id = requestId();
    const body: Record<string, string | number> = {
      request_id: id,
      serviceID: input.serviceID,
      phone: input.phone,
    };

    if (input.kind === 'AIRTIME') {
      body.amount = input.amount;
    } else if (input.kind === 'DATA') {
      body.billersCode = input.billersCode;
      if (!input.variationCode) {
        throw Object.assign(new Error('Select a valid data plan'), { status: 400 });
      }
      body.variation_code = input.variationCode;
      body.amount = input.amount;
    } else if (input.kind === 'ELECTRICITY') {
      body.billersCode = input.billersCode;
      body.variation_code = input.variationCode || 'prepaid';
      body.amount = input.amount;
    } else {
      body.billersCode = input.billersCode;
      if (!input.variationCode) {
        throw Object.assign(new Error('Select a valid bouquet'), { status: 400 });
      }
      body.variation_code = input.variationCode;
      body.amount = input.amount;
      body.subscription_type = input.subscriptionType || 'change';
      body.quantity = 1;
    }

    let data: any;
    try {
      const response = await this.client('POST').post('/pay', body);
      data = response.data;
    } catch (error: any) {
      if (!error.response) {
        data = await this.pollRequery(id);
      } else {
        throw Object.assign(
          new Error(error.response?.data?.response_description || 'Bill payment failed'),
          { status: 400, raw: error.response?.data }
        );
      }
    }

    data = await this.resolvePayResult(id, data);
    const status = String(data?.content?.transactions?.status ?? '').toLowerCase();
    const code = String(data?.code ?? '');

    if (code === '000' && status === 'delivered') {
      return {
        requestId: data.requestId || id,
        status,
        transactionId: data?.content?.transactions?.transactionId,
        token: extractToken(data),
        units: data?.Units || data?.units,
        purchasedCode: data?.purchased_code,
        raw: data,
      };
    }

    const failed = ['016', '091', '010', '011', '012', '013', '017', '018', '019', '030', '034', '035'];
    if (failed.includes(code) || status === 'failed') {
      throw Object.assign(
        new Error(data?.response_description || 'Bill payment failed'),
        { status: 400, raw: data }
      );
    }

    throw Object.assign(
      new Error(
        data?.response_description ||
          'Payment is still processing. Please wait a moment and check your receipt before retrying.'
      ),
      { status: 409, raw: data, pending: true }
    );
  }

  private async resolvePayResult(id: string, data: any) {
    const code = String(data?.code ?? '');
    const status = String(data?.content?.transactions?.status ?? '').toLowerCase();
    if (code === '000' && status === 'delivered') return data;
    if (code === '099' || status === 'pending' || status === 'initiated' || !data) {
      return this.pollRequery(id);
    }
    return data;
  }

  private async pollRequery(id: string) {
    let last: any;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await sleep(1500 * (attempt + 1));
      last = await this.requery(id);
      const code = String(last?.code ?? '');
      const status = String(last?.content?.transactions?.status ?? '').toLowerCase();
      if (code === '000' && status === 'delivered') return last;
      if (['016', '091', '010', '011', '012', '013', '017', '018'].includes(code)) return last;
    }
    return last;
  }
}

export const vtpassService = new VtpassClient();
export default vtpassService;

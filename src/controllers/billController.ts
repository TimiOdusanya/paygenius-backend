import { Response } from 'express';
import { IAuthRequest } from '../types';
import { BillService, BillCategory, PaymentSource } from '../services/billService';
import logger from '../lib/log/winston.log';

const CATEGORIES: BillCategory[] = ['AIRTIME', 'DATA', 'ELECTRICITY', 'TELEVISION'];

function asCategory(value: unknown): BillCategory | null {
  const key = String(value ?? '').toUpperCase() as BillCategory;
  return CATEGORIES.includes(key) ? key : null;
}

function sendServiceError(res: Response, error: any, logLabel: string) {
  if (error?.status) {
    res.status(error.status).json({ success: false, message: error.message });
    return;
  }
  logger.error(logLabel, error);
  res.status(500).json({ success: false, message: 'Internal server error' });
}

export const listBillers = async (req: IAuthRequest, res: Response): Promise<void> => {
  try {
    const category = asCategory(req.query.category);
    const billers = await BillService.listBillers(category ?? undefined);
    res.status(200).json({
      success: true,
      message: 'Billers retrieved successfully',
      data: { billers },
    });
  } catch (error: any) {
    sendServiceError(res, error, 'List billers error:');
  }
};

export const listPlans = async (req: IAuthRequest, res: Response): Promise<void> => {
  try {
    const billerCode = typeof req.query.billerCode === 'string' ? req.query.billerCode : '';
    const plans = await BillService.listPlans(billerCode);
    res.status(200).json({
      success: true,
      message: 'Plans retrieved successfully',
      data: { plans },
    });
  } catch (error: any) {
    sendServiceError(res, error, 'List plans error:');
  }
};

export const validateCustomer = async (req: IAuthRequest, res: Response): Promise<void> => {
  try {
    const category = asCategory(req.body?.category);
    if (!category) {
      res.status(400).json({ success: false, message: 'A valid bill category is required' });
      return;
    }
    const meterType =
      req.body?.meterType === 'postpaid' || req.body?.meterType === 'prepaid'
        ? req.body.meterType
        : undefined;
    const data = await BillService.validateCustomer({
      category,
      billerCode: String(req.body?.billerCode ?? ''),
      customerId: String(req.body?.customerId ?? ''),
      meterType,
    });
    res.status(200).json({
      success: true,
      message: 'Customer validated successfully',
      data,
    });
  } catch (error: any) {
    sendServiceError(res, error, 'Validate bill customer error:');
  }
};

export const payBill = async (req: IAuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!._id.toString();
    const category = asCategory(req.body?.category);
    if (!category) {
      res.status(400).json({ success: false, message: 'A valid bill category is required' });
      return;
    }

    const paymentSource = String(req.body?.paymentSource ?? 'WALLET').toUpperCase() as PaymentSource;
    if (paymentSource !== 'WALLET' && paymentSource !== 'BUDGET') {
      res.status(400).json({ success: false, message: 'Payment source must be WALLET or BUDGET' });
      return;
    }

    const meterType =
      req.body?.meterType === 'postpaid' || req.body?.meterType === 'prepaid'
        ? req.body.meterType
        : undefined;

    const payment = await BillService.payBill(userId, {
      category,
      billerCode: String(req.body?.billerCode ?? ''),
      customerId: String(req.body?.customerId ?? ''),
      amount: Number(req.body?.amount),
      pin: req.body?.pin,
      useBiometric: Boolean(req.body?.useBiometric),
      paymentSource,
      budgetId: req.body?.budgetId,
      planCode: req.body?.planCode,
      planName: req.body?.planName,
      meterType,
    });

    res.status(200).json({
      success: true,
      message: 'Bill paid successfully',
      data: { payment },
    });
  } catch (error: any) {
    sendServiceError(res, error, 'Pay bill error:');
  }
};

export const getPayment = async (req: IAuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!._id.toString();
    const payment = await BillService.getPayment(userId, req.params.id);
    if (!payment) {
      res.status(404).json({ success: false, message: 'Payment not found' });
      return;
    }
    res.status(200).json({
      success: true,
      message: 'Payment retrieved successfully',
      data: { payment },
    });
  } catch (error: any) {
    sendServiceError(res, error, 'Get bill payment error:');
  }
};

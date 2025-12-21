// src/bank-accounts/dto/bank-account-transaction.dto.ts
import { IsOptional, IsDateString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO para filtrar transacciones de una cuenta bancaria
 */
export class BankAccountTransactionQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @IsOptional()
  search?: string; // Para buscar por cliente o número de factura
}

/**
 * Interfaz para información del cliente en la transacción
 */
export interface TransactionCustomer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

/**
 * Interfaz para información de la factura en la transacción
 */
export interface TransactionInvoice {
  id: string;
  invoiceNumber: string;
  total: number;
}

/**
 * Interfaz para una transacción individual
 */
export interface BankAccountTransaction {
  id: string;
  date: Date;
  type: 'invoice_payment' | 'credit_payment';
  amount: number;
  customer: TransactionCustomer | null;
  invoice: TransactionInvoice | null;
  paymentMethod: string;
  description: string;
  notes?: string;
}

/**
 * Interfaz para el resumen de transacciones de un período
 */
export interface TransactionsSummary {
  totalIncome: number;
  transactionCount: number;
  periodStart: Date | null;
  periodEnd: Date | null;
  averageTransaction: number;
}

/**
 * Interfaz para la paginación
 */
export interface TransactionsPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Interfaz para información de la cuenta en la respuesta
 */
export interface TransactionAccountInfo {
  id: string;
  name: string;
  type: string;
  currentBalance: number;
  bankName?: string;
  accountNumber?: string;
}

/**
 * Respuesta completa del endpoint de transacciones
 */
export interface BankAccountTransactionsResponse {
  account: TransactionAccountInfo;
  transactions: BankAccountTransaction[];
  pagination: TransactionsPagination;
  summary: TransactionsSummary;
}

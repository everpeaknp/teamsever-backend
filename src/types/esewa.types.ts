/**
 * eSewa v2 Payment Integration Types
 * Documentation: https://developer.esewa.com.np
 */

export interface EsewaPaymentRequest {
  amount: number;
  tax_amount: number;
  product_service_charge: number;
  product_delivery_charge: number;
  total_amount: number;
  transaction_uuid: string;
  product_code: string;
  success_url: string;
  failure_url: string;
  signed_field_names: string;
  signature: string;
}

export interface EsewaStatusResponse {
  product_code: string;
  transaction_uuid: string;
  total_amount: string;
  status: "COMPLETE" | "PENDING" | "FULL_REFUND" | "CANCELED" | "NOT_FOUND";
  ref_id: string | null;
}

export interface EsewaPaymentData {
  transaction_code: string;
  status: string;
  total_amount: string;
  transaction_uuid: string;
  product_code: string;
  signed_field_names: string;
  signature: string;
}

export interface EsewaConfig {
  merchantCode: string;
  secretKey: string;
  paymentUrl: string;
  statusUrl: string;
  successUrl: string;
  failureUrl: string;
}

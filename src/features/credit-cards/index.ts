export {
  CARD_BRAND_LABELS,
  type CardBrand,
  type CardPurchase,
  type CardPurchaseStatus,
  type CardStatus,
  type CreditCard,
} from './domain/entities/credit-card';
export type { CreditCardRepository } from './domain/repositories/credit-card.repository';
export {
  expandInstallments,
  getInvoiceDates,
  getInvoiceMonthForPurchase,
  type CardInstallment,
  type InvoiceDates,
} from './domain/services/invoice-schedule';
export {
  buildInvoiceForMonth,
  buildInvoices,
  computeCardDebt,
  computeLimitUsage,
  getCardInstallments,
  getCardPayments,
  getOpenInvoiceMonth,
  INVOICE_STATUS_LABELS,
  type CardLimitUsage,
  type Invoice,
  type InvoiceStatus,
} from './domain/services/invoices';
export {
  cardPurchaseRecordSchema,
  cardPurchaseToRecord,
  creditCardRecordSchema,
  creditCardToRecord,
} from './infrastructure/credit-card.records';
export {
  ApiCreditCardRepository,
  CREDIT_CARD_ENDPOINTS,
  DemoCreditCardRepository,
} from './infrastructure/credit-card.repositories';

// Fase 5 — escrita e casos de uso
export {
  CARD_INSTITUTION_MAX_LENGTH,
  CARD_NAME_MAX_LENGTH,
  CreditCardError,
  MAX_CARD_INSTALLMENTS,
  type CreditCardErrorCode,
} from './domain/rules/card-rules';
export type { CreditCardContext } from './application/card-context';
export { CARD_STATUS_LABELS, type CardInput } from './application/card-commands';
export type { PurchaseInput } from './application/purchase-commands';
export type { PayInvoiceInput } from './application/invoice-commands';
export type {
  CardDetails,
  CardOverview,
  CardsSummary,
  FutureMonth,
  PaymentView,
  PurchaseView,
} from './application/card-queries';
export {
  createCreditCardUseCases,
  type CreditCardUseCases,
} from './application/credit-card-use-cases';
export {
  CreditCardsServicesContext,
  useCreditCardsServices,
  type CreditCardsServices,
} from './presentation/context/credit-cards-context';
export * from './presentation/hooks/use-credit-cards';

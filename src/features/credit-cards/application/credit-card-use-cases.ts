import {
  CreateCardUseCase,
  DeleteCardUseCase,
  SetCardStatusUseCase,
  UpdateCardUseCase,
} from './card-commands';
import type { CreditCardContext } from './card-context';
import { GetCardDetailsUseCase, ListCardsUseCase } from './card-queries';
import { PayInvoiceUseCase, ReversePaymentUseCase } from './invoice-commands';
import {
  CancelPurchaseUseCase,
  RegisterPurchaseUseCase,
  UpdatePurchaseUseCase,
} from './purchase-commands';

export interface CreditCardUseCases {
  list: ListCardsUseCase;
  details: GetCardDetailsUseCase;
  createCard: CreateCardUseCase;
  updateCard: UpdateCardUseCase;
  setStatus: SetCardStatusUseCase;
  deleteCard: DeleteCardUseCase;
  registerPurchase: RegisterPurchaseUseCase;
  updatePurchase: UpdatePurchaseUseCase;
  cancelPurchase: CancelPurchaseUseCase;
  payInvoice: PayInvoiceUseCase;
  reversePayment: ReversePaymentUseCase;
}

export function createCreditCardUseCases(context: CreditCardContext): CreditCardUseCases {
  return {
    list: new ListCardsUseCase(context),
    details: new GetCardDetailsUseCase(context),
    createCard: new CreateCardUseCase(context),
    updateCard: new UpdateCardUseCase(context),
    setStatus: new SetCardStatusUseCase(context),
    deleteCard: new DeleteCardUseCase(context),
    registerPurchase: new RegisterPurchaseUseCase(context),
    updatePurchase: new UpdatePurchaseUseCase(context),
    cancelPurchase: new CancelPurchaseUseCase(context),
    payInvoice: new PayInvoiceUseCase(context),
    reversePayment: new ReversePaymentUseCase(context),
  };
}

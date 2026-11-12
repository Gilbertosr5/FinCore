import type { IsoDate } from '@/lib/dates';
import { formatMoney, type Money } from '@/lib/money';

import { auditEntry, type LedgerContext } from './ledger-context';
import type { Transaction } from '../domain/entities/transaction';
import { TransactionError } from '../domain/errors/transaction-error';
import {
  assertCategoryMatches,
  assertPaidDate,
  assertUsableAccount,
  assertValidAmount,
  normalizeDescription,
} from '../domain/rules/transaction-rules';

export interface InvestmentLedgerInput {
  /**
   * application = dinheiro sai da conta para a carteira; redemption = volta à
   * conta (ambos `kind: investment`, nunca receita/despesa); income = proventos
   * recebidos na conta (receita com categoria).
   */
  flow: 'application' | 'redemption' | 'income';
  accountId: string;
  assetId: string;
  amount: Money;
  date: IsoDate;
  description: string;
  /** Obrigatória para `income` (categoria de receita). */
  categoryId: string | null;
}

/**
 * Lançamentos de conta gerados pelo módulo de investimentos (ADR 0012). São
 * "gerenciados": não podem ser editados pela tela de Transações (ADR 0009) —
 * só criados e removidos por aqui, junto com a movimentação da carteira.
 */
export class InvestmentLedgerCommands {
  constructor(private readonly context: LedgerContext) {}

  async record(input: InvestmentLedgerInput): Promise<string> {
    assertValidAmount(input.amount);
    assertPaidDate(input.date, this.context.today());
    assertUsableAccount((await this.context.accounts.findById(input.accountId)) ?? undefined);
    const description = normalizeDescription(input.description);
    if (input.flow === 'income') {
      if (input.categoryId === null) {
        throw new TransactionError('category_not_found', 'Escolha a categoria dos proventos.');
      }
      const categories = await this.context.categories.findAll();
      assertCategoryMatches(
        categories.find((item) => item.id === input.categoryId),
        'income',
      );
    }
    const transaction: Transaction = {
      id: this.context.newId(),
      kind: input.flow === 'income' ? 'income' : 'investment',
      description,
      amount: input.amount,
      accountId: input.accountId,
      categoryId: input.flow === 'income' ? input.categoryId : null,
      competenceDate: input.date,
      dueDate: null,
      paidDate: input.date,
      status: 'paid',
      transfer: null,
      cardPayment: null,
      investment:
        input.flow === 'income' ? null : { assetId: input.assetId, direction: input.flow },
      recurrenceId: null,
      installment: null,
      tags: [],
      notes: null,
    };
    await this.context.transactions.commit({ upsert: [transaction] });
    await this.context.audit.append([
      auditEntry(
        this.context,
        'transaction',
        transaction.id,
        'created',
        `${description}: ${formatMoney(input.amount)} (registrado em Investimentos).`,
      ),
    ]);
    return transaction.id;
  }

  /** Remove o lançamento vinculado (ignora se já foi excluído). */
  async remove(transactionId: string): Promise<void> {
    const transaction = await this.context.transactions.findById(transactionId);
    if (!transaction) return;
    await this.context.transactions.commit({ remove: [transactionId] });
    await this.context.audit.append([
      auditEntry(
        this.context,
        'transaction',
        transactionId,
        'deleted',
        `Excluído junto com a movimentação de investimento: ${transaction.description}.`,
      ),
    ]);
  }
}

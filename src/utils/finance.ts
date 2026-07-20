import { Expense, Member, Settlement } from '../types';

export const CATEGORIES = [
  { id: 'general', label: 'General', emoji: '📦', color: '#ff7e33' },
  { id: 'food', label: 'Food & Drinks', emoji: '🍔', color: '#FF6B8B' },
  { id: 'transport', label: 'Transport', emoji: '🚗', color: '#38bdf8' },
  { id: 'rent', label: 'Rent/Living', emoji: '🏠', color: '#a855f7' },
  { id: 'entertainment', label: 'Entertainment', emoji: '🍿', color: '#FFE600' },
  { id: 'utilities', label: 'Utilities', emoji: '⚡', color: '#14b8a6' },
];

/**
 * Calculates the individual net balances of all members in a group.
 * A positive balance means they are owed money (creditor).
 * A negative balance means they owe money (debtor).
 */
export function calculateBalances(members: Member[], expenses: Expense[]): Record<string, number> {
  const balances: Record<string, number> = {};

  // Initialize balances for all members
  members.forEach((m) => {
    balances[m.id] = 0;
  });

  expenses.forEach((expense) => {
    const { amount, paidById, splitWithIds, splitType, shares } = expense;
    
    // Ignore expenses with no splitters or zero amount
    if (splitWithIds.length === 0 || amount <= 0) return;

    // Credit the payer
    if (balances[paidById] !== undefined) {
      balances[paidById] += amount;
    }

    // Debit the splitters based on splitType
    if (splitType === 'equal') {
      const share = amount / splitWithIds.length;
      splitWithIds.forEach((memberId) => {
        if (balances[memberId] !== undefined) {
          balances[memberId] -= share;
        }
      });
    } else if (splitType === 'unequal') {
      splitWithIds.forEach((memberId) => {
        const share = shares[memberId] || 0;
        if (balances[memberId] !== undefined) {
          balances[memberId] -= share;
        }
      });
    } else if (splitType === 'percentage') {
      splitWithIds.forEach((memberId) => {
        const percentage = shares[memberId] || 0;
        const share = (amount * percentage) / 100;
        if (balances[memberId] !== undefined) {
          balances[memberId] -= share;
        }
      });
    }
  });

  return balances;
}

/**
 * Splitwise Debt Simplification Algorithm (Greedy Minimize Cash Flow)
 * Simplifies all debts into the minimum number of high-level transactions.
 */
export function simplifyDebts(balances: Record<string, number>): Settlement[] {
  const settlements: Settlement[] = [];

  // Filter out people with near-zero balances (floating-point thresholds)
  const participants = Object.entries(balances)
    .map(([id, balance]) => ({ id, balance: Math.round(balance * 100) / 100 }))
    .filter((p) => Math.abs(p.balance) > 0.01);

  // Separate into debtors and creditors
  const debtors = participants
    .filter((p) => p.balance < 0)
    .map((p) => ({ id: p.id, debt: -p.balance }))
    .sort((a, b) => b.debt - a.debt); // Sort descending

  const creditors = participants
    .filter((p) => p.balance > 0)
    .map((p) => ({ id: p.id, credit: p.balance }))
    .sort((a, b) => b.credit - a.credit); // Sort descending

  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const amount = Math.min(debtor.debt, creditor.credit);

    if (amount > 0.01) {
      settlements.push({
        fromId: debtor.id,
        toId: creditor.id,
        amount: Math.round(amount * 100) / 100,
      });
    }

    debtor.debt -= amount;
    creditor.credit -= amount;

    if (debtor.debt < 0.01) {
      dIdx++;
    }
    if (creditor.credit < 0.01) {
      cIdx++;
    }
  }

  return settlements;
}

/**
 * Returns a beautiful pre-defined avatar configuration based on initials or seed.
 */
export const AVATAR_EMOJIS = ['🦊', '🐱', '🐼', '🐨', '🐯', '🐸', '🐙', '🦖', '🦁', '🦉', '🐷', '🐵', '🐹', '🐻'];
export const AVATAR_COLORS = [
  '#FF6B8B', // Neo-pink
  '#38bdf8', // Neo-blue
  '#FFE600', // Neo-yellow
  '#a855f7', // Neo-purple
  '#22c55e', // Neo-green
  '#ff7e33', // Neo-orange
  '#14b8a6', // Neo-teal
];

export function getRandomAvatar(): { emoji: string; color: string } {
  const emoji = AVATAR_EMOJIS[Math.floor(Math.random() * AVATAR_EMOJIS.length)];
  const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
  return { emoji, color };
}

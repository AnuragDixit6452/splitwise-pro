import type { Expense, Group, Member } from '../src/types.js';

const INITIAL_PEOPLE = [
  { name: 'Mark', emoji: '🦊', color: '#38bdf8' },
  { name: 'Anurag', emoji: '🐼', color: '#22c55e' },
  { name: 'Priya', emoji: '🐱', color: '#FF6B8B' },
  { name: 'Tahir', emoji: '🦁', color: '#ff7e33' },
  { name: 'Deep', emoji: '🐙', color: '#a855f7' },
  { name: 'Nitikiet', emoji: '🐨', color: '#14b8a6' },
  { name: 'Shikha', emoji: '🐹', color: '#FFE600' },
];

const INITIAL_EXPENSES_DATA: Array<{
  title: string;
  amount: number;
  paidBy: string;
  category: string;
  splitWith: 'all' | string[];
}> = [
  { title: 'Petrol', amount: 4004, paidBy: 'Anurag', category: 'transport', splitWith: 'all' },
  { title: 'Seven Eleven', amount: 1519, paidBy: 'Shikha', category: 'food', splitWith: 'all' },
  { title: 'Vig', amount: 1484, paidBy: 'Shikha', category: 'general', splitWith: 'all' },
  { title: 'Chai', amount: 140, paidBy: 'Priya', category: 'food', splitWith: 'all' },
  { title: 'kokam', amount: 441, paidBy: 'Mark', category: 'food', splitWith: 'all' },
  { title: 'Water', amount: 35, paidBy: 'Mark', category: 'food', splitWith: 'all' },
  { title: 'Masala Papad', amount: 112, paidBy: 'Mark', category: 'food', splitWith: 'all' },
  { title: 'Veg (lunch)', amount: 534, paidBy: 'Mark', category: 'food', splitWith: ['Mark', 'Anurag'] },
  {
    title: 'Non-Veg (lunch)',
    amount: 3110,
    paidBy: 'Mark',
    category: 'food',
    splitWith: ['Mark', 'Priya', 'Tahir', 'Deep', 'Nitikiet', 'Shikha'],
  },
  { title: 'Blinkit', amount: 1442, paidBy: 'Mark', category: 'general', splitWith: 'all' },
  { title: 'Veg Dinner', amount: 1830, paidBy: 'Anurag', category: 'food', splitWith: ['Mark', 'Anurag'] },
  {
    title: 'Non-Veg Dinner',
    amount: 2485,
    paidBy: 'Anurag',
    category: 'food',
    splitWith: ['Mark', 'Priya', 'Tahir', 'Deep', 'Nitikiet', 'Shikha'],
  },
  { title: 'Kaka', amount: 945, paidBy: 'Tahir', category: 'general', splitWith: 'all' },
  { title: 'Breakfast', amount: 1085, paidBy: 'Mark', category: 'food', splitWith: 'all' },
  { title: 'Pizza (veg)', amount: 1350, paidBy: 'Mark', category: 'food', splitWith: ['Mark', 'Anurag'] },
  {
    title: 'Pizza (non-veg)',
    amount: 2265,
    paidBy: 'Mark',
    category: 'food',
    splitWith: ['Mark', 'Priya', 'Tahir', 'Deep', 'Nitikiet', 'Shikha'],
  },
  { title: 'Pizza Common', amount: 224, paidBy: 'Mark', category: 'food', splitWith: 'all' },
  { title: 'Diesel', amount: 1200, paidBy: 'Tahir', category: 'transport', splitWith: 'all' },
  { title: 'Villa', amount: 20020, paidBy: 'Tahir', category: 'rent', splitWith: 'all' },
];

export function buildDefaultTrip(): {
  groups: Group[];
  members: Member[];
  expenses: Expense[];
  activeGroupId: string;
} {
  const defaultGroup: Group = {
    id: 'trip-settlement-group',
    name: 'Trip_Expense_Settlement',
    description: 'Personal trip group expense calculations securely auto-settled.',
    createdAt: new Date().toISOString(),
  };

  const members: Member[] = INITIAL_PEOPLE.map((p, idx) => ({
    id: `member-${idx}`,
    groupId: defaultGroup.id,
    name: p.name,
    avatarEmoji: p.emoji,
    avatarBgColor: p.color,
  }));

  const expenses: Expense[] = INITIAL_EXPENSES_DATA.map((e, idx) => {
    const payerObj = members.find((m) => m.name === e.paidBy);
    const paidById = payerObj ? payerObj.id : members[0].id;

    let splitWithIds: string[] = [];
    if (e.splitWith === 'all') {
      splitWithIds = members.map((m) => m.id);
    } else {
      splitWithIds = e.splitWith.map((name) => {
        const mObj = members.find((m) => m.name === name);
        return mObj ? mObj.id : members[0].id;
      });
    }

    return {
      id: `expense-${idx}`,
      groupId: defaultGroup.id,
      title: e.title,
      amount: e.amount,
      paidById,
      splitWithIds,
      splitType: 'equal' as const,
      shares: {},
      category: e.category,
      createdAt: new Date(Date.now() - (INITIAL_EXPENSES_DATA.length - idx) * 3600000).toISOString(),
    };
  });

  return {
    groups: [defaultGroup],
    members,
    expenses,
    activeGroupId: defaultGroup.id,
  };
}

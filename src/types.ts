export interface Group {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

export interface Member {
  id: string;
  groupId: string;
  name: string;
  email?: string;
  avatarEmoji: string;
  avatarBgColor: string;
}

export interface Expense {
  id: string;
  groupId: string;
  title: string;
  amount: number;
  paidById: string; // Member ID of the person who paid
  splitWithIds: string[]; // Member IDs of the people splitting the expense
  splitType: 'equal' | 'unequal' | 'percentage';
  shares: Record<string, number>; // Member ID -> share amount (for unequal/percentage)
  category: string;
  createdAt: string;
}

export interface Settlement {
  fromId: string; // Member who pays
  toId: string;   // Member who receives
  amount: number;
}

export interface Session {
  isLocked: boolean;
  pin: string | null; // Null means not set yet
  lastLoginAt: string | null;
}

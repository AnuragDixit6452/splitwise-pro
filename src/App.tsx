import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Trash2, 
  Coins, 
  Check, 
  Lock, 
  Unlock, 
  FileDown, 
  FileUp, 
  Settings, 
  X, 
  DollarSign, 
  ArrowRight, 
  Sparkles, 
  RefreshCw, 
  AlertCircle,
  HelpCircle,
  UserPlus,
  TrendingDown,
  TrendingUp,
  Receipt,
  FileSpreadsheet,
  Pencil
} from 'lucide-react';
import { Group, Member, Expense, Settlement, Session } from './types';
import { 
  calculateBalances, 
  simplifyDebts, 
  getRandomAvatar, 
  CATEGORIES 
} from './utils/finance';
import * as api from './api';

export default function App() {
  // Database states
  const [groups, setGroups] = useState<Group[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string>('');

  // Lockscreen security state
  const [session, setSession] = useState<Session>({
    isLocked: true,
    pin: '1495',
    lastLoginAt: null
  });
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const [isUnlocking, setIsUnlocking] = useState(false);

  // UI interaction states
  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  
  // New entry states
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  
  // New Expense Form States
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('general');
  const [expensePaidBy, setExpensePaidBy] = useState('');
  const [expenseSplitWith, setExpenseSplitWith] = useState<string[]>([]);
  const [expenseSplitType, setExpenseSplitType] = useState<'equal' | 'unequal' | 'percentage'>('equal');
  const [expenseShares, setExpenseShares] = useState<Record<string, number>>({});

  // Sandbox Drag and Drop Slots
  const [draggedMemberId, setDraggedMemberId] = useState<string | null>(null);
  const [sandboxDebtorId, setSandboxDebtorId] = useState<string>('');
  const [sandboxCreditorId, setSandboxCreditorId] = useState<string>('');
  const [sandboxAmount, setSandboxAmount] = useState<string>('');

  // Mobile section tabs (desktop shows all columns)
  const [mobileTab, setMobileTab] = useState<'people' | 'ledger' | 'settle'>('ledger');

  // Feedback notifications
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Resume session if a valid token is already in sessionStorage
  useEffect(() => {
    const token = api.getStoredToken();
    if (!token) return;

    let cancelled = false;
    (async () => {
      try {
        const state = await api.getState();
        if (cancelled) return;
        setGroups(state.groups);
        setMembers(state.members);
        setExpenses(state.expenses);
        setActiveGroupId(state.activeGroupId || state.groups[0]?.id || '');
        setSession({
          isLocked: false,
          pin: '1495',
          lastLoginAt: new Date().toISOString(),
        });
      } catch {
        api.clearToken();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const applyState = (state: api.LedgerState) => {
    setGroups(state.groups);
    setMembers(state.members);
    setExpenses(state.expenses);
    setActiveGroupId(state.activeGroupId || state.groups[0]?.id || '');
  };

  const persistState = async (
    newG: Group[],
    newM: Member[],
    newE: Expense[],
    activeId: string,
  ) => {
    setGroups(newG);
    setMembers(newM);
    setExpenses(newE);
    setActiveGroupId(activeId);
    try {
      await api.putState({
        groups: newG,
        members: newM,
        expenses: newE,
        activeGroupId: activeId,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save';
      if (message === 'Unauthorized') {
        setSession((s) => ({ ...s, isLocked: true }));
      }
      showNotification(message, 'error');
    }
  };

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => {
      setFeedbackMsg(null);
    }, 4000);
  };

  // Security Lockscreen handlers
  const handlePinSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (pinInput.length !== 4 || isUnlocking) return;

    setIsUnlocking(true);
    setPinError('');
    try {
      const { lastLoginAt } = await api.unlock(pinInput);
      const state = await api.getState();
      applyState(state);
      setSession({
        isLocked: false,
        pin: '1495',
        lastLoginAt,
      });
      setPinInput('');
      showNotification("Unlocked secure workspace! Welcome back, Dixit.", "success");
    } catch {
      setPinError("Invalid secure passcode. Unauthorized access denied!");
      setPinInput('');
    } finally {
      setIsUnlocking(false);
    }
  };

  // Auto-submit keypad once 4 digits are entered
  useEffect(() => {
    if (session.isLocked && pinInput.length === 4 && !isUnlocking) {
      void handlePinSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinInput]);

  const handleLogout = () => {
    api.clearToken();
    setSession({
      ...session,
      isLocked: true,
    });
    showNotification("Secure session locked.", "success");
  };

  // Group creation
  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    const newGroup: Group = {
      id: `group-${Date.now()}`,
      name: newGroupName.trim(),
      description: newGroupDesc.trim() || 'A secure neo-pop group ledger.',
      createdAt: new Date().toISOString()
    };

    const updatedGroups = [...groups, newGroup];
    void persistState(updatedGroups, members, expenses, newGroup.id);
    
    setNewGroupName('');
    setNewGroupDesc('');
    setShowAddGroupModal(false);
    showNotification(`Created group: ${newGroup.name}`, 'success');
  };

  // Member creation
  const handleCreateMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim() || !activeGroupId) return;

    const avatar = getRandomAvatar();
    const newMember: Member = {
      id: `member-${Date.now()}`,
      groupId: activeGroupId,
      name: newMemberName.trim(),
      avatarEmoji: avatar.emoji,
      avatarBgColor: avatar.color
    };

    const updatedMembers = [...members, newMember];
    void persistState(groups, updatedMembers, expenses, activeGroupId);

    setNewMemberName('');
    setShowAddMemberModal(false);
    showNotification(`Added ${newMember.name} to the group ledger!`, 'success');
  };

  // Delete Member
  const handleDeleteMember = (memberId: string) => {
    // Check if member has paid or is split on any expenses
    const isPayer = expenses.some(e => e.groupId === activeGroupId && e.paidById === memberId);
    const isSplitter = expenses.some(e => e.groupId === activeGroupId && e.splitWithIds.includes(memberId));

    if (isPayer || isSplitter) {
      showNotification("Cannot delete member: They are currently linked to active expenses in this group ledger.", "error");
      return;
    }

    const updatedMembers = members.filter(m => m.id !== memberId);
    void persistState(groups, updatedMembers, expenses, activeGroupId);
    showNotification("Member removed successfully.", "success");
  };

  // Expense creation / editing
  const closeExpenseModal = () => {
    setShowAddExpenseModal(false);
    setEditingExpenseId(null);
  };

  const handleOpenExpenseModal = () => {
    const activeGroupMembers = members.filter(m => m.groupId === activeGroupId);
    if (activeGroupMembers.length < 2) {
      showNotification("Please add at least 2 members to this group before logging expenses.", "error");
      return;
    }

    setEditingExpenseId(null);
    setExpenseTitle('');
    setExpenseAmount('');
    setExpenseCategory('general');
    setExpensePaidBy(activeGroupMembers[0].id);
    setExpenseSplitWith(activeGroupMembers.map(m => m.id));
    setExpenseSplitType('equal');

    const initialShares: Record<string, number> = {};
    activeGroupMembers.forEach(m => {
      initialShares[m.id] = 0;
    });
    setExpenseShares(initialShares);

    setShowAddExpenseModal(true);
  };

  const handleOpenEditExpense = (expense: Expense) => {
    const activeGroupMembers = members.filter(m => m.groupId === activeGroupId);
    if (activeGroupMembers.length === 0) {
      showNotification("No members available to edit this expense.", "error");
      return;
    }

    setEditingExpenseId(expense.id);
    setExpenseTitle(expense.title);
    setExpenseAmount(String(expense.amount));
    setExpenseCategory(expense.category);
    setExpensePaidBy(expense.paidById);
    setExpenseSplitWith([...expense.splitWithIds]);
    setExpenseSplitType(expense.splitType);

    const initialShares: Record<string, number> = {};
    activeGroupMembers.forEach(m => {
      initialShares[m.id] = expense.shares[m.id] ?? 0;
    });
    setExpenseShares(initialShares);
    setShowAddExpenseModal(true);
  };

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(expenseAmount);
    if (!expenseTitle.trim() || isNaN(amount) || amount <= 0) {
      showNotification("Please enter a valid title and positive numeric amount.", "error");
      return;
    }

    if (expenseSplitWith.length === 0) {
      showNotification("Please select at least one person to split the expense with.", "error");
      return;
    }

    if (expenseSplitType === 'unequal') {
      const totalShares = expenseSplitWith.reduce((acc, mId) => acc + (expenseShares[mId] || 0), 0);
      if (Math.abs(totalShares - amount) > 0.05) {
        showNotification(`The sum of individual shares (₹${totalShares.toFixed(2)}) must equal the total amount (₹${amount.toFixed(2)}).`, "error");
        return;
      }
    } else if (expenseSplitType === 'percentage') {
      const totalPercentages = expenseSplitWith.reduce((acc, mId) => acc + (expenseShares[mId] || 0), 0);
      if (Math.abs(totalPercentages - 100) > 0.01) {
        showNotification(`The sum of percentages must equal exactly 100%. Currently it is ${totalPercentages}%.`, "error");
        return;
      }
    }

    if (editingExpenseId) {
      const updatedExpenses = expenses.map((exp) =>
        exp.id === editingExpenseId
          ? {
              ...exp,
              title: expenseTitle.trim(),
              amount,
              paidById: expensePaidBy,
              splitWithIds: expenseSplitWith,
              splitType: expenseSplitType,
              shares: expenseShares,
              category: expenseCategory,
            }
          : exp,
      );
      void persistState(groups, members, updatedExpenses, activeGroupId);
      closeExpenseModal();
      showNotification(`Updated expense: ${expenseTitle.trim()} (₹${amount})`, 'success');
      return;
    }

    const newExpense: Expense = {
      id: `expense-${Date.now()}`,
      groupId: activeGroupId,
      title: expenseTitle.trim(),
      amount,
      paidById: expensePaidBy,
      splitWithIds: expenseSplitWith,
      splitType: expenseSplitType,
      shares: expenseShares,
      category: expenseCategory,
      createdAt: new Date().toISOString()
    };

    const updatedExpenses = [...expenses, newExpense];
    void persistState(groups, members, updatedExpenses, activeGroupId);

    closeExpenseModal();
    showNotification(`Logged expense: ${newExpense.title} (₹${newExpense.amount})`, 'success');
  };

  const handleDeleteExpense = (expenseId: string) => {
    const updatedExpenses = expenses.filter(e => e.id !== expenseId);
    void persistState(groups, members, updatedExpenses, activeGroupId);
    showNotification("Expense deleted.", "success");
  };

  // Toggle splitter checked status
  const toggleSplitter = (memberId: string) => {
    if (expenseSplitWith.includes(memberId)) {
      setExpenseSplitWith(expenseSplitWith.filter(id => id !== memberId));
    } else {
      setExpenseSplitWith([...expenseSplitWith, memberId]);
    }
  };

  // Direct peer settlement logger (through Sandbox or Modal)
  const handleLogSettlement = (debtorId: string, creditorId: string, amountVal: number) => {
    if (!debtorId || !creditorId || debtorId === creditorId) {
      showNotification("Invalid transfer parameters. Cannot pay yourself.", "error");
      return;
    }
    if (isNaN(amountVal) || amountVal <= 0) {
      showNotification("Please enter a positive settlement amount.", "error");
      return;
    }

    const debtorName = members.find(m => m.id === debtorId)?.name || 'Member';
    const creditorName = members.find(m => m.id === creditorId)?.name || 'Member';

    // Log this settlement as a custom category "Settle" expense
    // Payer is Debtor. Debtor paid [amountVal]. It was split 100% with Creditor.
    const newExpense: Expense = {
      id: `expense-${Date.now()}`,
      groupId: activeGroupId,
      title: `Settle: ${debtorName} ➔ ${creditorName}`,
      amount: amountVal,
      paidById: debtorId,
      splitWithIds: [creditorId],
      splitType: 'equal',
      shares: {},
      category: 'general',
      createdAt: new Date().toISOString()
    };

    const updatedExpenses = [...expenses, newExpense];
    void persistState(groups, members, updatedExpenses, activeGroupId);
    
    // Clear sandbox inputs
    setSandboxDebtorId('');
    setSandboxCreditorId('');
    setSandboxAmount('');
    
    showNotification(`Recorded settlement: ${debtorName} paid ${creditorName} ₹${amountVal.toFixed(2)}`, "success");
  };

  // Backup Import & Export handlers
  const handleExportDB = () => {
    const dataStr = JSON.stringify({ groups, members, expenses, session: { pin: '1495', lastLoginAt: session.lastLoginAt } }, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `splitwise_pro_free_backup_${new Date().toISOString().slice(0,10)}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    showNotification("Database backup file downloaded successfully!", "success");
  };

  const handleImportDB = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = async (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (Array.isArray(parsed.groups) && Array.isArray(parsed.members) && Array.isArray(parsed.expenses)) {
            const activeId = parsed.groups[0]?.id || '';
            await persistState(parsed.groups, parsed.members, parsed.expenses, activeId);
            showNotification("Database successfully restored from backup!", "success");
            setShowSettingsModal(false);
          } else {
            showNotification("Invalid file structure. Database backup schema corrupted.", "error");
          }
        } catch {
          showNotification("Failed to parse JSON file. Ensure file is valid.", "error");
        }
      };
    }
  };

  // Reset entire Database to blank slate (re-seed default trip)
  const handleResetDB = async () => {
    if (window.confirm("Are you absolutely sure you want to reset the database? All expenses and members will be deleted!")) {
      try {
        if (!api.getStoredToken()) {
          showNotification("Unlock the workspace first to reset the database.", "error");
          return;
        }
        const state = await api.resetDb();
        applyState(state);
        showNotification("Database reset and default trip reloaded.", "success");
        setShowSettingsModal(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Reset failed';
        if (message === 'Unauthorized') {
          setSession((s) => ({ ...s, isLocked: true }));
        }
        showNotification(message, "error");
      }
    }
  };

  // Drag and Drop helpers for visual sandbox
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedMemberId(id);
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Required to allow drop!
  };

  const handleDropInDebtor = (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || draggedMemberId;
    if (id) {
      if (id === sandboxCreditorId) {
        showNotification("Debtor and Creditor must be distinct members.", "error");
        return;
      }
      setSandboxDebtorId(id);
      showNotification(`Assigned Debtor!`, "success");
    }
    setDraggedMemberId(null);
  };

  const handleDropInCreditor = (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || draggedMemberId;
    if (id) {
      if (id === sandboxDebtorId) {
        showNotification("Debtor and Creditor must be distinct members.", "error");
        return;
      }
      setSandboxCreditorId(id);
      showNotification(`Assigned Creditor!`, "success");
    }
    setDraggedMemberId(null);
  };

  // Compute Active Group Data
  const activeGroup = groups.find(g => g.id === activeGroupId);
  const activeGroupMembers = members.filter(m => m.groupId === activeGroupId);
  const activeGroupExpenses = expenses.filter(e => e.groupId === activeGroupId);
  
  // Balances and settlements on the fly
  const currentBalances = calculateBalances(activeGroupMembers, activeGroupExpenses);
  const optimalSettlements = simplifyDebts(currentBalances);

  // Total expenses overall
  const totalExpensesSum = activeGroupExpenses.reduce((acc, exp) => acc + exp.amount, 0);

  // Category statistics
  const categoryStats = CATEGORIES.map(cat => {
    const total = activeGroupExpenses
      .filter(e => e.category === cat.id)
      .reduce((acc, e) => acc + e.amount, 0);
    return {
      ...cat,
      total
    };
  }).filter(c => c.total > 0);

  return (
    <div className="min-h-dvh w-full max-w-[100vw] bg-[#0F172A] selection:bg-[#FDE047] selection:text-black pb-24 lg:pb-12 transition-all duration-300 font-sans overflow-x-hidden">
      
      {/* SECURITY LOCKSCREEN */}
      {session.isLocked && (
        <div className="fixed inset-0 bg-[#0F172A] z-50 flex flex-col items-center justify-center p-3 sm:p-4 overflow-y-auto overflow-x-hidden">
          <div className="w-full max-w-md bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] sm:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-5 sm:p-8 relative overflow-hidden text-black my-auto">
            
            {/* Header branding */}
            <div className="absolute top-0 right-0 bg-[#FDE047] border-2 border-black border-t-0 border-r-0 px-3 py-1 font-display text-xs font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              DIXIT'S VAULT
            </div>

            <div className="flex justify-center mb-4 sm:mb-6">
              <div className="p-3 sm:p-4 bg-[#FDE047] border-4 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                <Lock className="w-10 h-10 sm:w-12 sm:h-12 text-black" strokeWidth={3} />
              </div>
            </div>

            <h1 className="text-3xl sm:text-4xl font-display font-black text-center mb-2 tracking-tighter uppercase italic">
              SPLITWISE <span className="bg-[#4ADE80] px-2 py-0.5 border-2 border-black shadow-[2px_2px_0px_rgba(0,0,0,1)] text-base sm:text-lg">PRO</span>
            </h1>
            <p className="text-[10px] text-center text-slate-500 font-black uppercase mb-6 tracking-widest px-2">
              DIXIT'S PERSONAL LEDGER • dixit4306@gmail.com
            </p>

            {pinError && (
              <div className="mb-4 p-3 bg-[#F472B6] border-2 border-black flex items-center gap-2 font-bold text-xs text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={2.5} />
                <span>{pinError}</span>
              </div>
            )}

            {/* ENTER PIN SCREEN */}
            <form onSubmit={handlePinSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-black block text-center uppercase tracking-widest text-slate-600">Enter Security PIN</label>
                  <input
                    type="password"
                    maxLength={4}
                    value={pinInput}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setPinInput(val);
                    }}
                    placeholder="••••"
                    className="w-full p-4 border-4 border-black text-center tracking-widest text-2xl font-mono font-bold bg-slate-50 focus:outline-none focus:bg-white"
                    autoFocus
                    disabled={isUnlocking}
                  />
                </div>

                {/* Tactile Numeric Keypad */}
                <div className="grid grid-cols-3 gap-2.5 max-w-[280px] mx-auto">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <button
                      key={num}
                      type="button"
                      disabled={isUnlocking}
                      onClick={() => {
                        if (pinInput.length < 4) setPinInput(pinInput + num);
                      }}
                      className="py-3 bg-white border-2 border-black font-mono font-black text-lg shadow-[2.5px_2.5px_0px_0px_rgba(0,0,0,1)] hover:bg-[#FDE047] active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer text-black disabled:opacity-50"
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={isUnlocking}
                    onClick={() => setPinInput('')}
                    className="py-3 bg-[#F472B6] border-2 border-black font-mono font-black text-xs shadow-[2.5px_2.5px_0px_0px_rgba(0,0,0,1)] hover:bg-[#F472B6]/90 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer text-black disabled:opacity-50"
                  >
                    CLR
                  </button>
                  <button
                    type="button"
                    disabled={isUnlocking}
                    onClick={() => {
                      if (pinInput.length < 4) setPinInput(pinInput + '0');
                    }}
                    className="py-3 bg-white border-2 border-black font-mono font-black text-lg shadow-[2.5px_2.5px_0px_0px_rgba(0,0,0,1)] hover:bg-[#FDE047] active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer text-black disabled:opacity-50"
                  >
                    0
                  </button>
                  <button
                    type="submit"
                    disabled={isUnlocking}
                    className="py-3 bg-[#4ADE80] border-2 border-black font-mono font-black text-xs shadow-[2.5px_2.5px_0px_0px_rgba(0,0,0,1)] hover:bg-[#4ADE80]/90 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer text-black flex items-center justify-center disabled:opacity-50"
                  >
                    {isUnlocking ? '...' : 'GO'}
                  </button>
                </div>

                <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-wider">
                  Personal vault · PIN is fixed for this workspace
                </p>
              </form>
          </div>
        </div>
      )}

      {/* FEEDBACK STATUS TOAST */}
      {feedbackMsg && (
        <div className="fixed top-3 left-3 right-3 sm:left-auto sm:right-6 sm:top-6 z-50 sm:max-w-sm">
          <div className={`p-3 sm:p-4 border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] font-sans font-black text-xs sm:text-sm flex items-center gap-3 text-black ${
            feedbackMsg.type === 'success' ? 'bg-[#4ADE80]' : 'bg-[#F472B6]'
          }`}>
            <Sparkles className="w-5 h-5 text-black shrink-0" strokeWidth={2.5} />
            <span>{feedbackMsg.text}</span>
          </div>
        </div>
      )}

      {/* NAVIGATION HEADER BAR */}
      <header className="bg-[#4ADE80] border-b-4 border-black sticky top-0 z-40 text-black w-full max-w-[100vw] overflow-hidden">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-[70px] flex items-center justify-between gap-2 min-w-0">
          
          <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white border-2 border-black flex items-center justify-center font-black text-lg sm:text-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-black select-none shrink-0">
              ₹
            </div>
            <div className="min-w-0 overflow-hidden">
              <h1 className="text-sm sm:text-2xl font-black uppercase tracking-tighter flex items-center gap-1.5 min-w-0">
                <span className="truncate">Splitwise Pro</span>
                <span className="hidden sm:inline text-xs bg-black text-white px-2 py-0.5 font-bold shrink-0">ADMIN</span>
              </h1>
              <p className="text-[10px] text-black/75 font-bold font-mono uppercase tracking-wider hidden md:block">Durable Secure Ledger • Dixit's Workspace</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <div className="hidden md:flex bg-black text-white border-2 border-black px-2 py-1 font-mono text-[9px] font-black tracking-wider items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#4ADE80] animate-pulse"></span>
              SECURE
            </div>

            <button
              onClick={() => setShowSettingsModal(true)}
              className="p-2 bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#FDE047] active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer text-black"
              title="Database Backup & Settings"
            >
              <Settings className="w-4 h-4" strokeWidth={2.5} />
            </button>

            <button
              onClick={handleLogout}
              className="p-2 bg-[#F472B6] border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#F472B6]/90 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer text-black"
              title="Lock Session"
            >
              <Lock className="w-4 h-4" strokeWidth={2.5} />
            </button>
            
            <div className="hidden lg:flex items-center gap-3 border-l-2 border-black/15 pl-4">
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-black uppercase opacity-75 leading-none">Logged in</span>
                <span className="font-black text-xs">Dixit User</span>
              </div>
              <div className="w-10 h-10 rounded-full border-2 border-black bg-[#F472B6] overflow-hidden shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] shrink-0" />
            </div>
          </div>
        </div>
      </header>

      {/* CORE LAYOUT — extra right/bottom pad so neo shadows don't force horizontal scroll */}
      <main className="max-w-7xl mx-auto w-full px-3 sm:px-6 py-4 sm:py-6 flex-1 flex flex-col gap-6 text-black overflow-x-hidden min-w-0">
        <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 items-stretch w-full min-w-0 pr-1.5 pb-1.5 sm:pr-2 sm:pb-2">
          
          {/* COLUMN 1: LEFT SIDEBAR (Groups & Members) */}
          <aside className={`${mobileTab === 'people' ? 'flex' : 'hidden'} lg:flex w-full lg:w-72 shrink-0 flex-col gap-4 sm:gap-6 min-w-0 max-w-full`}>
            
            {/* Groups Card */}
            <div className="bg-[#FDE047] border-4 border-black p-3 sm:p-4 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] sm:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col max-w-full min-w-0 box-border">
              <div className="flex justify-between items-center mb-3 gap-2 min-w-0">
                <h2 className="text-xs font-black uppercase tracking-widest text-black truncate">Active Groups</h2>
                <button
                  onClick={() => setShowAddGroupModal(true)}
                  className="bg-black text-white px-2 py-0.5 text-[10px] font-black uppercase hover:bg-slate-800 cursor-pointer shrink-0"
                >
                  + Add
                </button>
              </div>
              
              <div className="space-y-2 max-h-[180px] overflow-y-auto overflow-x-hidden pr-1 min-w-0">
                {groups.length === 0 ? (
                  <p className="text-[10px] text-black font-semibold text-center py-4 uppercase">No active groups</p>
                ) : (
                  groups.map((group) => {
                    const isActive = group.id === activeGroupId;
                    return (
                      <div
                        key={group.id}
                        onClick={() => {
                          void persistState(groups, members, expenses, group.id);
                          setMobileTab('ledger');
                          showNotification(`Switched to: ${group.name}`, 'success');
                        }}
                        className={`p-2 border-2 border-black text-sm font-black transition-all cursor-pointer select-none flex items-center justify-between gap-2 min-w-0 max-w-full ${
                          isActive 
                            ? 'bg-black text-white' 
                            : 'bg-white hover:bg-black/5 text-black'
                        }`}
                      >
                        <span className="truncate min-w-0 flex-1">📂 {group.name.replace(/_/g, ' ')}</span>
                        {isActive && (
                          <span className="text-[9px] bg-[#4ADE80] text-black px-1 font-black shrink-0">ACTIVE</span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Members Card */}
            <div className="bg-white border-4 border-black p-3 sm:p-4 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] sm:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex-1 flex flex-col max-w-full min-w-0 box-border">
              <div className="flex justify-between items-center mb-3 gap-2 min-w-0">
                <h2 className="text-xs font-black uppercase tracking-widest text-black truncate">Members ({activeGroupMembers.length})</h2>
                {activeGroup && (
                  <button
                    onClick={() => setShowAddMemberModal(true)}
                    className="bg-black text-white px-2 py-0.5 text-[10px] font-black uppercase hover:bg-slate-800 cursor-pointer shrink-0"
                  >
                    + Add
                  </button>
                )}
              </div>

              {!activeGroup ? (
                <p className="text-[11px] text-slate-500 font-bold text-center py-6 uppercase">Select group first</p>
              ) : activeGroupMembers.length === 0 ? (
                <p className="text-[11px] text-slate-500 font-bold text-center py-6 uppercase">No members yet</p>
              ) : (
                <div className="space-y-2.5 max-h-[min(380px,50vh)] lg:max-h-[380px] overflow-y-auto overflow-x-hidden pr-1 min-w-0">
                  {activeGroupMembers.map((m) => {
                    const bal = currentBalances[m.id] || 0;
                    const isCreditor = bal > 0.01;
                    const isDebtor = bal < -0.01;
                    
                    return (
                      <div
                        key={m.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, m.id)}
                        className="p-2 border-2 border-black bg-white flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing hover:bg-slate-50 transition-all relative group min-w-0 max-w-full"
                        title="Drag me into the Sandbox zone on the right side!"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                          <div 
                            className="w-6 h-6 border-2 border-black flex items-center justify-center font-bold text-xs shrink-0"
                            style={{ backgroundColor: m.avatarBgColor }}
                          >
                            {m.avatarEmoji}
                          </div>
                          <span className="text-sm font-bold italic truncate text-black min-w-0">{m.name}</span>
                        </div>

                        <div className="text-right shrink-0">
                          <span className={`text-[11px] sm:text-xs font-black block tabular-nums ${
                            isCreditor ? 'text-[#22c55e]' : isDebtor ? 'text-[#F472B6]' : 'text-slate-400'
                          }`}>
                            {isCreditor ? `+₹${bal.toFixed(0)}` : isDebtor ? `-₹${Math.abs(bal).toFixed(0)}` : '₹0'}
                          </span>
                        </div>

                        {!expenses.some(e => e.groupId === activeGroupId && (e.paidById === m.id || e.splitWithIds.includes(m.id))) && (
                          <button
                            onClick={() => handleDeleteMember(m.id)}
                            className="absolute top-1 right-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 p-1 lg:p-0.5 bg-[#F472B6] text-black border border-black text-[8px] font-black cursor-pointer"
                            title="Remove member"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>

          {/* COLUMN 2: CENTRAL FEED (Active Group Title, Add Expense & Expenses List) */}
          <main className={`${mobileTab === 'ledger' ? 'flex' : 'hidden'} lg:flex flex-1 flex-col gap-4 min-w-0 max-w-full`}>
            {activeGroup ? (
              <>
                {/* Active Group Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                  <div className="min-w-0">
                    <h2 className="text-2xl sm:text-3xl font-black text-white uppercase italic drop-shadow-[2px_2px_0px_rgba(0,0,0,1)] truncate">
                      {activeGroup.name.replace(/_/g, ' ')}
                    </h2>
                    <p className="text-xs font-bold text-slate-400 mt-1 line-clamp-2 sm:line-clamp-1">
                      {activeGroup.description}
                    </p>
                  </div>
                  <button
                    onClick={handleOpenExpenseModal}
                    className="bg-[#F472B6] border-4 border-black px-4 sm:px-6 py-2.5 sm:py-2 font-black uppercase text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all cursor-pointer text-black shrink-0 text-center w-full sm:w-auto"
                  >
                    Add Expense
                  </button>
                </div>

                {/* Main feed list of expenses */}
                <div className="flex-1 flex flex-col gap-4">
                  {activeGroupExpenses.length === 0 ? (
                    <div className="bg-white border-4 border-black p-8 text-center shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-black">
                      <p className="text-base font-black uppercase">No expenses in this ledger yet!</p>
                      <p className="text-xs font-bold text-slate-500 mt-1">Log a bill item using the "Add Expense" button to split charges.</p>
                    </div>
                  ) : (
                    activeGroupExpenses.slice().reverse().map((exp, expIdx) => {
                      const payer = activeGroupMembers.find(m => m.id === exp.paidById);
                      const categoryObj = CATEGORIES.find(c => c.id === exp.category);
                      const isDirectSettle = exp.title.startsWith("Settle:");
                      const expenseDate = new Date(exp.createdAt);
                      const formattedMonth = expenseDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
                      const formattedDay = expenseDate.getDate();

                      // Cycle shadow colors: green, pink, blue, orange
                      const shadowColors = ['rgba(74,222,128,1)', 'rgba(244,114,182,1)', 'rgba(96,165,250,1)', 'rgba(251,146,60,1)'];
                      const currentShadowColor = isDirectSettle ? 'rgba(0,0,0,1)' : shadowColors[expIdx % shadowColors.length];

                      return (
                        <div
                          key={exp.id}
                          className="bg-white border-4 border-black p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[4px_4px_0px_0px_var(--shadow-col)] sm:shadow-[8px_8px_0px_0px_var(--shadow-col)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all relative group text-black"
                          style={{ '--shadow-col': currentShadowColor } as React.CSSProperties}
                        >
                          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                            {/* Date box */}
                            <div className="w-11 h-11 sm:w-12 sm:h-12 bg-slate-100 border-2 border-black flex flex-col items-center justify-center shrink-0 text-black">
                              <span className="text-[9px] font-black leading-none">{formattedMonth}</span>
                              <span className="text-lg font-black leading-none mt-0.5">{formattedDay}</span>
                            </div>

                            {/* Info */}
                            <div className="min-w-0 flex-1">
                              <h3 className="font-black text-base sm:text-lg text-black truncate pr-2">{exp.title}</h3>
                              <p className="text-xs font-bold text-slate-500 mt-0.5 line-clamp-2 sm:line-clamp-1">
                                Paid by <span className="text-black underline">{payer?.name || 'Unknown'}</span> • {isDirectSettle ? 'Peer Settlement' : `Split with ${exp.splitWithIds.length} members`}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 text-black pl-0 sm:pl-0 border-t sm:border-t-0 border-black/10 pt-2 sm:pt-0">
                            <div className="text-left sm:text-right">
                              <div className="text-xl sm:text-2xl font-black text-black">₹{exp.amount.toFixed(0)}</div>
                              <div className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">
                                {isDirectSettle ? 'SETTLED' : `${categoryObj?.emoji || '🧾'} ${categoryObj?.label || 'General'}`}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleOpenEditExpense(exp)}
                                className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 p-2 sm:p-1.5 bg-[#60A5FA] hover:bg-[#60A5FA]/90 border-2 border-black text-black transition-all cursor-pointer"
                                title="Edit expense"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteExpense(exp.id)}
                                className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 p-2 sm:p-1.5 bg-[#F472B6] hover:bg-[#F472B6]/90 border-2 border-black text-black transition-all cursor-pointer"
                                title="Delete bill record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Extra Section: Category charts shown in the middle below the bills */}
                {categoryStats.length > 0 && (
                  <div className="bg-white border-4 border-black p-4 sm:p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] sm:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-black mt-4">
                    <h3 className="font-black text-sm uppercase tracking-widest mb-4">Category Outlays</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {categoryStats.map(stat => {
                        const pct = (stat.total / totalExpensesSum) * 100;
                        return (
                          <div key={stat.id} className="space-y-1">
                            <div className="flex justify-between text-xs font-bold text-black gap-2">
                              <span className="truncate">{stat.emoji} {stat.label}</span>
                              <span className="font-mono shrink-0">₹{stat.total.toFixed(0)} ({pct.toFixed(0)}%)</span>
                            </div>
                            <div className="w-full h-3 bg-slate-100 border-2 border-black relative overflow-hidden">
                              <div 
                                className="h-full border-r-2 border-black" 
                                style={{ 
                                  backgroundColor: stat.color,
                                  width: `${pct}%` 
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white border-4 border-black p-6 sm:p-12 text-center shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                <h2 className="text-xl sm:text-2xl font-black uppercase mb-2 text-black">Splitwise Pro Ledger</h2>
                <p className="text-sm font-bold text-slate-600 mb-6">Select an existing ledger, or create a brand new one to get started calculating optimized debts.</p>
                <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
                  <button
                    onClick={async () => {
                      try {
                        const state = await api.resetDb();
                        applyState(state);
                        showNotification("Loaded default trip dataset!", "success");
                      } catch (err) {
                        const message = err instanceof Error ? err.message : 'Failed to load demo';
                        showNotification(message, "error");
                      }
                    }}
                    className="px-6 py-2.5 bg-[#FDE047] border-4 border-black font-black uppercase text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all cursor-pointer text-black"
                  >
                    Load Trip Demo Data
                  </button>
                  <button
                    onClick={() => setShowAddGroupModal(true)}
                    className="px-6 py-2.5 bg-[#4ADE80] border-4 border-black font-black uppercase text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all cursor-pointer text-black"
                  >
                    New Group Ledger
                  </button>
                </div>
              </div>
            )}
          </main>

          {/* COLUMN 3: RIGHT SIDEBAR (Net Settlements, Sandbox, Auto-Settle Status) */}
          <aside className={`${mobileTab === 'settle' ? 'flex' : 'hidden'} lg:flex w-full lg:w-72 shrink-0 flex-col gap-4 sm:gap-6 min-w-0 max-w-full`}>
            
            {/* Balance Summary Card */}
            <div className="bg-white border-4 border-black p-4 sm:p-6 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] sm:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between text-black max-w-full min-w-0">
              <div>
                <h2 className="text-xs font-black uppercase mb-3 tracking-widest text-slate-500">Total Balance</h2>
                <div className="text-3xl sm:text-4xl font-black text-[#4ADE80] drop-shadow-[2.5px_2.5px_0px_rgba(0,0,0,1)]">
                  ₹{totalExpensesSum.toFixed(0)}
                </div>
                <p className="text-[10px] font-black mt-2 opacity-70 uppercase tracking-wider">Across {activeGroupExpenses.length} bills in ledger</p>
              </div>
            </div>

            {/* Settlement Status (Optimal Settle) Card */}
            <div className="bg-[#60A5FA] border-4 border-black p-4 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] sm:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-black flex flex-col max-w-full min-w-0">
              <h2 className="text-xs font-black uppercase mb-4 tracking-widest text-black">Settlement Status</h2>
              
              {!activeGroup ? (
                <p className="text-xs font-bold text-center py-4 uppercase text-black/75">Select group</p>
              ) : optimalSettlements.length === 0 ? (
                <div className="bg-white p-3 border-2 border-black text-center space-y-2">
                  <div className="text-2xl">🥳</div>
                  <p className="text-xs font-black uppercase">All debts settled!</p>
                </div>
              ) : (
                <div className="space-y-3 overflow-y-auto max-h-[300px] pr-1">
                  {optimalSettlements.map((settlement, idx) => {
                    const fromMem = activeGroupMembers.find(m => m.id === settlement.fromId);
                    const toMem = activeGroupMembers.find(m => m.id === settlement.toId);

                    if (!fromMem || !toMem) return null;

                    return (
                      <div key={idx} className="bg-white p-3 border-2 border-black flex flex-col gap-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] relative">
                        <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-500 leading-none">
                          <span>OWES</span>
                          <span>RECEIVES</span>
                        </div>
                        
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-xs text-black truncate italic">{fromMem.name}</span>
                          <ArrowRight className="w-3 h-3 text-black shrink-0" />
                          <span className="font-bold text-xs text-black truncate italic">{toMem.name}</span>
                        </div>

                        <div className="flex items-center justify-between border-t border-black/10 pt-2 mt-1">
                          <span className="font-black text-lg text-black">₹{settlement.amount.toFixed(0)}</span>
                          <button
                            onClick={() => handleLogSettlement(settlement.fromId, settlement.toId, settlement.amount)}
                            className="bg-[#4ADE80] border-2 border-black px-2 py-0.5 text-[9px] font-black uppercase hover:bg-[#4ADE80]/90 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[1px] active:translate-y-[1px] cursor-pointer text-black"
                            title="Log settlement payment"
                          >
                            SETTLE
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Sandbox Quick Transfer Card */}
            <div className="bg-[#FB923C] border-4 border-black p-4 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] sm:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-black max-w-full min-w-0">
              <h2 className="text-xs font-black uppercase mb-2 tracking-widest text-black">TRANSFER SANDBOX</h2>
              <p className="text-[10px] font-bold text-black/85 leading-snug mb-3 hidden lg:block">Drag/Drop members from the list onto slots below to draft payments on-the-fly!</p>
              <p className="text-[10px] font-bold text-black/85 leading-snug mb-3 lg:hidden">Pick debtor and creditor below to record a payment.</p>

              {/* Mobile-friendly member picks */}
              <div className="grid grid-cols-1 gap-2 mb-3 lg:hidden">
                <select
                  value={sandboxDebtorId}
                  onChange={(e) => setSandboxDebtorId(e.target.value)}
                  className="w-full p-2.5 border-2 border-black bg-white font-bold text-sm text-black"
                >
                  <option value="">Select debtor…</option>
                  {activeGroupMembers.map((m) => (
                    <option key={m.id} value={m.id} disabled={m.id === sandboxCreditorId}>
                      {m.avatarEmoji} {m.name}
                    </option>
                  ))}
                </select>
                <select
                  value={sandboxCreditorId}
                  onChange={(e) => setSandboxCreditorId(e.target.value)}
                  className="w-full p-2.5 border-2 border-black bg-white font-bold text-sm text-black"
                >
                  <option value="">Select creditor…</option>
                  {activeGroupMembers.map((m) => (
                    <option key={m.id} value={m.id} disabled={m.id === sandboxDebtorId}>
                      {m.avatarEmoji} {m.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="hidden lg:grid grid-cols-2 gap-2">
                <div 
                  onDragOver={handleDragOver}
                  onDrop={handleDropInDebtor}
                  className="bg-white border-2 border-black p-2 min-h-[70px] flex flex-col items-center justify-center text-center relative"
                >
                  {sandboxDebtorId ? (
                    <>
                      <button 
                        onClick={() => setSandboxDebtorId('')}
                        className="absolute top-0.5 right-0.5 text-[8px] bg-[#F472B6] border border-black px-1 font-black cursor-pointer uppercase text-black"
                      >
                        X
                      </button>
                      <span className="text-lg">{activeGroupMembers.find(m => m.id === sandboxDebtorId)?.avatarEmoji}</span>
                      <span className="text-xs font-black truncate max-w-full italic">{activeGroupMembers.find(m => m.id === sandboxDebtorId)?.name}</span>
                      <span className="text-[8px] font-black text-[#F472B6] uppercase">Debtor</span>
                    </>
                  ) : (
                    <span className="text-[9px] font-black text-slate-400 uppercase">Drop Debtor</span>
                  )}
                </div>

                <div 
                  onDragOver={handleDragOver}
                  onDrop={handleDropInCreditor}
                  className="bg-white border-2 border-black p-2 min-h-[70px] flex flex-col items-center justify-center text-center relative"
                >
                  {sandboxCreditorId ? (
                    <>
                      <button 
                        onClick={() => setSandboxCreditorId('')}
                        className="absolute top-0.5 right-0.5 text-[8px] bg-[#F472B6] border border-black px-1 font-black cursor-pointer uppercase text-black"
                      >
                        X
                      </button>
                      <span className="text-lg">{activeGroupMembers.find(m => m.id === sandboxCreditorId)?.avatarEmoji}</span>
                      <span className="text-xs font-black truncate max-w-full italic">{activeGroupMembers.find(m => m.id === sandboxCreditorId)?.name}</span>
                      <span className="text-[8px] font-black text-[#4ADE80] uppercase">Creditor</span>
                    </>
                  ) : (
                    <span className="text-[9px] font-black text-slate-400 uppercase">Drop Creditor</span>
                  )}
                </div>
              </div>

              {sandboxDebtorId && sandboxCreditorId && (
                <div className="mt-3 bg-white border-2 border-black p-2 space-y-2">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-black">₹</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      placeholder="Amount"
                      value={sandboxAmount}
                      onChange={(e) => setSandboxAmount(e.target.value)}
                      className="w-full bg-slate-50 p-2 border border-black text-sm font-bold font-mono focus:outline-none text-black"
                    />
                  </div>
                  <button
                    onClick={() => handleLogSettlement(sandboxDebtorId, sandboxCreditorId, parseFloat(sandboxAmount))}
                    className="w-full bg-[#4ADE80] border-2 border-black py-2.5 text-[10px] font-black uppercase hover:bg-[#4ADE80]/90 transition-all cursor-pointer text-black"
                  >
                    Record Payment
                  </button>
                </div>
              )}
            </div>

            {/* Auto-Settle Status Strip */}
            <div className="bg-black text-white p-3 border-2 border-white flex justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] select-none">
              <span className="text-[10px] font-black tracking-[0.2em] uppercase">Auto-Settle: ON</span>
            </div>

          </aside>

        </div>
      </main>

      {/* MODAL: NEW GROUP */}
      {showAddGroupModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-white border-4 border-black p-5 sm:p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-black relative rounded-t-lg sm:rounded-none max-h-[90dvh] overflow-y-auto">
            <button
              onClick={() => setShowAddGroupModal(false)}
              className="absolute top-4 right-4 p-1.5 bg-white border-2 border-black hover:bg-[#F472B6]"
            >
              <X className="w-4 h-4" />
            </button>
            
            <h3 className="text-xl font-black mb-4 uppercase tracking-tight">
              📂 Create New Group Ledger
            </h3>

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-black block uppercase">Group Name:</label>
                <input
                  type="text"
                  placeholder="e.g. Goa Trip 2026, Rent Ledger"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full p-2.5 border-2 border-black focus:outline-none focus:bg-[#FDE047]/10 font-bold bg-white text-black text-sm"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black block uppercase">Description / Purpose:</label>
                <textarea
                  placeholder="Describe the expenses logged in this ledger..."
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  className="w-full p-2.5 border-2 border-black focus:outline-none focus:bg-[#FDE047]/10 text-sm h-20 resize-none bg-white text-black font-bold"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-[#FDE047] border-2 border-black font-black text-sm uppercase tracking-wider shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none cursor-pointer"
              >
                Create Ledger
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NEW MEMBER */}
      {showAddMemberModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-sm bg-white border-4 border-black p-5 sm:p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-black relative rounded-t-lg sm:rounded-none">
            <button
              onClick={() => setShowAddMemberModal(false)}
              className="absolute top-4 right-4 p-1.5 bg-white border-2 border-black hover:bg-[#F472B6]"
            >
              <X className="w-4 h-4" />
            </button>
            
            <h3 className="text-xl font-black mb-4 uppercase tracking-tight">
              👥 Add Group Member
            </h3>

            <form onSubmit={handleCreateMember} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-black block uppercase">Member Name:</label>
                <input
                  type="text"
                  placeholder="e.g. Anurag, Shikha, Mark"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  className="w-full p-2.5 border-2 border-black focus:outline-none focus:bg-[#FDE047]/10 font-bold bg-white text-black text-sm"
                  required
                  autoFocus
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-[#4ADE80] border-2 border-black font-black text-sm uppercase tracking-wider shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none cursor-pointer"
              >
                Add Member Token
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NEW / EDIT EXPENSE */}
      {showAddExpenseModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-xl bg-white border-4 border-black p-5 sm:p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-black relative overflow-y-auto max-h-[92dvh] rounded-t-lg sm:rounded-none">
            <button
              onClick={closeExpenseModal}
              className="absolute top-4 right-4 p-1.5 bg-white border-2 border-black hover:bg-[#F472B6]"
            >
              <X className="w-4 h-4" />
            </button>
            
            <h3 className="text-xl font-black mb-4 uppercase tracking-tight pr-10">
              {editingExpenseId ? '✏️ Edit Expense Bill' : '🧾 Log Group Expense Bill'}
            </h3>

            <form onSubmit={handleSaveExpense} className="space-y-4 font-sans text-xs">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-black block uppercase">Expense Title:</label>
                  <input
                    type="text"
                    placeholder="e.g. Petrol, Seven Eleven, Villa"
                    value={expenseTitle}
                    onChange={(e) => setExpenseTitle(e.target.value)}
                    className="w-full p-2.5 border-2 border-black focus:outline-none focus:bg-[#FDE047]/10 text-sm font-bold bg-white text-black"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black block uppercase">Total Amount (₹):</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2.5 text-sm font-black">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={expenseAmount}
                      onChange={(e) => {
                        setExpenseAmount(e.target.value);
                        // Auto populate split amounts if unequal
                        if (expenseSplitType === 'equal') return;
                        const amt = parseFloat(e.target.value) || 0;
                        const each = amt / expenseSplitWith.length;
                        const newS: Record<string, number> = {};
                        expenseSplitWith.forEach(id => {
                          newS[id] = expenseSplitType === 'percentage' ? Math.round((100 / expenseSplitWith.length) * 100) / 100 : Math.round(each * 100) / 100;
                        });
                        setExpenseShares(newS);
                      }}
                      className="w-full p-2.5 pl-6 border-2 border-black focus:outline-none focus:bg-[#FDE047]/10 font-mono text-sm font-black bg-white text-black"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Paid by selection */}
              <div className="space-y-1">
                <label className="text-xs font-black block uppercase">Who Paid?</label>
                <select
                  value={expensePaidBy}
                  onChange={(e) => setExpensePaidBy(e.target.value)}
                  className="w-full p-2.5 border-2 border-black focus:outline-none font-bold text-sm bg-white text-black"
                >
                  {activeGroupMembers.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.avatarEmoji} {m.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-black block uppercase">Category:</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(cat => {
                    const isSel = expenseCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setExpenseCategory(cat.id)}
                        className={`px-3 py-1.5 text-xs font-bold border-2 border-black flex items-center gap-1.5 transition-all cursor-pointer ${
                          isSel ? 'bg-[#FDE047] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-white text-black hover:bg-gray-100'
                        }`}
                      >
                        <span>{cat.emoji}</span>
                        <span>{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Split Strategy selection */}
              <div className="space-y-2 border-t border-black/10 pt-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-xs font-black uppercase block">Split Strategy:</label>
                  <div className="flex flex-wrap gap-2">
                    {(['equal', 'unequal', 'percentage'] as const).map(strategy => (
                      <button
                        key={strategy}
                        type="button"
                        onClick={() => {
                          setExpenseSplitType(strategy);
                          // Reset shares structure
                          const defaultS: Record<string, number> = {};
                          const total = parseFloat(expenseAmount) || 0;
                          const each = total / expenseSplitWith.length;
                          expenseSplitWith.forEach(id => {
                            defaultS[id] = strategy === 'percentage' 
                              ? Math.round((100 / expenseSplitWith.length) * 10) / 10 
                              : Math.round(each * 100) / 100;
                          });
                          setExpenseShares(defaultS);
                        }}
                        className={`px-2.5 py-1 text-[10px] font-black border-2 border-black cursor-pointer ${
                          expenseSplitType === strategy ? 'bg-[#FDE047] shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)]' : 'bg-white text-black'
                        }`}
                      >
                        {strategy === 'equal' ? 'Split Equally' : strategy === 'unequal' ? 'Split Unequally (₹)' : 'By Percentage (%)'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Checklist of splitters */}
                <div className="p-3 bg-slate-50 border-2 border-black space-y-2">
                  <div className="flex justify-between font-black text-[10px] text-slate-500 uppercase pb-1 border-b border-black/5">
                    <span>Split Participant Check</span>
                    <span>{expenseSplitType === 'equal' ? 'Status' : expenseSplitType === 'unequal' ? 'Share Amount (₹)' : 'Percentage (%)'}</span>
                  </div>

                  <div className="space-y-2 max-h-[160px] overflow-y-auto">
                    {activeGroupMembers.map(m => {
                      const isChecked = expenseSplitWith.includes(m.id);
                      return (
                        <div key={m.id} className="flex items-center justify-between gap-3 text-black">
                          <label className="flex items-center gap-2 cursor-pointer font-bold text-xs">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleSplitter(m.id)}
                              className="w-4 h-4 rounded-none border-2 border-black accent-black focus:ring-0 cursor-pointer"
                            />
                            <span>{m.avatarEmoji} {m.name}</span>
                          </label>

                          {isChecked && expenseSplitType !== 'equal' && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              {expenseSplitType === 'percentage' ? (
                                <>
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={expenseShares[m.id] || ''}
                                    onChange={(e) => {
                                      setExpenseShares({
                                        ...expenseShares,
                                        [m.id]: parseFloat(e.target.value) || 0
                                      });
                                    }}
                                    className="w-16 p-1 text-right border border-black focus:outline-none font-mono text-xs bg-white text-black font-bold"
                                    required
                                  />
                                  <span className="font-black">%</span>
                                </>
                              ) : (
                                <>
                                  <span className="font-black">₹</span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={expenseShares[m.id] || ''}
                                    onChange={(e) => {
                                      setExpenseShares({
                                        ...expenseShares,
                                        [m.id]: parseFloat(e.target.value) || 0
                                      });
                                    }}
                                    className="w-20 p-1 text-right border border-black focus:outline-none font-mono text-xs bg-white text-black font-bold"
                                    required
                                  />
                                </>
                              )}
                            </div>
                          )}

                          {isChecked && expenseSplitType === 'equal' && (
                            <span className="text-[10px] text-slate-500 font-mono font-bold">
                              ₹{((parseFloat(expenseAmount) || 0) / Math.max(expenseSplitWith.length, 1)).toFixed(2)} each
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-[#FDE047] border-2 border-black font-black text-sm uppercase tracking-wider shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none cursor-pointer mt-4"
              >
                {editingExpenseId ? 'Save Changes & Recalculate' : 'Log Bill Item'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DATABASE BACKUPS & CONSOLE */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-white border-4 border-black p-5 sm:p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-black relative rounded-t-lg sm:rounded-none max-h-[90dvh] overflow-y-auto">
            <button
              onClick={() => setShowSettingsModal(false)}
              className="absolute top-4 right-4 p-1.5 bg-white border-2 border-black hover:bg-[#F472B6]"
            >
              <X className="w-4 h-4" />
            </button>
            
            <h3 className="text-xl font-black mb-4 uppercase tracking-tight">
              ⚙️ Ledger Database Backups
            </h3>

            <div className="space-y-4 text-xs">
              <div className="p-3.5 bg-slate-50 border-2 border-black leading-relaxed space-y-1.5 text-black font-bold">
                <p className="font-black text-[#F472B6]">🔒 DIXIT'S RECOVERABLE SYSTEM ACTIVE</p>
                <p>Because Firestore database is not configured, we write data to a high-reliability client-side database. Download backups as local files so you can recover your ledger easily at any time!</p>
              </div>

              {/* Action buttons */}
              <div className="space-y-3 pt-2">
                
                {/* Download Backup */}
                <button
                  onClick={handleExportDB}
                  className="w-full py-2.5 bg-[#60A5FA] border-2 border-black font-black text-sm uppercase flex items-center justify-center gap-2 shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-y-0.5 cursor-pointer text-black"
                >
                  <FileDown className="w-4 h-4 text-black" strokeWidth={2.5} />
                  Download Backup (JSON)
                </button>

                {/* Upload Backup */}
                <div className="relative">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportDB}
                    id="restore-upload-input"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <button
                    type="button"
                    className="w-full py-2.5 bg-white border-2 border-black font-black text-sm uppercase flex items-center justify-center gap-2 shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-y-0.5 cursor-pointer text-black"
                  >
                    <FileUp className="w-4 h-4 text-black" strokeWidth={2.5} />
                    Restore From Backup
                  </button>
                </div>

                {/* Reset system */}
                <button
                  onClick={handleResetDB}
                  className="w-full py-2.5 bg-[#F472B6] border-2 border-black font-black text-sm uppercase flex items-center justify-center gap-2 shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-y-0.5 cursor-pointer text-black"
                >
                  <AlertCircle className="w-4 h-4 text-black" strokeWidth={2.5} />
                  Reset System & Reseed
                </button>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE BOTTOM NAV */}
      {!session.isLocked && (
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#0F172A] border-t-4 border-black pb-[env(safe-area-inset-bottom)]">
          <div className="grid grid-cols-3 gap-0">
            {(
              [
                { id: 'people' as const, label: 'People', icon: Users },
                { id: 'ledger' as const, label: 'Ledger', icon: Receipt },
                { id: 'settle' as const, label: 'Settle', icon: Coins },
              ]
            ).map(({ id, label, icon: Icon }) => {
              const active = mobileTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMobileTab(id)}
                  className={`flex flex-col items-center justify-center gap-0.5 py-2.5 px-1 font-black uppercase text-[10px] tracking-wider transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#FDE047] text-black'
                      : 'bg-transparent text-white/80 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5" strokeWidth={2.5} />
                  {label}
                </button>
              );
            })}
          </div>
        </nav>
      )}

    </div>
  );
}

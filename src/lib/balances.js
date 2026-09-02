import { sharesForExpense } from "./money.js";

export function computeBalances(members, expenses) {
  const bal = {};
  for (const m of members) bal[m.id] = 0;

  for (const exp of expenses) {
    const shares = sharesForExpense(exp);
    const paidBy = Number(exp.paidBy);
    bal[paidBy] = (bal[paidBy] || 0) + Number(exp.amount);

    for (const [id, share] of Object.entries(shares)) {
      const key = Number(id);
      bal[key] = (bal[key] || 0) - share;
    }
  }

  for (const id of Object.keys(bal)) {
    bal[id] = Math.round(bal[id] * 100) / 100;
  }

  return bal;
}

export function totalSpent(expenses) {
  const sum = expenses.reduce((s, e) => s + Number(e.amount), 0);
  return Math.round(sum * 100) / 100;
}


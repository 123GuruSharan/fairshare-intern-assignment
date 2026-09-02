export function formatMoney(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "$0.00";
  const sign = n < -0.005 ? "-" : "";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

export function splitEqual(amount, ids) {
  const n = ids.length;
  if (!n) return {};
  const totalCents = Math.round(Number(amount) * 100);
  const baseCents = Math.floor(totalCents / n);
  let remainder = totalCents - baseCents * n;
  const shares = {};
  for (const id of ids) {
    const shareCents = baseCents + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder--;
    shares[id] = shareCents / 100;
  }
  return shares;
}

export function percentsSumTo100(percents) {
  const values = Object.values(percents).map(Number);
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.abs(sum - 100) < 0.01;
}

export function splitByPercent(amount, percents) {
  const entries = Object.entries(percents);
  if (!entries.length) return {};
  const totalCents = Math.round(Number(amount) * 100);
  let allocatedCents = 0;
  const shares = {};
  entries.forEach(([id, pct], idx) => {
    if (idx === entries.length - 1) {
      const shareCents = totalCents - allocatedCents;
      shares[id] = shareCents / 100;
    } else {
      const shareCents = Math.round((totalCents * Number(pct)) / 100);
      allocatedCents += shareCents;
      shares[id] = shareCents / 100;
    }
  });
  return shares;
}

export function sharesForExpense(expense) {
  if (expense.splitType === "percent" && expense.percents) {
    return splitByPercent(expense.amount, expense.percents);
  }
  return splitEqual(expense.amount, expense.splitWith);
}

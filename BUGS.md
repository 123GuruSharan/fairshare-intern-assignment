# Bugs found

This document logs all bugs found and fixed in FairShare, including root causes, reproduction steps, expected vs actual behavior, code changes, and verification.

---

## Bug 1 — Expense list sorting order (Oldest first instead of Newest first, and same-date creation tie-breaking)

### Problem
`ExpenseList.jsx` sorted expenses in ascending date order (`a.date - b.date`), causing oldest expenses to appear at the top despite the UI header indicating "Newest first". In addition, `dateValue` in `format.js` returned string dates directly without converting them to numeric timestamps, causing `string - string` (`NaN`) failures. Furthermore, when multiple expenses shared the same calendar date, there was no creation timestamp tie-breaker, causing newly added same-day expenses to appear below older expenses of that date.

### Reproduction
1. Open the app.
2. The first row in the expenses list is "Wine" (7 Mar 2026).
3. "Board game" (15 Mar 2026) is near the bottom.
4. Adding multiple expenses on the same date (e.g. 16 Mar 2026) placed newly created expenses below earlier expenses of that date.

### Expected
Expenses should be sorted newest first by date (15 Mar 2026 at the top, 7 Mar 2026 at the bottom). When two expenses share the same calendar date, the one created later must appear first.

### Actual
The list was sorted oldest first, and same-day expenses did not respect creation order.

### Fix
- In `src/App.jsx`, attached `createdAt: Date.now()` timestamp when creating a new expense.
- In `src/lib/format.js`, updated `dateValue` to reliably convert Date objects and `YYYY-MM-DD` / ISO date strings into numeric millisecond timestamps, and added `createdValue` to resolve creation timestamps with fallbacks.
- In `src/components/ExpenseList.jsx`, sorted primarily by date (`dateValue(b.date) - dateValue(a.date)`), breaking ties using `createdValue(b) - createdValue(a)`.

### Verification
Verified sorting order in automated tests and UI: Board game (15 Mar) appears first and Wine (7 Mar) appears last. For multiple expenses created on the same date, the later-created expense appears at the top.


---

## Bug 2 — Paid-by filter type mismatch

### Problem
In `Filters.jsx`, the "Paid by" `<select>` produces string values (e.g., `"1"`), whereas expense `paidBy` fields are numbers (e.g., `1`). In `App.jsx`, the filter comparison `if (paidBy !== "" && e.paidBy !== paidBy) return false;` failed for all members due to strict type inequality (`1 !== "1"`).

### Reproduction
1. Open the app.
2. In the "Filter" card, select any member from the "Paid by" dropdown (e.g., "Aisha Khan").

### Expected
All expenses paid by Aisha Khan should be displayed.

### Actual
Zero expenses matched and the list displayed "No expenses match these filters."

### Fix
In `src/App.jsx`, updated the filter condition to compare string representations:
`if (paidBy !== "" && String(e.paidBy) !== String(paidBy)) return false;`

### Verification
Filtered by each member in the group and verified that the expenses paid by the selected member are displayed correctly.

---

## Bug 3 — Edit and Delete targeting wrong expense due to array index identity

### Problem
`ExpenseList.jsx` mapped over the filtered and sorted list and passed array indices to `onDeleteAt(index)` and `onUpdateAt(index, patch)`. In `store.js`, the reducer modified `state.expenses` by index. Because `state.expenses` has a different ordering and length than the filtered/sorted view, deleting or editing an item modified or removed the wrong expense in state.

### Reproduction
1. Filter the list (e.g. search "Uber" or select a category), or leave sorted newest-first.
2. Click "Delete" on the top expense ("Board game", id `e8`).

### Expected
Only "Board game" should be deleted.

### Actual
The expense at index 0 of the unfiltered array ("Groceries", id `e1`) was deleted instead.

### Fix
- In `src/state/store.js`, updated `DELETE_EXPENSE` to filter by `action.id` (`state.expenses.filter(e => e.id !== action.id)`), and updated `UPDATE_EXPENSE` to map by `action.id`.
- In `src/App.jsx`, passed ID-based handlers `onDelete={(id) => ...}` and `onUpdate={(id, patch) => ...}`.
- In `src/components/ExpenseList.jsx`, used `key={expense.id}` and passed `expense.id` to `onDelete` and `onSaveAmount`.
- In `ExpenseRow`, synced the input `draft` state when `expense.amount` changes and supported `Enter` key submission.

### Verification
Verified via automated test suite and UI testing that deleting or updating any expense targets the exact expense regardless of sorting or active filters.

---

## Bug 4 — Inverted balance labels and CSS status classes

### Problem
In `BalancesPanel.jsx`, positive balances (`bal > 0.005`) were labeled as `"owes $X"` with class `"owe"` (red), while negative balances (`bal < -0.005`) were labeled as `"is owed $X"` with class `"owed"` (green). In running balance accounting, a positive balance indicates that a member paid more than their share and is in credit (is owed money), whereas a negative balance indicates that a member paid less than their share and is in debt (owes money).

### Reproduction
1. Open the app and observe the Balances panel for members with positive/negative balances.

### Expected
Members with positive balance should display "is owed $X" in green (`owed` class). Members with negative balance should display "owes $X" in red (`owe` class).

### Actual
Creditors were shown as owing money in red, and debtors were shown as being owed money in green.

### Fix
In `src/components/BalancesPanel.jsx`, updated the condition:
- `if (bal > 0.005)` -> `label = "is owed " + formatMoney(bal); cls = "owed";`
- `else if (bal < -0.005)` -> `label = "owes " + formatMoney(-bal); cls = "owe";`

### Verification
Confirmed that positive balances show "is owed" (green) and negative balances show "owes" (red).

---

## Bug 5 — Non-participant payer improperly deducted from balances

### Problem
In `src/lib/balances.js`, an erroneous check deducted `amount / n` from the payer when the payer was not in `splitWith` (`if (!(exp.paidBy in shares) ... bal[exp.paidBy] -= amount / n`). This directly violated the README requirement that non-participant payers must be reimbursed in full and broke the closed-group zero-sum balance invariant.

### Reproduction
1. Inspect balances for seed expense `e2` ("Uber to airport" - $60 paid by Diya for Aisha and Ben).
2. Diya's balance was calculated as +$13 instead of +$43.
3. The sum of all group member balances equaled -$30.00 instead of $0.00.

### Expected
Diya should be credited the full $60 from the payer side and debited $0 on consumption, resulting in net +$43 across all expenses. Total group balance sum must be $0.00.

### Actual
A phantom consumption share was deducted from Diya, breaking the group balance sum.

### Fix
Removed the incorrect deduction block from `src/lib/balances.js`. `bal[exp.paidBy] += Number(exp.amount)` already credits what they paid, and `bal[key] -= share` debits what each participant consumed.

### Verification
Verified in automated tests that the sum of member balances on seed data equals exactly $0.00.

---

## Bug 6 — Equal split rounding loss (off-by-one cent)

### Problem
`splitEqual` in `src/lib/money.js` calculated `share = Number((amount / n).toFixed(2))` for every participant. For an amount like $100 split among 3 people, each person was assigned $33.33, totaling $99.99 and losing $0.01.

### Reproduction
1. Call `splitEqual(100, [1, 2, 3])`.

### Expected
Shares must sum exactly to the bill amount: `{ 1: 33.34, 2: 33.33, 3: 33.33 }` (sum = $100.00).

### Actual
Returned `{ 1: 33.33, 2: 33.33, 3: 33.33 }` (sum = $99.99).

### Fix
Rewrote `splitEqual` in `src/lib/money.js` to compute in integer cents (`totalCents = Math.round(amount * 100)`), calculate base cents per person (`Math.floor(totalCents / n)`), and distribute the remainder cents across participants so that `sum(shares) === amount`.

### Verification
Tested $100 across 3 people ($33.34, $33.33, $33.33), $0.05 across 3 people ($0.02, $0.02, $0.01), and $1 across 6 people. All sums match the original amount to the exact cent.

---

## Bug 7 — Percentage split rounding inaccuracies and float sum validation failure

### Problem
1. In `src/lib/money.js`, `percentsSumTo100` compared `values.reduce(...) === 100`, which failed for valid splits like `33.33 + 33.33 + 33.34` because IEEE 754 float addition produces `100.00000000000001`.
2. `splitByPercent` rounded each participant's share independently to 2 decimals, leading to invented or lost cents (e.g. $20 split 33.33%/33.33%/33.34% produced $6.67 + $6.67 + $6.67 = $20.01).

### Reproduction
1. Add an expense with percentage split `33.33%`, `33.33%`, `33.34%`. Form validation failed.
2. For $20 split with those percentages, the sum of shares was $20.01 ($0.01 invented).

### Expected
Percentages adding to 100% within fractional cents should validate successfully, and computed shares must sum exactly to the total expense amount ($20.00).

### Actual
Validation failed intermittently, and calculated shares did not reconcile with the expense total.

### Fix
- In `src/lib/money.js`, updated `percentsSumTo100` to check `Math.abs(sum - 100) < 0.01`.
- In `splitByPercent`, converted total amount to integer cents, computed cents per participant, and allocated the remaining cents to the final share so `sum(shares) === amount`.

### Verification
Verified `percentsSumTo100` and `splitByPercent` across multiple edge-case percentages and amounts in automated test suite.

---

## Bug 8 — Equal debt/credit transfers omitted in `suggestSettlements`

### Problem
In `src/lib/settle.js`, when a debtor's balance magnitude matched a creditor's balance magnitude (`d.amount === c.amount`), the `else` branch incremented both indices `i += 1; j += 1;` without pushing any transfer to `transfers`.

### Reproduction
1. Compute settlements for a group where one debtor owes $50 and one creditor is owed $50.

### Expected
`suggestSettlements` should return `[{ from: 1, to: 2, amount: 50 }]`.

### Actual
Returned `[]` (empty list), leaving both members unsettled.

### Fix
Updated `suggestSettlements` in `src/lib/settle.js` to calculate `settleAmount = Math.min(d.amount, c.amount)` and always push a transfer whenever `settleAmount > 0`, updating both debtor and creditor amounts accordingly.

### Verification
Tested equal and unequal debt settlement scenarios and verified in simulation that applying all suggested transfers reduces every member's balance to $0.00.

---

## Bug 9 — Stale member memoization in `SummaryCards`

### Problem
In `src/components/SummaryCards.jsx`, `perPerson` was computed with `useMemo` having `[expenses]` as its only dependency. When a new member was added via `onAddMember`, `members` changed but `expenses` did not, leaving `perPerson` stale and failing to render the newly added member in the "Paid so far" list.

### Reproduction
1. Type a new member name into "Add member" in the Summary card and click "Add".

### Expected
The new member should appear in the "Paid so far" section with $0.00 paid.

### Actual
The new member did not appear in "Paid so far" until an expense was changed.

### Fix
Updated the dependency array of `perPerson` to `[members, expenses]`.

### Verification
Verified in UI and component testing that adding a member immediately updates the "Paid so far" list.

---

## Bug 10 — Add Expense form inputs not resetting after submission

### Problem
In `AddExpenseForm.jsx`, submitting an expense did not reset `description`, `amount`, or `error` state, requiring the user to manually erase previous inputs before adding another expense.

### Reproduction
1. Fill out the Add Expense form and click "Save expense".

### Expected
Form inputs should clear so the user can enter the next expense.

### Actual
Previous description and amount remained in the inputs.

### Fix
Added state resets for `description`, `amount`, and `error` in `submit` handler in `src/components/AddExpenseForm.jsx`.

### Verification
Verified that adding an expense clears the input fields ready for the next entry.

---

## Bug 11 — Inconsistent date formatting and localStorage date serialization

### Problem
In `src/state/store.js`, initial state converted `e.date` to a `Date` object, but `persistState` serialized it to a JSON string. Upon reload, `JSON.parse` returned raw strings. In `src/lib/format.js`, `formatDate` returned `date.slice(0, 10)` for string dates (`"2026-03-12"`) rather than localized format (`"12 Mar 2026"`), causing date display inconsistency before and after page reload. Additionally, timezone shifts during standard `new Date("YYYY-MM-DD")` parsing could cause off-by-one day display errors in certain timezones.

### Reproduction
1. Load app from seed (displays "12 Mar 2026").
2. Refresh the page so data loads from localStorage (displayed "2026-03-12").

### Expected
Dates should format consistently as "12 Mar 2026" both on fresh load and after page reload from localStorage.

### Actual
Date display format changed upon page refresh.

### Fix
Updated `formatDate` and `dateValue` in `src/lib/format.js` to parse `YYYY-MM-DD` and ISO strings consistently without timezone shift and output formatted date strings consistently.

### Verification
Verified in automated tests and formatting checks that date display and timestamp conversion remain stable across all formats.


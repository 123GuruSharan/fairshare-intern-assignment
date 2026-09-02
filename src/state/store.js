const KEY = "fairshare-v1";

function hydrate(data) {
  return {
    groupName: data.groupName,
    members: data.members.map((m) => ({ ...m })),
    expenses: data.expenses.map((e) => ({
      ...e,
    })),
  };
}

export function loadState(seed) {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const initial = hydrate(seed);
      localStorage.setItem(KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      !Array.isArray(parsed.members) ||
      !Array.isArray(parsed.expenses)
    ) {
      return hydrate(seed);
    }
    return parsed;
  } catch {
    return hydrate(seed);
  }
}

export function persistState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Failed to persist state", e);
  }
}

export function nextExpenseId() {
  return `e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function nextMemberId(members) {
  const max = members.reduce((m, x) => (x.id > m ? x.id : m), 0);
  return max + 1;
}

export function reducer(state, action) {
  switch (action.type) {
    case "ADD_EXPENSE": {
      return { ...state, expenses: [...state.expenses, action.expense] };
    }
    case "DELETE_EXPENSE": {
      return {
        ...state,
        expenses: state.expenses.filter((e) => e.id !== action.id),
      };
    }
    case "UPDATE_EXPENSE": {
      return {
        ...state,
        expenses: state.expenses.map((e) =>
          e.id === action.id ? { ...e, ...action.patch } : e
        ),
      };
    }
    case "ADD_MEMBER": {
      return { ...state, members: [...state.members, action.member] };
    }
    default:
      return state;
  }
}


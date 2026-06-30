import { useState, useCallback, useEffect } from "react";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const CARDS = ["Barclays", "Capital One", "Other"];

const DEFAULT_BILLS = [
  { id: 1, name: "Rent", emoji: "🏠", amount: 1810, note: "" },
  { id: 2, name: "Electricity", emoji: "⚡", amount: 112, note: "" },
  { id: 3, name: "Tax", emoji: "📋", amount: 160, note: "" },
  { id: 4, name: "Water", emoji: "💧", amount: 122.52, note: "" },
  { id: 5, name: "Marchello vet", emoji: "🐶", amount: 30, note: "" },
  { id: 6, name: "Spotify", emoji: "🎵", amount: 19.99, note: "" },
  { id: 7, name: "Marchello insurance", emoji: "🐾", amount: 20, note: "" },
  { id: 8, name: "Account fee", emoji: "💰", amount: 2, note: "" },
  { id: 9, name: "Netflix", emoji: "🎬", amount: 0, note: "" },
  { id: 10, name: "Hayu", emoji: "📺", amount: 0, note: "" },
  { id: 11, name: "Disney Plus", emoji: "🎭", amount: 0, note: "" },
  { id: 12, name: "M&M Food", emoji: "🐾", amount: 70, note: "" },
  { id: 13, name: "Food", emoji: "🌮", amount: 0, note: "" },
  { id: 14, name: "Extras", emoji: "💸", amount: 0, note: "", isExtras: true },
];

const DEFAULT_DEBTS = [
  { id: 1, name: "Mika bills", card: "Barclays", balance: 491.78, instalment: 0, mode: "manual" },
  { id: 2, name: "Water Bill", card: "Capital One", balance: 193.31, instalment: 0, mode: "manual" },
  { id: 3, name: "Mykonos Spend", card: "Barclays", balance: 1512, instalment: 0, mode: "manual" },
];

const currentDate = new Date();
const INITIAL_MONTH_KEY = `${currentDate.getFullYear()}-${currentDate.getMonth()}`;

const createMonthData = (bills = DEFAULT_BILLS, debts = DEFAULT_DEBTS, loggedDebts = {}) => ({
  bills: bills.map(b => ({ ...b, note: b.note || "" })),
  debts: debts.map(d => ({ ...d })),
  loggedDebts: { ...loggedDebts },
  creditCardNote: "",
  locked: false,
  editingLocked: false,
});

const INITIAL_MONTHS = {
  [INITIAL_MONTH_KEY]: createMonthData(),
};

function parseMonthKey(key) {
  const [y, m] = key.split("-").map(Number);
  return { year: y, monthIndex: m };
}

function makeMonthKey(year, monthIndex) {
  return `${year}-${monthIndex}`;
}

function monthLabel(key) {
  const { year, monthIndex } = parseMonthKey(key);
  return `${MONTHS[monthIndex]} ${year}`;
}

function isCurrentMonthKey(key) {
  const now = new Date();
  return key === makeMonthKey(now.getFullYear(), now.getMonth());
}

export default function BudgetApp({ initialMonthsData = {}, onSave, onSaveSettings, initialSettings = {} }) {
  const [monthsData, setMonthsData] = useState(() => {
    // Use saved data from Supabase if available, otherwise start fresh
    if (initialMonthsData && Object.keys(initialMonthsData).length > 0) {
      return initialMonthsData
    }
    return INITIAL_MONTHS
  });

  // Auto-save to Supabase whenever monthsData changes
  useEffect(() => {
    if (onSave && Object.keys(monthsData).length > 0) {
      onSave(monthsData)
    }
  }, [monthsData]);

  // Save settings (emails + send day) to Supabase
  const saveSettings = () => {
    if (onSaveSettings) onSaveSettings({ email1, email2, sendDay })
    setSettingsSaved(true)
    setTimeout(() => setSettingsSaved(false), 2000)
  };
  const [activeMonthKey, setActiveMonthKey] = useState(INITIAL_MONTH_KEY);
  const [activeTab, setActiveTab] = useState("bills");
  const [newBillName, setNewBillName] = useState("");
  const [newBillAmount, setNewBillAmount] = useState("");
  const [newDebtName, setNewDebtName] = useState("");
  const [newDebtCard, setNewDebtCard] = useState("Barclays");
  const [newDebtBalance, setNewDebtBalance] = useState("");
  const [email1, setEmail1] = useState(initialSettings.email1 || "");
  const [email2, setEmail2] = useState(initialSettings.email2 || "");
  const [sendDay, setSendDay] = useState(initialSettings.sendDay || 28);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [expandedNotes, setExpandedNotes] = useState({});
  const [showLockedWarning, setShowLockedWarning] = useState(false);
  const [showNewMonthConfirm, setShowNewMonthConfirm] = useState(false);

  const currentMonthKey = makeMonthKey(new Date().getFullYear(), new Date().getMonth());
  const monthData = monthsData[activeMonthKey] || createMonthData();
  const { bills, debts, loggedDebts, creditCardNote = "" } = monthData;
  const isCurrentMonth = isCurrentMonthKey(activeMonthKey);
  const isLocked = monthData.locked && !monthData.editingLocked;

  // Sorted month keys for navigation
  const sortedKeys = Object.keys(monthsData).sort((a, b) => {
    const pa = parseMonthKey(a), pb = parseMonthKey(b);
    return pa.year !== pb.year ? pa.year - pb.year : pa.monthIndex - pb.monthIndex;
  });
  const currentKeyIdx = sortedKeys.indexOf(activeMonthKey);

  const updateMonth = useCallback((updater) => {
    setMonthsData(prev => ({
      ...prev,
      [activeMonthKey]: updater(prev[activeMonthKey] || createMonthData())
    }));
  }, [activeMonthKey]);

  // Credit card total
  const totalCreditForBills = debts
    .filter(d => parseFloat(d.instalment) > 0)
    .reduce((sum, d) => sum + parseFloat(d.instalment), 0);

  const effectiveBills = (() => {
    const base = bills.filter(b => b.id !== "cc");
    if (totalCreditForBills > 0) {
      const extrasIdx = base.findIndex(b => b.isExtras);
      const insertAt = extrasIdx >= 0 ? extrasIdx : base.length;
      const next = [...base];
      next.splice(insertAt, 0, { id: "cc", name: "Credit Cards", emoji: "💳", amount: totalCreditForBills, isCredit: true, note: creditCardNote });
      return next;
    }
    return base;
  })();

  const total = effectiveBills.reduce((sum, b) => sum + (parseFloat(b.amount) || 0), 0);
  const each = total / 2;

  // Bill actions
  const updateBill = (id, field, value) => {
    updateMonth(m => ({ ...m, bills: m.bills.map(b => b.id === id ? { ...b, [field]: value } : b) }));
  };
  const removeBill = (id) => {
    updateMonth(m => ({ ...m, bills: m.bills.filter(b => b.id !== id) }));
  };
  const addBill = () => {
    if (!newBillName.trim()) return;
    updateMonth(m => ({
      ...m,
      bills: [...m.bills, { id: Date.now(), name: newBillName, emoji: "💳", amount: parseFloat(newBillAmount) || 0, note: "" }]
    }));
    setNewBillName(""); setNewBillAmount("");
  };

  const updateCreditCardNote = (value) => {
    updateMonth(m => ({ ...m, creditCardNote: value }));
  };

  // Debt actions
  const updateDebt = (id, field, value) => {
    updateMonth(m => ({ ...m, debts: m.debts.map(d => d.id === id ? { ...d, [field]: value } : d) }));
  };
  const logPayment = (id) => {
    const debt = debts.find(d => d.id === id);
    if (!debt) return;
    const payment = parseFloat(debt.instalment) || 0;
    if (payment <= 0) return;
    const previousBalance = parseFloat(debt.balance);
    const newBalance = Math.max(0, previousBalance - payment);
    updateMonth(m => ({
      ...m,
      debts: m.debts.map(d => d.id !== id ? d : { ...d, balance: parseFloat(newBalance.toFixed(2)) }),
      loggedDebts: { ...m.loggedDebts, [id]: { logged: true, previousBalance } }
    }));
  };
  const undoPayment = (id) => {
    const logState = loggedDebts[id];
    if (!logState) return;
    updateMonth(m => ({
      ...m,
      debts: m.debts.map(d => d.id !== id ? d : { ...d, balance: logState.previousBalance }),
      loggedDebts: { ...m.loggedDebts, [id]: null }
    }));
  };
  const confirmDeleteDebt = (id) => setConfirmDelete(id);
  const removeDebt = () => {
    updateMonth(m => ({ ...m, debts: m.debts.filter(d => d.id !== confirmDelete) }));
    setConfirmDelete(null);
  };
  const addDebt = () => {
    if (!newDebtName.trim() || !newDebtBalance) return;
    updateMonth(m => ({
      ...m,
      debts: [...m.debts, { id: Date.now(), name: newDebtName, card: newDebtCard, balance: parseFloat(newDebtBalance), instalment: 0, mode: "manual" }]
    }));
    setNewDebtName(""); setNewDebtBalance(""); setNewDebtCard("Barclays");
  };

  // Month navigation
  const goToPrevMonth = () => {
    if (currentKeyIdx > 0) setActiveMonthKey(sortedKeys[currentKeyIdx - 1]);
  };
  const goToNextMonth = () => {
    if (currentKeyIdx < sortedKeys.length - 1) setActiveMonthKey(sortedKeys[currentKeyIdx + 1]);
  };

  const startNewMonth = () => {
    const { year, monthIndex } = parseMonthKey(activeMonthKey);
    const nextMonthIndex = monthIndex === 11 ? 0 : monthIndex + 1;
    const nextYear = monthIndex === 11 ? year + 1 : year;
    const nextKey = makeMonthKey(nextYear, nextMonthIndex);
    if (monthsData[nextKey]) { setActiveMonthKey(nextKey); return; }

    // Roll over bills — reset Extras to 0
    const rolledBills = bills
      .filter(b => b.id !== "cc")
      .map(b => ({ ...b, amount: b.isExtras ? 0 : b.amount, note: "" }));

    // Lock current month, create next
    setMonthsData(prev => ({
      ...prev,
      [activeMonthKey]: { ...prev[activeMonthKey], locked: true, editingLocked: false },
      [nextKey]: createMonthData(rolledBills, debts, {})
    }));
    setActiveMonthKey(nextKey);
    setShowNewMonthConfirm(false);
  };

  const handleLockedEdit = () => {
    updateMonth(m => ({ ...m, editingLocked: true }));
    setShowLockedWarning(false);
  };

  const totalDebt = debts.reduce((sum, d) => sum + parseFloat(d.balance || 0), 0);
  const barclaysDebt = debts.filter(d => d.card === "Barclays").reduce((sum, d) => sum + parseFloat(d.balance || 0), 0);
  const capitalOneDebt = debts.filter(d => d.card === "Capital One").reduce((sum, d) => sum + parseFloat(d.balance || 0), 0);

  const sendEmail = async () => {
    if (!email1 && !email2) { setError("Please add at least one email in Settings."); setActiveTab("settings"); return; }
    setSending(true); setError("");
    try {
      await new Promise(r => setTimeout(r, 1500));
      setSent(true); setTimeout(() => setSent(false), 4000);
    } catch { setError("Failed to send. Please try again."); }
    setSending(false);
  };

  const toggleNote = (id) => setExpandedNotes(prev => ({ ...prev, [id]: !prev[id] }));

  const inputStyle = {
    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "10px", color: "#fff", padding: "10px 12px", fontSize: "14px",
    width: "100%", boxSizing: "border-box", outline: "none",
  };
  const cardStyle = {
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "14px", padding: "16px",
  };

  return (
    <>
    <style>{`
      @media (min-width: 640px) {
        .budget-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
        .budget-full { grid-column: 1 / -1; }
        .budget-tabs { display: flex; }
      }
      @media (max-width: 639px) {
        .budget-grid { display: block; }
      }
      * { -webkit-tap-highlight-color: transparent; }
      input:focus, textarea:focus, select:focus { outline: 2px solid rgba(167,139,250,0.5); outline-offset: 1px; }
    `}</style>
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      color: "#fff",
    }}>
    <div style={{
      maxWidth: "900px",
      margin: "0 auto",
      padding: "0 20px",
      paddingBottom: "80px",
    }}>

      {/* Header */}
      <div style={{ padding: "28px 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 800, letterSpacing: "-0.5px" }}>🏡 Home Budget</h1>
            <p style={{ margin: "3px 0 0", fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>Auto-sends on the 28th</p>
          </div>
          {/* Month navigation */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button onClick={goToPrevMonth} disabled={currentKeyIdx === 0} style={{
              background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "8px",
              color: currentKeyIdx === 0 ? "rgba(255,255,255,0.2)" : "#fff",
              padding: "8px 11px", cursor: currentKeyIdx === 0 ? "default" : "pointer", fontSize: "14px"
            }}>‹</button>
            <span style={{ fontSize: "13px", fontWeight: 700, minWidth: "110px", textAlign: "center" }}>
              {monthLabel(activeMonthKey)}
            </span>
            <button onClick={goToNextMonth} disabled={currentKeyIdx === sortedKeys.length - 1} style={{
              background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "8px",
              color: currentKeyIdx === sortedKeys.length - 1 ? "rgba(255,255,255,0.2)" : "#fff",
              padding: "8px 11px", cursor: currentKeyIdx === sortedKeys.length - 1 ? "default" : "pointer", fontSize: "14px"
            }}>›</button>
          </div>
        </div>

        {/* Locked month banner */}
        {monthData.locked && !monthData.editingLocked && (
          <div style={{
            background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)",
            borderRadius: "10px", padding: "10px 14px", marginBottom: "12px",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px"
          }}>
            <span style={{ fontSize: "12px", color: "rgba(251,191,36,0.9)" }}>
              🔒 You're viewing a previous month
            </span>
            <div style={{ display: "flex", gap: "6px" }}>
              <button onClick={() => setActiveMonthKey(currentMonthKey)} style={{
                background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "7px",
                color: "#fff", padding: "5px 10px", fontSize: "11px", fontWeight: 600, cursor: "pointer"
              }}>Current</button>
              <button onClick={() => setShowLockedWarning(true)} style={{
                background: "rgba(251,191,36,0.2)", border: "1px solid rgba(251,191,36,0.4)",
                borderRadius: "7px", color: "#fbbf24", padding: "5px 10px", fontSize: "11px", fontWeight: 600, cursor: "pointer"
              }}>Edit</button>
            </div>
          </div>
        )}

        {/* Editing locked month indicator */}
        {monthData.locked && monthData.editingLocked && (
          <div style={{
            background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.25)",
            borderRadius: "10px", padding: "8px 14px", marginBottom: "12px",
            fontSize: "12px", color: "rgba(251,191,36,0.7)", display: "flex", justifyContent: "space-between", alignItems: "center"
          }}>
            <span>✏️ Editing previous month</span>
            <button onClick={() => setActiveMonthKey(currentMonthKey)} style={{
              background: "none", border: "none", color: "rgba(251,191,36,0.8)", fontSize: "11px", fontWeight: 600, cursor: "pointer"
            }}>Go to current →</button>
          </div>
        )}

        {/* Totals */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <div style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.35), rgba(59,130,246,0.25))", border: "1px solid rgba(139,92,246,0.35)", borderRadius: "14px", padding: "16px" }}>
            <p style={{ margin: 0, fontSize: "11px", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.6px" }}>Total bills</p>
            <p style={{ margin: "6px 0 0", fontSize: "26px", fontWeight: 800, lineHeight: 1 }}>£{total.toFixed(2)}</p>
          </div>
          <div style={{ background: "linear-gradient(135deg, rgba(167,139,250,0.25), rgba(99,102,241,0.2))", border: "1px solid rgba(167,139,250,0.3)", borderRadius: "14px", padding: "16px" }}>
            <p style={{ margin: 0, fontSize: "11px", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.6px" }}>Each pays</p>
            <p style={{ margin: "6px 0 0", fontSize: "26px", fontWeight: 800, lineHeight: 1, color: "#c4b5fd" }}>£{each.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "0" }}>
        {[
          { key: "bills", label: "💳 Bills" },
          { key: "cards", label: "🏦 Cards" },
          { key: "preview", label: "👀 Preview" },
          { key: "settings", label: "⚙️" },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            flex: 1, background: "none", border: "none",
            borderBottom: activeTab === tab.key ? "2px solid #a78bfa" : "2px solid transparent",
            color: activeTab === tab.key ? "#a78bfa" : "rgba(255,255,255,0.35)",
            padding: "13px 0", fontSize: "12px", fontWeight: activeTab === tab.key ? 700 : 400,
            cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap",
          }}>{tab.label}</button>
        ))}
      </div>

      <div style={{ padding: "20px 0" }}>

        {/* BILLS TAB */}
        {activeTab === "bills" && (
          <div>
            {totalCreditForBills > 0 && (
              <div style={{
                background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.25)",
                borderRadius: "10px", padding: "10px 14px", marginBottom: "14px",
                fontSize: "12px", color: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", gap: "8px"
              }}>
                <span>💳</span><span>£{totalCreditForBills.toFixed(2)} in credit card payments this month</span>
              </div>
            )}

            <div className="budget-grid">
              {effectiveBills.map(bill => (
                <div key={bill.id} style={{
                  ...cardStyle, padding: "0",
                  opacity: parseFloat(bill.amount) === 0 ? 0.45 : 1,
                  border: bill.isCredit ? "1px solid rgba(167,139,250,0.3)" : "1px solid rgba(255,255,255,0.08)",
                  overflow: "hidden"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 14px" }}>
                    <span style={{ fontSize: "18px", minWidth: "24px" }}>{bill.emoji}</span>
                    <span style={{ flex: 1, fontSize: "14px", fontWeight: 500, color: bill.isCredit ? "#c4b5fd" : "#fff" }}>{bill.name}</span>
                    {/* Note toggle */}
                    <button onClick={() => toggleNote(bill.id)} style={{
                      background: "none", border: "none", cursor: "pointer", fontSize: "14px",
                      opacity: bill.note ? 1 : 0.3, padding: "2px 4px"
                    }} title="Add note">📝</button>
                    <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                      <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "13px" }}>£</span>
                      <input
                        type="number" value={bill.amount}
                        onChange={e => !bill.isCredit && !isLocked && updateBill(bill.id, "amount", e.target.value)}
                        readOnly={bill.isCredit || isLocked} step="0.01"
                        style={{
                          ...inputStyle, width: "80px", textAlign: "right", fontWeight: 700, fontSize: "15px", padding: "6px 8px",
                          background: bill.isCredit ? "rgba(167,139,250,0.1)" : "rgba(255,255,255,0.06)",
                          color: bill.isCredit ? "#c4b5fd" : "#fff",
                        }}
                      />
                    </div>
                    {!bill.isCredit && !isLocked && (
                      <button onClick={() => removeBill(bill.id)} style={{
                        background: "rgba(239,68,68,0.12)", border: "none", borderRadius: "7px",
                        color: "#f87171", padding: "5px 9px", cursor: "pointer", fontSize: "13px"
                      }}>✕</button>
                    )}
                  </div>
                  {/* Note field — always mounted, shown/hidden via CSS to prevent mobile focus loss */}
                  <div style={{
                    maxHeight: expandedNotes[bill.id] ? "80px" : "0px",
                    overflow: "hidden", transition: "max-height 0.2s ease",
                    borderTop: expandedNotes[bill.id] ? "1px solid rgba(255,255,255,0.06)" : "none"
                  }}>
                    <textarea
                      placeholder="Add a note..."
                      value={bill.isCredit ? creditCardNote : (bill.note || "")}
                      onChange={e => bill.isCredit ? updateCreditCardNote(e.target.value) : updateBill(bill.id, "note", e.target.value)}
                      readOnly={isLocked}
                      rows={2}
                      style={{
                        ...inputStyle, fontSize: "12px", marginTop: "10px",
                        color: "rgba(255,255,255,0.7)", resize: "none",
                        display: "block", lineHeight: 1.5
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {!isLocked && (
              <div style={{ marginTop: "14px", ...cardStyle, border: "1px dashed rgba(139,92,246,0.35)", background: "rgba(139,92,246,0.06)" }}>
                <p style={{ margin: "0 0 10px", fontSize: "12px", color: "rgba(255,255,255,0.4)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px" }}>Add a bill</p>
                <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                  <input type="text" placeholder="Bill name" value={newBillName} onChange={e => setNewBillName(e.target.value)} onKeyDown={e => e.key === "Enter" && addBill()} style={{ ...inputStyle, flex: 1 }} />
                  <input type="number" placeholder="£0" value={newBillAmount} onChange={e => setNewBillAmount(e.target.value)} onKeyDown={e => e.key === "Enter" && addBill()} style={{ ...inputStyle, width: "80px", textAlign: "right" }} />
                </div>
                <button onClick={addBill} style={{
                  width: "100%", background: "rgba(139,92,246,0.25)", border: "1px solid rgba(139,92,246,0.4)",
                  borderRadius: "9px", color: "#c4b5fd", padding: "10px", fontSize: "13px", fontWeight: 700, cursor: "pointer"
                }}>+ Add bill</button>
              </div>
            )}

            {/* Start new month button — only on current month */}
            {isCurrentMonth && (
              <button onClick={() => setShowNewMonthConfirm(true)} style={{
                width: "100%", marginTop: "16px",
                background: "linear-gradient(135deg, #7c3aed, #3b82f6)",
                border: "none", borderRadius: "14px", color: "#fff",
                padding: "14px", fontSize: "14px", fontWeight: 700, cursor: "pointer"
              }}>
                Start {MONTHS[(parseMonthKey(activeMonthKey).monthIndex + 1) % 12]} →
              </button>
            )}
          </div>
        )}

        {/* CARDS TAB */}
        {activeTab === "cards" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "16px" }}>
              {[
                { label: "Total owed", value: totalDebt, color: "#f87171" },
                { label: "Barclays", value: barclaysDebt, color: "#60a5fa" },
                { label: "Capital One", value: capitalOneDebt, color: "#34d399" },
              ].map(s => (
                <div key={s.label} style={{ ...cardStyle, padding: "12px", textAlign: "center" }}>
                  <p style={{ margin: 0, fontSize: "10px", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.4px" }}>{s.label}</p>
                  <p style={{ margin: "4px 0 0", fontSize: "16px", fontWeight: 800, color: s.color }}>£{s.value.toFixed(0)}</p>
                </div>
              ))}
            </div>

            {totalCreditForBills > 0 && (
              <div style={{
                background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.25)",
                borderRadius: "10px", padding: "10px 14px", marginBottom: "14px",
                fontSize: "12px", color: "rgba(255,255,255,0.6)"
              }}>
                💳 <strong style={{ color: "#c4b5fd" }}>£{totalCreditForBills.toFixed(2)}</strong> added to this month's bills — update amounts below to adjust
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {debts.map(debt => (
                <div key={debt.id} style={{
                  ...cardStyle,
                  border: parseFloat(debt.instalment) > 0 ? "1px solid rgba(167,139,250,0.35)" : "1px solid rgba(255,255,255,0.08)"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                    <div>
                      <p style={{ margin: 0, fontSize: "15px", fontWeight: 700 }}>{debt.name}</p>
                      <span style={{
                        display: "inline-block", marginTop: "4px",
                        background: debt.card === "Barclays" ? "rgba(96,165,250,0.15)" : debt.card === "Capital One" ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.1)",
                        border: `1px solid ${debt.card === "Barclays" ? "rgba(96,165,250,0.3)" : debt.card === "Capital One" ? "rgba(52,211,153,0.3)" : "rgba(255,255,255,0.2)"}`,
                        borderRadius: "6px", padding: "2px 8px", fontSize: "11px",
                        color: debt.card === "Barclays" ? "#60a5fa" : debt.card === "Capital One" ? "#34d399" : "#fff", fontWeight: 600
                      }}>{debt.card}</span>
                    </div>
                    {!isLocked && (
                      <button onClick={() => confirmDeleteDebt(debt.id)} style={{
                        background: "rgba(239,68,68,0.12)", border: "none", borderRadius: "7px",
                        color: "#f87171", padding: "5px 9px", cursor: "pointer", fontSize: "13px"
                      }}>✕</button>
                    )}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "12px" }}>
                    <div>
                      <p style={{ margin: "0 0 5px", fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>Balance remaining</p>
                      <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                        <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "13px" }}>£</span>
                        <input type="number" value={debt.balance} onChange={e => !isLocked && updateDebt(debt.id, "balance", e.target.value)} step="0.01" readOnly={isLocked}
                          style={{ ...inputStyle, fontWeight: 700, fontSize: "15px", color: "#f87171", padding: "7px 8px" }} />
                      </div>
                    </div>
                    <div>
                      <p style={{ margin: "0 0 5px", fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>Pay this month</p>
                      <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                        <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "13px" }}>£</span>
                        <input type="number" value={debt.instalment} onChange={e => !isLocked && updateDebt(debt.id, "instalment", e.target.value)} step="0.01" readOnly={isLocked}
                          style={{ ...inputStyle, fontWeight: 700, fontSize: "15px", color: "#c4b5fd", padding: "7px 8px" }} />
                      </div>
                    </div>
                  </div>

                  {parseFloat(debt.instalment) > 0 && (
                    <div style={{
                      background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)",
                      borderRadius: "8px", padding: "8px 12px", fontSize: "12px", color: "rgba(255,255,255,0.5)", marginBottom: "10px"
                    }}>
                      £{parseFloat(debt.instalment).toFixed(2)} added to <strong style={{ color: "#c4b5fd" }}>Credit Cards</strong> in bills. Change the amount above to adjust.
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
                    {["manual", "auto"].map(mode => (
                      <button key={mode} onClick={() => !isLocked && updateDebt(debt.id, "mode", mode)} style={{
                        flex: 1,
                        background: debt.mode === mode ? mode === "auto" ? "rgba(167,139,250,0.25)" : "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
                        border: debt.mode === mode ? mode === "auto" ? "1px solid rgba(167,139,250,0.5)" : "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(255,255,255,0.08)",
                        borderRadius: "9px", color: debt.mode === mode ? "#fff" : "rgba(255,255,255,0.35)",
                        padding: "8px", fontSize: "12px", fontWeight: 600, cursor: isLocked ? "default" : "pointer", transition: "all 0.15s"
                      }}>
                        {mode === "auto" ? "⚡ Auto" : "✋ Manual"}
                      </button>
                    ))}
                  </div>

                  {debt.mode === "auto" && (
                    <div style={{
                      background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.15)",
                      borderRadius: "8px", padding: "8px 12px", fontSize: "12px", color: "rgba(255,255,255,0.4)", marginBottom: "10px"
                    }}>
                      ⚡ Auto mode — this amount will be included every month automatically
                    </div>
                  )}

                  {debt.mode === "manual" && parseFloat(debt.instalment) > 0 && !isLocked && (
                    <div style={{ display: "flex", gap: "8px" }}>
                      {loggedDebts[debt.id]?.logged ? (
                        <>
                          <div style={{
                            flex: 1, background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.35)",
                            borderRadius: "9px", color: "#34d399", padding: "9px", fontSize: "13px", fontWeight: 600, textAlign: "center"
                          }}>
                            ✓ Paid this month — balance £{debt.balance.toFixed(2)}
                          </div>
                          <button onClick={() => undoPayment(debt.id)} style={{
                            background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
                            borderRadius: "9px", color: "#f87171", padding: "9px 14px",
                            fontSize: "13px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap"
                          }}>Undo</button>
                        </>
                      ) : (
                        <button onClick={() => logPayment(debt.id)} style={{
                          flex: 1, background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.25)",
                          borderRadius: "9px", color: "#34d399", padding: "9px",
                          fontSize: "13px", fontWeight: 600, cursor: "pointer"
                        }}>
                          Log payment of £{parseFloat(debt.instalment).toFixed(2)}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {!isLocked && (
              <div style={{ marginTop: "14px", ...cardStyle, border: "1px dashed rgba(139,92,246,0.35)", background: "rgba(139,92,246,0.06)" }}>
                <p style={{ margin: "0 0 10px", fontSize: "12px", color: "rgba(255,255,255,0.4)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px" }}>Add a debt</p>
                <div className="budget-grid">
                  <input type="text" placeholder="Debt name" value={newDebtName} onChange={e => setNewDebtName(e.target.value)} style={inputStyle} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <select value={newDebtCard} onChange={e => setNewDebtCard(e.target.value)} style={inputStyle}>
                      {CARDS.map(c => <option key={c} value={c} style={{ background: "#302b63" }}>{c}</option>)}
                    </select>
                    <input type="number" placeholder="Balance £" value={newDebtBalance} onChange={e => setNewDebtBalance(e.target.value)} style={inputStyle} />
                  </div>
                  <button onClick={addDebt} style={{
                    width: "100%", background: "rgba(139,92,246,0.25)", border: "1px solid rgba(139,92,246,0.4)",
                    borderRadius: "9px", color: "#c4b5fd", padding: "10px", fontSize: "13px", fontWeight: 700, cursor: "pointer"
                  }}>+ Add debt</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PREVIEW TAB */}
        {activeTab === "preview" && (
          <div>
            <div style={{ ...cardStyle, marginBottom: "14px" }}>
              <p style={{ margin: "0 0 4px", fontSize: "11px", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Email preview</p>
              <p style={{ margin: "0 0 16px", fontSize: "20px", fontWeight: 800 }}>💰 {monthLabel(activeMonthKey)} Budget</p>
              <p style={{ margin: "0 0 12px", fontSize: "14px", color: "rgba(255,255,255,0.6)" }}>Hi! Here's this month's breakdown:</p>
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: "10px" }}>
                {effectiveBills.filter(b => parseFloat(b.amount) > 0).map(b => (
                  <div key={b.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <span style={{ fontSize: "14px", color: b.isCredit ? "#c4b5fd" : "#fff" }}>{b.emoji} {b.name}</span>
                      <span style={{ fontSize: "14px", fontWeight: 700, color: b.isCredit ? "#c4b5fd" : "#fff" }}>£{parseFloat(b.amount).toFixed(2)}</span>
                    </div>
                    {b.note && <p style={{ margin: "2px 0 4px 28px", fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>📝 {b.note}</p>}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: "14px", paddingTop: "14px", borderTop: "1px solid rgba(255,255,255,0.12)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ fontWeight: 600, fontSize: "15px" }}>Total</span>
                  <span style={{ fontWeight: 800, fontSize: "15px" }}>£{total.toFixed(2)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 600, fontSize: "17px", color: "#c4b5fd" }}>Each pays</span>
                  <span style={{ fontWeight: 800, fontSize: "22px", color: "#c4b5fd" }}>£{each.toFixed(2)}</span>
                </div>
              </div>
              <p style={{ margin: "14px 0 0", fontSize: "13px", color: "rgba(255,255,255,0.35)" }}>
                Please transfer £{each.toFixed(2)} to the joint account before the 1st! 🙏
              </p>
            </div>
            {error && (
              <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "10px", padding: "12px 16px", marginBottom: "12px", fontSize: "14px", color: "#f87171" }}>
                {error}
              </div>
            )}
            <button onClick={sendEmail} disabled={sending || sent} style={{
              width: "100%",
              background: sent ? "rgba(52,211,153,0.15)" : "linear-gradient(135deg, #7c3aed, #3b82f6)",
              border: sent ? "1px solid rgba(52,211,153,0.4)" : "none",
              borderRadius: "14px", color: sent ? "#34d399" : "#fff",
              padding: "17px", fontSize: "16px", fontWeight: 800,
              cursor: sending || sent ? "default" : "pointer", transition: "all 0.3s"
            }}>
              {sending ? "Sending..." : sent ? "✓ Sent!" : "Send now"}
            </button>
            <p style={{ margin: "10px 0 0", fontSize: "12px", color: "rgba(255,255,255,0.25)", textAlign: "center" }}>
              Auto-sends to both of you on the 28th each month
            </p>
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === "settings" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label style={{ fontSize: "13px", color: "rgba(255,255,255,0.45)", display: "block", marginBottom: "7px" }}>Your email</label>
              <input type="email" placeholder="you@email.com" value={email1} onChange={e => setEmail1(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: "13px", color: "rgba(255,255,255,0.45)", display: "block", marginBottom: "7px" }}>Partner's email</label>
              <input type="email" placeholder="partner@email.com" value={email2} onChange={e => setEmail2(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: "13px", color: "rgba(255,255,255,0.45)", display: "block", marginBottom: "7px" }}>Send email on day</label>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <input
                  type="number" min="1" max="31" value={sendDay}
                  onChange={e => setSendDay(Math.min(31, Math.max(1, parseInt(e.target.value) || 1)))}
                  style={{ ...inputStyle, width: "80px", textAlign: "center", fontWeight: 700, fontSize: "18px" }}
                />
                <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>
                  of every month<br />
                  <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.25)" }}>If the month is shorter, sends on the last day</span>
                </span>
              </div>
            </div>
            <div style={{ ...cardStyle, background: "rgba(139,92,246,0.07)", border: "1px solid rgba(139,92,246,0.2)" }}>
              <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.45)", lineHeight: 1.7 }}>
                📅 The budget email will automatically send to both addresses on the <strong style={{ color: "#a78bfa" }}>{sendDay}{sendDay === 1 ? 'st' : sendDay === 2 ? 'nd' : sendDay === 3 ? 'rd' : 'th'} of every month</strong>.
              </p>
            </div>
            <button onClick={() => { setSettingsSaved(true); setTimeout(() => setSettingsSaved(false), 2000); }} style={{
              width: "100%",
              background: settingsSaved ? "rgba(52,211,153,0.15)" : "linear-gradient(135deg, #7c3aed, #3b82f6)",
              border: settingsSaved ? "1px solid rgba(52,211,153,0.4)" : "none",
              borderRadius: "14px", color: settingsSaved ? "#34d399" : "#fff",
              padding: "16px", fontSize: "16px", fontWeight: 800, cursor: "pointer", transition: "all 0.3s"
            }}>
              {settingsSaved ? "✓ Saved!" : "Save settings"}
            </button>
          </div>
        )}
      </div>

    </div>
      {/* Confirm delete debt modal */}
      {confirmDelete && (() => {
        const debt = debts.find(d => d.id === confirmDelete);
        return (
          <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000, padding: "24px", backdropFilter: "blur(4px)"
          }}>
            <div style={{
              background: "linear-gradient(160deg, #1a1640, #2a2455)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "20px", padding: "28px 24px",
              maxWidth: "320px", width: "100%", textAlign: "center"
            }}>
              <div style={{ fontSize: "36px", marginBottom: "12px" }}>⚠️</div>
              <h3 style={{ margin: "0 0 8px", fontSize: "18px", fontWeight: 800 }}>Remove this debt?</h3>
              <p style={{ margin: "0 0 6px", fontSize: "14px", color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>
                You're about to remove <strong style={{ color: "#fff" }}>{debt?.name}</strong>
              </p>
              <p style={{ margin: "0 0 24px", fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>
                This will delete the debt record. This can't be undone.
              </p>
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={() => setConfirmDelete(null)} style={{
                  flex: 1, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: "12px", color: "#fff", padding: "13px", fontSize: "14px", fontWeight: 600, cursor: "pointer"
                }}>Cancel</button>
                <button onClick={removeDebt} style={{
                  flex: 1, background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.4)",
                  borderRadius: "12px", color: "#f87171", padding: "13px", fontSize: "14px", fontWeight: 700, cursor: "pointer"
                }}>Yes, remove it</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Locked month edit warning modal */}
      {showLockedWarning && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1000, padding: "24px", backdropFilter: "blur(4px)"
        }}>
          <div style={{
            background: "linear-gradient(160deg, #1a1640, #2a2455)",
            border: "1px solid rgba(251,191,36,0.25)",
            borderRadius: "20px", padding: "28px 24px",
            maxWidth: "320px", width: "100%", textAlign: "center"
          }}>
            <div style={{ fontSize: "36px", marginBottom: "12px" }}>🔒</div>
            <h3 style={{ margin: "0 0 8px", fontSize: "18px", fontWeight: 800 }}>Edit previous month?</h3>
            <p style={{ margin: "0 0 24px", fontSize: "14px", color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
              You're about to edit <strong style={{ color: "#fbbf24" }}>{monthLabel(activeMonthKey)}</strong>. This is a previous month — are you sure you want to make changes?
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => { setActiveMonthKey(currentMonthKey); setShowLockedWarning(false); }} style={{
                flex: 1, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: "12px", color: "#fff", padding: "13px", fontSize: "14px", fontWeight: 600, cursor: "pointer"
              }}>Go to current</button>
              <button onClick={handleLockedEdit} style={{
                flex: 1, background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.35)",
                borderRadius: "12px", color: "#fbbf24", padding: "13px", fontSize: "14px", fontWeight: 700, cursor: "pointer"
              }}>Edit anyway</button>
            </div>
          </div>
        </div>
      )}

      {/* New month confirmation modal */}
      {showNewMonthConfirm && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1000, padding: "24px", backdropFilter: "blur(4px)"
        }}>
          <div style={{
            background: "linear-gradient(160deg, #1a1640, #2a2455)",
            border: "1px solid rgba(139,92,246,0.25)",
            borderRadius: "20px", padding: "28px 24px",
            maxWidth: "320px", width: "100%", textAlign: "center"
          }}>
            <div style={{ fontSize: "36px", marginBottom: "12px" }}>📅</div>
            <h3 style={{ margin: "0 0 8px", fontSize: "18px", fontWeight: 800 }}>
              Start {MONTHS[(parseMonthKey(activeMonthKey).monthIndex + 1) % 12]}?
            </h3>
            <p style={{ margin: "0 0 24px", fontSize: "14px", color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
              This will lock <strong style={{ color: "#fff" }}>{monthLabel(activeMonthKey)}</strong> and create a new month with your bills rolled over. Extras will reset to £0.
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setShowNewMonthConfirm(false)} style={{
                flex: 1, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: "12px", color: "#fff", padding: "13px", fontSize: "14px", fontWeight: 600, cursor: "pointer"
              }}>Cancel</button>
              <button onClick={startNewMonth} style={{
                flex: 1, background: "linear-gradient(135deg, #7c3aed, #3b82f6)", border: "none",
                borderRadius: "12px", color: "#fff", padding: "13px", fontSize: "14px", fontWeight: 700, cursor: "pointer"
              }}>Yes, start it</button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}

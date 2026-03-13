<<<<<<< HEAD
# MAI ROI Calculator

A lightweight **ROI calculator** that estimates savings and return on investment for deploying MAI wearable solutions (scanner, guidance, lookup, etc.) in a warehouse or industrial environment.

This is a **static, client-side** web app built with **vanilla HTML/CSS/JavaScript**. It runs entirely in the browser (no server required).

---

## ✅ Features

- Enter operational assumptions (work days, shifts, labor cost)
- Configure time-saving feature scenarios (scanning, guidance, lookups, inputs)
- Specify product costs and integration expenses
- View key KPIs including payback period, ROI, and annual savings
- Interactive charts (savings breakdown + payback period)
- Export / import your configuration as JSON
- Print results to PDF
- Guided tour to walk through key sections

---

## ▶️ How to Run

1. Open `index.html` in a modern browser (Chrome / Edge / Firefox).
2. All calculations happen instantly as you change inputs.

> **Tip:** No build step is required.

---

## 🧠 How It Works (High Level)

- `app.js` manages app state and performs calculations
- Derived values (e.g., workdays per year, labor cost per second) update automatically
- Savings are computed per feature and rolled up into cost/time savings and ROI
- Investments include:
  - Product costs (hardware + licenses)
  - Integration costs (one-time fee + hours)

---

## 📦 Files

- `index.html` – UI layout + export/import buttons
- `styles.css` – styling
- `app.js` – application logic and charts
- `debug.html` / `test.html` – auxiliary pages (if present)

---

## 🛠️ Notes

- Uses Chart.js for charts and FileSaver.js for JSON export
- Designed for desktop/tablet use (prints cleanly via browser print to PDF)

---

## 🙋‍♂️ Want to Customize?

- Adjust default assumptions in `app.js` under `defaultState`
- Add/remove product types in `state.products`
- Modify the guided tour steps in `app.js` under `tourSteps`
=======
# MAI-ROI-Calculator
Customer Return on Investement Calculator
>>>>>>> 51776bdab59923b8ae387dc1d1e840899e0e2214

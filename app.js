// ROI Calculator - Main Application Logic
// Pure vanilla JavaScript with modular architecture

// ==================== STATE ====================
const defaultState = {
  assumptions: {
    weeksPerMonth: 4,
    workdaysPerWeek: 5,
    workdaysPerMonth: null, // Calculated: weeksPerMonth × workdaysPerWeek
    workdaysPerYear: null, // Calculated: workdaysPerMonth × 12
    workstations: 50,
    shiftsPerDay: 1,
    hoursPerShift: 7.5,
    laborCostPerHour: 45,
    laborCostPerSecond: null, // Calculated: laborCostPerHour ÷ 3600
    laborCostPerMonthPerWS: null, // Calculated: laborCostPerHour × hoursPerShift × shiftsPerDay × workdaysPerMonth (per workstation)
    laborCostPerMonthTotal: null // Calculated: laborCostPerMonthPerWS × workstations (all workstations)
  },
  features: {
    scanning: {
      enabled: true,
      quantityScansPerShift: 1000,
      scansPerMinute: null, // Calculated: quantityScansPerShift / minutesPerShift
      timePerScanBefore: 4,
      timePerScanWith: 1.5
    },
    workerGuidance: {
      enabled: true,
      quantityPerShift: 1000,
      perScanRatio: 0.3,
      timeWithout: 4,
      timeWith: 1.5
    },
    informationLookup: {
      enabled: true,
      quantityPerShift: 50,
      perScanRatio: 0.1,
      timeWithout: 7,
      timeWith: 3
    },
    simpleInput: {
      enabled: true,
      quantityPerShift: 100,
      perScanRatio: 0.2,
      timeWithout: 8,
      timeWith: 4
    },
    moderateInput: {
      enabled: true,
      quantityPerShift: 20,
      perScanRatio: 0.05,
      timeWithout: 15,
      timeWith: 10
    }
  },
  confidence: 80,
  products: [
    {
      id: "p1",
      name: "MAI",
      listPrice: 1749,
      quantity: 1,
      selected: true,
      category: "hardware_one_time"
    },
    {
      id: "p2",
      name: "Insight Control (yrly)",
      listPrice: 36,
      quantity: 3,
      selected: true,
      category: "license_recurring",
      recurrence: "per_year",
      mutuallyExclusive: "insight"
    },
    {
      id: "p3",
      name: "Insight Enhance (yrly)",
      listPrice: 120,
      quantity: 3,
      selected: false,
      category: "license_recurring",
      recurrence: "per_year",
      mutuallyExclusive: "insight"
    },
    {
      id: "p4",
      name: "ProGlove Care (3 yrs SLA)",
      listPrice: 403,
      quantity: 1,
      selected: true,
      category: "license_recurring",
      recurrence: "per_year"
    },
    {
      id: "p5",
      name: "Hand Strap Gen2",
      listPrice: 36,
      quantity: 12,
      selected: true,
      category: "hardware_one_time"
    },
    {
      id: "p6",
      name: "Charging Station Gen 2",
      listPrice: 189,
      quantity: 0.5,
      selected: true,
      category: "hardware_one_time"
    }
  ],
  productDiscount: 20,
  integration: {
    fixedFeeOneTime: 15000,
    hours: 120,
    hourlyRate: 120
  },
  currency: "€"
};


let state = JSON.parse(JSON.stringify(defaultState));
let charts = {}; // Store chart instances

// Register plugins (datalabels if available)
if (typeof Chart !== 'undefined' && Chart.registry && window.ChartDataLabels) {
  Chart.register(window.ChartDataLabels);
}

// ==================== UTILITY FUNCTIONS ====================
function clamp(val, min = 0) {
  const num = parseFloat(val);
  return isNaN(num) ? 0 : Math.max(min, num);
}

function formatCurrency(val) {
  const cur = state.currency || "€";
  return `${cur} ${(Number(val) || 0).toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

// Currency formatting without decimals for high-level KPI display
function formatCurrencyNoDecimals(val) {
  const cur = state.currency || "€";
  return `${cur} ${(Number(val) || 0).toLocaleString('de-DE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })}`;
}

function generateId() {
  return 'p' + Date.now() + Math.random().toString(36).substr(2, 9);
}

// ==================== CALCULATIONS ====================

function normalizeLabor() {
  const s = state.assumptions;
  
  console.log('normalizeLabor called with:', {
    weeksPerMonth: s.weeksPerMonth,
    workdaysPerWeek: s.workdaysPerWeek,
    laborCostPerHour: s.laborCostPerHour,
    hoursPerShift: s.hoursPerShift,
    shiftsPerDay: s.shiftsPerDay
  });
  
  // Calculate workdaysPerMonth from weeksPerMonth × workdaysPerWeek
  if (s.weeksPerMonth && s.workdaysPerWeek) {
    s.workdaysPerMonth = Math.round(s.weeksPerMonth * s.workdaysPerWeek);
    console.log('Calculated workdaysPerMonth:', s.workdaysPerMonth);
  }
  
  // Calculate workdaysPerYear from workdaysPerMonth × 12
  if (s.workdaysPerMonth) {
    s.workdaysPerYear = s.workdaysPerMonth * 12;
    console.log('Calculated workdaysPerYear:', s.workdaysPerYear);
  }
  
  const hoursWorkPerMonthPerWS = (s.hoursPerShift || 0) * (s.shiftsPerDay || 0) * (s.workdaysPerMonth || 0);
  console.log('hoursWorkPerMonthPerWS:', hoursWorkPerMonthPerWS);
  
  // Calculate labor costs
  if (s.laborCostPerHour && s.laborCostPerHour > 0) {
    s.laborCostPerSecond = s.laborCostPerHour / 3600;
    s.laborCostPerMonthPerWS = s.laborCostPerHour * hoursWorkPerMonthPerWS;
    s.laborCostPerMonthTotal = s.laborCostPerMonthPerWS * (s.workstations || 0);
    console.log('Calculated laborCostPerSecond:', s.laborCostPerSecond);
    console.log('Calculated laborCostPerMonthPerWS:', s.laborCostPerMonthPerWS);
    console.log('Calculated laborCostPerMonthTotal:', s.laborCostPerMonthTotal);
  }
  
  return { hoursWorkPerMonthPerWS };
}

function deriveScanningQuantity() {
  const scan = state.features.scanning;
  const s = state.assumptions;
  
  // Calculate scans per minute if we have scans per shift
  if (scan.quantityScansPerShift && s.hoursPerShift) {
    const minutesPerShift = s.hoursPerShift * 60;
    scan.scansPerMinute = scan.quantityScansPerShift / minutesPerShift;
  } else {
    scan.scansPerMinute = 0;
  }
  
  return scan.quantityScansPerShift || 0;
}

function calculateFeatureReductions() {
  const s = state.assumptions;
  const conf = state.confidence / 100;
  const laborCostPerSecond = s.laborCostPerSecond || 0;
  
  const results = {};
  
  // Scanning
  const scan = state.features.scanning;
  const quantityScansPerShift = deriveScanningQuantity();
  const timeReductionScan = Math.max(0, scan.timePerScanBefore - scan.timePerScanWith);
  const secsPerShiftScan = scan.enabled ? quantityScansPerShift * timeReductionScan * conf : 0;
  
  // Store time savings for display
  scan.timeSavings = timeReductionScan;
  
  results.scanning = {
    secondsPerShift: secsPerShiftScan,
    costPerShiftPerWS: secsPerShiftScan * laborCostPerSecond,
    quantity: quantityScansPerShift,
    timeSavings: timeReductionScan,
    enabled: scan.enabled
  };
  
  // Generic features
  const featureNames = ['workerGuidance', 'informationLookup', 'simpleInput', 'moderateInput'];
  featureNames.forEach(fname => {
    const f = state.features[fname];
    let quantity = f.quantityPerShift;
    
    // Calculate perScanRatio based on quantityPerShift / quantityScansPerShift
    if (quantityScansPerShift > 0 && quantity != null && quantity > 0) {
      f.perScanRatio = quantity / quantityScansPerShift;
    } else if ((!quantity || quantity === 0) && f.perScanRatio != null) {
      // Fallback: If no quantity entered, calculate quantity from ratio
      quantity = quantityScansPerShift * f.perScanRatio;
    } else {
      f.perScanRatio = 0;
    }
    
    const timeReduction = Math.max(0, (f.timeWithout || 0) - (f.timeWith || 0));
    const secondsPerShift = f.enabled ? (quantity || 0) * timeReduction * conf : 0;
    
    // Store time savings for display
    f.timeSavings = timeReduction;
    
    results[fname] = {
      secondsPerShift,
      costPerShiftPerWS: secondsPerShift * laborCostPerSecond,
      quantity: quantity || 0,
      perScanRatio: f.perScanRatio,
      timeSavings: timeReduction,
      enabled: f.enabled
    };
  });
  
  return results;
}

function aggregateSavings(perFeature) {
  const s = state.assumptions;
  
  let sumSecsShiftWS = 0;
  Object.values(perFeature).forEach(f => {
    sumSecsShiftWS += f.secondsPerShift;
  });
  
  // Per workstation calculations
  const secPerDayPerWS = sumSecsShiftWS * s.shiftsPerDay;
  const hoursPerDayPerWS = secPerDayPerWS / 3600;
  const costPerDayPerWS = secPerDayPerWS * (s.laborCostPerSecond || 0);
  const costPerMonthPerWS = costPerDayPerWS * s.workdaysPerMonth;
  const costPerYearPerWS = costPerDayPerWS * s.workdaysPerYear;
  const hoursPerYearPerWS = hoursPerDayPerWS * s.workdaysPerYear;
  
  // All workstations calculations
  const totalSecPerDay = sumSecsShiftWS * s.shiftsPerDay * s.workstations;
  const totalMinPerDay = totalSecPerDay / 60;
  const totalHoursPerDay = totalSecPerDay / 3600;
  const totalCostReductionPerDay = totalSecPerDay * (s.laborCostPerSecond || 0);
  
  const hoursSavedPerMonthAllWS = totalHoursPerDay * s.workdaysPerMonth;
  const costSavedPerMonthAllWS = totalCostReductionPerDay * s.workdaysPerMonth;
  const costSavedPerYearAllWS = totalCostReductionPerDay * s.workdaysPerYear;
  const hoursPerYearAllWS = totalHoursPerDay * s.workdaysPerYear;
  
  return {
    sumSecsShiftWS,
    // Per workstation
    hoursPerDayPerWS,
    costPerMonthPerWS,
    costPerYearPerWS,
    hoursPerYearPerWS,
    // All workstations
    totalSecPerDay,
    totalMinPerDay,
    totalHoursPerDay,
    totalCostReductionPerDay,
    hoursSavedPerMonthAllWS,
    costSavedPerMonthAllWS,
    costSavedPerYearAllWS,
    hoursPerYearAllWS,
    perFeature
  };
}

function computeInvestments() {
  const s = state.assumptions;
  const products = state.products.filter(p => p.selected); // Only selected products
  const discount = (state.productDiscount || 0) / 100;
  
  console.log('computeInvestments - Selected products:', products.map(p => ({ name: p.name, selected: p.selected })));
  
  const oneTimeProducts = products
    .filter(p => p.category === "hardware_one_time")
    .reduce((sum, p) => {
      const discountedPrice = p.listPrice * (1 - discount);
      const cost = discountedPrice * p.quantity * s.workstations;
      console.log('Product cost:', p.name, 'listPrice:', p.listPrice, 'qty:', p.quantity, 'WS:', s.workstations, 'cost:', cost);
      return sum + cost;
    }, 0);
  
  console.log('Total oneTimeProducts:', oneTimeProducts);
  
  // Calculate yearly recurring licenses as one-time costs (since they're multi-year contracts)
  const yearlyLicenses = products
    .filter(p => p.category === "license_recurring" && p.recurrence === "per_year")
    .reduce((sum, p) => {
      const discountedPrice = p.listPrice * (1 - discount);
      const cost = discountedPrice * p.quantity * s.workstations;
      console.log('Yearly license cost:', p.name, 'cost:', cost);
      return sum + cost;
    }, 0);
  
  const monthlyRecurring = products.reduce((sum, p) => {
    const discountedPrice = p.listPrice * (1 - discount);
    const qtyTotal = p.quantity * s.workstations;
    
    if (p.category === "license_recurring" && p.recurrence === "per_month") {
      return sum + discountedPrice * qtyTotal;
    }
    if (p.category === "consumable_recurring" && p.recurrence === "per_shift") {
      return sum + discountedPrice * qtyTotal * s.shiftsPerDay * s.workdaysPerMonth;
    }
    return sum;
  }, 0);
  
  const integrationHoursCost = state.integration.hours * state.integration.hourlyRate;
  const integrationOneTime = state.integration.fixedFeeOneTime + integrationHoursCost;
  
  console.log('Integration calculation:', {
    fixedFeeOneTime: state.integration.fixedFeeOneTime,
    hours: state.integration.hours,
    hourlyRate: state.integration.hourlyRate,
    integrationHoursCost: integrationHoursCost,
    integrationOneTime: integrationOneTime
  });
  
  // Total one-time investment includes hardware and yearly licenses
  const totalOneTimeProducts = oneTimeProducts + yearlyLicenses;
  const oneTimeInvestment = totalOneTimeProducts + integrationOneTime;
  const annualRecurring = monthlyRecurring * 12;
  
  console.log('Investment totals:', {
    oneTimeProducts,
    yearlyLicenses,
    totalOneTimeProducts,
    integrationOneTime,
    oneTimeInvestment
  });
  
  // Calculate per-workstation costs (hardware + licenses per WS)
  const oneTimeProductsPerWS = s.workstations > 0 ? totalOneTimeProducts / s.workstations : 0;
  
  return {
    oneTimeProducts: totalOneTimeProducts, // Total products including yearly licenses
    oneTimeProductsPerWS,
    monthlyRecurring,
    integrationHoursCost,
    integrationOneTime,
    oneTimeInvestment,
    annualRecurring
  };
}

function computeResults(savings, investments) {
  // Gross savings (all workstations)
  const grossMonthlySavings = savings.costSavedPerMonthAllWS;
  const annualGrossSavings = grossMonthlySavings * 12;

  // Recurring (only true monthly / per-shift items, yearly licenses reclassified as one-time per user choice)
  const recurringMonthly = investments.monthlyRecurring;
  const annualRecurring = investments.annualRecurring;

  // Steady-state (after year 1, no CapEx repetition)
  const steadyStateNetMonthly = grossMonthlySavings - recurringMonthly;
  const steadyStateNetAnnual = annualGrossSavings - annualRecurring;

  // Year 1 net (subtract one-time investment once)
  const year1NetAnnual = steadyStateNetAnnual - investments.oneTimeInvestment;

  // Payback based on steady-state net monthly (choice 5:A)
  const paybackMonths = steadyStateNetMonthly <= 0 ? Infinity : Math.ceil(investments.oneTimeInvestment / steadyStateNetMonthly);

  // ROI (Option 1): (Annual Gross - Annual Recurring) / One-Time Investment
  const roiPerYear = investments.oneTimeInvestment <= 0 ? 0 : (steadyStateNetAnnual / investments.oneTimeInvestment);

  // Backward compatibility fields (so existing UI/chart refs don't break)
  const netMonthly = steadyStateNetMonthly;
  const annualNet = steadyStateNetAnnual;

  return {
    grossMonthlySavings,
    annualGrossSavings,
    recurringMonthly,
    annualRecurring,
    steadyStateNetMonthly,
    steadyStateNetAnnual,
    year1NetAnnual,
    paybackMonths,
    roiPerYear,
    // legacy
    netMonthly,
    annualNet
  };
}

// ==================== UI RENDERING ====================

function updateUI() {
  console.log('updateUI called');
  
  try {
    // Normalize labor costs and calculate derived fields
    normalizeLabor();
  
  // Update derived fields
  const s = state.assumptions;
  const workdaysPerMonthEl = document.getElementById('workdaysPerMonth');
  const workdaysPerYearEl = document.getElementById('workdaysPerYear');
  const laborCostPerSecondEl = document.getElementById('laborCostPerSecond');
  
  console.log('Setting values:', {
    workdaysPerMonth: s.workdaysPerMonth,
    workdaysPerYear: s.workdaysPerYear,
    laborCostPerSecond: s.laborCostPerSecond,
    laborCostPerMonthPerWS: s.laborCostPerMonthPerWS,
    laborCostPerMonthTotal: s.laborCostPerMonthTotal
  });
  
  if (workdaysPerMonthEl) {
    workdaysPerMonthEl.value = s.workdaysPerMonth || '';
    console.log('Set workdaysPerMonth to:', workdaysPerMonthEl.value);
  } else {
    console.error('workdaysPerMonth element not found!');
  }
  
  if (workdaysPerYearEl) {
    workdaysPerYearEl.value = s.workdaysPerYear || '';
    console.log('Set workdaysPerYear to:', workdaysPerYearEl.value);
  } else {
    console.error('workdaysPerYear element not found!');
  }
  
  if (laborCostPerSecondEl) {
    laborCostPerSecondEl.value = s.laborCostPerSecond?.toFixed(4) || '';
    console.log('Set laborCostPerSecond to:', laborCostPerSecondEl.value);
  }
  
  const laborCostPerMonthPerWSEl = document.getElementById('laborCostPerMonthPerWS');
  if (laborCostPerMonthPerWSEl) {
    laborCostPerMonthPerWSEl.value = s.laborCostPerMonthPerWS?.toFixed(2) || '';
    console.log('Set laborCostPerMonthPerWS to:', laborCostPerMonthPerWSEl.value);
  }
  
  const laborCostPerMonthTotalEl = document.getElementById('laborCostPerMonthTotal');
  if (laborCostPerMonthTotalEl) {
    laborCostPerMonthTotalEl.value = s.laborCostPerMonthTotal?.toFixed(2) || '';
    console.log('Set laborCostPerMonthTotal to:', laborCostPerMonthTotalEl.value);
  }
  
  // Calculate everything
  const featureReductions = calculateFeatureReductions();
  
  // Update calculated scansPerMinute field
  const scansPerMinuteEl = document.getElementById('scansPerMinute');
  if (scansPerMinuteEl) {
    const scansPerMin = state.features.scanning.scansPerMinute || 0;
    scansPerMinuteEl.value = scansPerMin.toFixed(2);
  }
  
  // Update calculated scanning time savings field
  const scanningTimeSavingsEl = document.getElementById('scanningTimeSavings');
  if (scanningTimeSavingsEl && featureReductions.scanning) {
    const timeSavings = featureReductions.scanning.timeSavings || 0;
    scanningTimeSavingsEl.value = timeSavings.toFixed(1);
  }
  
  // Update calculated perScanRatio and timeSavings fields
  ['workerGuidance', 'informationLookup', 'simpleInput', 'moderateInput'].forEach(fname => {
    const perScanRatioEl = document.getElementById(fname + 'PerScanRatio');
    if (perScanRatioEl && featureReductions[fname]) {
      const ratio = featureReductions[fname].perScanRatio || 0;
      perScanRatioEl.value = ratio.toFixed(4);
    }
    
    const timeSavingsEl = document.getElementById(fname + 'TimeSavings');
    if (timeSavingsEl && featureReductions[fname]) {
      const timeSavings = featureReductions[fname].timeSavings || 0;
      timeSavingsEl.value = timeSavings.toFixed(1);
    }
  });
  
  const savings = aggregateSavings(featureReductions);
  const investments = computeInvestments();
  const results = computeResults(savings, investments);
  
  // Update Sum of Savings (per workstation) fields
  const timeSavedPerDayEl = document.getElementById('timeSavedPerDay');
  if (timeSavedPerDayEl) {
    timeSavedPerDayEl.value = (savings.hoursPerDayPerWS || 0).toFixed(2);
  }
  
  const costSavedPerMonthEl = document.getElementById('costSavedPerMonth');
  if (costSavedPerMonthEl) {
    costSavedPerMonthEl.value = (savings.costPerMonthPerWS || 0).toFixed(2);
  }
  
  const annualCostSavingsEl = document.getElementById('annualCostSavings');
  if (annualCostSavingsEl) {
    annualCostSavingsEl.value = (savings.costPerYearPerWS || 0).toFixed(2);
  }
  
  const hoursSavedPerYearEl = document.getElementById('hoursSavedPerYear');
  if (hoursSavedPerYearEl) {
    hoursSavedPerYearEl.value = (savings.hoursPerYearPerWS || 0).toFixed(2);
  }
  
  // Update Integration Cost Total
  const integrationCostTotalEl = document.getElementById('integrationCostTotal');
  if (integrationCostTotalEl) {
    integrationCostTotalEl.value = (investments.integrationOneTime || 0).toFixed(2);
  }
  
  // Update Solution Setup per Workstation
  const solutionSetupPerWSEl = document.getElementById('solutionSetupPerWS');
  if (solutionSetupPerWSEl) {
    solutionSetupPerWSEl.value = (investments.oneTimeProductsPerWS || 0).toFixed(2);
  }
  
  // Update Solution Setup Total (all workstations)
  const solutionSetupTotalEl = document.getElementById('solutionSetupTotal');
  if (solutionSetupTotalEl) {
    solutionSetupTotalEl.value = (investments.oneTimeProducts || 0).toFixed(2);
  }
  
  // Update Workstation Count display
  const workstationCountEl = document.getElementById('workstationCount');
  if (workstationCountEl) {
    workstationCountEl.textContent = state.assumptions.workstations || 0;
  }
  
  // Update Total Investment (Integration + Solution Setup)
  const totalInvestmentEl = document.getElementById('totalInvestment');
  if (totalInvestmentEl) {
    totalInvestmentEl.value = (investments.oneTimeInvestment || 0).toFixed(2);
  }
  
  // Update summary KPIs
  // New layout KPI elements (Top Row)
  const paybackMonthsBigEl = document.getElementById('paybackMonthsBig');
  if (paybackMonthsBigEl) {
    paybackMonthsBigEl.textContent = results.paybackMonths === Infinity ? 'No payback' : results.paybackMonths;
  }
  const netAnnualBigEl = document.getElementById('netAnnualBig');
  if (netAnnualBigEl) {
    netAnnualBigEl.textContent = formatCurrencyNoDecimals(results.year1NetAnnual);
  }
  const roiPerYearBigEl = document.getElementById('roiPerYearBig');
  if (roiPerYearBigEl) {
    roiPerYearBigEl.textContent = (results.roiPerYear * 100).toFixed(1) + '%';
  }

  // Supporting Row
  const netMonthlySmallEl = document.getElementById('netMonthlySmall');
  if (netMonthlySmallEl) {
    netMonthlySmallEl.textContent = formatCurrencyNoDecimals(results.steadyStateNetMonthly);
  }
  const realizationRateSmallEl = document.getElementById('realizationRateSmall');
  if (realizationRateSmallEl) {
    realizationRateSmallEl.textContent = state.confidence + '%';
  }

  // Annualized Savings card values
  const hoursPerWSAnnualEl = document.getElementById('hoursPerWSAnnual');
  if (hoursPerWSAnnualEl) {
    hoursPerWSAnnualEl.textContent = (savings.hoursPerYearPerWS || 0).toLocaleString('de-DE');
  }
  const hoursTotalAnnualEl = document.getElementById('hoursTotalAnnual');
  if (hoursTotalAnnualEl) {
    hoursTotalAnnualEl.textContent = (savings.hoursPerYearAllWS || 0).toLocaleString('de-DE');
  }
  const grossCostAnnualEl = document.getElementById('grossCostAnnual');
  if (grossCostAnnualEl) {
    grossCostAnnualEl.textContent = formatCurrencyNoDecimals(results.annualGrossSavings);
  }

  // Realization note (confidence)
  const contextRealizationRateEl = document.getElementById('contextRealizationRate');
  if (contextRealizationRateEl) {
    contextRealizationRateEl.textContent = state.confidence + '%';
  }
  const contextWorkstationsEl = document.getElementById('contextWorkstations');
  if (contextWorkstationsEl) {
    contextWorkstationsEl.textContent = state.assumptions.workstations || 0;
  }
  const contextInvestmentTotalEl = document.getElementById('contextInvestmentTotal');
  if (contextInvestmentTotalEl) {
    contextInvestmentTotalEl.textContent = formatCurrencyNoDecimals(investments.oneTimeInvestment || 0);
  }
  const contextInvestmentPerWSEl = document.getElementById('contextInvestmentPerWS');
  if (contextInvestmentPerWSEl) {
    contextInvestmentPerWSEl.textContent = formatCurrencyNoDecimals(investments.oneTimeProductsPerWS + (investments.integrationOneTime / (state.assumptions.workstations||1)));
  }
  
  // Update products table
  renderProductsTable();
  
  // Update charts
  renderCharts(savings, investments, results);
  
  } catch (error) {
    console.error('ERROR in updateUI:', error);
    console.error('Error stack:', error.stack);
    alert('Error updating UI: ' + error.message);
  }
}

function renderProductsTable() {
  console.log('=== renderProductsTable called ===');
  const table = document.getElementById('productsTable');
  console.log('Table element:', table);
  
  const tbody = table ? table.querySelector('tbody') : null;
  console.log('tbody element:', tbody);
  
  if (!tbody) {
    console.error('Products table tbody not found!');
    return;
  }
  
  console.log('Rendering products table, # of products:', state.products.length);
  console.log('Products:', state.products);
  const discount = state.productDiscount || 0;
  console.log('Discount:', discount);
  
  if (!state.products || state.products.length === 0) {
    console.warn('No products to render!');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">No products added yet</td></tr>';
    return;
  }
  
  try {
    const htmlContent = state.products.map((p, idx) => {
      const discountedPrice = p.listPrice * (1 - discount / 100);
      const discountedCost = discountedPrice * p.quantity;
      
      return `
      <tr>
        <td style="text-align: center;">
          <input type="checkbox" 
                 id="product-select-${p.id}" 
                 ${p.selected ? 'checked' : ''} 
                 onchange="toggleProductSelection('${p.id}')"
                 ${p.mutuallyExclusive ? `data-exclusive="${p.mutuallyExclusive}"` : ''} />
        </td>
        <td>
          <input type="text" 
                 value="${p.name}" 
                 onchange="updateProductField('${p.id}', 'name', this.value)" 
                 style="width: 100%; border: 1px solid #e0e0e0; padding: 0.25rem;" />
        </td>
        <td>
          <input type="number" 
                 value="${p.listPrice}" 
                 onchange="updateProductField('${p.id}', 'listPrice', parseFloat(this.value))" 
                 style="width: 100px; text-align: right; border: 1px solid #e0e0e0; padding: 0.25rem;" />
        </td>
        <td>
          <input type="number" 
                 value="${p.quantity}" 
                 step="0.001"
                 onchange="updateProductField('${p.id}', 'quantity', parseFloat(this.value))" 
                 style="width: 80px; text-align: right; border: 1px solid #e0e0e0; padding: 0.25rem;" />
        </td>
        <td style="text-align: right; font-weight: 600;">
          € ${discountedCost.toFixed(2)}
        </td>
        <td>
          <button class="btn-secondary" onclick="deleteProduct('${p.id}')" style="padding: 0.25rem 0.5rem; font-size: 0.85rem;">Delete</button>
        </td>
      </tr>
    `}).join('');
    
    console.log('Generated HTML length:', htmlContent.length);
    tbody.innerHTML = htmlContent;
    console.log('Table updated with', state.products.length, 'products');
  } catch (error) {
    console.error('Error rendering products table:', error);
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: red;">Error rendering table: ' + error.message + '</td></tr>';
  }
}

// ==================== CHARTS ====================

function renderCharts(savings, investments, results) {
  const featureLabels = {
    scanning: "Scanning",
    workerGuidance: "Worker Guidance",
    informationLookup: "Information Lookup",
    simpleInput: "Simple Input",
    moderateInput: "Moderate Input"
  };
  
  const s = state.assumptions;
  
  // Prepare data for enabled features only
  const enabledFeatures = Object.keys(savings.perFeature).filter(key => savings.perFeature[key].enabled);
  const labels = enabledFeatures.map(k => featureLabels[k]);
  
  // Chart 1: Savings Breakdown (Horizontal Bar - Annual Savings)
  const annualCostPerFeature = enabledFeatures.map(key => {
    const feature = savings.perFeature[key];
    return feature.costPerShiftPerWS * s.shiftsPerDay * s.workstations * s.workdaysPerYear; // annualized
  });
  const annualHoursPerFeature = enabledFeatures.map(key => {
    const feature = savings.perFeature[key];
    const secondsPerYearAllWS = feature.secondsPerShift * s.shiftsPerDay * s.workstations * s.workdaysPerYear;
    return secondsPerYearAllWS / 3600; // hours
  });

  // Sort features descending by annual value for clearer story
  const combined = labels.map((label, i) => ({ label, value: annualCostPerFeature[i], hours: annualHoursPerFeature[i] }));
  combined.sort((a,b) => b.value - a.value);
  const sortedLabels = combined.map(c => c.label);
  const sortedValues = combined.map(c => c.value);
  const sortedHours = combined.map(c => c.hours);

  const barColors = ['#ff6600','#ff8a33','#ffb066','#ffd6a6','#ffe9d2'];

  updateOrCreateChart('chartSavingsBreakdown', {
    type: 'bar',
    data: {
      labels: sortedLabels,
      datasets: [{
        label: 'Annual Gross Savings (€)',
        data: sortedValues,
        backgroundColor: barColors,
        borderRadius: 6,
        maxBarThickness: 38,
        featureHours: sortedHours
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { right: 32, left: 4, top: 8, bottom: 8 } },
      scales: {
        x: {
          ticks: {
            callback: (val) => {
              const v = Number(val);
              if (Math.abs(v) >= 1_000_000) return (v/1_000_000).toFixed(1)+'M';
              if (Math.abs(v) >= 1_000) return (v/1_000).toFixed(1)+'k';
              return v;
            }
          },
          title: { display: true, text: 'Annual Gross Savings (€)' },
          grid: { color: '#f1f1f1' }
        },
        y: {
          grid: { display: false }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const total = ctx.chart.data.datasets[0].data.reduce((a,b)=>a+b,0);
              const val = ctx.parsed.x || 0;
              const pct = total ? ((val/total)*100).toFixed(1) : '0.0';
              const hours = ctx.chart.data.datasets[0].featureHours[ctx.dataIndex] || 0;
              const hoursFmt = hours >= 100 ? hours.toFixed(0) : hours.toFixed(1);
              return `${ctx.label}: ${formatCurrency(val)} (${pct}%) – ${hoursFmt} h/yr`;
            }
          }
        },
        datalabels: {
          anchor: 'end',
          align: 'right',
          color: '#333',
          formatter: (val, ctx) => {
            const total = ctx.chart.data.datasets[0].data.reduce((a,b)=>a+b,0);
            const pct = total ? ((val/total)*100).toFixed(0) : '0';
            return pct + '%';
          },
          clamp: true,
          offset: 6
        }
      }
    }
  });
  
  // Chart 2: Time vs. Cost Conversion (Dual-axis)
  const timePerDay = enabledFeatures.map(key => {
    const feature = savings.perFeature[key];
    return (feature.secondsPerShift * s.shiftsPerDay * s.workstations) / 3600;
  });
  
  // (Removed Time vs. Cost Conversion and ROI Scenarios charts per request)
  
  // Chart 4: Payback Period (Enhanced)
  // Dynamic horizon selection: 12, 24, or 36 months depending on breakeven
  // Determine preliminary breakeven from an initial large horizon (36) to classify
  const probeMonths = Array.from({ length: 37 }, (_, i) => i); // 0..36
  const probeCumulative = probeMonths.map(m => results.steadyStateNetMonthly * m - investments.oneTimeInvestment);
  const probeBreakeven = probeCumulative.findIndex(v => v >= 0);

  let horizon;
  if (probeBreakeven === -1 || !isFinite(results.paybackMonths)) {
    // No breakeven within 36 months (or infinite payback) -> show full 36 months
    horizon = 36;
  } else if (probeBreakeven <= 12) {
    horizon = 12;
  } else if (probeBreakeven <= 24) {
    horizon = 24;
  } else {
    horizon = 36;
  }

  const months = Array.from({ length: horizon + 1 }, (_, i) => i); // inclusive 0..horizon
  const cumulative = months.map(m => results.steadyStateNetMonthly * m - investments.oneTimeInvestment);
  const breakeven = cumulative.findIndex(v => v >= 0); // recompute within selected horizon

  // Split positive / negative areas for color differentiation
  // (Removed separate positive/negative area datasets for visual simplicity)

  // Helper for compact Y tick formatting
  const compactNumber = (val) => {
    const abs = Math.abs(val);
    if (abs >= 1_000_000) return (val/1_000_000).toFixed(1) + 'M';
    if (abs >= 1_000) return (val/1_000).toFixed(1) + 'k';
    return val.toString();
  };

  updateOrCreateChart('chartPaybackPeriod', {
    type: 'line',
    data: {
  labels: months.map(m => `Month ${m}`),
      datasets: [
        // Base cumulative line (no fill)
        {
          label: 'Cumulative',
            data: cumulative,
            borderColor: '#ff6600',
            borderWidth: 2,
            fill: false,
            pointRadius: months.map((m,i)=> i===breakeven ? 6 : 0),
            pointBackgroundColor: months.map((m,i)=> i===breakeven ? '#1e7e34' : '#ff6600'),
            tension: 0.25
        },
        // Zero line (for visual baseline / Breakeven line)
        {
          label: 'Breakeven',
          data: Array(months.length).fill(0),
          borderColor: '#666',
          borderDash: [6,4],
          pointRadius: 0,
          fill: false
        },
        // Investment line (horizontal at -oneTimeInvestment start crossing upward)
        {
          label: 'Investment',
          data: Array(months.length).fill(-investments.oneTimeInvestment),
          borderColor: '#999',
          borderDash: [4,6],
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { 
          display: true,
          labels: {
            filter: (item) => ['Cumulative','Breakeven','Investment'].includes(item.text)
          }
        },
        title: { display: false },
        subtitle: { display: false },
        datalabels: { display: false },
        annotation: {
          annotations: {
            ...(breakeven >= 0 ? {
              breakevenPoint: {
                type: 'label',
                xValue: breakeven,
                yValue: cumulative[breakeven],
                backgroundColor: 'rgba(30,126,52,0.85)',
                content: [`Payback reached: Month ${breakeven}`],
                color: '#fff',
                font: { weight: '600' },
                padding: 6,
                yAdjust: -10
              },
              breakevenVertical: {
                type: 'line',
                xMin: breakeven,
                xMax: breakeven,
                borderColor: '#1e7e34',
                borderWidth: 2,
                borderDash: [4,4]
              }
            } : {})
          }
        }
      },
      scales: {
        y: {
          title: { display: true, text: 'Cumulative Savings (€)' },
          ticks: {
            callback: (val) => compactNumber(val)
          },
          grid: { color: '#eee' }
        },
        x: {
          title: { display: true, text: 'Months' },
          grid: { color: '#f4f4f4' },
          ticks: {
            callback: (val, index) => index % 3 === 0 ? `M${index}` : ''
          }
        }
      },
      elements: {
        point: { hoverRadius: 7 }
      }
    }
  });
}

function updateOrCreateChart(canvasId, config) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  
  if (charts[canvasId]) {
    charts[canvasId].data = config.data;
    charts[canvasId].options = config.options;
    charts[canvasId].update();
  } else {
    charts[canvasId] = new Chart(ctx, config);
  }
}

// ==================== INPUT BINDINGS ====================

function bindInputs() {
  // Assumptions - number inputs (only editable fields)
  ['weeksPerMonth', 'workdaysPerWeek', 'workstations', 'hoursPerShift', 'laborCostPerHour'].forEach(key => {
    const el = document.getElementById(key);
    if (!el) {
      console.warn(`Element not found: ${key}`);
      return;
    }
    el.value = state.assumptions[key] ?? '';
    el.addEventListener('input', (e) => {
      state.assumptions[key] = clamp(e.target.value);
      updateUI();
    });
  });
  
  // Shifts per day - dropdown
  const shiftsEl = document.getElementById('shiftsPerDay');
  if (shiftsEl) {
    shiftsEl.value = state.assumptions.shiftsPerDay.toString();
    shiftsEl.addEventListener('change', (e) => {
      state.assumptions.shiftsPerDay = parseInt(e.target.value);
      updateUI();
    });
  } else {
    console.warn('Element not found: shiftsPerDay');
  }
  
  // Scanning (excluding scansPerMinute which is calculated)
  ['quantityScansPerShift', 'timePerScanBefore', 'timePerScanWith'].forEach(key => {
    const el = document.getElementById(key);
    if (!el) return;
    el.value = state.features.scanning[key] ?? '';
    el.addEventListener('input', (e) => {
      state.features.scanning[key] = clamp(e.target.value);
      updateUI();
    });
  });
  
  const scanEnabledEl = document.getElementById('scanningEnabled');
  if (scanEnabledEl) {
    scanEnabledEl.checked = state.features.scanning.enabled;
    scanEnabledEl.addEventListener('change', (e) => {
      state.features.scanning.enabled = e.target.checked;
      updateUI();
    });
  }
  
  // Other features
  ['workerGuidance', 'informationLookup', 'simpleInput', 'moderateInput'].forEach(fname => {
    const enabledEl = document.getElementById(fname + 'Enabled');
    if (enabledEl) {
      enabledEl.checked = state.features[fname].enabled;
      enabledEl.addEventListener('change', (e) => {
        state.features[fname].enabled = e.target.checked;
        updateUI();
      });
    }
    
    // Bind input fields (excluding perScanRatio which is calculated)
    ['quantityPerShift', 'timeWithout', 'timeWith'].forEach(key => {
      const fullKey = fname + key.charAt(0).toUpperCase() + key.slice(1);
      const el = document.getElementById(fullKey);
      if (!el) return;
      el.value = state.features[fname][key] ?? '';
      el.addEventListener('input', (e) => {
        state.features[fname][key] = clamp(e.target.value);
        updateUI();
      });
    });
  });
  
  // Confidence slider
  const confidenceEl = document.getElementById('confidence');
  const confidenceValueEl = document.getElementById('confidenceValue');
  if (confidenceEl) {
    confidenceEl.value = state.confidence;
    confidenceValueEl.textContent = `${state.confidence}%`;
    // Update range progress color
    confidenceEl.style.setProperty('--range-progress', `${state.confidence}%`);
    confidenceEl.addEventListener('input', (e) => {
      state.confidence = parseInt(e.target.value);
      confidenceValueEl.textContent = `${state.confidence}%`;
      // Update range progress color
      e.target.style.setProperty('--range-progress', `${state.confidence}%`);
      updateUI();
    });
  }
  
  // Integration
  ['integrationFixedFeeOneTime', 'integrationHours', 'integrationHourlyRate'].forEach(key => {
    const shortKey = key.replace('integration', '').charAt(0).toLowerCase() + key.replace('integration', '').slice(1);
    const el = document.getElementById(key);
    console.log('Integration field init:', { key, shortKey, element: el, value: state.integration[shortKey] });
    if (!el) return;
    el.value = state.integration[shortKey] ?? '';
    el.addEventListener('input', (e) => {
      state.integration[shortKey] = clamp(e.target.value);
      updateUI();
    });
  });
  
  // Product discount slider
  const discountEl = document.getElementById('productDiscount');
  const discountValueEl = document.getElementById('productDiscountValue');
  if (discountEl) {
    discountEl.value = state.productDiscount || 0;
    discountEl.style.setProperty('--range-progress', `${state.productDiscount}%`);
    if (discountValueEl) {
      discountValueEl.textContent = state.productDiscount || 0;
    }
    discountEl.addEventListener('input', (e) => {
      state.productDiscount = clamp(e.target.value, 0, 100);
      if (discountValueEl) {
        discountValueEl.textContent = state.productDiscount;
      }
      e.target.style.setProperty('--range-progress', `${state.productDiscount}%`);
      updateUI();
    });
  }
  
  // Export/Import
  document.getElementById('exportJson').addEventListener('click', exportJson);
  document.getElementById('importJson').addEventListener('click', () => {
    document.getElementById('importFile').click();
  });
  document.getElementById('importFile').addEventListener('change', importJson);
  document.getElementById('printPdf').addEventListener('click', () => window.print());
  
  // Add product button
  document.getElementById('addProductBtn').addEventListener('click', addProduct);
}

// ==================== PRODUCT MANAGEMENT ====================

function addProduct() {
  // Create a new product with default values
  const newProduct = {
    id: generateId(),
    name: 'New Item',
    listPrice: 0,
    quantity: 1,
    selected: true,
    category: 'hardware_one_time'
  };
  
  state.products.push(newProduct);
  updateUI();
}

function editProduct(id) {
  const product = state.products.find(p => p.id === id);
  if (!product) return;
  
  const name = prompt('Product name:', product.name);
  if (name) product.name = name;
  
  const unitPrice = prompt('Unit price:', product.unitPrice);
  if (unitPrice) product.unitPrice = parseFloat(unitPrice);
  
  const qtyPerWorkstation = prompt('Quantity per workstation:', product.qtyPerWorkstation);
  if (qtyPerWorkstation) product.qtyPerWorkstation = parseFloat(qtyPerWorkstation);
  
  updateUI();
}

function deleteProduct(id) {
  if (!confirm('Delete this product?')) return;
  state.products = state.products.filter(p => p.id !== id);
  updateUI();
}

function toggleProductSelection(id) {
  const product = state.products.find(p => p.id === id);
  if (!product) return;
  
  product.selected = !product.selected;
  
  console.log('Product selection toggled:', product.name, 'selected:', product.selected);
  
  // Handle mutual exclusivity (only one Insight product can be selected)
  if (product.selected && product.mutuallyExclusive) {
    state.products.forEach(p => {
      if (p.id !== id && p.mutuallyExclusive === product.mutuallyExclusive) {
        p.selected = false;
      }
    });
  }
  
  console.log('Selected products:', state.products.filter(p => p.selected).map(p => p.name));
  
  updateUI();
}

function updateProductField(id, field, value) {
  const product = state.products.find(p => p.id === id);
  if (!product) return;
  
  product[field] = value;
  updateUI();
}

// Make functions globally accessible for inline onclick handlers
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.toggleProductSelection = toggleProductSelection;
window.updateProductField = updateProductField;

// ==================== EXPORT / IMPORT ====================

function exportJson() {
  const featureReductions = calculateFeatureReductions();
  const savings = aggregateSavings(featureReductions);
  const investments = computeInvestments();
  const results = computeResults(savings, investments);
  
  const exportData = {
    state,
    results: {
      savings,
      investments,
      kpis: results
    },
    exportedAt: new Date().toISOString()
  };
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  saveAs(blob, `roi-calculator-${Date.now()}.json`);
}

function importJson(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const data = JSON.parse(evt.target.result);
      if (data.state) {
        state = data.state;
        bindInputs();
        updateUI();
        alert('Data imported successfully!');
      }
    } catch (err) {
      alert('Invalid JSON file: ' + err.message);
    }
  };
  reader.readAsText(file);
}

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', () => {
  console.log('ROI Calculator initializing...');
  console.log('Initial state:', state);
  bindInputs();
  updateUI();
  console.log('ROI Calculator initialized!');
  console.log('After calculation:', state.assumptions);
});

// ==================== GUIDED TOUR FUNCTIONALITY ====================
let currentTourStep = 0;
const tourSteps = [
  {
    title: "Welcome to the ROI Calculator",
    description: "This guided tour will help you understand what information to enter and why it matters for calculating your ROI with MAI.",
    target: null,
    tips: []
  },
  {
    title: "Time Parameters",
    description: "These parameters define your operational calendar and determine how many working hours you have per month and year. This affects all cost calculations.",
    target: "#assumptions h3:first-of-type",
    tips: [
      "Weeks/Month: Typically 4-4.5 for standard operations",
      "Workdays/Week: Usually 5, but can be 6-7 for continuous operations",
      "The calculated fields (Workdays/Month, Workdays/Year) will update automatically"
    ]
  },
  {
    title: "Operational Parameters",
    description: "Define your workforce setup and labor costs. These are the foundation for calculating time savings and cost benefits.",
    target: "#assumptions h3:nth-of-type(2)",
    tips: [
      "Workstations: Number of positions that will use MAI devices",
      "Shifts/Day: How many shifts operate per day (affects total hours)",
      "Labor Cost/Hour: Average hourly wage including benefits - this drives the ROI calculation"
    ]
  },
  {
    title: "Time-Saving Features",
    description: "Configure which MAI features you'll use and how much time they save. Each feature represents a different workflow improvement.",
    target: "#features h2",
    tips: [
      "Enable/disable features based on your use case",
      "Scans/Shift: How many barcode scans happen per shift",
      "Time Before/With MAI: Measure current vs. improved process times",
      "More features = higher potential savings, but realistic expectations matter"
    ]
  },
  {
    title: "Realization Rate",
    description: "Not every organization achieves 100% of theoretical savings. This factor adjusts for real-world adoption and process maturity.",
    target: ".realization-rate-field",
    tips: [
      "80% is a conservative starting point for most implementations",
      "Lower rates account for training time, change management, and process optimization",
      "You can adjust this based on your organization's change management experience"
    ]
  },
  {
    title: "Investment Costs",
    description: "Enter your implementation costs. These include integration work and MAI hardware/software purchases.",
    target: "#investment h2",
    tips: [
      "Integration costs: Professional services for system setup and training",
      "Product costs: MAI devices and software licenses (3-year calculation)",
      "Use the discount slider to reflect negotiated pricing",
      "Add custom products if needed with the + button"
    ]
  },
  {
    title: "Review Results",
    description: "Check your ROI calculations, payback period, and savings projections. The charts show your return on investment over time.",
    target: "#results h2",
    tips: [
      "Payback Period: How long until investment is recovered",
      "Annual Cost Savings: Ongoing benefits after implementation",
      "ROI %: Return on investment percentage",
      "Use Export/Import to save and share configurations"
    ]
  }
];

function initTour() {
  const startBtn = document.getElementById('startWizardBtn');
  const overlay = document.getElementById('tourOverlay');
  const closeBtn = document.getElementById('tourCloseBtn');
  const prevBtn = document.getElementById('tourPrevBtn');
  const nextBtn = document.getElementById('tourNextBtn');

  startBtn.addEventListener('click', () => {
    currentTourStep = 0;
    showTourStep();
    overlay.style.display = 'flex';
  });

  closeBtn.addEventListener('click', () => {
    overlay.style.display = 'none';
    clearHighlights();
  });

  prevBtn.addEventListener('click', () => {
    if (currentTourStep > 0) {
      currentTourStep--;
      showTourStep();
    }
  });

  nextBtn.addEventListener('click', () => {
    if (currentTourStep < tourSteps.length - 1) {
      currentTourStep++;
      showTourStep();
    } else {
      overlay.style.display = 'none';
      clearHighlights();
    }
  });

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.style.display = 'none';
      clearHighlights();
    }
  });
}

function showTourStep() {
  const step = tourSteps[currentTourStep];
  const tooltip = document.getElementById('tourTooltip');
  const titleEl = document.getElementById('tourTitle');
  const descEl = document.getElementById('tourDescription');
  const tipsEl = document.getElementById('tourTips');
  const tipsListEl = document.getElementById('tourTipsList');
  const currentStepEl = document.getElementById('tourCurrentStep');
  const totalStepsEl = document.getElementById('tourTotalSteps');
  const progressBar = document.getElementById('tourProgressBar');
  const prevBtn = document.getElementById('tourPrevBtn');
  const nextBtn = document.getElementById('tourNextBtn');

  // Update content
  titleEl.textContent = step.title;
  descEl.textContent = step.description;
  currentStepEl.textContent = currentTourStep + 1;
  totalStepsEl.textContent = tourSteps.length;
  progressBar.style.width = ((currentTourStep + 1) / tourSteps.length) * 100 + '%';

  // Update tips
  if (step.tips && step.tips.length > 0) {
    tipsListEl.innerHTML = step.tips.map(tip => `<li>${tip}</li>`).join('');
    tipsEl.style.display = 'block';
  } else {
    tipsEl.style.display = 'none';
  }

  // Update buttons
  prevBtn.disabled = currentTourStep === 0;
  nextBtn.textContent = currentTourStep === tourSteps.length - 1 ? 'Finish' : 'Next';

  // Position tooltip and highlight target
  clearHighlights();
  if (step.target) {
    const targetEl = document.querySelector(step.target);
    if (targetEl) {
      targetEl.classList.add('tour-highlight');
      positionTooltip(targetEl);
    }
  } else {
    // Center tooltip for intro step
    tooltip.style.position = 'relative';
    tooltip.style.top = 'auto';
    tooltip.style.left = 'auto';
    tooltip.style.transform = 'none';
  }
}

function positionTooltip(targetEl) {
  const tooltip = document.getElementById('tourTooltip');
  const arrow = document.getElementById('tourArrow');
  const rect = targetEl.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  
  // Position tooltip above or below target
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  
  // Try to position above first
  let top = rect.top - tooltipRect.height - 20;
  let arrowClass = 'bottom';
  
  if (top < 20) {
    // Position below
    top = rect.bottom + 20;
    arrowClass = 'top';
  }
  
  let left = centerX - tooltipRect.width / 2;
  
  // Keep within viewport
  if (left < 10) left = 10;
  if (left + tooltipRect.width > window.innerWidth - 10) {
    left = window.innerWidth - tooltipRect.width - 10;
  }
  
  tooltip.style.position = 'fixed';
  tooltip.style.top = top + 'px';
  tooltip.style.left = left + 'px';
  tooltip.style.transform = 'none';
  
  // Position arrow
  arrow.className = 'tour-arrow ' + arrowClass;
  const arrowOffset = centerX - left;
  if (arrowClass === 'top' || arrowClass === 'bottom') {
    arrow.style.left = arrowOffset + 'px';
    arrow.style.top = arrowClass === 'top' ? '-20px' : 'auto';
    arrow.style.bottom = arrowClass === 'bottom' ? '-20px' : 'auto';
  }
}

function clearHighlights() {
  document.querySelectorAll('.tour-highlight').forEach(el => {
    el.classList.remove('tour-highlight');
  });
}

// Initialize tour when DOM is ready
document.addEventListener('DOMContentLoaded', initTour);

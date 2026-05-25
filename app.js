/**
 * ECOWATT - Household Carbon & Utility Auditor
 * Complete Core Interactive Engine
 */

// 1. CARBON CONVERSION FACTORS (kg CO2e equivalents)
const EMISSION_FACTORS = {
    electricity_kwh: 0.385,    // Average US/Global grid mix
    natural_gas_therm: 5.30,   // Natural gas combustion
    water_gal: 0.003,          // Pumping, purification and distribution
    transit_fuel: {
        petrol: 0.25,          // Petrol vehicle per mile
        diesel: 0.28,          // Diesel vehicle per mile
        hybrid: 0.14,          // Hybrid vehicle per mile
        ev: 0.04               // EV lifecycle grid emissions per mile
    },
    flight_mile: 0.115,        // Commercial air transport average
    waste_kg: 0.90,            // Municipal solid waste landfilling
    recycling_offset: 0.65,    // Carbon savings factor per % of waste recycled
    diet_annual_kg: {
        'meat-heavy': 2900,
        'meat-average': 2000,
        'pescatarian': 1400,
        'vegetarian': 1100,
        'vegan': 700
    }
};

// COST UNIT RATES (for simulation savings in USD)
const UTILITY_RATES = {
    electricity_kwh: 0.16,      // $0.16 per kWh
    natural_gas_therm: 1.25,    // $1.25 per therm
    water_gal: 0.008,           // $0.008 per gallon
    petrol_gallon: 3.50,        // Fuel rate
    mpg: 25                     // Average miles per gallon for driving cost
};

// 2. DEFAULT MOCK DATA (to look gorgeous out-of-the-box)
const DEFAULT_MOCK_ENTRIES = [
    {
        month: "January",
        electricity: 420,
        gas: 32,
        water: 3100,
        waste: 45,
        recycling: 20,
        transitMiles: 950,
        transitType: "petrol",
        flightMiles: 0,
        dietProfile: "meat-average"
    },
    {
        month: "February",
        electricity: 380,
        gas: 28,
        water: 2800,
        waste: 40,
        recycling: 25,
        transitMiles: 800,
        transitType: "petrol",
        flightMiles: 500,
        dietProfile: "meat-average"
    },
    {
        month: "March",
        electricity: 310,
        gas: 18,
        water: 2900,
        waste: 38,
        recycling: 30,
        transitMiles: 750,
        transitType: "petrol",
        flightMiles: 0,
        dietProfile: "meat-average"
    },
    {
        month: "April",
        electricity: 280,
        gas: 10,
        water: 3200,
        waste: 42,
        recycling: 35,
        transitMiles: 880,
        transitType: "hybrid",
        flightMiles: 1200,
        dietProfile: "meat-average"
    }
];

// 3. APP STORE STATE MANAGEMENT CLASS
class AppStore {
    constructor() {
        this.entries = [];
        this.checkedActions = [];
        this.simSettings = {
            solar: 0,
            efficiency: 0,
            transit: 0,
            diet: 0,
            recycling: 0
        };
        this.loadState();
    }

    loadState() {
        try {
            const savedEntries = localStorage.getItem('ecowatt_entries');
            const savedActions = localStorage.getItem('ecowatt_actions');
            const savedSims = localStorage.getItem('ecowatt_sims');

            this.entries = savedEntries ? JSON.parse(savedEntries) : [...DEFAULT_MOCK_ENTRIES];
            this.checkedActions = savedActions ? JSON.parse(savedActions) : [];
            this.simSettings = savedSims ? JSON.parse(savedSims) : {
                solar: 0, efficiency: 0, transit: 0, diet: 0, recycling: 0
            };
        } catch (e) {
            console.error("Failed to parse LocalStorage", e);
            this.entries = [...DEFAULT_MOCK_ENTRIES];
            this.checkedActions = [];
        }
    }

    saveState() {
        localStorage.setItem('ecowatt_entries', JSON.stringify(this.entries));
        localStorage.setItem('ecowatt_actions', JSON.stringify(this.checkedActions));
        localStorage.setItem('ecowatt_sims', JSON.stringify(this.simSettings));
    }

    addEntry(entry) {
        // Overwrite or push new entry
        const existingIdx = this.entries.findIndex(e => e.month === entry.month);
        if (existingIdx >= 0) {
            this.entries[existingIdx] = entry;
        } else {
            this.entries.push(entry);
        }
        this.saveState();
    }

    deleteEntry(month) {
        this.entries = this.entries.filter(e => e.month !== month);
        this.saveState();
    }

    resetData() {
        this.entries = [];
        this.checkedActions = [];
        this.simSettings = { solar: 0, efficiency: 0, transit: 0, diet: 0, recycling: 0 };
        this.saveState();
    }

    // Mathematical Engine to parse absolute CO2 metrics
    calculateEmission(entry) {
        const elect = entry.electricity * EMISSION_FACTORS.electricity_kwh;
        const gas = entry.gas * EMISSION_FACTORS.natural_gas_therm;
        const water = entry.water * EMISSION_FACTORS.water_gal;
        
        const transportFactor = EMISSION_FACTORS.transit_fuel[entry.transitType] || EMISSION_FACTORS.transit_fuel.petrol;
        const transit = entry.transitMiles * transportFactor;
        const flights = entry.flightMiles * EMISSION_FACTORS.flight_mile;
        
        // Waste carbon calculation subtracted by recycling offset
        const baselineWaste = entry.waste * EMISSION_FACTORS.waste_kg;
        const wasteSaved = baselineWaste * (entry.recycling / 100) * EMISSION_FACTORS.recycling_offset;
        const waste = Math.max(0, baselineWaste - wasteSaved);
        
        // Monthly portion of annual diet profile
        const food = EMISSION_FACTORS.diet_annual_kg[entry.dietProfile] / 12;

        return {
            electricity: elect,
            gas: gas,
            water: water,
            transit: transit,
            flights: flights,
            waste: waste,
            food: food,
            total: elect + gas + water + transit + flights + waste + food
        };
    }

    // Calculates baseline averages, scaled to a 12-month annual projection
    getAnnualProjections() {
        if (this.entries.length === 0) {
            return { electricity: 0, gas: 0, water: 0, transit: 0, flights: 0, waste: 0, food: 0, total: 0, count: 0 };
        }

        const totals = { electricity: 0, gas: 0, water: 0, transit: 0, flights: 0, waste: 0, food: 0, total: 0 };
        
        this.entries.forEach(e => {
            const co2 = this.calculateEmission(e);
            totals.electricity += co2.electricity;
            totals.gas += co2.gas;
            totals.water += co2.water;
            totals.transit += co2.transit;
            totals.flights += co2.flights;
            totals.waste += co2.waste;
            totals.food += co2.food;
            totals.total += co2.total;
        });

        const multiplier = 12 / this.entries.length;
        
        // Return annual scale
        return {
            electricity: totals.electricity * multiplier,
            gas: totals.gas * multiplier,
            water: totals.water * multiplier,
            transit: totals.transit * multiplier,
            flights: totals.flights * multiplier,
            waste: totals.waste * multiplier,
            food: totals.food * multiplier,
            total: totals.total * multiplier,
            rawMonthlyAverage: totals.total / this.entries.length,
            count: this.entries.length
        };
    }
}

// 4. CORE UI CONTROLLER
class UIController {
    constructor(store) {
        this.store = store;
        this.donutChart = null;
        this.barChart = null;
        
        this.init();
    }

    init() {
        // Initialize vector icons
        lucide.createIcons();
        
        this.setupTabNavigation();
        this.setupEventListeners();
        this.renderAll();
    }

    setupTabNavigation() {
        const navButtons = document.querySelectorAll('.nav-btn');
        const panels = document.querySelectorAll('.tab-panel');

        navButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.getAttribute('data-tab');
                
                // Toggle nav state
                navButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Toggle visibility
                panels.forEach(p => p.classList.remove('active'));
                const targetPanel = document.getElementById(targetTab);
                if (targetPanel) {
                    targetPanel.classList.add('active');
                }

                // Update title & description
                this.updateHeaderContent(targetTab);
            });
        });
    }

    updateHeaderContent(tab) {
        const titleEl = document.getElementById('page-title');
        const descEl = document.getElementById('page-subtitle');
        
        const contentMap = {
            'dashboard': {
                title: 'Overview Dashboard',
                desc: 'Track and analyze your household carbon footprint and energy savings.'
            },
            'log-utility': {
                title: 'Log Utility Bill',
                desc: 'Record electrical, water, waste, and transport logs to update audits.'
            },
            'ledger': {
                title: 'Household Ledger',
                desc: 'Complete ledger history of audited household records.'
            },
            'simulator': {
                title: 'Action Simulator',
                desc: 'Test ecological retrofits and lifestyle changes in real-time.'
            },
            'actions': {
                title: 'Action Planner',
                desc: 'Implement carbon reducing plans to directly offset baseline scores.'
            }
        };

        if (contentMap[tab]) {
            titleEl.textContent = contentMap[tab].title;
            descEl.textContent = contentMap[tab].desc;
        }
    }

    setupEventListeners() {
        // Form submissions
        const form = document.getElementById('utility-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                
                const entry = {
                    month: document.getElementById('bill-month').value,
                    electricity: parseFloat(document.getElementById('bill-electricity').value) || 0,
                    gas: parseFloat(document.getElementById('bill-gas').value) || 0,
                    water: parseFloat(document.getElementById('bill-water').value) || 0,
                    waste: parseFloat(document.getElementById('bill-waste').value) || 0,
                    recycling: parseFloat(document.getElementById('bill-recycling').value) || 0,
                    transitMiles: parseFloat(document.getElementById('transit-miles').value) || 0,
                    transitType: document.getElementById('transit-type').value,
                    flightMiles: parseFloat(document.getElementById('flight-miles').value) || 0,
                    dietProfile: document.getElementById('diet-profile').value
                };

                this.store.addEntry(entry);
                this.showToast('Utility bill and carbon log recorded successfully!', 'success');
                
                form.reset();
                this.renderAll();
                
                // Redirect back to dashboard
                document.querySelector('[data-tab="dashboard"]').click();
            });
        }

        // Action Checkboxes
        const checkboxes = document.querySelectorAll('.action-checkbox');
        checkboxes.forEach(cb => {
            // Load initial state
            if (this.store.checkedActions.includes(cb.id)) {
                cb.checked = true;
            }

            cb.addEventListener('change', () => {
                if (cb.checked) {
                    if (!this.store.checkedActions.includes(cb.id)) {
                        this.store.checkedActions.push(cb.id);
                    }
                    this.showToast(`Active eco action adopted! -${cb.getAttribute('data-impact')}kg CO2 offset.`, 'success');
                } else {
                    this.store.checkedActions = this.store.checkedActions.filter(id => id !== cb.id);
                    this.showToast(`Removed active eco action.`, 'info');
                }
                this.store.saveState();
                this.renderAll();
            });
        });

        // Reset Ledger Data
        const btnReset = document.getElementById('btn-clear-ledger');
        if (btnReset) {
            btnReset.addEventListener('click', () => {
                if (confirm("Are you sure you want to completely erase the audit ledger? This will erase all persistent history.")) {
                    this.store.resetData();
                    
                    // Uncheck actions UI
                    document.querySelectorAll('.action-checkbox').forEach(cb => cb.checked = false);
                    
                    // Reset sliders UI
                    document.querySelectorAll('.sim-slider').forEach(slider => {
                        slider.value = 0;
                        if (slider.id === 'sim-diet') slider.value = 0;
                    });
                    
                    this.showToast("Local data reset successful.", "info");
                    this.renderAll();
                }
            });
        }

        // Export JSON Report
        const btnExport = document.getElementById('btn-export-audit');
        if (btnExport) {
            btnExport.addEventListener('click', () => {
                this.exportReport();
            });
        }

        // What-If Sliders
        const sliders = [
            { id: 'sim-solar', valId: 'sim-val-solar', format: (v) => `${v}% solar` },
            { id: 'sim-efficiency', valId: 'sim-val-efficiency', format: (v) => `${v}% efficient` },
            { id: 'sim-transit', valId: 'sim-val-transit', format: (v) => `${v} mi/wk` },
            { id: 'sim-diet', valId: 'sim-val-diet', format: (v) => {
                const labels = ["Omnivore", "Meat Reduced", "Pescatarian", "Vegetarian", "100% Vegan"];
                return labels[v] || "Omnivore";
            }},
            { id: 'sim-recycling', valId: 'sim-val-recycling', format: (v) => `${v}% recycle` }
        ];

        sliders.forEach(s => {
            const input = document.getElementById(s.id);
            const valLabel = document.getElementById(s.valId);
            if (input && valLabel) {
                // Set initial stored values
                const settingKey = s.id.replace('sim-', '');
                if (this.store.simSettings[settingKey] !== undefined) {
                    input.value = this.store.simSettings[settingKey];
                    valLabel.textContent = s.format(input.value);
                }

                input.addEventListener('input', () => {
                    valLabel.textContent = s.format(input.value);
                    this.store.simSettings[settingKey] = parseInt(input.value) || 0;
                    this.store.saveState();
                    this.calculateSimulation();
                });
            }
        });
    }

    renderAll() {
        const projections = this.store.getAnnualProjections();
        
        // Calculate offsets from the action checklist
        let checklistOffset = 0;
        this.store.checkedActions.forEach(actionId => {
            const cb = document.getElementById(actionId);
            if (cb) {
                checklistOffset += parseFloat(cb.getAttribute('data-impact')) || 0;
            }
        });

        // Compute active adjusted carbon total
        const adjustedTotal = Math.max(0, projections.total - checklistOffset);

        // 1. Render Dashboard Numbers
        const numberEl = document.getElementById('total-carbon-value');
        if (numberEl) {
            this.animateNumber('total-carbon-value', adjustedTotal);
        }

        // Carbon Comparison target (e.g. baseline average is 8000kg)
        const targetPercent = Math.min(100, Math.round((adjustedTotal / 8000) * 100));
        const fillEl = document.getElementById('carbon-progress-fill');
        if (fillEl) {
            fillEl.style.width = `${targetPercent}%`;
            // Color shifts based on safety
            if (targetPercent <= 50) {
                fillEl.style.background = 'linear-gradient(90deg, #10b981 0%, #34d399 100%)';
            } else if (targetPercent <= 90) {
                fillEl.style.background = 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)';
            } else {
                fillEl.style.background = 'linear-gradient(90deg, #ef4444 0%, #f87171 100%)';
            }
        }
        const percentText = document.getElementById('comparison-percent');
        if (percentText) {
            percentText.textContent = `${targetPercent}% of average target`;
        }

        // 2. Render Eco-Grade
        this.renderEcoGrade(adjustedTotal, projections.count);

        // 3. Render quick statistics list
        this.renderQuickStats(projections);

        // 4. Render Table rows
        this.renderLedgerTable();

        // 5. Render charts
        this.renderCharts(projections);

        // 6. Run Auditing engine for smart alerts
        this.runSmartAlerts(projections);

        // 7. Initialize simulator projections
        this.calculateSimulation();
    }

    animateNumber(id, endValue) {
        const obj = document.getElementById(id);
        if (!obj) return;
        
        const start = parseInt(obj.textContent.replace(/,/g, '')) || 0;
        const duration = 800;
        let startTimestamp = null;
        
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const current = Math.floor(progress * (endValue - start) + start);
            obj.textContent = current.toLocaleString();
            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                obj.textContent = Math.round(endValue).toLocaleString();
            }
        };
        window.requestAnimationFrame(step);
    }

    renderEcoGrade(totalCarbon, count) {
        const badge = document.getElementById('grade-badge');
        const status = document.getElementById('grade-status');
        const feedback = document.getElementById('grade-feedback');
        
        if (!badge) return;

        if (count === 0) {
            badge.textContent = '-';
            badge.style.backgroundColor = 'var(--text-muted)';
            badge.style.boxShadow = 'none';
            status.textContent = 'Awaiting Entries';
            feedback.textContent = 'Submit your monthly utilities to receive an energy efficiency grade.';
            return;
        }

        // Grade math threshold (Annual total carbon impact)
        let grade = 'G';
        let color = '#ef4444'; // Red
        let shadow = 'var(--shadow-accent)';
        let title = 'Carbon Emitter';
        let desc = 'Your emissions exceed acceptable guidelines. Check out the Action Plan immediately!';

        if (totalCarbon < 2000) {
            grade = 'A';
            color = '#10b981'; // Emerald
            shadow = 'var(--shadow-emerald)';
            title = 'Carbon Hero!';
            desc = 'Exemplary low carbon household. Achieving true carbon neutrality benchmark.';
        } else if (totalCarbon < 4000) {
            grade = 'B';
            color = '#047857'; // Deep emerald
            shadow = '0 0 16px rgba(4, 120, 87, 0.4)';
            title = 'Eco Champion';
            desc = 'Fantastic environmental sustainability performance. Well below national averages.';
        } else if (totalCarbon < 6000) {
            grade = 'C';
            color = '#06b6d4'; // Cyan
            shadow = 'var(--shadow-cyan)';
            title = 'Green Pioneer';
            desc = 'Conscious habits are showing positive results. Highly responsive footprint.';
        } else if (totalCarbon < 8500) {
            grade = 'D';
            color = '#3b82f6'; // Blue
            shadow = '0 0 16px rgba(59, 130, 246, 0.4)';
            title = 'Standard Consumer';
            desc = 'Normal carbon impact standard. Minor adjustments could unlock huge savings.';
        } else if (totalCarbon < 11500) {
            grade = 'E';
            color = '#f59e0b'; // Amber
            shadow = '0 0 16px rgba(245, 158, 11, 0.4)';
            title = 'Energy Conscious';
            desc = 'Utility bills are starting to aggregate. Explore heat-pump or solar integrations.';
        } else if (totalCarbon < 15000) {
            grade = 'F';
            color = '#ea580c'; // Orange
            shadow = '0 0 16px rgba(234, 88, 12, 0.4)';
            title = 'High Carbon footprint';
            desc = 'Considerable emissions occurring in energy or transport grids.';
        }

        badge.textContent = grade;
        badge.style.background = `radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.15) 0%, transparent 80%), ${color}`;
        badge.style.borderColor = 'rgba(255, 255, 255, 0.3)';
        badge.style.boxShadow = shadow;
        
        status.textContent = title;
        status.style.color = color;
        feedback.textContent = desc;
    }

    renderQuickStats(proj) {
        const elElect = document.getElementById('stat-electricity');
        const elTransit = document.getElementById('stat-transport');
        const elWater = document.getElementById('stat-water');

        if (this.store.entries.length === 0) {
            if (elElect) elElect.textContent = "0 kWh logged";
            if (elTransit) elTransit.textContent = "0 kg CO2e";
            if (elWater) elWater.textContent = "0 gal logged";
            return;
        }

        // Calculate averages from entries
        let totalKwh = 0;
        let totalWater = 0;
        this.store.entries.forEach(e => {
            totalKwh += e.electricity;
            totalWater += e.water;
        });
        const avgKwh = Math.round(totalKwh / this.store.entries.length);
        const avgWater = Math.round(totalWater / this.store.entries.length);

        if (elElect) {
            const solarMultiplier = this.store.simSettings.solar > 0 ? ` (${this.store.simSettings.solar}% Solar)` : '';
            elElect.textContent = `${avgKwh.toLocaleString()} kWh/mo avg${solarMultiplier}`;
        }
        if (elTransit) {
            elTransit.textContent = `${Math.round(proj.transit).toLocaleString()} kg/yr transit`;
        }
        if (elWater) {
            elWater.textContent = `${avgWater.toLocaleString()} gal/mo avg`;
        }
    }

    renderLedgerTable() {
        const rowsContainer = document.getElementById('ledger-rows');
        const emptyView = document.getElementById('empty-ledger-view');
        
        if (!rowsContainer) return;

        rowsContainer.innerHTML = '';
        
        if (this.store.entries.length === 0) {
            if (emptyView) emptyView.style.display = 'flex';
            return;
        }

        if (emptyView) emptyView.style.display = 'none';

        // Load logs in order
        this.store.entries.forEach(entry => {
            const co2 = this.store.calculateEmission(entry);
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td><strong>${entry.month}</strong></td>
                <td>${entry.electricity.toLocaleString()} kWh</td>
                <td>${entry.gas.toLocaleString()} therms</td>
                <td>${entry.water.toLocaleString()} gal</td>
                <td>${entry.transitMiles.toLocaleString()} mi (${entry.transitType})</td>
                <td>${entry.waste.toLocaleString()} kg (${entry.recycling}%)</td>
                <td><strong>${Math.round(co2.total).toLocaleString()} kg</strong></td>
                <td>
                    <button class="action-row-btn" data-month="${entry.month}" title="Delete entry">
                        <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
                    </button>
                </td>
            `;

            rowsContainer.appendChild(row);
        });

        // Re-compile icons inside the new table rows
        lucide.createIcons();

        // Bind delete events
        const deleteButtons = rowsContainer.querySelectorAll('.action-row-btn');
        deleteButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const month = btn.getAttribute('data-month');
                if (confirm(`Erase logs for the month of ${month}?`)) {
                    this.store.deleteEntry(month);
                    this.showToast(`Erased entry for ${month}.`, 'info');
                    this.renderAll();
                }
            });
        });
    }

    // Chart.js Visualizations Loader
    renderCharts(proj) {
        if (this.store.entries.length === 0) {
            return; // Don't crash if empty
        }

        // A. Donut Chart - Sector Breakdown
        const donutCtx = document.getElementById('carbonDonutChart');
        if (donutCtx) {
            const data = [
                proj.electricity,
                proj.gas,
                proj.water,
                proj.transit,
                proj.flights,
                proj.waste,
                proj.food
            ];

            if (this.donutChart) {
                this.donutChart.data.datasets[0].data = data;
                this.donutChart.update();
            } else {
                this.donutChart = new Chart(donutCtx, {
                    type: 'doughnut',
                    data: {
                        labels: ['Electricity', 'Natural Gas', 'Water Usage', 'Car Transit', 'Flights', 'Waste', 'Diet/Food'],
                        datasets: [{
                            data: data,
                            backgroundColor: [
                                '#10b981', // Emerald
                                '#fbbf24', // Amber/Yellow
                                '#06b6d4', // Cyan
                                '#3b82f6', // Blue
                                '#8b5cf6', // Violet
                                '#f43f5e', // Rose
                                '#ec4899'  // Pink
                            ],
                            borderColor: '#0f1422',
                            borderWidth: 2
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'right',
                                labels: {
                                    color: '#94a3b8',
                                    font: { family: 'Inter', size: 11 }
                                }
                            }
                        }
                    }
                });
            }
        }

        // B. Bar Chart - Monthly comparison trends
        const barCtx = document.getElementById('monthlyTrendChart');
        if (barCtx) {
            const months = this.store.entries.map(e => e.month);
            
            // Build separate dataset carbon arrays
            const electricityData = [];
            const transitData = [];
            const otherData = [];

            this.store.entries.forEach(e => {
                const co2 = this.store.calculateEmission(e);
                electricityData.push(Math.round(co2.electricity + co2.gas));
                transitData.push(Math.round(co2.transit + co2.flights));
                otherData.push(Math.round(co2.water + co2.waste + co2.food));
            });

            if (this.barChart) {
                this.barChart.data.labels = months;
                this.barChart.data.datasets[0].data = electricityData;
                this.barChart.data.datasets[1].data = transitData;
                this.barChart.data.datasets[2].data = otherData;
                this.barChart.update();
            } else {
                this.barChart = new Chart(barCtx, {
                    type: 'bar',
                    data: {
                        labels: months,
                        datasets: [
                            {
                                label: 'Home Energy (Elec/Gas)',
                                data: electricityData,
                                backgroundColor: '#10b981',
                            },
                            {
                                label: 'Transport (Car/Air)',
                                data: transitData,
                                backgroundColor: '#06b6d4',
                            },
                            {
                                label: 'Other (Water/Waste/Food)',
                                data: otherData,
                                backgroundColor: '#f59e0b',
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            x: {
                                stacked: true,
                                grid: { color: 'rgba(255, 255, 255, 0.03)' },
                                ticks: { color: '#94a3b8' }
                            },
                            y: {
                                stacked: true,
                                grid: { color: 'rgba(255, 255, 255, 0.03)' },
                                ticks: { color: '#94a3b8' }
                            }
                        },
                        plugins: {
                            legend: {
                                position: 'bottom',
                                labels: {
                                    color: '#94a3b8',
                                    font: { family: 'Inter', size: 10 }
                                }
                            }
                        }
                    }
                });
            }
        }
    }

    // Smart Energy & Resource Auditing Engine
    runSmartAlerts(proj) {
        const container = document.getElementById('smart-alerts-container');
        if (!container) return;

        if (this.store.entries.length === 0) {
            container.innerHTML = `
                <div class="empty-alert-message">
                    <i data-lucide="check-circle-2" class="text-emerald"></i>
                    <span>No anomalies detected! Log your household energy bills to run an automated efficiency audit.</span>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        container.innerHTML = '';
        const alerts = [];

        // Average quantities
        let avgElectricity = 0;
        let avgWater = 0;
        let avgRecycling = 0;
        let avgWaste = 0;
        let avgTransit = 0;

        this.store.entries.forEach(e => {
            avgElectricity += e.electricity;
            avgWater += e.water;
            avgRecycling += e.recycling;
            avgWaste += e.waste;
            avgTransit += e.transitMiles;
        });

        const size = this.store.entries.length;
        avgElectricity /= size;
        avgWater /= size;
        avgRecycling /= size;
        avgWaste /= size;
        avgTransit /= size;

        // Auditing Rules thresholds:
        // 1. High electricity trigger (>400 kWh average per month)
        if (avgElectricity > 400) {
            alerts.push({
                type: 'alert-danger',
                badgeText: 'Home Energy',
                icon: 'zap',
                title: 'High Electricity Draw Detected',
                desc: `Your household draws ${Math.round(avgElectricity)} kWh of electricity monthly. This is 33% higher than standard energy grids. Upgrade your lights to 100% LEDs or adopt smart utility plugs to save up to $150 per year.`
            });
        }

        // 2. High water audit (>3,000 gallons per month)
        if (avgWater > 3000) {
            alerts.push({
                type: 'alert-warning',
                badgeText: 'Resource Usage',
                icon: 'droplet',
                title: 'Elevated Hydro-Consumption',
                desc: `Water volume averages ${Math.round(avgWater).toLocaleString()} gallons monthly. Pumping water counts towards indirect grid emissions. Check for pipe leakage or install low-flow aerators.`
            });
        }

        // 3. Low recycling circularity rate (<30%)
        if (avgRecycling < 30) {
            alerts.push({
                type: 'alert-warning',
                badgeText: 'Circularity',
                icon: 'refresh-cw',
                title: 'Low Waste Circularity Rate',
                desc: `Your recycling rate is only ${Math.round(avgRecycling)}%. A higher rate prevents methane gas creation in local landfills. Strive to sort compostables to shave off 80kg of carbon annually.`
            });
        }

        // 4. Excessive vehicle driving (>900 miles/month)
        if (avgTransit > 900) {
            alerts.push({
                type: 'alert-danger',
                badgeText: 'Mobility',
                icon: 'car',
                title: 'Elevated Transit Emissions',
                desc: `Vehicle operations cover ${Math.round(avgTransit).toLocaleString()} miles monthly. Consider cycling or public transport shifts to offset fuel costs, or explore swapping to an EV in the simulator.`
            });
        }

        // Render notifications
        if (alerts.length === 0) {
            container.innerHTML = `
                <div class="audit-alert-item alert-success">
                    <div class="stat-icon-wrapper text-emerald bg-emerald-trans">
                        <i data-lucide="check-circle-2"></i>
                    </div>
                    <div class="alert-body">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span class="alert-badge text-emerald bg-emerald-trans">Optimized</span>
                            <h4>Household Running Super Efficiently!</h4>
                        </div>
                        <p>No carbon anomalies or excessive resource waste detected across any logged metrics. Keep up the ecological work!</p>
                    </div>
                </div>
            `;
        } else {
            alerts.forEach(al => {
                const item = document.createElement('div');
                item.className = `audit-alert-item ${al.type}`;
                
                // Set color scheme variables
                let colorClass = 'text-accent bg-accent-trans';
                if (al.type === 'alert-danger') colorClass = 'text-danger bg-red-trans';
                
                item.innerHTML = `
                    <div class="stat-icon-wrapper ${colorClass}">
                        <i data-lucide="${al.icon}"></i>
                    </div>
                    <div class="alert-body">
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                            <span class="alert-badge ${al.type === 'alert-danger' ? 'text-danger bg-red-trans' : 'text-accent bg-accent-trans'}">${al.badgeText}</span>
                            <h4>${al.title}</h4>
                        </div>
                        <p>${al.desc}</p>
                    </div>
                `;
                container.appendChild(item);
            });
        }

        // Refresh icons inside alerts
        lucide.createIcons();
    }

    // Real-Time Simulator Mathematics
    calculateSimulation() {
        const s = this.store.simSettings;
        const projections = this.store.getAnnualProjections();
        
        if (this.store.entries.length === 0) {
            // Fill simulator offsets with 0 if no entries exist yet
            document.getElementById('sim-carbon-saved').textContent = '0';
            document.getElementById('sim-cost-saved').textContent = '$0';
            document.getElementById('sim-carbon-bar').style.width = '0%';
            document.getElementById('sim-cost-bar').style.width = '0%';
            document.getElementById('eq-trees').textContent = '0';
            document.getElementById('eq-miles').textContent = '0';
            return;
        }

        let carbonSaved = 0;
        let costSaved = 0;

        // 1. Solar calculations: Offsets grid energy emissions (electricity)
        const solarReductionShare = s.solar / 100;
        const solarCarbonOffset = projections.electricity * solarReductionShare;
        carbonSaved += solarCarbonOffset;
        
        // Cost saved: Electricity kwh * solar share * unit rate
        let annualKwh = 0;
        this.store.entries.forEach(e => annualKwh += e.electricity);
        annualKwh *= (12 / this.store.entries.length);
        const solarCostOffset = annualKwh * solarReductionShare * UTILITY_RATES.electricity_kwh;
        costSaved += solarCostOffset;

        // 2. Efficiency calculations: Reductions in Elec + Gas usage (up to 40% reduction)
        const efficiencyShare = s.efficiency / 100;
        const efficiencyCarbonOffset = (projections.electricity + projections.gas) * efficiencyShare;
        carbonSaved += efficiencyCarbonOffset;

        // Cost saved: Elec cost + Gas cost saved
        let annualGas = 0;
        this.store.entries.forEach(e => annualGas += e.gas);
        annualGas *= (12 / this.store.entries.length);
        const efficiencyCostOffset = (annualKwh * UTILITY_RATES.electricity_kwh + annualGas * UTILITY_RATES.natural_gas_therm) * efficiencyShare;
        costSaved += efficiencyCostOffset;

        // 3. Transit calculations: Commute replacement miles
        const replacedTransitMilesAnnual = s.transit * 52; // Scale weekly miles to annual
        // Carbon saved based on Petrol factor minus cycle (0 emissions)
        const transitCarbonOffset = replacedTransitMilesAnnual * EMISSION_FACTORS.transit_fuel.petrol;
        carbonSaved += transitCarbonOffset;

        // Cost saved: miles * cost per mile (based on $3.50/gal at 25mpg = $0.14/mi fuel + $0.06 wear = $0.20/mi)
        const transitCostOffset = replacedTransitMilesAnnual * 0.20;
        costSaved += transitCostOffset;

        // 4. Diet calculations (Increments of vegetarian days replacing omnivore profile)
        const dietDaysShift = s.diet; // 0 to 4 days vegetarian shift
        if (dietDaysShift > 0) {
            // Difference between meat-average and vegetarian profile scaled to days
            const baselineDietCarbon = EMISSION_FACTORS.diet_annual_kg['meat-average'];
            const vegDietCarbon = EMISSION_FACTORS.diet_annual_kg['vegetarian'];
            const dietDelta = (baselineDietCarbon - vegDietCarbon) * (dietDaysShift / 7);
            carbonSaved += dietDelta;

            // Cost saved: grocery budget shift ($3 saved per day meat is replaced)
            costSaved += (dietDaysShift * 52 * 3.00);
        }

        // 5. Recycling calculations: scale recycling rate up to target%
        let avgWasteWeight = 0;
        let avgRecyclingCurrent = 0;
        this.store.entries.forEach(e => {
            avgWasteWeight += e.waste;
            avgRecyclingCurrent += e.recycling;
        });
        avgWasteWeight = (avgWasteWeight / this.store.entries.length) * 12;
        avgRecyclingCurrent = avgRecyclingCurrent / this.store.entries.length;

        const targetRecyclingShare = s.recycling / 100;
        const currentRecyclingShare = avgRecyclingCurrent / 100;
        
        if (targetRecyclingShare > currentRecyclingShare) {
            const extraWasteRecycled = avgWasteWeight * (targetRecyclingShare - currentRecyclingShare);
            const wasteCarbonOffset = extraWasteRecycled * EMISSION_FACTORS.waste_kg * EMISSION_FACTORS.recycling_offset;
            carbonSaved += wasteCarbonOffset;

            // Minor cost savings on trash bags/compost
            costSaved += (extraWasteRecycled * 0.05);
        }

        // Clamp totals
        carbonSaved = Math.max(0, carbonSaved);
        costSaved = Math.max(0, costSaved);

        // Update UI
        document.getElementById('sim-carbon-saved').textContent = Math.round(carbonSaved).toLocaleString();
        document.getElementById('sim-cost-saved').textContent = `$${Math.round(costSaved).toLocaleString()}`;

        // Fill progress bars relative to targets (e.g. Target max savings = 3,000kg carbon, $1,500 cash)
        const carbonBarPercent = Math.min(100, Math.round((carbonSaved / 3500) * 100));
        const costBarPercent = Math.min(100, Math.round((costSaved / 1200) * 100));

        document.getElementById('sim-carbon-bar').style.width = `${carbonBarPercent}%`;
        document.getElementById('sim-cost-bar').style.width = `${costBarPercent}%`;

        // Equivalence widgets formulas
        // 1 mature tree absorbs ~22kg of carbon CO2 annually
        const treesEquivalent = Math.round(carbonSaved / 22);
        // Miles driven replacement petrol factor (0.25 kg/mi)
        const milesEquivalent = Math.round(carbonSaved / 0.25);

        document.getElementById('eq-trees').textContent = treesEquivalent.toLocaleString();
        document.getElementById('eq-miles').textContent = milesEquivalent.toLocaleString();
    }

    // System Report Downloader
    exportReport() {
        const projections = this.store.getAnnualProjections();
        if (projections.count === 0) {
            this.showToast("Cannot export report: Ledger is empty.", "info");
            return;
        }

        // Gather actions checklist
        const activeActions = [];
        this.store.checkedActions.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                const name = el.closest('.action-item').querySelector('.action-name').textContent;
                activeActions.push(name);
            }
        });

        const report = {
            appName: "ECOWATT Household Auditor",
            generatedAt: new Date().toISOString(),
            auditSummary: {
                totalMonthsAudited: projections.count,
                annualBaseCarbonFootprintKg: Math.round(projections.total),
                activeOffsetCheckedActionsKg: activeActions.length * 200, // Estimated aggregate
                calculatedEcoRating: document.getElementById('grade-badge').textContent,
                ecoStatus: document.getElementById('grade-status').textContent
            },
            utilityAnnualEmissionsBreakdownKg: {
                gridElectricity: Math.round(projections.electricity),
                naturalGas: Math.round(projections.gas),
                waterUsage: Math.round(projections.water),
                transitMiles: Math.round(projections.transit),
                flights: Math.round(projections.flights),
                wasteSolid: Math.round(projections.waste),
                dietFood: Math.round(projections.food)
            },
            activeHouseholdActionsAdopted: activeActions,
            simulatorWhatIfProjections: {
                solarIntegrationPercent: this.store.simSettings.solar,
                smartEfficiencyPercent: this.store.simSettings.efficiency,
                bikeShiftMilesPerWeek: this.store.simSettings.transit,
                dietDaysVegetarianShift: this.store.simSettings.diet,
                wasteRecyclingTargetPercent: this.store.simSettings.recycling
            }
        };

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(report, null, 4));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `ecowatt_carbon_audit_${new Date().getFullYear()}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();

        this.showToast("Carbon Auditor Report compiled & downloaded successfully!", "success");
    }

    // System Alert snackbar loader
    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        const icon = document.getElementById('toast-icon');
        const msgEl = document.getElementById('toast-message');

        if (!toast || !msgEl) return;

        toast.className = 'toast'; // Reset
        if (type === 'success') {
            toast.classList.add('toast-success');
            icon.setAttribute('data-lucide', 'check-circle');
            toast.style.borderColor = 'rgba(16, 185, 129, 0.4)';
            toast.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5), 0 0 20px rgba(16, 185, 129, 0.2)';
        } else {
            icon.setAttribute('data-lucide', 'info');
            toast.style.borderColor = 'rgba(6, 182, 212, 0.4)';
            toast.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5), var(--shadow-cyan)';
        }

        msgEl.textContent = message;
        lucide.createIcons(); // Compile toast icon

        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3500);
    }
}

// 5. APPLICATION STARTUP INSTANTIATOR
document.addEventListener('DOMContentLoaded', () => {
    const store = new AppStore();
    window.appUI = new UIController(store);
});

const numberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const rupeeFormat = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

function syncNavigation() {
  const hash = window.location.hash.slice(1);
  const isMonitor = hash === "funds";
  document.querySelector("#overview-view").hidden = isMonitor;
  document.querySelector("#funds").hidden = !isMonitor;
  document.querySelector("#breadcrumb").innerHTML = isMonitor
    ? 'Workspace <span>/</span> ETF monitor'
    : `Workspace <span>/</span> ${hash === "markets" ? "Global markets" : hash === "research" ? "AI research" : "Overview"}`;

  for (const link of document.querySelectorAll(".nav-item")) {
    link.classList.toggle("active", link.hash === `#${isMonitor ? "funds" : hash || "overview"}`);
  }

  if (isMonitor || !hash || hash === "overview") window.scrollTo(0, 0);
  else document.getElementById(hash)?.scrollIntoView();
}

window.addEventListener("hashchange", syncNavigation);
syncNavigation();

async function loadMarket() {
  const response = await fetch("/api/market");
  if (!response.ok) throw new Error("Market data is unavailable.");
  const market = await response.json();

  for (const index of market.indices) {
    document.querySelector(`[data-index="${index.symbol}"]`).textContent = numberFormat.format(index.value);
    const change = document.querySelector(`[data-change="${index.symbol}"]`);
    const prefix = index.change_pct > 0 ? "+" : "";
    change.textContent = `${prefix}${index.change_pct.toFixed(2)}% today`;
    change.className = `change ${index.change_pct >= 0 ? "positive" : "negative"}`;
  }

  document.querySelector("#etf-rows").innerHTML = market.etfs.map((fund) => `
    <tr>
      <td><span class="fund-name"><span class="ticker-chip">${fund.symbol}</span>${fund.name}</span></td>
      <td class="price-cell">$${numberFormat.format(fund.price)}</td>
      <td><span class="change ${fund.change_pct >= 0 ? "positive" : "negative"}">${fund.change_pct > 0 ? "+" : ""}${fund.change_pct.toFixed(2)}%</span></td>
    </tr>`).join("");

  const topIndianEtfs = [...market.indian_etfs]
    .sort((left, right) => right.change_pct - left.change_pct)
    .slice(0, 10);
  const nearestYearLow = [...topIndianEtfs]
    .map((fund) => ({ ...fund, aboveYearLow: ((fund.price / fund.year_low) - 1) * 100 }))
    .sort((left, right) => left.aboveYearLow - right.aboveYearLow)[0];
  document.querySelector("#monitor-fund-count").textContent = topIndianEtfs.length;
  document.querySelector("#monitor-leader").textContent = topIndianEtfs[0].symbol;
  document.querySelector("#monitor-leader-change").textContent = `+${topIndianEtfs[0].change_pct.toFixed(2)}% today`;
  document.querySelector("#monitor-near-low").textContent = nearestYearLow.symbol;
  document.querySelector("#monitor-near-low-distance").textContent = `${nearestYearLow.aboveYearLow.toFixed(1)}% above its 1Y low`;
  document.querySelector("#monitor-symbol").innerHTML = topIndianEtfs.map((fund) =>
    `<option value="${fund.symbol}">${fund.symbol} · ${fund.name}</option>`
  ).join("");
  document.querySelector("#india-etf-rows").innerHTML = topIndianEtfs.map((fund, index) => {
    const aboveYearLow = ((fund.price / fund.year_low) - 1) * 100;
    return `
    <tr>
      <td class="rank-cell">${index + 1}</td>
      <td><span class="fund-name"><span class="ticker-chip">${fund.symbol}</span>${fund.name}</span></td>
      <td><span class="change ${fund.change_pct >= 0 ? "positive" : "negative"}">${fund.change_pct > 0 ? "+" : ""}${fund.change_pct.toFixed(2)}%</span></td>
      <td class="price-cell">${rupeeFormat.format(fund.price)}</td>
      <td class="price-cell">${rupeeFormat.format(fund.day_low)}</td>
      <td class="price-cell">${rupeeFormat.format(fund.week_low)}</td>
      <td class="price-cell">${rupeeFormat.format(fund.month_low)}</td>
      <td class="price-cell">${rupeeFormat.format(fund.year_low)}</td>
      <td class="distance-cell">${aboveYearLow.toFixed(1)}% above</td>
    </tr>`;
  }).join("");

  const regionSymbols = ["◉", "◍", "◎"];
  document.querySelector("#region-list").innerHTML = market.regions.map((region, index) => `
    <div class="region-row">
      <span class="region-name"><span class="region-symbol">${regionSymbols[index]}</span>${region.name}</span>
      <span class="region-state ${region.tone === "neutral" ? "neutral" : ""}"><i></i>${region.status}</span>
    </div>`).join("");
  document.querySelector("#snapshot-note").textContent = market.as_of;
}

const form = document.querySelector("#analysis-form");
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = document.querySelector("#analyze-button");
  const result = document.querySelector("#analysis-result");
  button.disabled = true;
  button.querySelector("span").textContent = "Analyzing...";
  result.classList.remove("error");
  result.innerHTML = '<span class="result-mark">✳</span><span>Preparing research brief...</span>';

  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        symbol: form.elements.symbol.value.trim(),
        focus: form.elements.focus.value,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "Analysis request failed.");
    result.replaceChildren();
    const mode = document.createElement("span");
    mode.className = "mode-label";
    mode.textContent = data.mode;
    const copy = document.createElement("span");
    copy.textContent = data.analysis;
    result.append(mode, copy);
  } catch (error) {
    result.classList.add("error");
    result.textContent = error.message;
  } finally {
    button.disabled = false;
    button.querySelector("span").textContent = "Run analysis";
  }
});

const monitorAnalysisForm = document.querySelector("#monitor-analysis-form");
monitorAnalysisForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = document.querySelector("#monitor-analyze-button");
  const result = document.querySelector("#monitor-analysis-result");
  button.disabled = true;
  button.querySelector("span").textContent = "Analyzing...";
  result.classList.remove("error");
  result.innerHTML = '<span class="result-mark">✳</span><span>Preparing ETF research brief...</span>';

  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: monitorAnalysisForm.elements.symbol.value, focus: "etf" }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "Analysis request failed.");
    result.replaceChildren();
    const mode = document.createElement("span");
    mode.className = "mode-label";
    mode.textContent = data.mode;
    const copy = document.createElement("span");
    copy.textContent = data.analysis;
    result.append(mode, copy);
  } catch (error) {
    result.classList.add("error");
    result.textContent = error.message;
  } finally {
    button.disabled = false;
    button.querySelector("span").textContent = "Analyze ETF";
  }
});

loadMarket().catch((error) => {
  document.querySelector("#etf-rows").innerHTML = `<tr><td colspan="3" class="loading-cell">${error.message}</td></tr>`;
  document.querySelector("#india-etf-rows").innerHTML = `<tr><td colspan="9" class="loading-cell">${error.message}</td></tr>`;
  document.querySelector("#monitor-symbol").innerHTML = `<option>${error.message}</option>`;
  document.querySelector("#monitor-fund-count").textContent = "--";
  document.querySelector("#region-list").textContent = error.message;
});
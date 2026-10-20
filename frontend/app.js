const numberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

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

loadMarket().catch((error) => {
  document.querySelector("#etf-rows").innerHTML = `<tr><td colspan="3" class="loading-cell">${error.message}</td></tr>`;
  document.querySelector("#region-list").textContent = error.message;
});
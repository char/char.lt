if (!ReadableStream.prototype[Symbol.asyncIterator])
  await import("./ihatesafari.js");

const minute = 60_000;
const hour = 60 * minute;
const day = 24 * hour;

const start = Date.parse("2021-01-01T00:00:00Z");
const initialScrollDate = Date.parse("2024-01-01T00:00:00Z");
const binSize = 5 * minute;
// we run each row to 30時 so that activity over midnight isn't split
const rowSpan = 30 * hour;
const sleepRange = [4 * hour, 16 * hour];

const binsPerDay = day / binSize;
const binsPerRow = rowSpan / binSize;

const minBinWidth = 0.5;
const rowHeight = 2;
const barHeight = rowHeight - 1;

const axisWidth = 56;
const axisHeight = 48;
const plotOverhang = 8;

async function loadTimestamps() {
  const response = await fetch(new URL("./actogram-bins.bin", import.meta.url));
  if (!response.ok) throw new Error("failed to fetch actogram bins");

  const timestamps = [];
  let minutes = 0;
  let delta = 0;
  let factor = 1;
  for await (const chunk of response.body.pipeThrough(
    new DecompressionStream("gzip"),
  )) {
    for (const byte of chunk) {
      delta += (byte & 0x7f) * factor;
      if (byte & 0x80) {
        factor *= 128;
        continue;
      }
      minutes += delta;
      timestamps.push(minutes * minute);
      delta = 0;
      factor = 1;
    }
  }
  if (factor !== 1) throw new Error("truncated minute delta");
  return timestamps;
}

const bar = (x, y, width) => `M${x} ${y}h${width}v${barHeight}h-${width}z`;

function activityLayer(timestamps, days) {
  const counts = new Uint32Array(days * binsPerDay);
  for (const timestamp of timestamps) {
    if (timestamp >= start) counts[Math.floor((timestamp - start) / binSize)]++;
  }
  const maxCount = counts.reduce((a, b) => Math.max(a, b));

  const runsByCount = new Map();
  for (let row = 0; row < days; row++) {
    const bins = counts.subarray(
      row * binsPerDay,
      row * binsPerDay + binsPerRow,
    );
    for (let bin = 0; bin < bins.length; ) {
      const count = bins[bin];
      const first = bin++;
      while (bin < bins.length && bins[bin] === count) bin++;
      if (!count) continue;
      const runs = runsByCount.get(count) ?? [];
      runs.push(bar(first, row * rowHeight, bin - first));
      runsByCount.set(count, runs);
    }
  }

  let layer = "";
  for (const [count, runs] of runsByCount) {
    const intensity = Math.log(count) / Math.log(Math.max(2, maxCount));
    layer += `<path d="${runs.join("")}" fill="var(--actogram-activity)" fill-opacity="${0.1 + intensity * 0.9}"/>`;
  }
  return layer;
}

function sleepLayer(timestamps, days) {
  const [minSleep, maxSleep] = sleepRange;
  const bars = [];
  for (let i = 1; i < timestamps.length; i++) {
    const [asleep, awake] = [timestamps[i - 1], timestamps[i]];
    const duration = awake - asleep;
    if (duration < minSleep || duration > maxSleep || awake <= start) continue;

    const firstRow = Math.max(0, Math.floor((asleep - start) / day) - 1);
    const lastRow = Math.min(days - 1, Math.floor((awake - start) / day));
    for (let row = firstRow; row <= lastRow; row++) {
      const rowStart = start + row * day;
      const from = Math.max(asleep, rowStart);
      const to = Math.min(awake, rowStart + rowSpan);
      if (to > from) {
        bars.push(
          bar(
            (from - rowStart) / binSize,
            row * rowHeight,
            (to - from) / binSize,
          ),
        );
      }
    }
  }
  return `<path d="${bars.join("")}" fill="var(--actogram-sleep)"/>`;
}

function firstsOfMonths(days) {
  const rows = [];
  for (let row = 0; row < days; row++) {
    const date = new Date(start + row * day);
    if (date.getUTCDate() === 1) rows.push({ row, date });
  }
  return rows;
}

function gridLayer(days) {
  const plotHeight = days * rowHeight;
  let lines = "";
  for (let h = 0; h <= rowSpan / hour; h += 6)
    lines += `M${h * (hour / binSize)} 0v${plotHeight}`;
  for (const { row } of firstsOfMonths(days))
    lines += `M0 ${row * rowHeight}h${binsPerRow}`;

  return `<path d="${lines}" stroke="var(--fg-col-mute)" stroke-opacity="0.3" vector-effect="non-scaling-stroke"/>
    <path d="M${binsPerDay} 0v${plotHeight}" stroke="var(--fg-col-mute)" vector-effect="non-scaling-stroke"/>
    <rect x="${binsPerDay}" y="${plotHeight - rowHeight}" width="${binsPerRow - binsPerDay}" height="${rowHeight}" fill="var(--fg-col-mute)" fill-opacity="0.3"/>`;
}

function monthLabels(days) {
  let labels = "";
  for (const { row, date } of firstsOfMonths(days)) {
    const weight = date.getUTCMonth() === 0 ? ' font-weight="700"' : "";
    labels += `<text x="${axisWidth - 8}" y="${row * rowHeight + 11}" text-anchor="end"${weight}>${date.toISOString().slice(0, 7)}</text>`;
  }
  return labels;
}

function hourLabels(plotWidth) {
  const hours = rowSpan / hour;
  // two-digit labels need ≈18px each
  const every = Math.ceil((18 * hours) / plotWidth);
  let labels = `<text x="${plotWidth / 2}" y="15" text-anchor="middle">time of day (UTC)</text>`;
  for (let h = 0; h <= hours; h += every) {
    labels += `<text x="${(h / hours) * plotWidth}" y="39" text-anchor="middle">${String(h % 24).padStart(2, "0")}</text>`;
  }
  return labels;
}

function render(timestamps) {
  const latest = timestamps.at(-1);
  if (latest === undefined || latest < start)
    throw new Error("no activity in the selected date range");
  const days = Math.floor((latest - start) / day) + 1;
  const plotHeight = days * rowHeight;

  const figure = document.createElement("figure");
  figure.className = "actogram";
  figure.innerHTML = `
    <div class="actogram-scroller" tabindex="0" aria-label="Scrollable actogram"
        style="--actogram-height: ${plotHeight}px; --actogram-axis-width: ${axisWidth}px; --actogram-axis-height: ${axisHeight}px">
      <div class="actogram-corner"></div>
      <svg class="actogram-x-axis" aria-hidden="true" height="${axisHeight}"></svg>
      <svg class="actogram-y-axis" aria-hidden="true" width="${axisWidth}" height="${plotHeight}">${monthLabels(days)}</svg>
      <svg class="actogram-plot" role="img" height="${plotHeight}" viewBox="0 0 ${binsPerRow} ${plotHeight}"
          preserveAspectRatio="none" style="margin-inline: ${plotOverhang}px">
        ${sleepLayer(timestamps, days)}
        ${gridLayer(days)}
        ${activityLayer(timestamps, days)}
      </svg>
    </div>
    <figcaption>
      <span><i class="actogram-activity"></i>online activity</span>
      <span><i class="actogram-sleep"></i>possible sleep</span>
    </figcaption>`;

  const scroller = figure.querySelector(".actogram-scroller");
  const plot = figure.querySelector(".actogram-plot");
  const xAxis = figure.querySelector(".actogram-x-axis");
  new ResizeObserver(() => {
    const available = scroller.clientWidth - axisWidth - plotOverhang * 2;
    const plotWidth = Math.max(binsPerRow * minBinWidth, available);
    scroller.style.setProperty(
      "--actogram-width",
      `${plotWidth + plotOverhang * 2}px`,
    );
    plot.setAttribute("width", plotWidth);
    xAxis.setAttribute("width", plotWidth + plotOverhang * 2);
    xAxis.setAttribute(
      "viewBox",
      `${-plotOverhang} 0 ${plotWidth + plotOverhang * 2} ${axisHeight}`,
    );
    xAxis.innerHTML = hourLabels(plotWidth);
  }).observe(scroller);

  return figure;
}

const graphContainer = document.querySelector("#non24swd-graph");
const loadButton = graphContainer.querySelector("button");
loadButton.addEventListener("click", async () => {
  loadButton.disabled = true;
  loadButton.textContent = "loading…";
  delete graphContainer.dataset.error;
  try {
    const figure = render(await loadTimestamps());
    loadButton.replaceWith(figure);
    figure.querySelector(".actogram-scroller").scrollTop =
      ((initialScrollDate - start) / day) * rowHeight;
  } catch (error) {
    console.error(error);
    loadButton.disabled = false;
    loadButton.textContent = "try again";
    graphContainer.dataset.error = "sorry, the graph failed to load";
  }
});

// ===========================================================
// STOCKLINK CHARTS
// One look for every Chart.js chart in the admin (dashboard,
// analytics, orders). Load after Chart.js and before the page script:
//   <script src="/admin/chart-theme.js"></script>
//
//   const chart = StockCharts.create(canvas, {
//     type: "line" | "bar",
//     labels: ["Oct 1", ...],
//     series: [{ key: "revenue", label: "Revenue", data: [...] }],
//     format: "money" | "count",
//   });
//
// Colors come from tokens.css (--chart-revenue / --chart-orders /
// --chart-visitors, each with its own dark-theme step), so a metric
// has the same color on every page, and charts recolor themselves
// when the theme toggles.
// ===========================================================

(function () {
  if (typeof Chart === "undefined") return;

  const token = (name) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  // "#2563eb" → "rgba(37, 99, 235, 0.1)"
  function withAlpha(hex, alpha) {
    const value = hex.replace("#", "");
    const full =
      value.length === 3
        ? value
            .split("")
            .map((c) => c + c)
            .join("")
        : value;
    const n = parseInt(full, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }

  function seriesColor(key) {
    return token(`--chart-${key}`) || token("--accent");
  }

  // 3400 → "$3.4K" on the axis; 3400 → "$3,400" in the tooltip
  function formatValue(value, format, compact) {
    const number = Number(value) || 0;
    const text = compact
      ? new Intl.NumberFormat("en-US", {
          notation: "compact",
          maximumFractionDigits: 1,
        }).format(number)
      : number.toLocaleString("en-US", { maximumFractionDigits: 2 });
    return format === "money" ? `$${text}` : text;
  }

  // A vertical hairline under the hovered point on line charts, so the
  // reader can see which day the tooltip belongs to.
  const crosshair = {
    id: "stockCrosshair",
    afterDatasetsDraw(chart) {
      if (chart.config.type !== "line") return;
      const active = chart.tooltip?.getActiveElements?.() || [];
      if (!active.length) return;
      const { ctx, chartArea } = chart;
      const x = active[0].element.x;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x, chartArea.top);
      ctx.lineTo(x, chartArea.bottom);
      ctx.lineWidth = 1;
      ctx.strokeStyle = token("--border-strong");
      ctx.stroke();
      ctx.restore();
    },
  };
  Chart.register(crosshair);

  function buildDataset(series, type) {
    const color = seriesColor(series.key);
    const surface = token("--surface");
    const last = series.data.length - 1;

    if (type === "bar") {
      return {
        label: series.label,
        data: series.data,
        backgroundColor: color,
        hoverBackgroundColor: withAlpha(color, 0.8),
        borderRadius: 4,
        borderSkipped: "start", // square at the baseline, round at the top
        maxBarThickness: 24,
        categoryPercentage: 0.8,
        barPercentage: 0.9,
        pointStyle: "circle",
      };
    }

    return {
      label: series.label,
      data: series.data,
      borderColor: color,
      borderWidth: 2,
      borderJoinStyle: "round",
      borderCapStyle: "round",
      backgroundColor: withAlpha(color, 0.1),
      fill: "origin",
      cubicInterpolationMode: "monotone", // smooth, but never dips below 0
      // only the latest point gets a dot; the rest appear on hover
      pointRadius: (ctx) => (ctx.dataIndex === last ? 4 : 0),
      pointBackgroundColor: color,
      pointBorderColor: surface,
      pointBorderWidth: 2,
      pointHoverRadius: 5,
      pointHoverBorderWidth: 2,
      pointHoverBorderColor: surface,
      pointHoverBackgroundColor: color,
      pointHitRadius: 12,
      pointStyle: "circle",
    };
  }

  function buildOptions(spec) {
    const ink = token("--ink");
    const inkSoft = token("--ink-soft");
    const inkFaint = token("--ink-faint");
    const border = token("--border");
    const format = spec.format || "count";
    const font = token("--font-body") || "Inter, sans-serif";

    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      interaction: { mode: "index", intersect: false },
      layout: { padding: { top: 6, right: 4 } },
      plugins: {
        legend: {
          // one series: the card title already names it, unless the page
          // asks (e.g. two stacked charts that each need a name)
          display: spec.showLegend ?? spec.series.length > 1,
          align: spec.showLegend ? "start" : "end",
          labels: {
            color: inkSoft,
            usePointStyle: true,
            boxWidth: 8,
            boxHeight: 8,
            padding: 14,
            font: { family: font, size: 12 },
          },
        },
        tooltip: {
          backgroundColor: token("--surface"),
          borderColor: border,
          borderWidth: 1,
          titleColor: inkSoft,
          bodyColor: ink,
          titleFont: { family: font, size: 11, weight: "500" },
          bodyFont: { family: font, size: 13, weight: "600" },
          padding: 10,
          cornerRadius: 8,
          caretSize: 0,
          usePointStyle: true,
          boxWidth: 8,
          boxHeight: 8,
          boxPadding: 6,
          callbacks: {
            label: (ctx) =>
              `${ctx.dataset.label}: ${formatValue(ctx.parsed.y, format, false)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { color: border },
          ticks: {
            color: inkFaint,
            autoSkip: true,
            maxRotation: 0,
            maxTicksLimit: 7,
            padding: 8,
            font: { family: font, size: 11 },
          },
        },
        y: {
          beginAtZero: true,
          grid: { color: border, lineWidth: 1, drawTicks: false },
          border: { display: false },
          // same minimum axis width everywhere, so stacked charts ("Both"
          // on the orders page) line their dates up
          afterFit: (scale) => {
            scale.width = Math.max(scale.width, 48);
          },
          ticks: {
            color: inkFaint,
            padding: 10,
            maxTicksLimit: 5,
            precision: 0,
            font: { family: font, size: 11 },
            callback: (value) => formatValue(value, format, true),
          },
        },
      },
    };
  }

  function buildConfig(spec) {
    return {
      type: spec.type,
      data: {
        labels: spec.labels,
        datasets: spec.series.map((series) => buildDataset(series, spec.type)),
      },
      options: buildOptions(spec),
    };
  }

  function create(canvas, spec) {
    const chart = new Chart(canvas, buildConfig(spec));
    chart.$stockSpec = spec;
    return chart;
  }

  // Theme toggled: rebuild colors from the new token values in place.
  function retheme() {
    Object.values(Chart.instances || {}).forEach((chart) => {
      const spec = chart.$stockSpec;
      if (!spec) return;
      const fresh = buildConfig(spec);
      chart.data.datasets.forEach((dataset, i) => {
        const { data, ...style } = fresh.data.datasets[i];
        Object.assign(dataset, style);
      });
      chart.options = fresh.options;
      chart.update("none");
    });
  }

  new MutationObserver(retheme).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  window.StockCharts = { create, formatValue };
})();

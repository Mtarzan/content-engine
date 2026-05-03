const state = {
  apiKey: localStorage.getItem("contentEngineApiKey") || "",
  status: "",
  posts: [],
  overview: null,
  scheduler: null,
  integrations: null
};

const els = {
  apiKeyInput: document.querySelector("#apiKeyInput"),
  saveKeyButton: document.querySelector("#saveKeyButton"),
  healthText: document.querySelector("#healthText"),
  metricsGrid: document.querySelector("#metricsGrid"),
  platformChart: document.querySelector("#platformChart"),
  funnelChart: document.querySelector("#funnelChart"),
  postsList: document.querySelector("#postsList"),
  eventsList: document.querySelector("#eventsList"),
  integrationsList: document.querySelector("#integrationsList"),
  postCount: document.querySelector("#postCount"),
  schedulerEnabled: document.querySelector("#schedulerEnabled"),
  intervalInput: document.querySelector("#intervalInput"),
  batchInput: document.querySelector("#batchInput"),
  saveSchedulerButton: document.querySelector("#saveSchedulerButton"),
  runWorkerButton: document.querySelector("#runWorkerButton"),
  editDialog: document.querySelector("#editDialog")
};

const fmt = new Intl.NumberFormat("en-US");
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function authHeaders() {
  return { "content-type": "application/json", "x-admin-api-key": state.apiKey };
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) }
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status} ${text}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

function metric(label, value, hint = "") {
  return `<div class="metric"><span>${label}</span><strong>${value}</strong><span>${hint}</span></div>`;
}

function renderMetrics() {
  const data = state.overview;
  if (!data) return;
  const m = data.metrics;
  els.metricsGrid.innerHTML = [
    metric("Products", fmt.format(data.products), `${fmt.format(data.processedProducts)} processed`),
    metric("Posts", fmt.format(data.posts), `${fmt.format(data.pending)} pending`),
    metric("Impressions", fmt.format(m.impressions), "tracked views"),
    metric("Clicks", fmt.format(m.clicks), `${(m.ctr * 100).toFixed(2)}% CTR`),
    metric("Conversions", fmt.format(m.conversions), `${(m.conversionRate * 100).toFixed(2)}% CVR`),
    metric("Revenue", money.format(Number(m.revenue || 0)), `${money.format(Number(m.spend || 0))} spend`)
  ].join("");
}

function drawBars(canvas, labels, values, color) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#667085";
  ctx.font = "13px sans-serif";
  const max = Math.max(...values, 1);
  const barWidth = Math.max(32, Math.floor((width - 60) / Math.max(values.length, 1)) - 18);
  values.forEach((value, index) => {
    const x = 38 + index * (barWidth + 18);
    const barHeight = Math.round((height - 70) * (value / max));
    const y = height - 34 - barHeight;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, barWidth, barHeight);
    ctx.fillStyle = "#17202a";
    ctx.fillText(String(value), x, y - 8);
    ctx.fillStyle = "#667085";
    ctx.fillText(labels[index].slice(0, 12), x, height - 12);
  });
}

function renderCharts() {
  const platforms = state.overview?.byPlatform || [];
  drawBars(
    els.platformChart,
    platforms.map((item) => item.platform),
    platforms.map((item) => item._count._all),
    "#0f766e"
  );
  const metrics = state.overview?.metrics || {};
  drawBars(
    els.funnelChart,
    ["Impress", "Clicks", "Conv"],
    [metrics.impressions || 0, metrics.clicks || 0, metrics.conversions || 0],
    "#2563eb"
  );
}

function trackingUrl(post) {
  return `${location.origin}/r/${post.id}`;
}

function renderPosts() {
  els.postCount.textContent = `${state.posts.length} shown`;
  els.postsList.innerHTML = "";
  if (state.posts.length === 0) {
    els.postsList.innerHTML = `<div class="empty">No posts match this filter.</div>`;
    return;
  }

  const template = document.querySelector("#postTemplate");
  state.posts.forEach((post) => {
    const row = template.content.cloneNode(true);
    const asset = row.querySelector(".asset");
    if (post.image_url) {
      const img = document.createElement("img");
      img.src = post.image_url;
      img.alt = post.product?.title || "Generated asset";
      asset.appendChild(img);
    } else {
      asset.innerHTML = `<div class="asset-label">${post.asset_type || "text"}</div>`;
    }

    row.querySelector(".post-meta").innerHTML = `
      <span>${post.platform}</span>
      <span>${post.status}</span>
      <span>${post.asset_type || "image"}</span>
    `;
    row.querySelector("h3").textContent = post.product?.title || "Product";
    row.querySelector("p").textContent = post.caption;
    row.querySelector(".post-stats").innerHTML = `
      <span>${fmt.format(post.impressions)} impressions</span>
      <span>${fmt.format(post.clicks)} clicks</span>
      <span>${fmt.format(post.conversions)} conversions</span>
      <span>${money.format(Number(post.revenue || 0))} revenue</span>
    `;
    const link = row.querySelector(".tracking-link");
    link.href = trackingUrl(post);
    link.textContent = "Tracking Link";
    row.querySelector(".edit-button").addEventListener("click", () => openEdit(post));
    const publishButton = row.querySelector(".publish-button");
    publishButton.disabled = post.status === "posted";
    publishButton.addEventListener("click", () => publishPost(post.id));
    els.postsList.appendChild(row);
  });
}

function renderEvents() {
  const events = state.overview?.recentEvents || [];
  if (events.length === 0) {
    els.eventsList.innerHTML = `<div class="empty">No activity yet.</div>`;
    return;
  }
  els.eventsList.innerHTML = events
    .map(
      (event) => `
        <div class="event">
          <strong>${event.event_type}</strong>
          <span>${event.post?.platform || "post"} · ${event.post?.product?.title || ""}</span>
          <span>${new Date(event.created_at).toLocaleString()}</span>
        </div>
      `
    )
    .join("");
}

function renderScheduler() {
  if (!state.scheduler) return;
  els.schedulerEnabled.value = String(state.scheduler.enabled);
  els.intervalInput.value = state.scheduler.interval_minutes;
  els.batchInput.value = state.scheduler.batch_size;
}

function renderIntegrations() {
  const data = state.integrations;
  if (!data) return;
  els.integrationsList.innerHTML = `
    <span>Publisher: ${data.publisherMode}</span>
    <span>Facebook: ${data.facebook.configured ? "configured" : "missing"}</span>
    <span>Shopify webhook signature: ${data.shopifyWebhooks.signatureVerification}</span>
    <span>Orders paid: ${data.shopifyWebhooks.ordersPaidEndpoint || "/webhooks/shopify/orders-paid"}</span>
  `;
}

function openEdit(post) {
  document.querySelector("#editId").value = post.id;
  document.querySelector("#editPlatform").value = post.platform;
  document.querySelector("#editAssetType").value = post.asset_type || "image";
  document.querySelector("#editImageUrl").value = post.image_url || "";
  document.querySelector("#editCaption").value = post.caption;
  document.querySelector("#editImpressions").value = post.impressions || 0;
  document.querySelector("#editClicks").value = post.clicks || 0;
  document.querySelector("#editConversions").value = post.conversions || 0;
  document.querySelector("#editSpend").value = post.spend || 0;
  document.querySelector("#editRevenue").value = post.revenue || 0;
  els.editDialog.showModal();
}

async function savePost() {
  const id = document.querySelector("#editId").value;
  await api(`/posts/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      platform: document.querySelector("#editPlatform").value,
      asset_type: document.querySelector("#editAssetType").value,
      image_url: document.querySelector("#editImageUrl").value || null,
      caption: document.querySelector("#editCaption").value,
      impressions: Number(document.querySelector("#editImpressions").value || 0),
      clicks: Number(document.querySelector("#editClicks").value || 0),
      conversions: Number(document.querySelector("#editConversions").value || 0),
      spend: Number(document.querySelector("#editSpend").value || 0),
      revenue: Number(document.querySelector("#editRevenue").value || 0)
    })
  });
  els.editDialog.close();
  await refreshAll();
}

async function publishPost(id) {
  await api(`/posts/${id}/publish`, { method: "POST" });
  await refreshAll();
}

async function saveScheduler() {
  await api("/admin/scheduler", {
    method: "PATCH",
    body: JSON.stringify({
      enabled: els.schedulerEnabled.value === "true",
      interval_minutes: Number(els.intervalInput.value),
      batch_size: Number(els.batchInput.value)
    })
  });
  await refreshAll();
}

async function runWorker() {
  els.runWorkerButton.disabled = true;
  els.runWorkerButton.textContent = "Running...";
  try {
    await api("/admin/worker/run", {
      method: "POST",
      body: JSON.stringify({ batch_size: Number(els.batchInput.value || 1) })
    });
    await refreshAll();
  } finally {
    els.runWorkerButton.disabled = false;
    els.runWorkerButton.textContent = "Run Now";
  }
}

async function refreshAll() {
  if (!state.apiKey) {
    els.healthText.textContent = "Enter the admin key to load dashboard data.";
    return;
  }

  const [health, overview, posts, scheduler, integrations] = await Promise.all([
    fetch("/health").then((r) => r.json()),
    api("/admin/overview").then((r) => r.data),
    api(`/posts${state.status ? `?status=${state.status}` : ""}`).then((r) => r.data),
    api("/admin/scheduler").then((r) => r.data),
    api("/admin/integrations").then((r) => r.data)
  ]);

  els.healthText.textContent = `API ${health.status}, DB ${health.database}`;
  state.overview = overview;
  state.posts = posts;
  state.scheduler = scheduler;
  state.integrations = integrations;
  renderMetrics();
  renderCharts();
  renderPosts();
  renderEvents();
  renderScheduler();
  renderIntegrations();
}

els.apiKeyInput.value = state.apiKey;
els.saveKeyButton.addEventListener("click", async () => {
  state.apiKey = els.apiKeyInput.value.trim();
  localStorage.setItem("contentEngineApiKey", state.apiKey);
  await refreshAll();
});
els.saveSchedulerButton.addEventListener("click", saveScheduler);
els.runWorkerButton.addEventListener("click", runWorker);
document.querySelector("#savePostButton").addEventListener("click", savePost);
document.querySelectorAll(".filter-button").forEach((button) => {
  button.addEventListener("click", async () => {
    document.querySelectorAll(".filter-button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    state.status = button.dataset.status || "";
    await refreshAll();
  });
});

refreshAll().catch((error) => {
  els.healthText.textContent = error.message;
});

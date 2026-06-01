const STORAGE_KEY = "test-hole-collector-v1";

const fields = [
  "projectNumber",
  "projectName",
  "client",
  "crew",
  "fieldDate",
  "weather",
  "coordinateSystem",
  "customCoordinateSystem",
  "location",
  "mapLink",
  "projectNotes",
];

const holeFields = [
  "holeName",
  "expectedUtility",
  "utilityType",
  "surfaceType",
  "method",
  "northing",
  "easting",
  "elevation",
  "topPipeElevation",
  "depthTop",
  "utilitySize",
  "material",
  "description",
  "holeNotes",
];

const state = {
  project: {
    projectNumber: "",
    projectName: "",
    client: "",
    crew: "",
    fieldDate: new Date().toISOString().slice(0, 10),
    weather: "",
    coordinateSystem: "2236",
    customCoordinateSystem: "",
    location: "",
    mapLink: "",
    projectNotes: "",
  },
  mapImage: "",
  holes: [],
  selectedId: null,
};

const $ = (id) => document.getElementById(id);

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random()}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function selectedHole() {
  return state.holes.find((hole) => hole.id === state.selectedId) || null;
}

function numericValue(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(number) ? number : null;
}

function formatDepth(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function updateCalculatedDepth(hole) {
  const ground = numericValue(hole.elevation);
  const topPipe = numericValue(hole.topPipeElevation);
  hole.depthTop = ground === null || topPipe === null ? "" : formatDepth(ground - topPipe);
}

function blankHole(index = state.holes.length + 1) {
  return {
    id: uid(),
    holeName: `TH-${index}`,
    expectedUtility: "Water",
    utilityType: "Water",
    surfaceType: "Asphalt",
    method: "Vacuum excavation",
    northing: "",
    easting: "",
    elevation: "",
    topPipeElevation: "",
    depthTop: "",
    utilitySize: "",
    material: "",
    description: "",
    holeNotes: "",
    mapX: null,
    mapY: null,
    photos: [],
  };
}

function hydrate() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    addHole(false);
    render();
    return;
  }

  try {
    const parsed = JSON.parse(saved);
    Object.assign(state.project, parsed.project || {});
    state.mapImage = parsed.mapImage || "";
    state.holes = Array.isArray(parsed.holes) ? parsed.holes : [];
    state.holes.forEach((hole) => {
      if (!Object.hasOwn(hole, "expectedUtility")) hole.expectedUtility = hole.utilityType || "Water";
      if (!Object.hasOwn(hole, "topPipeElevation")) hole.topPipeElevation = "";
      updateCalculatedDepth(hole);
    });
    state.selectedId = parsed.selectedId || state.holes[0]?.id || null;
  } catch {
    addHole(false);
  }

  render();
}

let saveTimer;
function save() {
  $("saveState").textContent = "Saving...";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    $("saveState").textContent = "Saved";
  }, 120);
}

function bindProjectFields() {
  fields.forEach((field) => {
    const input = $(field);
    input.addEventListener("input", () => {
      state.project[field] = input.value;
      save();
      renderReport();
    });
  });
}

function bindHoleFields() {
  holeFields.forEach((field) => {
    const input = $(field);
    input.addEventListener("input", () => {
      const hole = selectedHole();
      if (!hole) return;
      hole[field] = input.value;
      if (field === "elevation" || field === "topPipeElevation") {
        updateCalculatedDepth(hole);
        $("depthTop").value = hole.depthTop;
      }
      save();
      renderHoleList();
      renderPins();
      renderReport();
    });
  });
}

function addHole(shouldSave = true) {
  const hole = blankHole();
  state.holes.push(hole);
  state.selectedId = hole.id;
  if (shouldSave) save();
  render();
}

function duplicateHole() {
  const hole = selectedHole();
  if (!hole) return;
  const copy = {
    ...JSON.parse(JSON.stringify(hole)),
    id: uid(),
    holeName: nextDuplicateName(hole.holeName),
    mapX: null,
    mapY: null,
  };
  state.holes.push(copy);
  state.selectedId = copy.id;
  save();
  render();
}

function nextDuplicateName(name) {
  const base = name || "TH";
  let candidate = `${base} copy`;
  let i = 2;
  while (state.holes.some((hole) => hole.holeName === candidate)) {
    candidate = `${base} copy ${i}`;
    i += 1;
  }
  return candidate;
}

function deleteHole() {
  const index = state.holes.findIndex((hole) => hole.id === state.selectedId);
  if (index < 0) return;
  state.holes.splice(index, 1);
  state.selectedId = state.holes[Math.max(0, index - 1)]?.id || state.holes[0]?.id || null;
  save();
  render();
}

function render() {
  fields.forEach((field) => {
    $(field).value = state.project[field] || "";
  });
  renderMapImage();
  renderHoleList();
  renderHoleForm();
  renderPins();
  renderReport();
}

function renderMapImage() {
  const canvas = $("mapCanvas");
  const image = $("mapImage");
  image.src = state.mapImage || "";
  canvas.classList.toggle("has-image", Boolean(state.mapImage));
}

function renderHoleList() {
  $("holeCount").textContent = `${state.holes.length} total`;
  $("selectedHoleName").textContent = selectedHole()?.holeName || "None";
  $("holeList").innerHTML = state.holes
    .map((hole) => {
      const selected = hole.id === state.selectedId ? " selected" : "";
      const utilityPair = [hole.expectedUtility && `Exp: ${hole.expectedUtility}`, hole.utilityType && `Found: ${hole.utilityType}`]
        .filter(Boolean)
        .join(" / ");
      const details = [utilityPair, hole.depthTop && `${hole.depthTop} ft`]
        .filter(Boolean)
        .join(" | ");
      return `
        <button class="hole-card${selected}" type="button" data-id="${hole.id}">
          <strong>${escapeHtml(hole.holeName || "Unnamed TH")}</strong>
          <span>${escapeHtml(details || "No details yet")}</span>
        </button>
      `;
    })
    .join("");

  document.querySelectorAll(".hole-card").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedId = button.dataset.id;
      save();
      render();
    });
  });
}

function renderHoleForm() {
  const hole = selectedHole();
  $("emptyState").classList.toggle("hidden", Boolean(hole));
  $("holeForm").classList.toggle("hidden", !hole);
  if (!hole) return;

  holeFields.forEach((field) => {
    $(field).value = hole[field] || "";
  });
  renderPhotos(hole);
}

function renderPhotos(hole) {
  $("photoGrid").innerHTML = (hole.photos || [])
    .map(
      (photo, index) => `
        <figure>
          <img src="${photo.src}" alt="${escapeHtml(photo.name || `Photo ${index + 1}`)}">
          <figcaption>${escapeHtml(photo.name || `Photo ${index + 1}`)}</figcaption>
        </figure>
      `,
    )
    .join("");
}

function renderPins() {
  $("pinLayer").innerHTML = state.holes
    .filter((hole) => Number.isFinite(hole.mapX) && Number.isFinite(hole.mapY))
    .map((hole) => {
      const selected = hole.id === state.selectedId ? " selected" : "";
      return `<span class="pin${selected}" style="left:${hole.mapX}%;top:${hole.mapY}%"><i></i><b>${escapeHtml(hole.holeName)}</b></span>`;
    })
    .join("");
}

function placePin(event) {
  const hole = selectedHole();
  if (!hole) return;
  const rect = $("mapCanvas").getBoundingClientRect();
  hole.mapX = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
  hole.mapY = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100));
  save();
  renderPins();
  renderReport();
}

function projectCoordinateWkid() {
  const selected = state.project.coordinateSystem || "2236";
  return selected === "custom" ? state.project.customCoordinateSystem?.trim() : selected;
}

async function convertToLatLong(easting, northing) {
  const wkid = projectCoordinateWkid();
  if (!wkid) throw new Error("Choose a coordinate system first.");

  if (wkid === "4326") {
    if (Math.abs(northing) > 90 || Math.abs(easting) > 180) {
      throw new Error("Those N/E values are not lat/long. Choose the project State Plane/WKID first.");
    }
    return { lat: northing, lng: easting };
  }

  const params = new URLSearchParams({
    inSR: wkid,
    outSR: "4326",
    f: "json",
    geometries: JSON.stringify({
      geometryType: "esriGeometryPoint",
      geometries: [{ x: easting, y: northing }],
    }),
  });
  const response = await fetch(`https://utility.arcgisonline.com/ArcGIS/rest/services/Geometry/GeometryServer/project?${params.toString()}`);
  if (!response.ok) throw new Error("Coordinate conversion failed.");
  const data = await response.json();
  const point = data.geometries?.[0];
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new Error(data.error?.message || "Coordinate conversion returned no point.");
  }
  if (Math.abs(point.y) > 90 || Math.abs(point.x) > 180) {
    throw new Error("Converted coordinate is outside valid lat/long range. Check the coordinate system.");
  }
  return { lat: point.y, lng: point.x };
}

async function aerialFromCoordinates() {
  const hole = selectedHole();
  if (!hole) return;

  const northing = numericValue(hole.northing);
  const easting = numericValue(hole.easting);
  if (northing === null || easting === null) {
    $("mapTip").textContent = "Enter northing and easting first.";
    return;
  }

  $("mapTip").textContent = "Converting coordinates...";
  let latLng;
  try {
    latLng = await convertToLatLong(easting, northing);
  } catch (error) {
    $("mapTip").textContent = error.message;
    state.mapImage = "";
    save();
    renderMapImage();
    renderReport();
    return;
  }

  const { lat, lng } = latLng;
  const delta = 0.0018;
  const bbox = [lng - delta, lat - delta, lng + delta, lat + delta].join(",");
  const params = new URLSearchParams({
    bbox,
    bboxSR: "4326",
    imageSR: "4326",
    size: "1400,1000",
    format: "png32",
    transparent: "false",
    f: "image",
  });

  state.mapImage = `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?${params.toString()}`;
  hole.mapX = 50;
  hole.mapY = 50;
  save();
  renderMapImage();
  renderPins();
  renderReport();
  $("mapTip").innerHTML = `Aerial centered on <b id="selectedHoleName">${escapeHtml(hole.holeName)}</b>`;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function loadMapImage(event) {
  const [file] = event.target.files;
  if (!file) return;
  state.mapImage = await fileToDataUrl(file);
  save();
  renderMapImage();
  renderReport();
  event.target.value = "";
}

async function addPhotos(event) {
  const hole = selectedHole();
  if (!hole) return;
  const files = Array.from(event.target.files || []);
  const photos = await Promise.all(
    files.map(async (file) => ({
      name: file.name,
      src: await fileToDataUrl(file),
    })),
  );
  hole.photos = [...(hole.photos || []), ...photos];
  save();
  renderPhotos(hole);
  renderReport();
  event.target.value = "";
}

function clearPhotos() {
  const hole = selectedHole();
  if (!hole) return;
  hole.photos = [];
  save();
  renderPhotos(hole);
  renderReport();
}

function renderReport() {
  const report = buildReport();
  $("reportPreview").innerHTML = report;
  $("printReport").innerHTML = report;
}

function buildReport() {
  const title = [state.project.projectNumber, state.project.projectName].filter(Boolean).join(" - ") || "Test Hole Report";
  const holes = state.holes.length ? state.holes : [blankHole(1)];
  const totalSheets = holes.length * 2;
  return holes
    .map((hole, index) => {
      const sheetNumber = index * 2 + 1;
      return buildHoleDataSheet(hole, title, sheetNumber, totalSheets) + buildHolePhotoSheet(hole, title, sheetNumber + 1, totalSheets);
    })
    .join("");
}

function buildHoleDataSheet(hole, projectTitle, sheetNumber, totalSheets) {
  const p = state.project;
  return `
    <article class="sheet survey-sheet">
      <div class="sheet-frame first-page-frame">
        ${titleBlock(`${hole.holeName || "TEST HOLE"} DATA & LOCATION MAP`, projectTitle, String(sheetNumber), totalSheets)}
        <div class="top-deliverable">
          <table class="report-table project-info-table">
            <tbody>
              <tr><th>Project</th><td>${escapeHtml(projectTitle)}</td><th>Date</th><td>${escapeHtml(p.fieldDate || "")}</td></tr>
              <tr><th>Location</th><td>${escapeHtml(p.location || "")}</td><th>Crew</th><td>${escapeHtml(p.crew || "")}</td></tr>
              <tr><th>Client</th><td>${escapeHtml(p.client || "")}</td><th>Weather</th><td>${escapeHtml(p.weather || "")}</td></tr>
            </tbody>
          </table>
          <table class="report-table single-hole-table">
            <tbody>
              ${holeDataRows(hole)}
            </tbody>
          </table>
        </div>
        <div class="map-section-title">Aerial Image / Location Map</div>
        <div class="drawing-area first-page-map">
          <div class="north-arrow" aria-hidden="true">N</div>
          <div class="report-map">
            ${state.mapImage ? `<img src="${state.mapImage}" alt="">` : `<div class="map-placeholder"><strong>Aerial image / location map</strong><span>Upload aerial in app</span></div>`}
            ${Number.isFinite(hole.mapX) && Number.isFinite(hole.mapY) ? `<span class="report-pin" style="left:${hole.mapX}%;top:${hole.mapY}%"><i></i><b>${escapeHtml(hole.holeName)}</b></span>` : ""}
          </div>
        </div>
        <div class="sheet-notes">
          <b>Notes</b>
          <p>${escapeHtml(p.projectNotes || "Test hole information shown above was collected in the field. Verify utilities before excavation.")}</p>
        </div>
      </div>
    </article>
  `;
}

function holeDataRows(hole) {
  return `
    <tr>
      <th>Test Hole</th><td>${escapeHtml(hole.holeName)}</td>
      <th>Expected Utility</th><td>${escapeHtml(hole.expectedUtility)}</td>
      <th>Found Utility</th><td>${escapeHtml(hole.utilityType)}</td>
    </tr>
    <tr>
      <th>Size</th><td>${escapeHtml(hole.utilitySize)}</td>
      <th>Material</th><td>${escapeHtml(hole.material)}</td>
      <th>Surface</th><td>${escapeHtml(hole.surfaceType)}</td>
    </tr>
    <tr>
      <th>Ground Elev.</th><td>${escapeHtml(hole.elevation)}</td>
      <th>Top Pipe Elev.</th><td>${escapeHtml(hole.topPipeElevation)}</td>
      <th>Depth to T.O.P.</th><td>${escapeHtml(hole.depthTop)}</td>
    </tr>
    <tr>
      <th>Northing</th><td>${escapeHtml(hole.northing)}</td>
      <th>Easting</th><td>${escapeHtml(hole.easting)}</td>
      <th>Method</th><td>${escapeHtml(hole.method)}</td>
    </tr>
    <tr>
      <th>Description</th><td colspan="5">${escapeHtml(hole.description)}</td>
    </tr>
    <tr>
      <th>Field Notes</th><td colspan="5">${escapeHtml(hole.holeNotes)}</td>
    </tr>
  `;
}

function buildHolePhotoSheet(hole, projectTitle, sheetNumber, totalSheets) {
  const photoFigures = (hole.photos || [])
    .map(
      (photo, index) => `
        <figure>
          <img src="${photo.src}" alt="${escapeHtml(photo.name || "Test hole photo")}">
          <figcaption>${escapeHtml(hole.holeName || "Test Hole")} - Photo ${index + 1}</figcaption>
        </figure>
      `,
    )
    .join("");

  return `
    <article class="sheet survey-sheet">
      <div class="sheet-frame photo-page-frame">
        ${titleBlock(`${hole.holeName || "TEST HOLE"} PHOTOGRAPHS`, projectTitle, String(sheetNumber), totalSheets)}
        <div class="photo-page-title">${escapeHtml(hole.holeName || "Test Hole")} Photographs</div>
        <div class="photo-page-grid">
          ${photoFigures || `<div class="empty-photo">No photos attached.</div>`}
        </div>
      </div>
    </article>
  `;
}

function titleBlock(sheetTitle, projectTitle, sheetNumber, totalSheets) {
  const p = state.project;
  return `
    <div class="title-block">
      <div class="tb-brand">
        <b>DEGROVE</b>
        <span>Surveyors Inc.</span>
      </div>
      <div class="tb-project">
        <b>${escapeHtml(projectTitle || "Test Hole Project")}</b>
        <span>${escapeHtml(p.location || "")}</span>
      </div>
      <div class="tb-meta">
        <span>Project No.</span><b>${escapeHtml(p.projectNumber || "")}</b>
        <span>Date</span><b>${escapeHtml(p.fieldDate || "")}</b>
        <span>Crew</span><b>${escapeHtml(p.crew || "")}</b>
      </div>
      <div class="tb-sheet">
        <span>${escapeHtml(sheetTitle)}</span>
        <b>SHEET ${sheetNumber} OF ${totalSheets}</b>
      </div>
    </div>
  `;
}

function exportCsv() {
  const headers = [
    "holeName",
    "expectedUtility",
    "utilityType",
    "surfaceType",
    "method",
    "northing",
    "easting",
    "elevation",
    "topPipeElevation",
    "depthTop",
    "utilitySize",
    "material",
    "description",
    "holeNotes",
    "mapX",
    "mapY",
  ];
  const rows = [headers, ...state.holes.map((hole) => headers.map((header) => hole[header] ?? ""))];
  download(
    `${state.project.projectNumber || "test-holes"}.csv`,
    rows.map((row) => row.map(csvCell).join(",")).join("\n"),
    "text/csv",
  );
}

function csvCell(value) {
  const text = String(value).replaceAll('"', '""');
  return /[",\n]/.test(text) ? `"${text}"` : text;
}

function exportJson() {
  download(
    `${state.project.projectNumber || "test-hole-backup"}.json`,
    JSON.stringify(state, null, 2),
    "application/json",
  );
}

function exportGeoJson() {
  const features = state.holes
    .map((hole) => {
      const lat = Number(hole.northing);
      const lng = Number(hole.easting);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [lng, lat],
        },
        properties: {
          name: hole.holeName,
          expectedUtility: hole.expectedUtility,
          foundUtility: hole.utilityType,
          size: hole.utilitySize,
          material: hole.material,
          groundElevation: hole.elevation,
          topPipeElevation: hole.topPipeElevation,
          depthTop: hole.depthTop,
          description: hole.description,
          notes: hole.holeNotes,
          projectNumber: state.project.projectNumber,
          projectName: state.project.projectName,
        },
      };
    })
    .filter(Boolean);

  download(
    `${state.project.projectNumber || "test-holes"}.geojson`,
    JSON.stringify({ type: "FeatureCollection", features }, null, 2),
    "application/geo+json",
  );
}

function projectMapUrl() {
  const link = state.project.mapLink?.trim();
  if (link) return link;
  const location = state.project.location?.trim();
  return location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}` : "";
}

function openProjectMap() {
  const url = projectMapUrl();
  if (!url) {
    alert("Add a project location or map link first.");
    return;
  }
  window.open(url, "_blank", "noopener");
}

function emailPdf() {
  renderReport();
  const subject = encodeURIComponent(`${state.project.projectNumber || "Test Hole"} PDF Deliverable`);
  const body = encodeURIComponent(
    [
      "Attached is the test hole PDF deliverable.",
      "",
      "If the PDF is not attached yet, use Print > Save as PDF from the app, then attach the saved file to this email.",
      projectMapUrl() ? `Map link: ${projectMapUrl()}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );
  window.print();
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
}

function download(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

async function restoreJson(event) {
  const [file] = event.target.files;
  if (!file) return;
  const text = await file.text();
  const restored = JSON.parse(text);
  Object.assign(state.project, restored.project || {});
  state.mapImage = restored.mapImage || "";
  state.holes = Array.isArray(restored.holes) ? restored.holes : [];
  state.selectedId = restored.selectedId || state.holes[0]?.id || null;
  save();
  render();
  event.target.value = "";
}

function bindEvents() {
  bindProjectFields();
  bindHoleFields();
  $("addHoleBtn").addEventListener("click", () => addHole());
  $("duplicateHoleBtn").addEventListener("click", duplicateHole);
  $("deleteHoleBtn").addEventListener("click", deleteHole);
  $("mapCanvas").addEventListener("click", placePin);
  $("mapImage").addEventListener("error", () => {
    $("mapTip").textContent = "Aerial image failed to load. Check the coordinate system and internet connection.";
  });
  $("mapImage").addEventListener("load", () => {
    const hole = selectedHole();
    if (hole && state.mapImage) {
      $("mapTip").innerHTML = `Aerial centered on <b id="selectedHoleName">${escapeHtml(hole.holeName)}</b>`;
    }
  });
  $("mapImageInput").addEventListener("change", loadMapImage);
  $("aerialFromCoordsBtn").addEventListener("click", aerialFromCoordinates);
  $("clearMapBtn").addEventListener("click", () => {
    state.mapImage = "";
    save();
    renderMapImage();
    renderReport();
  });
  $("photoInput").addEventListener("change", addPhotos);
  $("clearPhotosBtn").addEventListener("click", clearPhotos);
  $("refreshReportBtn").addEventListener("click", renderReport);
  $("printBtn").addEventListener("click", () => {
    renderReport();
    window.print();
  });
  $("csvBtn").addEventListener("click", exportCsv);
  $("geoJsonBtn").addEventListener("click", exportGeoJson);
  $("openProjectMapBtn").addEventListener("click", openProjectMap);
  $("emailPdfBtn").addEventListener("click", emailPdf);
  $("jsonBtn").addEventListener("click", exportJson);
  $("jsonInput").addEventListener("change", restoreJson);
}

bindEvents();
hydrate();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}

const STORAGE_KEY = "test-hole-collector-v1";
const PROJECT_INDEX_KEY = "test-hole-project-index-v1";
const ACTIVE_PROJECT_KEY = "test-hole-active-project-v1";

const fields = [
  "projectFileName",
  "projectNumber",
  "projectName",
  "client",
  "crew",
  "fieldDate",
  "weather",
  "coordinateSystem",
  "customCoordinateSystem",
  "mapStyle",
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
  "pipeBearing",
  "pipeStartDistance",
  "pipeEndDistance",
  "description",
  "holeNotes",
];

const state = {
  project: defaultProject(),
  mapImage: "",
  mapZoom: 1,
  holes: [],
  selectedId: null,
};

let projectRecords = [];
let activeProjectId = null;

function defaultProject() {
  return {
    projectNumber: "",
    projectFileName: "",
    projectName: "",
    client: "",
    crew: "",
    fieldDate: new Date().toISOString().slice(0, 10),
    weather: "",
    coordinateSystem: "2236",
    customCoordinateSystem: "",
    mapStyle: "imagery",
    location: "",
    mapLink: "",
    projectNotes: "",
  };
}

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

function normalizeBearing(value) {
  const number = numericValue(value);
  if (number === null) return null;
  return ((number % 360) + 360) % 360;
}

function bearingDirection(value) {
  const bearing = normalizeBearing(value);
  if (bearing === null) return "";
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return directions[Math.round(bearing / 45) % 8];
}

function oppositeDirection(direction) {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = directions.indexOf(direction);
  return index < 0 ? "" : directions[(index + 4) % 8];
}

function pipeDirectionPair(hole) {
  const first = bearingDirection(hole.pipeBearing);
  if (!first) return "";
  return `${first}-${oppositeDirection(first)}`;
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
    pipeBearing: "",
    pipeStartDistance: "",
    pipeEndDistance: "",
    description: "",
    holeNotes: "",
    mapX: null,
    mapY: null,
    mapImage: "",
    mapLabelImage: "",
    mapZoom: 1,
    photos: [],
  };
}

function projectStorageKey(id) {
  return `test-hole-project-${id}`;
}

function blankProjectState() {
  const projectState = JSON.parse(JSON.stringify({
    project: defaultProject(),
    mapImage: "",
    mapZoom: 1,
    holes: [],
    selectedId: null,
  }));
  projectState.holes = [blankHole(1)];
  projectState.selectedId = projectState.holes[0].id;
  return projectState;
}

function normalizeProjectData(data) {
  const normalized = data || blankProjectState();
  normalized.project = { ...defaultProject(), ...(normalized.project || {}) };
  normalized.mapImage = normalized.mapImage || "";
  normalized.mapZoom = normalized.mapZoom || 1;
  normalized.holes = Array.isArray(normalized.holes) ? normalized.holes : [];
  if (!normalized.holes.length) normalized.holes = [blankHole(1)];
  normalized.holes.forEach((hole) => {
    if (!Object.hasOwn(hole, "expectedUtility")) hole.expectedUtility = hole.utilityType || "Water";
    if (!Object.hasOwn(hole, "topPipeElevation")) hole.topPipeElevation = "";
    if (!Object.hasOwn(hole, "pipeBearing")) hole.pipeBearing = "";
    if (!Object.hasOwn(hole, "pipeStartDistance")) hole.pipeStartDistance = hole.pipeDistance || "";
    if (!Object.hasOwn(hole, "pipeEndDistance")) hole.pipeEndDistance = hole.pipeDistance || "";
    if (!Object.hasOwn(hole, "mapImage")) hole.mapImage = "";
    if (!Object.hasOwn(hole, "mapLabelImage")) hole.mapLabelImage = "";
    if (!Object.hasOwn(hole, "mapZoom")) hole.mapZoom = 1;
    updateCalculatedDepth(hole);
  });
  normalized.selectedId = normalized.selectedId || normalized.holes[0]?.id || null;
  return normalized;
}

function applyProjectData(data) {
  const normalized = normalizeProjectData(data);
  Object.assign(state.project, normalized.project);
  state.mapImage = normalized.mapImage;
  state.mapZoom = normalized.mapZoom;
  state.holes = normalized.holes;
  state.selectedId = normalized.selectedId;
}

function projectDisplayName(data = state) {
  return data.project?.projectFileName || [data.project?.projectNumber, data.project?.projectName].filter(Boolean).join(" - ") || "Untitled Project";
}

function saveProjectIndex() {
  localStorage.setItem(PROJECT_INDEX_KEY, JSON.stringify(projectRecords));
  localStorage.setItem(ACTIVE_PROJECT_KEY, activeProjectId || "");
}

function saveActiveProjectNow() {
  if (!activeProjectId) return;
  localStorage.setItem(projectStorageKey(activeProjectId), JSON.stringify(state));
  const record = projectRecords.find((project) => project.id === activeProjectId);
  if (record) {
    record.name = projectDisplayName();
    record.updatedAt = new Date().toISOString();
  }
  saveProjectIndex();
}

function hydrate() {
  try {
    projectRecords = JSON.parse(localStorage.getItem(PROJECT_INDEX_KEY) || "[]");
  } catch {
    projectRecords = [];
  }

  if (!projectRecords.length) {
    let initialData = null;
    try {
      const legacy = localStorage.getItem(STORAGE_KEY);
      initialData = legacy ? JSON.parse(legacy) : blankProjectState();
    } catch {
      initialData = blankProjectState();
    }
    activeProjectId = uid();
    projectRecords = [{ id: activeProjectId, name: projectDisplayName(initialData), updatedAt: new Date().toISOString() }];
    localStorage.setItem(projectStorageKey(activeProjectId), JSON.stringify(normalizeProjectData(initialData)));
    saveProjectIndex();
  }

  activeProjectId = localStorage.getItem(ACTIVE_PROJECT_KEY) || projectRecords[0].id;
  if (!projectRecords.some((project) => project.id === activeProjectId)) {
    activeProjectId = projectRecords[0].id;
  }

  const raw = localStorage.getItem(projectStorageKey(activeProjectId));
  applyProjectData(raw ? JSON.parse(raw) : blankProjectState());
  render();
}

let saveTimer;
function save() {
  $("saveState").textContent = "Saving...";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveActiveProjectNow();
    renderProjectSelector();
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
  renderProjectSelector();
  fields.forEach((field) => {
    $(field).value = state.project[field] || "";
  });
  renderMapImage();
  renderHoleList();
  renderHoleForm();
  renderPins();
  renderReport();
}

function renderProjectSelector() {
  const select = $("projectSelect");
  if (!select) return;
  select.innerHTML = projectRecords
    .map((project) => `<option value="${project.id}">${escapeHtml(project.name || "Untitled Project")}</option>`)
    .join("");
  select.value = activeProjectId || "";
}

function switchProject(id) {
  if (!id || id === activeProjectId) return;
  saveActiveProjectNow();
  activeProjectId = id;
  localStorage.setItem(ACTIVE_PROJECT_KEY, activeProjectId);
  const raw = localStorage.getItem(projectStorageKey(activeProjectId));
  applyProjectData(raw ? JSON.parse(raw) : blankProjectState());
  render();
}

function newProject() {
  saveActiveProjectNow();
  activeProjectId = uid();
  const data = blankProjectState();
  projectRecords.push({ id: activeProjectId, name: projectDisplayName(data), updatedAt: new Date().toISOString() });
  localStorage.setItem(projectStorageKey(activeProjectId), JSON.stringify(data));
  saveProjectIndex();
  applyProjectData(data);
  render();
  save();
}

function deleteProject() {
  if (projectRecords.length <= 1) {
    alert("At least one project is required.");
    return;
  }
  if (!confirm("Delete this local project from this device?")) return;
  localStorage.removeItem(projectStorageKey(activeProjectId));
  projectRecords = projectRecords.filter((project) => project.id !== activeProjectId);
  activeProjectId = projectRecords[0].id;
  saveProjectIndex();
  const raw = localStorage.getItem(projectStorageKey(activeProjectId));
  applyProjectData(raw ? JSON.parse(raw) : blankProjectState());
  render();
}

function renderMapImage() {
  const hole = selectedHole();
  const mapImage = hole?.mapImage || state.mapImage || "";
  const mapLabelImage = hole?.mapLabelImage || "";
  const mapZoom = hole?.mapZoom || state.mapZoom || 1;
  const canvas = $("mapCanvas");
  const image = $("mapImage");
  const labelImage = $("mapLabelImage");
  const pinLayer = $("pinLayer");

  canvas.style.setProperty("--map-zoom", markerZoom(mapZoom));
  image.src = mapImage;
  labelImage.src = mapLabelImage;

  [image, labelImage, pinLayer].forEach((layer) => {
    layer.style.transformOrigin = "50% 50%";
    layer.style.transform = `scale(${mapZoom})`;
  });

  canvas.classList.toggle("has-image", Boolean(mapImage));
  canvas.classList.toggle("has-labels", Boolean(mapLabelImage));
}

function setMapZoom(nextZoom) {
  const hole = selectedHole();
  const canvas = $("mapCanvas");
  const previousZoom = hole?.mapZoom || state.mapZoom || 1;
  const zoom = Math.max(1, Math.min(4, Number(nextZoom.toFixed(2))));

  const centerX = canvas.scrollLeft + canvas.clientWidth / 2;
  const centerY = canvas.scrollTop + canvas.clientHeight / 2;
  const ratio = zoom / previousZoom;

  if (hole) {
    hole.mapZoom = zoom;
  } else {
    state.mapZoom = zoom;
  }

  save();
  renderMapImage();

  canvas.scrollLeft = centerX * ratio - canvas.clientWidth / 2;
  canvas.scrollTop = centerY * ratio - canvas.clientHeight / 2;

  renderReport();
}

function markerZoom(mapZoom) {
  return Math.max(0.75, Math.min(2.25, 0.75 + ((mapZoom || 1) - 1) * 0.5625));
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
  const hole = selectedHole();
  const mapZoom = hole?.mapZoom || state.mapZoom || 1;
  const labelZoom = markerZoom(mapZoom);
  $("pinLayer").innerHTML = hole ? [hole]
    .filter((hole) => Number.isFinite(hole.mapX) && Number.isFinite(hole.mapY))
    .map((hole) => {
      const selected = hole.id === state.selectedId ? " selected" : "";
      return `${pipeOverlay(hole, "pipe-bearing", "px", labelZoom)}<span class="pin${selected}" style="left:${hole.mapX}%;top:${hole.mapY}%;--marker-zoom:${labelZoom}"><i></i>${mapPointLabel(hole)}</span>`;
    })
    .join("") : "";
}

function mapUtilityLabel(hole) {
  return hole.utilityType || hole.holeName || "TH";
}

function mapPointLabel(hole) {
  return `<b><span>${escapeHtml(hole.holeName || "TH")}</span><span>${escapeHtml(mapUtilityLabel(hole))}</span></b>`;
}

function pipeOverlay(hole, className, unit, labelZoom = 1) {
  const bearing = normalizeBearing(hole.pipeBearing);
  if (bearing === null) return "";
  const fallback = unit === "in" ? 0.8 : 95;
  const start = pipeDisplayDistance(hole.pipeStartDistance, fallback, unit);
  const end = pipeDisplayDistance(hole.pipeEndDistance, fallback, unit);
  const originClass = className === "report-pipe-bearing" ? "report-pipe-origin" : "pipe-origin";
  return `
    <span class="${originClass}" style="left:${hole.mapX}%;top:${hole.mapY}%;--marker-zoom:${labelZoom};transform: translate(-50%, -50%) rotate(${bearing}deg)">
      <span class="${className} pipe-arm-start" style="height:${start}${unit}"></span>
      <span class="${className} pipe-arm-end" style="height:${end}${unit}"></span>
    </span>
  `;
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
    hole.mapImage = "";
    save();
    renderMapImage();
    renderReport();
    return;
  }

  const { lat, lng } = latLng;
  const delta = 0.0018;
  const bbox = [lng - delta, lat - delta, lng + delta, lat + delta].join(",");
  hole.mapImage = esriExportUrl("World_Imagery", bbox, false);
  hole.mapLabelImage = state.project.mapStyle === "hybrid" ? esriExportUrl("Reference/World_Boundaries_and_Places", bbox, true) : "";
  hole.mapZoom = 1;
  hole.mapX = 50;
  hole.mapY = 50;
  save();
  renderMapImage();
  renderPins();
  renderReport();
  $("mapTip").innerHTML = `Aerial centered on <b id="selectedHoleName">${escapeHtml(hole.holeName)}</b>`;
}

function esriExportUrl(service, bbox, transparent) {
  const params = new URLSearchParams({
    bbox,
    bboxSR: "4326",
    imageSR: "4326",
    size: "1400,1000",
    format: "png32",
    transparent: transparent ? "true" : "false",
    f: "image",
  });
  return `https://services.arcgisonline.com/ArcGIS/rest/services/${service}/MapServer/export?${params.toString()}`;
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
  const hole = selectedHole();
  const [file] = event.target.files;
  if (!file || !hole) return;
  hole.mapImage = await fileToDataUrl(file);
  hole.mapLabelImage = "";
  hole.mapZoom = 1;
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
  const hole = selectedHole() || state.holes[0] || blankHole(1);
  return buildHoleDataSheet(hole, title, 1, 2) + buildHolePhotoSheet(hole, title, 2, 2);
}

function buildHoleDataSheet(hole, projectTitle, sheetNumber, totalSheets) {
  const p = state.project;
  const mapImage = hole.mapImage || state.mapImage || "";
  const mapLabelImage = hole.mapLabelImage || "";
  const mapZoom = hole.mapZoom || state.mapZoom || 1;
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
            <div class="report-map-layer" style="--map-zoom:${markerZoom(mapZoom)};transform: scale(${mapZoom})">
              ${mapImage ? `<img src="${mapImage}" alt="">` : `<div class="map-placeholder"><strong>Aerial image / location map</strong><span>Generate or upload aerial for this test hole</span></div>`}
              ${mapLabelImage ? `<img class="report-label-image" src="${mapLabelImage}" alt="">` : ""}
              ${Number.isFinite(hole.mapX) && Number.isFinite(hole.mapY) ? `${reportPipeBearing(hole)}<span class="report-pin" style="left:${hole.mapX}%;top:${hole.mapY}%"><i></i>${mapPointLabel(hole)}</span>` : ""}
            </div>
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
      <th>Pipe Direction</th><td>${escapeHtml(pipeDirectionPair(hole))}</td>
      <th></th><td></td>
      <th></th><td></td>
    </tr>
    <tr>
      <th>Description</th><td colspan="5">${escapeHtml(hole.description)}</td>
    </tr>
    <tr>
      <th>Field Notes</th><td colspan="5">${escapeHtml(hole.holeNotes)}</td>
    </tr>
  `;
}

function reportPipeBearing(hole) {
  return pipeOverlay(hole, "report-pipe-bearing", "in", markerZoom(hole.mapZoom || state.mapZoom || 1));
}

function pipeDisplayDistance(value, fallback, unit = "px") {
  const distance = numericValue(value);
  if (distance === null || distance <= 0) return fallback;
  if (unit === "in") return Math.max(0.15, Math.min(3.5, distance / 120));
  return distance;
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

function safeFilePart(value) {
  return String(value || "test-hole-project")
    .trim()
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "test-hole-project";
}

function exportProjectFile() {
  saveActiveProjectNow();
  const payload = {
    fileType: "test-hole-project",
    version: 1,
    exportedAt: new Date().toISOString(),
    data: state,
  };
  download(
    `${safeFilePart(state.project.projectFileName || state.project.projectNumber || state.project.projectName)}.thproject.json`,
    JSON.stringify(payload, null, 2),
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
  const restoredData = restored.fileType === "test-hole-project" ? restored.data : restored;
  applyProjectData(restoredData);
  activeProjectId = uid();
  projectRecords.push({ id: activeProjectId, name: projectDisplayName(), updatedAt: new Date().toISOString() });
  saveActiveProjectNow();
  save();
  render();
  event.target.value = "";
}

function bindEvents() {
  bindProjectFields();
  bindHoleFields();
  $("projectSelect").addEventListener("change", (event) => switchProject(event.target.value));
  $("newProjectBtn").addEventListener("click", newProject);
  $("deleteProjectBtn").addEventListener("click", deleteProject);
  $("addHoleBtn").addEventListener("click", () => addHole());
  $("duplicateHoleBtn").addEventListener("click", duplicateHole);
  $("deleteHoleBtn").addEventListener("click", deleteHole);
  $("mapImage").addEventListener("error", () => {
    $("mapTip").textContent = "Aerial image failed to load. Check the coordinate system and internet connection.";
  });
  $("mapImage").addEventListener("load", () => {
    const hole = selectedHole();
    if (hole && (hole.mapImage || state.mapImage)) {
      $("mapTip").innerHTML = `Aerial centered on <b id="selectedHoleName">${escapeHtml(hole.holeName)}</b>`;
    }
  });
  $("mapImageInput").addEventListener("change", loadMapImage);
  $("aerialFromCoordsBtn").addEventListener("click", aerialFromCoordinates);
  $("zoomOutBtn").addEventListener("click", () => setMapZoom((selectedHole()?.mapZoom || state.mapZoom || 1) - 0.25));
  $("zoomInBtn").addEventListener("click", () => setMapZoom((selectedHole()?.mapZoom || state.mapZoom || 1) + 0.25));
  $("zoomResetBtn").addEventListener("click", () => setMapZoom(1));
  $("clearMapBtn").addEventListener("click", () => {
    const hole = selectedHole();
    if (hole) {
      hole.mapImage = "";
      hole.mapZoom = 1;
      hole.mapX = null;
      hole.mapY = null;
    } else {
      state.mapImage = "";
    }
    save();
    renderMapImage();
    renderPins();
    renderReport();
  });
  $("photoInput").addEventListener("change", addPhotos);
  $("photoRollInput").addEventListener("change", addPhotos);
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
  $("exportProjectBtn").addEventListener("click", exportProjectFile);
  $("jsonBtn").addEventListener("click", exportJson);
  $("jsonInput").addEventListener("change", restoreJson);
}

bindEvents();
hydrate();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").then((registration) => {
      registration.update();
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            window.location.reload();
          }
        });
      });
    }).catch(() => {});
  });
}

const API_URL =
  "https://script.google.com/macros/s/AKfycbz6veJ_02mh-L1-LmzJTfQpFgUBHKKg3MN__4OQ_NHleaaS2gFz_Yy-CNwqDgNi5jQwzw/exec";

const ORDEN_VISUAL = [
  "1ª Hora",
  "2ª Hora",
  "3ª Hora",
  "Recreo",
  "4ª Hora",
  "5ª Hora",
  "6ª Hora",
];

window.onload = function () {
  generarDias();
  
  const loadTime = performance.now();
  const loadStats = document.getElementById("pageLoadStats");
  
  if (loadStats) {
    loadStats.innerHTML = `Página: ${loadTime.toFixed(0)}ms`;
  }
};

function generarDias() {
  const select = document.getElementById("selDia");
  const dias = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
  dias.forEach((d, i) => {
    let opt = document.createElement("option");
    opt.value = d;
    opt.text = d;
    if (i + 1 === new Date().getDay()) opt.selected = true;
    select.add(opt);
  });
}

function renderizarTablaExterna(datosOriginales) {
  const tbody = document.getElementById("tbody");
  tbody.innerHTML = "";

  if (datosOriginales.length === 0) {
    tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; padding:40px; color:#137333; font-weight:bold;">Sin incidencias.</td></tr>`;
    return;
  }

  // 1. Agrupar datos por hora
  let agenda = {};
  datosOriginales.forEach((item) => {
    if (!agenda[item.hora]) {
      agenda[item.hora] = { guardias: [], faltas: [] };
    }
    // Añadir responsable (guardia) si existe y no está ya en la lista
    if (
      item.responsable &&
      !agenda[item.hora].guardias.includes(item.responsable)
    ) {
      agenda[item.hora].guardias.push(item.responsable);
    }
    // Añadir la falta SOLO si hay un sujeto (profesor que falta)
    if (item.sujeto) {
      agenda[item.hora].faltas.push({
        profe: item.sujeto,
        aula: item.lugar,
        nota: item.nota,
      });
    }
  });

  // 2. Ordenar horas según el ORDEN_VISUAL
  let horasOrdenadas = Object.keys(agenda).sort(
    (a, b) => ORDEN_VISUAL.indexOf(a) - ORDEN_VISUAL.indexOf(b),
  );

  // 3. Pintar en la tabla
  horasOrdenadas.forEach((hora) => {
    let info = agenda[hora];
    let tr = document.createElement("tr");

    let htmlGuardias =
      info.guardias.length > 0
        ? `<ul class="guard-list">${info.guardias.map((p) => `<li>${p}</li>`).join("")}</ul>`
        : '<span class="no-guards">⚠️ ALERTA: NADIE DISPONIBLE</span>';

    let htmlFaltas = info.faltas.length > 0 
      ? info.faltas
          .map(
            (f) => `
            <div class="falta-card">
              <span class="falta-profe">${f.profe}</span>
              <span class="falta-aula">${f.aula || ''}</span>
              ${f.nota ? `<p style="font-size:12px; color:#666; margin-top:4px;">${f.nota}</p>` : ""}
            </div>
          `,
          )
          .join("")
      : '<span class="sin-faltas">Sin incidencias</span>';

    tr.innerHTML = `
      <td width="40%"><span class="periodo-display">${hora}</span>${htmlGuardias}</td>
      <td width="60%">${htmlFaltas}</td>
    `;
    tbody.appendChild(tr);
  });
}

function obtenerFechaDeSemana(nombreDia) {
  const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const hoy = new Date();
  const indiceDeseado = dias.indexOf(nombreDia);
  const fecha = new Date(hoy);
  const diferencia = indiceDeseado - hoy.getDay();
  fecha.setDate(hoy.getDate() + diferencia);
  return fecha.toISOString().split("T")[0];
}

// --- INTEGRACIONES ---

function fetchEucariota() {
  const dia = document.getElementById("selDia").value;
  const tbody = document.getElementById("tbody");
  const latencyBox = document.getElementById("latencyStats");

  tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; padding:40px; font-size:18px;">🔄 Consultando base de datos Eucariota...</td></tr>';

  const startTime = performance.now();
  latencyBox.style.display = "none";

  fetch(API_URL + "?dia=" + dia)
    .then((r) => r.json())
    .then((data) => {
      const endTime = performance.now();
      latencyBox.innerText = `Fetch: ${(endTime - startTime).toFixed(0)} ms`;
      latencyBox.style.display = "inline-block";

      if (data.status === "error") {
        tbody.innerHTML = `<tr><td colspan="2" style="color:red; text-align:center; padding:20px;">Error: ${data.message}</td></tr>`;
        return;
      }

      let formateados = [];

      // Procesar guardias
      data.guardias.forEach((g) => {
        g.profesores.forEach((profe) => {
          formateados.push({
            hora: g.hora,
            responsable: profe,
            sujeto: null,
            lugar: null
          });
        });
      });

      // Procesar faltas
      data.faltas.forEach((f) => {
        formateados.push({
          hora: f.hora,
          responsable: null,
          sujeto: f.profesor,
          lugar: f.aula
        });
      });

      renderizarTablaExterna(formateados);
    });
}

async function fetchJotasones() {
  const tbody = document.getElementById("tbody");
  const latencyBox = document.getElementById("latencyStats");
  const diaSeleccionado = document.getElementById("selDia").value;
  const fechaStr = obtenerFechaDeSemana(diaSeleccionado);

  tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; padding:40px; font-size:18px;">🔄 Consultando Jotasones...</td></tr>';
  const startTime = performance.now();

  try {
    const res = await fetch(`http://localhost:3000/api/panel?fecha=${fechaStr}`);
    const data = await res.json();
    const endTime = performance.now();
    latencyBox.innerText = `Fetch: ${(endTime - startTime).toFixed(0)} ms`;
    latencyBox.style.display = "inline-block";

    const formateados = data.map((d) => ({
      hora: d.hora_inicio + "ª Hora",
      responsable: d.nombre_guardia,
      sujeto: d.nombre_profesor,
      lugar: d.grupo,
      nota: d.tarea,
    }));
    renderizarTablaExterna(formateados);
  } catch (e) {
    alert("Error Jotasones (Puerto 3000)");
  }
}

async function fetchMoteros() {
  const tbody = document.getElementById("tbody");
  const latencyBox = document.getElementById("latencyStats");
  const diaStr = document.getElementById("selDia").value;
  const fechaStr = obtenerFechaDeSemana(diaStr);

  tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; padding:40px; font-size:18px;">🔄 Consultando Moteros...</td></tr>';
  const startTime = performance.now();

  try {
    const res = await fetch(`http://localhost:3001/api/panel?diaSemana=${diaStr}&fecha=${fechaStr}`);
    const data = await res.json();
    const endTime = performance.now();
    latencyBox.innerText = `Fetch: ${(endTime - startTime).toFixed(0)} ms`;
    latencyBox.style.display = "inline-block";

    const formateados = data.ausencias.map((ausencia) => {
      const guardiasEnEsaHora = data.guardias
        .filter((g) => g.hora === ausencia.hora && g.status === "disponible")
        .map((g) => `${g.profesor.nombre} ${g.profesor.apellidos}`);

      return {
        hora: ausencia.hora,
        responsable: guardiasEnEsaHora.length > 0 ? guardiasEnEsaHora.join(", ") : null,
        sujeto: `${ausencia.profesor.nombre} ${ausencia.profesor.apellidos}`,
        lugar: ausencia.grupo,
        nota: ausencia.tarea,
      };
    });
    renderizarTablaExterna(formateados);
  } catch (e) {
    alert("Error conectando con el servidor de Moteros (Puerto 3001)");
  }
}

async function fetchDuostream() {
  const tbody = document.getElementById("tbody");
  const latencyBox = document.getElementById("latencyStats");
  const urlCSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRLBHYrwNyk20UoDwqBu-zfDXWSyeRtsg536axelI0eEHYsovoMiwgoS82tjGRy6Tysw3Pj6ovDiyzo/pub?gid=1908899796&single=true&output=csv";
  const diaSeleccionado = document.getElementById("selDia").value;

  tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; padding:40px; font-size:18px;">🔄 Consultando Duostream CSV...</td></tr>';
  const startTime = performance.now();

  try {
    const res = await fetch(urlCSV);
    const texto = await res.text();
    const endTime = performance.now();
    latencyBox.innerText = `Fetch: ${(endTime - startTime).toFixed(0)} ms`;
    latencyBox.style.display = "inline-block";

    const lineas = texto.split("\n").slice(1);
    const formateados = lineas
      .map((linea) => {
        const c = linea.split(",");
        return {
          dia: c[0]?.trim(),
          hora: (c[1] ? c[1] + "ª Hora" : "") + (c[2] ? " (" + c[2] + ")" : ""),
          responsable: c[3] === "GUARDIA" ? c[4] : null,
          sujeto: c[4],
          lugar: c[5],
          nota: c[6],
        };
      })
      .filter((f) => f.dia === diaSeleccionado);

    renderizarTablaExterna(formateados);
  } catch (e) {
    alert("Error al leer CSV de Duostream");
  }
}
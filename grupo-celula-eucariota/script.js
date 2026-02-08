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
  cargarDatos();
};

// --- FUNCIONES ORIGINALES ---
function cargarDatos() {
  const dia = document.getElementById("selDia").value;
  const tbody = document.getElementById("tbody");
  const latencyBox = document.getElementById("latencyStats");

  tbody.innerHTML =
    '<tr><td colspan="2" style="text-align:center; padding:40px; font-size:18px;">🔄 Consultando base de datos...</td></tr>';

  const startTime = performance.now();
  latencyBox.style.display = "none";

  fetch(API_URL + "?dia=" + dia)
    .then((r) => r.json())
    .then((data) => {
      const endTime = performance.now();
      const duration = (endTime - startTime).toFixed(0);

      latencyBox.innerText = `⏱️ Ping: ${duration} ms`;
      latencyBox.style.display = "inline-block";

      tbody.innerHTML = "";

      if (data.status === "error") {
        tbody.innerHTML = `<tr><td colspan="2" style="color:red; text-align:center; padding:20px;">Error: ${data.message}</td></tr>`;
        return;
      }

      let agenda = {};
      const initHora = (h) => {
        if (!agenda[h]) agenda[h] = { guardias: [], faltas: [] };
      };

      data.guardias.forEach((item) => {
        initHora(item.hora);
        agenda[item.hora].guardias = item.profesores;
      });

      data.faltas.forEach((item) => {
        initHora(item.hora);
        agenda[item.hora].faltas.push({
          profe: item.profesor,
          aula: item.aula,
        });
      });

      let horasPresentes = Object.keys(agenda);

      if (horasPresentes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; padding:40px; color:#137333; font-weight:bold;">✅ Agenda libre: No hay incidencias registradas para el ${dia}.</td></tr>`;
        return;
      }

      horasPresentes.sort((a, b) => {
        let idxA = ORDEN_VISUAL.indexOf(a);
        let idxB = ORDEN_VISUAL.indexOf(b);
        if (idxA === -1) idxA = 999;
        if (idxB === -1) idxB = 999;
        return idxA - idxB;
      });

      horasPresentes.forEach((hora) => {
        let info = agenda[hora];
        let tr = document.createElement("tr");

        let htmlGuardias = "";
        if (info.guardias.length > 0) {
          htmlGuardias = '<ul class="guard-list">';
          info.guardias.forEach((p) => (htmlGuardias += `<li>${p}</li>`));
          htmlGuardias += "</ul>";
        } else {
          htmlGuardias =
            '<span class="no-guards">⚠️ ALERTA: NADIE DISPONIBLE</span>';
        }

        let celdaIzq = `
            <span class="periodo-display">${hora}</span>
            <div style="font-size:12px; font-weight:bold; color:#888; margin-bottom:5px; text-transform:uppercase;">Profesorado de Guardia:</div>
            ${htmlGuardias}
          `;

        let htmlFaltas = "";
        if (info.faltas.length > 0) {
          info.faltas.forEach((f) => {
            htmlFaltas += `
                <div class="falta-card">
                  <span class="falta-profe">👤 ${f.profe}</span>
                  <span class="falta-aula">📍 ${f.aula}</span>
                </div>`;
          });
        } else {
          htmlFaltas = '<span class="sin-faltas">✅ Sin incidencias</span>';
        }

        tr.innerHTML = `
            <td width="40%">${celdaIzq}</td>
            <td width="60%">${htmlFaltas}</td>
          `;
        tbody.appendChild(tr);
      });
    })
    .catch((e) => {
      console.error(e);
      tbody.innerHTML =
        '<tr><td colspan="2" style="color:red; text-align:center;">Error de conexión. Verifica la URL del Script.</td></tr>';
    });
}

function generarDias() {
  const select = document.getElementById("selDia");
  const dias = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
  const hoyIdx = new Date().getDay();
  dias.forEach((d, i) => {
    let opt = document.createElement("option");
    opt.value = d;
    opt.text = d;
    if (i + 1 === hoyIdx || (hoyIdx === 0 && i === 0)) opt.selected = true;
    select.add(opt);
  });
}

// --- NUEVAS FUNCIONES DE INTEGRACIÓN ---

// 1. Fetch Propio (Célula Eucariota)
function fetchEucariota() {
  console.log("Ejecutando fetch original...");
  cargarDatos();
}

// 2. Fetch Jotasones (Requiere node server.js en puerto 3000)
async function fetchJotasones() {
  const fechaStr = new Date().toISOString().split('T')[0];
  try {
    const res = await fetch(`http://localhost:3000/api/panel?fecha=${fechaStr}`);
    const data = await res.json();
    console.log("Datos Jotasones:", data);
    alert(`Fetch Jotasones: Recibidos ${data.length} registros desde MySQL.`);
  } catch (e) {
    alert("Error Jotasones: ¿Está el servidor activo en el puerto 3000?");
  }
}

// 3. Fetch Los Moteros (Requiere node server.js en puerto 3000)
async function fetchMoteros() {
  const diaStr = document.getElementById("selDia").value;
  const fechaStr = new Date().toISOString().split('T')[0];
  try {
    const res = await fetch(`http://localhost:3001/api/panel?diaSemana=${diaStr}&fecha=${fechaStr}`);
    const data = await res.json();
    console.log("Datos Moteros:", data);
    alert(`Fetch Moteros: Recibidas ${data.ausencias.length} ausencias desde MongoDB.`);
  } catch (e) {
    alert("Error Moteros: ¿Está el servidor activo en el puerto 3000?");
  }
}

// 4. Fetch Duostream (CSV público de Google Sheets)
async function fetchDuostream() {
  const urlCSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRLBHYrwNyk20UoDwqBu-zfDXWSyeRtsg536axelI0eEHYsovoMiwgoS82tjGRy6Tysw3Pj6ovDiyzo/pub?gid=1908899796&single=true&output=csv';
  try {
    const res = await fetch(urlCSV);
    const texto = await res.text();
    console.log("CSV Duostream:", texto);
    const filas = texto.split('\n').length - 1;
    alert(`Fetch Duostream: Recibido CSV con ${filas} líneas de datos.`);
  } catch (e) {
    alert("Error Duostream: No se pudo acceder al CSV de Google Sheets.");
  }
}
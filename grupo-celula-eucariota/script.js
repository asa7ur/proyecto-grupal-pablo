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

// --- FUNCIONES ORIGINALES (EUCARIOTA) ---
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

      let horasPresentes = Object.keys(agenda).sort(
        (a, b) => ORDEN_VISUAL.indexOf(a) - ORDEN_VISUAL.indexOf(b),
      );

      if (horasPresentes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; padding:40px; color:#137333; font-weight:bold;">✅ Agenda libre para el ${dia}.</td></tr>`;
        return;
      }

      horasPresentes.forEach((hora) => {
        let info = agenda[hora];
        let tr = document.createElement("tr");
        let htmlGuardias =
          info.guardias.length > 0
            ? `<ul class="guard-list">${info.guardias.map((p) => `<li>${p}</li>`).join("")}</ul>`
            : '<span class="no-guards">⚠️ ALERTA: NADIE DISPONIBLE</span>';

        let htmlFaltas =
          info.faltas.length > 0
            ? info.faltas
                .map(
                  (f) =>
                    `<div class="falta-card"><span class="falta-profe">👤 ${f.profe}</span><span class="falta-aula">📍 ${f.aula}</span></div>`,
                )
                .join("")
            : '<span class="sin-faltas">✅ Sin incidencias</span>';

        tr.innerHTML = `<td width="40%"><span class="periodo-display">${hora}</span>${htmlGuardias}</td><td width="60%">${htmlFaltas}</td>`;
        tbody.appendChild(tr);
      });
    });
}

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

// --- NUEVA FUNCIÓN GENÉRICA PARA PINTAR DATOS EXTERNOS ---
function renderizarTablaExterna(filas, titulo) {
  const tbody = document.getElementById("tbody");
  tbody.innerHTML = "";

  if (filas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; padding:20px;">No hay datos en ${titulo}</td></tr>`;
    return;
  }

  filas.forEach((item) => {
    let tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
          <span class="periodo-display">${item.hora}</span>
          <div style="font-size:12px; font-weight:bold; color:#888;">Personal:</div>
          <ul class="guard-list"><li>${item.responsable || "No asignado"}</li></ul>
      </td>
      <td>
          <div class="falta-card">
              <span class="falta-profe">👤 ${item.sujeto}</span>
              <span class="falta-aula">📍 ${item.lugar}</span>
              ${item.nota ? `<p style="font-size:13px; margin-top:5px; color:#555;">📝 ${item.nota}</p>` : ""}
          </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// --- INTEGRACIONES ---

function fetchEucariota() {
  cargarDatos();
}

async function fetchJotasones() {
  const fechaStr = new Date().toISOString().split("T")[0];
  try {
    const res = await fetch(
      `http://localhost:3000/api/panel?fecha=${fechaStr}`,
    );
    const data = await res.json();
    const formateados = data.map((d) => ({
      hora: d.hora_inicio + "ª Hora",
      responsable: d.nombre_guardia,
      sujeto: d.nombre_profesor,
      lugar: d.grupo,
      nota: d.tarea,
    }));
    renderizarTablaExterna(formateados, "Jotasones");
  } catch (e) {
    alert("Error Jotasones (Puerto 3000)");
  }
}

async function fetchMoteros() {
  const diaStr = document.getElementById("selDia").value;
  // Obtenemos la fecha de hoy en formato YYYY-MM-DD
  const fechaStr = new Date().toISOString().split("T")[0];

  try {
    // Añadimos &fecha= a la URL
    const res = await fetch(
      `http://localhost:3001/api/panel?diaSemana=${diaStr}&fecha=${fechaStr}`,
    );
    const data = await res.json();

    // Corregimos el mapeo de nombres de campos (Moteros usa 'grupo' y 'tarea')
    const formateados = data.ausencias.map((d) => ({
      hora: d.hora,
      responsable: "Ver en App Moteros",
      sujeto: `${d.profesor.nombre} ${d.profesor.apellidos}`,
      lugar: d.grupo, // En Moteros es 'grupo', no 'aula'
      nota: d.tarea, // En Moteros es 'tarea', no 'observaciones'
    }));
    renderizarTablaExterna(formateados, "Moteros");
  } catch (e) {
    alert("Error Moteros (Puerto 3001). ¿Has arrancado su servidor?");
  }
}

async function fetchDuostream() {
  const urlCSV =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRLBHYrwNyk20UoDwqBu-zfDXWSyeRtsg536axelI0eEHYsovoMiwgoS82tjGRy6Tysw3Pj6ovDiyzo/pub?gid=1908899796&single=true&output=csv";
  const diaSeleccionado = document.getElementById("selDia").value;

  try {
    const res = await fetch(urlCSV);
    const texto = await res.text();
    const lineas = texto.split("\n").slice(1);

    const formateados = lineas
      .map((linea) => {
        const c = linea.split(",");
        // Estructura: Dia[0], Orden[1], Rango[2], Tipo[3], Profesor[4], Ubicacion[5], Tarea[6]
        return {
          dia: c[0]?.trim(),
          hora: (c[1] ? c[1] + "ª Hora" : "") + (c[2] ? " (" + c[2] + ")" : ""),
          responsable: c[3] === "GUARDIA" ? c[4] : "Por asignar",
          sujeto: c[4],
          lugar: c[5],
          nota: c[6],
        };
      })
      .filter((f) => f.dia === diaSeleccionado); // Solo mostramos los del día seleccionado en el desplegable

    renderizarTablaExterna(formateados, "Duostream");
  } catch (e) {
    alert("Error al leer CSV de Duostream");
  }
}

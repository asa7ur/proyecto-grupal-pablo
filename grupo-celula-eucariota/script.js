// ==========================================
// 1. CONFIGURACIÓN Y VARIABLES GLOBALES
// ==========================================

// URLs de las distintas fuentes de datos
const API_URL_APPS_SCRIPT = "https://script.google.com/macros/s/AKfycbz6veJ_02mh-L1-LmzJTfQpFgUBHKKg3MN__4OQ_NHleaaS2gFz_Yy-CNwqDgNi5jQwzw/exec"; 
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRLBHYrwNyk20UoDwqBu-zfDXWSyeRtsg536axelI0eEHYsovoMiwgoS82tjGRy6Tysw3Pj6ovDiyzo/pub?gid=1908899796&single=true&output=csv';

// Puertos separados para evitar conflictos si enciendes ambos servidores
const URL_MONGO = "http://localhost:3000"; // Servidor Los Moteros
const URL_MYSQL = "http://localhost:3001"; // Servidor Jotasones

const ORDEN_VISUAL = ["1ª Hora", "2ª Hora", "3ª Hora", "Recreo", "4ª Hora", "5ª Hora", "6ª Hora"];

// Inicialización de Socket.io (Solo para Mongo/Tiempo Real)
const socket = typeof io !== 'undefined' ? io(URL_MONGO) : null;

if (socket) {
    socket.on("connect", () => console.log("🟢 Conectado al servidor de tiempo real (Mongo)"));
    socket.on("datos-actualizados", () => {
        console.log("⚡ Cambio detectado en BD. Recargando...");
        // Solo recargamos si el usuario está viendo la vista de Mongo en ese momento
        // (Opcional: podrías comprobar una bandera, por ahora recarga simple)
        const btnMongoActive = document.activeElement && document.activeElement.innerText.includes("MongoDB");
        if(btnMongoActive) fetchMongo(); 
    });
}

// ==========================================
// 2. INICIO Y UTILIDADES
// ==========================================

window.onload = function () {
    generarDias();
    cargarDatos(); // Carga inicial por defecto (Apps Script)
};

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

// ==========================================
// 3. MÉTODOS DE FETCH (LAS 4 FUENTES)
// ==========================================

// --- A. GOOGLE APPS SCRIPT (Original) ---
function cargarDatos() {
    const dia = document.getElementById("selDia").value;
    const tbody = document.getElementById("tbody");
    const latencyBox = document.getElementById("latencyStats");

    tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; padding:40px;">🔄 Consultando Apps Script...</td></tr>';
    const startTime = performance.now();

    fetch(`${API_URL_APPS_SCRIPT}?dia=${dia}`)
        .then(r => r.json())
        .then(data => {
            mostrarLatencia(startTime, latencyBox);
            let agenda = {};
            const initH = h => { if (!agenda[h]) agenda[h] = { guardias: [], faltas: [] }; };

            data.guardias.forEach(item => {
                initH(item.hora);
                agenda[item.hora].guardias = item.profesores;
            });
            data.faltas.forEach(item => {
                initH(item.hora);
                agenda[item.hora].faltas.push({ profe: item.profesor, aula: item.aula });
            });
            renderizarTablaDesdeObjeto(agenda);
        })
        .catch(e => errorTabla("Error al conectar con Apps Script"));
}

// --- B. CSV / GOOGLE SHEETS ---
async function fetchCSV() {
    const diaSel = document.getElementById("selDia").value;
    const tbody = document.getElementById("tbody");
    tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;">📄 Procesando CSV...</td></tr>';

    try {
        const res = await fetch(CSV_URL);
        const text = await res.text();
        const filas = text.split('\n').slice(1);
        let agenda = {};

        filas.forEach(linea => {
            const [dia, orden, rango, tipo, profesor, ubi] = linea.split(',').map(s => s?.trim());
            if (dia === diaSel) {
                const hKey = `${orden}ª Hora`;
                if (!agenda[hKey]) agenda[hKey] = { guardias: [], faltas: [] };
                if (tipo?.toUpperCase() === 'AUSENCIA') {
                    agenda[hKey].faltas.push({ profe: profesor, aula: ubi || "N/A" });
                } else {
                    agenda[hKey].guardias.push(profesor);
                }
            }
        });
        renderizarTablaDesdeObjeto(agenda);
    } catch (e) { errorTabla("Error al leer el CSV"); }
}

// --- C. MYSQL (JOTASONES) ---
async function fetchMySQL() {
    const tbody = document.getElementById("tbody");
    tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;">🐬 Consultando MySQL Local (Puerto 3001)...</td></tr>';
    
    const fecha = new Date().toISOString().split('T')[0];
    try {
        // CORREGIDO: Usamos URL_MYSQL (Puerto 3001)
        const res = await fetch(`${URL_MYSQL}/api/panel?fecha=${fecha}`);
        const data = await res.json();
        
        let agenda = {};
        
        // Procesamos Guardias
        if (data.guardias) {
            data.guardias.forEach(g => {
                const h = `${g.hora}ª Hora`;
                if (!agenda[h]) agenda[h] = { guardias: [], faltas: [] };
                agenda[h].guardias.push(g.profesor);
            });
        }

        // Procesamos Ausencias
        if (data.ausencias) {
            data.ausencias.forEach(a => {
                const h = `${a.hora}ª Hora`;
                if (!agenda[h]) agenda[h] = { guardias: [], faltas: [] };
                agenda[h].faltas.push({ profe: a.profesor, aula: a.aula });
            });
        }

        renderizarTablaDesdeObjeto(agenda);
    } catch (e) { 
        console.error(e);
        errorTabla("Error conectando a MySQL (Jotasones) en puerto 3001."); 
    }
}

// --- D. MONGODB / REAL TIME (LOS MOTEROS) ---
async function fetchMongo() {
    const tbody = document.getElementById("tbody");
    const dia = document.getElementById("selDia").value;
    tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;">🍃 Consultando MongoDB (Puerto 3000)...</td></tr>';

    try {
        const fecha = new Date().toISOString().split('T')[0];
        // CORREGIDO: Usamos URL_MONGO (Puerto 3000)
        const res = await fetch(`${URL_MONGO}/api/panel?diaSemana=${dia}&fecha=${fecha}`);
        const data = await res.json();
        
        let agenda = {};
        const formatH = h => h.includes('º') ? h.replace('º', 'ª Hora') : h;

        data.guardias.forEach(g => {
            const h = formatH(g.hora);
            if (!agenda[h]) agenda[h] = { guardias: [], faltas: [] };
            // Mongo devuelve un objeto profesor, lo concatenamos
            agenda[h].guardias.push(`${g.profesor.nombre} ${g.profesor.apellidos}`);
        });
        
        data.ausencias.forEach(a => {
            const h = formatH(a.hora);
            if (!agenda[h]) agenda[h] = { guardias: [], faltas: [] };
            agenda[h].faltas.push({ profe: `${a.profesor.nombre} ${a.profesor.apellidos}`, aula: a.grupo });
        });

        renderizarTablaDesdeObjeto(agenda);
    } catch (e) { errorTabla("¿Está encendido el servidor Mongo (Los Moteros) en puerto 3000?"); }
}

// ==========================================
// 4. SISTEMA DE RENDERIZADO COMÚN
// ==========================================

function renderizarTablaDesdeObjeto(agenda) {
    const tbody = document.getElementById("tbody");
    tbody.innerHTML = "";
    let horas = Object.keys(agenda).sort((a, b) => {
        let idxA = ORDEN_VISUAL.indexOf(a);
        let idxB = ORDEN_VISUAL.indexOf(b);
        return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    });

    if (horas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; padding:40px;">✅ Sin incidencias registradas.</td></tr>';
        return;
    }

    horas.forEach(hora => {
        const info = agenda[hora];
        const tr = document.createElement("tr");

        const htmlG = info.guardias.length > 0 
            ? `<ul class="guard-list">${info.guardias.map(p => `<li>${p}</li>`).join('')}</ul>`
            : '<span class="no-guards">⚠️ ALERTA: NADIE DISPONIBLE</span>';

        const htmlF = info.faltas.length > 0
            ? info.faltas.map(f => `<div class="falta-card"><span class="falta-profe">👤 ${f.profe}</span><span class="falta-aula">📍 ${f.aula}</span></div>`).join('')
            : '<span class="sin-faltas">✅ Sin incidencias</span>';

        tr.innerHTML = `<td width="40%"><span class="periodo-display">${hora}</span><div class="label-mini">Guardia:</div>${htmlG}</td>
                        <td width="60%">${htmlF}</td>`;
        tbody.appendChild(tr);
    });
}

function mostrarLatencia(start, box) {
    if (box) {
        box.innerText = `⏱️ Ping: ${(performance.now() - start).toFixed(0)} ms`;
        box.style.display = "inline-block";
    }
}

function errorTabla(msg) {
    document.getElementById("tbody").innerHTML = `<tr><td colspan="2" style="color:red; text-align:center; padding:20px;">❌ ${msg}</td></tr>`;
}
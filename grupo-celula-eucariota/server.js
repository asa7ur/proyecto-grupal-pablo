const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root_password',
    database: 'guardias'
});

db.connect(err => {
    if (err) console.error("Error conectando a MySQL: " + err.stack);
    else console.log("🟢 Conectado a MySQL Base de Datos");
});

// ---------- PROFESORES ----------
app.get('/api/profesores', (req, res) => {
    db.query('SELECT * FROM profesores ORDER BY apellidos', (e, r) => res.json(r));
});

// ---------- GRUPOS ----------
app.get('/api/grupos', (req, res) => {
    db.query('SELECT * FROM grupos ORDER BY nombre', (e, r) => res.json(r));
});

// ---------- DISPONIBLES ----------
app.get('/api/profesores-disponibles', (req, res) => {
    const { hora, fecha } = req.query;
    db.query(`
        SELECT * FROM profesores
        WHERE id NOT IN (
            SELECT profesor_id FROM reportes
            WHERE fecha=? AND hora_inicio<=? AND hora_fin>=?
        )
        AND id NOT IN (
            SELECT profesor_guardia_id FROM guardias
            WHERE fecha=? AND hora=?
        )
        ORDER BY apellidos
    `, [fecha, hora, hora, fecha, hora], (e, r) => res.json(r));
});

// ---------- PANEL (CORREGIDO) ----------
app.get('/api/panel', (req, res) => {
    const { fecha } = req.query;
    
    // Consulta que une reportes de ausencias con posibles asignaciones de guardias
    const sql = `
        SELECT r.hora_inicio, r.hora_fin, r.tarea,
               p.nombre as p_nom, p.apellidos as p_ape,
               g.nombre as g_nom,
               pg.nombre as pg_nom, pg.apellidos as pg_ape,
               ga.id as guardia_id
        FROM reportes r
        JOIN profesores p ON r.profesor_id=p.id
        JOIN grupos g ON r.grupo_id=g.id
        LEFT JOIN guardias ga ON ga.reporte_id=r.id
        LEFT JOIN profesores pg ON ga.profesor_guardia_id=pg.id
        WHERE r.fecha=?
        ORDER BY r.hora_inicio
    `;

    db.query(sql, [fecha], (e, rows) => {
        if (e) return res.status(500).json({ error: e.message });

        // Transformar la respuesta plana SQL en el Objeto que espera el frontend
        const responseData = { guardias: [], ausencias: [] };
        
        rows.forEach(row => {
            // 1. Agregar Ausencia
            responseData.ausencias.push({
                hora: row.hora_inicio, 
                profesor: `${row.p_nom} ${row.p_ape}`,
                aula: row.g_nom,
                tarea: row.tarea
            });

            // 2. Agregar Guardia (solo si hay un profesor de guardia asignado en 'ga')
            if (row.guardia_id && row.pg_nom) {
                responseData.guardias.push({
                    hora: row.hora_inicio,
                    profesor: `${row.pg_nom} ${row.pg_ape}`
                });
            }
        });
        
        res.json(responseData);
    });
});

// ---------- AUSENCIAS ----------
app.post('/api/reportes', (req, res) => {
    const { profesor_id, grupo_id, hora_inicio, hora_fin, tarea, fecha } = req.body;
    db.query(`
        INSERT INTO reportes
        (profesor_id,grupo_id,hora_inicio,hora_fin,tarea,fecha)
        VALUES (?,?,?,?,?,?)
    `, [profesor_id, grupo_id, hora_inicio, hora_fin, tarea, fecha]);
    res.json({ ok: true });
});

app.delete('/api/reportes/:id', (req, res) => {
    db.query('DELETE FROM reportes WHERE id=?', [req.params.id]);
    res.json({ ok: true });
});

// ---------- GUARDIAS ----------
app.post('/api/guardias', (req, res) => {
    const { reporte_id, profesor_guardia_id, hora, fecha } = req.body;
    db.query(`
        INSERT INTO guardias
        (reporte_id,profesor_guardia_id,hora,fecha)
        VALUES (?,?,?,?)
    `, [reporte_id, profesor_guardia_id, hora, fecha]);
    res.json({ ok: true });
});

app.delete('/api/guardias/:id', (req, res) => {
    db.query('DELETE FROM guardias WHERE id=?', [req.params.id]);
    res.json({ ok: true });
});

// CORREGIDO: Puerto 3001 para no chocar con Mongo (3000)
const PORT = 3001;
app.listen(PORT, () => console.log(`🐬 Servidor MySQL activo en puerto ${PORT}`));
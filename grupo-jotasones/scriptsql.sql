DROP DATABASE IF EXISTS guardias;
CREATE DATABASE guardias;
USE guardias;

CREATE TABLE profesores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50),
    apellidos VARCHAR(100)
);

CREATE TABLE grupos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(20)
);

CREATE TABLE reportes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    profesor_id INT,
    grupo_id INT,
    hora_inicio INT,
    hora_fin INT,
    tarea TEXT,
    fecha DATE,
    FOREIGN KEY (profesor_id) REFERENCES profesores(id) ON DELETE CASCADE,
    FOREIGN KEY (grupo_id) REFERENCES grupos(id)
);

CREATE TABLE guardias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    reporte_id INT,
    profesor_guardia_id INT,
    hora INT,
    fecha DATE,
    FOREIGN KEY (reporte_id) REFERENCES reportes(id) ON DELETE CASCADE,
    FOREIGN KEY (profesor_guardia_id) REFERENCES profesores(id)
);

-- PROFESORES
INSERT INTO profesores (nombre,apellidos) VALUES
('María','Fernández Ruiz'),
('Laura','Pérez Gómez'),
('Juan','López García'),
('Ana','Martín Díaz'),
('Carlos','Sánchez Mora'),
('Lucía','Navarro Gil'),
('Pedro','Romero Torres'),
('Elena','Vega Castillo');

-- GRUPOS
INSERT INTO grupos (nombre) VALUES
('1ºA'),('1ºB'),('2ºA'),('2ºB'),
('3ºA'),('3ºB'),('4ºA'),('4ºB');

-- EJEMPLOS DE AUSENCIAS
INSERT INTO reportes VALUES
(NULL, 3, 2, 1, 1, 'Examen de recuperación de Biología', CURDATE()),
(NULL, 4, 5, 2, 2, 'Lectura comprensiva capítulo 3', CURDATE()),
(NULL, 5, 7, 4, 5, 'Proyecto de Geografía en el aula de informática', CURDATE() + INTERVAL 3 DAY),
(NULL, 6, 8, 6, 6, 'Repaso trimestral de Matemáticas', CURDATE() + INTERVAL 4 DAY),
(NULL, 1, 3, 1, 2, 'Práctica de laboratorio: Células vegetales', CURDATE() + INTERVAL 1 DAY),
(NULL, 7, 4, 3, 3, 'Análisis de texto literario', CURDATE() + INTERVAL 1 DAY),
(NULL, 8, 1, 5, 5, 'Corrección de ejercicios de Inglés', CURDATE() + INTERVAL 1 DAY),
(NULL, 2, 6, 2, 2, 'Debate sobre el cambio climático', CURDATE() + INTERVAL 1 DAY),
(NULL, 5, 2, 3, 4, 'Visualización de documental histórico', CURDATE() + INTERVAL 2 DAY),
(NULL, 3, 8, 1, 1, 'Cuestionario en Google Forms', CURDATE() + INTERVAL 2 DAY),
(NULL, 4, 3, 6, 6, 'Tutoría grupal sobre convivencia', CURDATE() + INTERVAL 2 DAY),
(NULL, 6, 4, 2, 3, 'Ejercicios de sintaxis en el cuaderno', CURDATE() + INTERVAL 2 DAY);

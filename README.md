# Defia Book - Backend API & Motor Financiero Matemático Puro

> **Iniciativa de Fintech Andina S.A.C.**  
> Solución tecnológica y financiera para la digitalización, control y modernización del crédito en bodegas y comercios de barrio mediante cuentas corrientes vecinales transparentes.

---

## 1. Contexto del Negocio y Dominio

En el comercio minorista tradicional del Perú, el crédito vecinal ("al fiado") ha operado históricamente de forma informal mediante libretas de papel, con graves problemas de trazabilidad, cálculos empíricos imprecisos y falta de apego al marco regulatorio.

**Defia Book** resuelve esta problemática implementando una arquitectura financiera y tecnológica formal:

1. **Motor Financiero Matemático Puro:** Replica fielmente el marco de ecuaciones **F-1 a F-17** y algoritmos **A1 a A8** del informe oficial del proyecto, utilizando el año comercial de 360 días y meses de 30 días homogéneos.
2. **Método Francés Vencido con Gracia Total:** Trata el periodo entre la fecha de compra y el primer vencimiento como gracia total, capitalizando el saldo a la TEA pactada ($P'$), calculando cuotas constantes con Factor de Recuperación del Capital (FRC) y absorbiendo desbalances de redondeo en la última cuota ($S_n = 0.00$).
3. **Cálculo de TCEA y TREA:** Resuelve numéricamente mediante bisección en 60 iteraciones el flujo de fondos igualado al desembolso al contado.
4. **Cobranza, Mora e Imputación Legal:** Aplica interés moratorio sin capitalizar sobre deuda vencida, **prohíbe pagos parciales** e imputa los pagos recibidos bajo estricto orden legal: **1° Interés Moratorio ($IM$) $\rightarrow$ 2° Interés Compensatorio ($I_c$) $\rightarrow$ 3° Capital ($A$)**.
5. **Control de Línea de Crédito:** Restringe compras si la suma del capital vigente más el nuevo importe excede el límite del vecino ($K_v + PL \le L$).
6. **Cumplimiento Regulatorio BCRP:** Integra validación frente a los topes máximos de tasas de interés compensatorio y moratorio para evitar cobros usureros.

---

## 2. Arquitectura de Software

El proyecto sigue los principios de **Clean Architecture & Ports and Adapters (Arquitectura Hexagonal)**:

- **Dominio Puro (`src/core`):** Funciones matemáticas puras sin dependencias externas (sin I/O, sin frameworks).
- **Entidades y Puertos (`src/domain`):** Modelos de negocio e interfaces de repositorios (`IClienteRepository`, `ICreditoRepository`, etc.).
- **Adaptadores en Memoria (`src/infrastructure`):** Implementaciones temporales basadas en `Map<ID, Entity>` con operaciones asíncronas (`Promise`), permitiendo desacoplar completamente la lógica de negocio antes de migrar a una base de datos relacional (PostgreSQL, MySQL o SQL Server).
- **Servicios de Aplicación (`src/services`):** Orquestación de casos de uso (Simulación, Emisión, Liquidación de Pagos, Estados de Cuenta y Reportes).
- **Capa HTTP & Controladores (`src/controllers`, `src/routes`, `src/middlewares`):** API RESTful desarrollada con Express.js, validación de contratos con Zod y documentación interactiva con OpenAPI / Swagger UI.

```
src/
├── core/               # Motor Financiero Matemático Puro (F-1 a F-17, A1 a A8)
├── domain/             # Entidades de dominio e Interfaces de Repositorios (Ports)
├── infrastructure/     # Repositorios In-Memory (Adapters) y Precarga de Datos (Seed)
├── services/           # Casos de uso y reglas de negocio
├── controllers/        # Controladores HTTP Express
├── routes/             # Enrutamiento de la API REST
├── middlewares/        # Esquemas Zod, validadores y manejador de errores
├── docs/               # Especificación OpenAPI 3.0 para Swagger UI
├── tests/              # Suite de pruebas TDD unitarias y de integración
├── app.ts              # Fábrica de aplicación Express
└── server.ts           # Punto de entrada y servidor HTTP
```

---

## 3. Casos de Prueba Oficiales Validados

La suite de pruebas automatizadas garantiza exactitud al céntimo y 4 decimales de tasa para los dos casos resueltos en el informe técnico:

| Parámetro                         | Caso 1 (Gracia Total)            | Caso 2 (Pago con Mora)                                                     |
| --------------------------------- | -------------------------------- | -------------------------------------------------------------------------- |
| **Capital / Precio Lista ($PL$)** | S/ 1,500.00                      | US$ 2,000.00                                                               |
| **Tipo de Tasa**                  | TNA 36 % cap. mensual ($m = 12$) | TEA 20.00 %                                                                |
| **TEA Equivalente**               | 42.5761 %                        | 20.0000 %                                                                  |
| **TEM**                           | 3.0000 %                         | 1.5309 %                                                                   |
| **Plazo**                         | 6 cuotas mensuales               | 4 cuotas mensuales                                                         |
| **Periodo de Gracia Total ($g$)** | 30 días (1 mes)                  | 0 días (sin gracia)                                                        |
| **Capital Capitalizado ($P'$)**   | S/ 1,545.00                      | US$ 2,000.00                                                               |
| **Cuota Ordinaria FRC ($R$)**     | S/ 285.20                        | US$ 519.28                                                                 |
| **Cuota Final Ajustada**          | S/ 285.21 (absorción residual)   | US$ 519.29 (absorción residual)                                            |
| **Saldo Final ($S_n$)**           | **0.00**                         | **0.00**                                                                   |
| **Total Pagado Base**             | S/ 1,711.21                      | US$ 2,077.13                                                               |
| **Mora en Cuota 2**               | N/A                              | $dm = 10$ días, $TEA_m = 36 \%$ $\rightarrow$ **$IM = \text{US\$ } 4.45$** |
| **Total Cuota 2 con Mora**        | N/A                              | **US$ 523.73**                                                             |
| **TCEA Calculada (Bisección)**    | **42.5739 %** (coincide con TEA) | **20.0003 %** (coincide con TEA)                                           |

---

## 4. Requisitos y Tecnologías

- **Node.js**: v20 o superior (verificado en v24).
- **Gestor de Paquetes OBLIGATORIO**: **`pnpm`** (v12 o superior). _Prohibido el uso de npm o yarn_.
- **TypeScript**: Configuración estricta (`strict: true`, `noImplicitAny: true`).
- **Framework**: Express.js con CORS y Zod.
- **Testing**: Vitest con Supertest.
- **Documentación**: Swagger UI con OpenAPI 3.0.

---

## 5. Instrucciones de Instalación y Ejecución

### Paso 1: Clonar e instalar dependencias

Abre una terminal PowerShell en el directorio del proyecto y ejecuta:

```powershell
pnpm install
```

### Paso 2: Ejecutar la suite de pruebas (TDD)

Corre las pruebas unitarias del motor financiero y las pruebas de integración de la API REST:

```powershell
pnpm test
```

> Resultado esperado: **33 tests en verde (100 % de aprobación)**.

### Paso 3: Compilar TypeScript

Genera la versión compilada en la carpeta `dist/`:

```powershell
pnpm build
```

### Paso 4: Iniciar el servidor

**En modo desarrollo (con recarga en vivo):**

```powershell
pnpm dev
```

**En modo producción (código compilado):**

```powershell
pnpm start
```

El servidor iniciará en:
`http://localhost:3000` (enlazado localmente a `127.0.0.1:3000`).

---

## 6. Documentación Interactiva de la API (Swagger UI)

Una vez iniciado el servidor, puedes explorar y ejecutar todos los endpoints de forma interactiva directamente desde el navegador:

👉 **`http://localhost:3000/api/docs`**

_(La especificación OpenAPI 3.0 en formato JSON está disponible en `http://localhost:3000/api/docs.json` para importar en herramientas como Postman o Insomnia)._

---

## 7. Guía Paso a Paso para Probar los Endpoints

El sistema cuenta con datos precargados automáticamente al iniciar el servidor:

- **Tienda:** Bodega & Minimarket Don Pepe S.A.C.
- **Cliente 1 (Soles / Caso 1):** Carlos Quispe Mamani (ID: precargado en logs, DNI: `10234567`, Límite: S/ 3,000.00).
- **Cliente 2 (Dólares / Caso 2):** María Alva Gonzales (ID: precargado en logs, DNI: `45678912`, Límite: US$ 2,500.00).
- **Productos:** Smartphone Samsung Galaxy A54 (S/ 1,500.00) y Laptop Lenovo ThinkBook (US$ 2,000.00).

---

### Endpoint 1: Simulación de Crédito en Tiempo Real (Sin persistencia)

Calcula el cronograma de cuotas, cuota referencial y TCEA antes de contraer la deuda.

- **Método:** `POST`
- **Ruta:** `/api/creditos/simular`
- **Cuerpo de Solicitud (Caso 1 Oficial):**

```json
{
  "precioLista": 1500.0,
  "moneda": "PEN",
  "tipoTasa": "Nominal",
  "tasa": 0.36,
  "capitalizacion": 12,
  "modalidad": "Cuotas",
  "plazoMeses": 6,
  "diasGracia": 30,
  "fCompra": "2026-03-15",
  "diaCorte": 15,
  "diaPago": 25
}
```

- **Respuesta Esperada (`200 OK`):**
  - `capitalCapitalizado`: `1545.00`
  - `cuotaReferencial`: `285.20`
  - `totalPagar`: `1711.21`
  - `tcea`: `0.4257` (42.57 %)
  - `cronograma`: 6 filas con cuota final de ajuste en `285.21` y saldo final `0.00`.

---

### Endpoint 2: Emisión y Registro de Compra a Crédito

Valida la regla $K_v + PL \le L$, verifica stock del producto, genera las cuotas y actualiza el capital vigente del vecino.

- **Método:** `POST`
- **Ruta:** `/api/creditos/emitir`
- **Cuerpo de Solicitud:**

```json
{
  "clienteId": "<ID_DE_CARLOS_QUISPE>",
  "precioLista": 1500.0,
  "modalidad": "Cuotas",
  "plazoMeses": 6,
  "diasGracia": 30,
  "fCompra": "2026-03-15",
  "usuario": "ASESOR_JUAN"
}
```

- **Respuesta Esperada (`201 Created`):**
  - Retorna el objeto `credito` con ID único.
  - Retorna el arreglo de `cuotas` persistidas en estado `Pendiente`.
  - `nuevoCapitalVigente`: `1500.00`
  - `lineaDisponible`: `1500.00` (3000 - 1500).

_(Si se intenta emitir un crédito que supere el límite disponible, el endpoint responderá con `400 Bad Request` indicando el saldo restante)._

---

### Endpoint 3: Listar Clientes Registrados

- **Método:** `GET`
- **Ruta:** `/api/clientes`
- **Respuesta Esperada (`200 OK`):** Lista todos los vecinos con sus datos de contacto, moneda, límite asignado y capital vigente.

---

### Endpoint 4: Estado de Cuenta Consolidado al Corte

Genera el consolidado del mes agrupando cuotas exigibles, intereses moratorios devengados y saldo pendiente total.

- **Método:** `GET`
- **Ruta:** `/api/clientes/:id/estado-cuenta?fCorte=2026-03-15`
- **Respuesta Esperada (`200 OK`):**
  - Datos del vecino y ciclo de facturación.
  - `subtotalCiclo`: Suma de capital e intereses correspondientes a la fecha de corte.
  - `cuotasCicloActual`: Cuotas que vencen en el ciclo.
  - `cuotasVencidasAnteriores`: Cuotas impagas de periodos pasados con su mora calculada.
  - `totalExigibleHoy`: Monto total consolidado a liquidar.

---

### Endpoint 5: Liquidación de Pago con Mora e Imputación Legal

Procesa el cobro de cuotas con cálculo automático de mora según días de atraso ($dm = f_p - F_0$).

- **Método:** `POST`
- **Ruta:** `/api/pagos/liquidar`
- **Cuerpo de Solicitud (Caso 2 Oficial con 10 días de mora):**

```json
{
  "clienteId": "<ID_DE_MARIA_ALVA>",
  "fPago": "2026-06-25",
  "montoRecibido": 523.73,
  "usuario": "CAJERO_ANA"
}
```

- **Respuesta Esperada (`200 OK`):**
  - `totalExigibleBase`: `519.28`
  - `totalInteresMoratorio`: `4.45` ($IM = 519.28 \times [(1 + 0.36)^{10/360} - 1]$)
  - `totalPagado`: `523.73`
  - `imputacionLegal`:
    - `moratorio`: `4.45`
    - `compensatorio`: `23.14`
    - `capital`: `496.14`
  - La cuota pasa a estado `Pagada` y el capital vigente del cliente se reduce en `496.14`.

_(Si `montoRecibido` es menor a `523.73`, el endpoint responderá con `400 Bad Request: No se admiten pagos parciales`)_.

---

### Endpoint 6: Tablero Gerencial (Dashboard)

Retorna indicadores operativos consolidados del comercio emisor.

- **Método:** `GET`
- **Ruta:** `/api/reportes/dashboard`
- **Respuesta Esperada (`200 OK`):**
  - `totalCapitalColocado`: Suma histórica de desembolsos.
  - `carteraVigenteActiva`: Saldo deudor vigente de todos los clientes.
  - `carteraVencidaEnMora`: Importe de cuotas vencidas no pagadas.
  - `ratioMorosidadPct`: Porcentaje de mora sobre la cartera activa.
  - `treaPromedioPonderadaPct`: Rendimiento ponderado por volumen de colocación.
  - `recaudacion`: Desglose total de cobranza (capital, compensatorios y moratorios).

---

## 8. Scripts Disponibles en `package.json`

| Comando           | Acción                                                                    |
| ----------------- | ------------------------------------------------------------------------- |
| `pnpm dev`        | Inicia el servidor con recarga en caliente (`tsx watch src/server.ts`).   |
| `pnpm build`      | Compila TypeScript a JavaScript estándar en el directorio `dist/`.        |
| `pnpm start`      | Inicia el servidor de producción desde `dist/server.js`.                  |
| `pnpm test`       | Ejecuta la suite completa de pruebas unitarias y de integración (Vitest). |
| `pnpm test:watch` | Ejecuta las pruebas en modo observador interactivo.                       |

---

export const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Defia Book Backend API - Fintech Andina S.A.C.',
    version: '1.0.0',
    description: `
**Sistema de Gestión de Crédito Vecinal & Motor Financiero Matemático Puro**

Desarrollado para **Fintech Andina S.A.C.** implementando fielmente el marco de fórmulas **F-1 a F-17** y algoritmos **A1 a A8**:
- **Método Francés Vencido con Periodo de Gracia Total**: Capitalización del saldo ($P' = PL \\times (1 + TEA)^{g/360}$), cuota constante mediante Factor de Recuperación de Capital (FRC) y absorción residual en la cuota final ($S_n = 0.00$).
- **TCEA y TREA**: Calculadas mediante bisección numérica en 60 iteraciones sobre el flujo descontado en base comercial de 360 días.
- **Control de Línea de Crédito**: Regla estricta $K_v + PL \\le L$ (F-17).
- **Cobranza y Mora**: Interés moratorio sobre deuda exigible sin capitalizar ($IM = T \\times [(1 + TEA_m)^{dm/360} - 1]$), rechazo de pagos parciales e imputación en estricta prelación legal (1° Mora, 2° Interés Compensatorio, 3° Capital).
    `,
    contact: {
      name: 'Equipo de Arquitectura e Ingeniería - Fintech Andina S.A.C.',
    },
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Servidor Local de Desarrollo',
    },
  ],
  tags: [
    {
      name: 'Autenticación',
      description: 'Registro e inicio de sesión JWT (ADMIN_SISTEMA, ADMIN_NEGOCIO, CLIENTE)',
    },
    {
      name: 'Tiendas',
      description: 'Administración de tiendas afiliadas y alta/baja (exclusivo ADMIN_SISTEMA)',
    },
    {
      name: 'Créditos',
      description: 'Simulación financiera en tiempo real y emisión de créditos vecinales',
    },
    {
      name: 'Clientes',
      description: 'Gestión de vecinos y emisión de Estados de Cuenta consolidados',
    },
    {
      name: 'Pagos',
      description: 'Liquidación de cuotas, cálculo de mora y aplicación de prelación legal',
    },
    {
      name: 'Reportes',
      description: 'Métricas gerenciales y tablero de control (cartera y TREA ponderada)',
    },
    {
      name: 'Productos',
      description: 'Catálogo de bienes disponibles para compras a crédito',
    },
    {
      name: 'Sistema',
      description: 'Verificación de salud y estado operativo de la API',
    },
  ],
  paths: {
    '/api/auth/register': {
      post: {
        tags: ['Autenticación'],
        summary: 'Registrar nueva tienda en la plataforma',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['ruc', 'direccion', 'email', 'password'],
                properties: {
                  ruc: { type: 'string', example: '20601234567' },
                  razonSocial: { type: 'string', example: 'Bodega El Vecino E.I.R.L.' },
                  nombreComercial: { type: 'string', example: 'Bodega El Vecino' },
                  direccion: { type: 'string', example: 'Jr. Las Magnolias 245, Surco' },
                  telefono: { type: 'string', example: '+51 987654321' },
                  email: { type: 'string', example: 'donlucho@bodegaelvecino.pe' },
                  password: { type: 'string', example: '12345678' },
                  rol: { type: 'string', enum: ['ADMIN_NEGOCIO', 'ADMIN_SISTEMA'], example: 'ADMIN_NEGOCIO' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Tienda registrada y token JWT emitido' },
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Autenticación'],
        summary: 'Iniciar sesión (ADMIN_SISTEMA, ADMIN_NEGOCIO o CLIENTE)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', example: 'donlucho@bodegaelvecino.pe' },
                  password: { type: 'string', example: '12345678' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Autenticación exitosa y registro en Bitácora' },
          401: { description: 'Credenciales inválidas' },
        },
      },
    },
    '/api/auth/login-cliente': {
      post: {
        tags: ['Autenticación'],
        summary: 'Iniciar sesión como Vecino (rol CLIENTE)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['password'],
                properties: {
                  email: { type: 'string', example: 'carlos.quispe@vecino.pe' },
                  numDoc: { type: 'string', example: '10234567' },
                  password: { type: 'string', example: '12345678' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Token JWT de cliente emitido' },
        },
      },
    },
    '/api/tiendas/{id}/estado': {
      patch: {
        tags: ['Tiendas'],
        summary: 'Activar o desactivar una tienda (Exclusivo ADMIN_SISTEMA)',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['estado'],
                properties: {
                  estado: { type: 'string', enum: ['ACTIVO', 'INACTIVO'], example: 'ACTIVO' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Estado de tienda actualizado' },
          403: { description: 'Requiere rol ADMIN_SISTEMA' },
        },
      },
    },
    '/api/creditos/simular': {
      post: {
        tags: ['Créditos'],
        summary: 'Simular cronograma de cuotas y costo efectivo (TCEA / TREA)',
        description:
          'Calcula en memoria el cronograma por el método francés con gracia total, la cuota constante y la TCEA por bisección. **No persiste datos**.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SimularCreditoRequest' },
              examples: {
                caso1_gracia_total: {
                  summary: 'Caso 1 Oficial: S/ 1,500 a 6 cuotas con 30 días de gracia total',
                  value: {
                    precioLista: 1500.0,
                    moneda: 'PEN',
                    tipoTasa: 'Nominal',
                    tasa: 0.36,
                    capitalizacion: 12,
                    modalidad: 'Cuotas',
                    plazoMeses: 6,
                    diasGracia: 30,
                    fCompra: '2026-03-15',
                    diaCorte: 15,
                    diaPago: 25,
                  },
                },
                caso2_sin_gracia: {
                  summary: 'Caso 2 Oficial: US$ 2,000 a 4 cuotas sin gracia',
                  value: {
                    precioLista: 2000.0,
                    moneda: 'USD',
                    tipoTasa: 'Efectiva',
                    tasa: 0.2,
                    modalidad: 'Cuotas',
                    plazoMeses: 4,
                    diasGracia: 0,
                    fCompra: '2026-05-15',
                    diaCorte: 15,
                    diaPago: 15,
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Simulación calculada exitosamente',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SimularCreditoResponse' },
              },
            },
          },
          400: {
            description: 'Parámetros inválidos o fuera de rango',
          },
        },
      },
    },
    '/api/creditos/emitir': {
      post: {
        tags: ['Créditos'],
        summary: 'Emitir un nuevo crédito y persistir cronograma de cuotas',
        description:
          'Verifica la capacidad crediticia del vecino ($K_v + PL \\le L$), valida los topes contra la usura del BCRP, genera el cronograma y persiste el crédito en memoria.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/EmitirCreditoRequest' },
              examples: {
                emision_ejemplo: {
                  summary: 'Emisión para cliente precargado Carlos Quispe',
                  value: {
                    clienteId: '679257ff-1f60-405d-bea0-599de85d9ef0',
                    precioLista: 1500.0,
                    modalidad: 'Cuotas',
                    plazoMeses: 6,
                    diasGracia: 30,
                    fCompra: '2026-03-15',
                    usuario: 'ASESOR_JUAN',
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Crédito emitido y cuotas persistidas exitosamente',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/EmitirCreditoResponse' },
              },
            },
          },
          400: {
            description: 'Límite de crédito excedido o validación regulatoria fallida',
          },
        },
      },
    },
    '/api/creditos': {
      get: {
        tags: ['Créditos'],
        summary: 'Listar todos los créditos emitidos',
        responses: {
          200: {
            description: 'Listado completo de créditos',
          },
        },
      },
    },
    '/api/creditos/{id}': {
      get: {
        tags: ['Créditos'],
        summary: 'Obtener detalle de un crédito con su cronograma de cuotas',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'ID único del crédito',
          },
        ],
        responses: {
          200: {
            description: 'Detalle de crédito y cuotas',
          },
          404: {
            description: 'Crédito no encontrado',
          },
        },
      },
    },
    '/api/clientes': {
      get: {
        tags: ['Clientes'],
        summary: 'Listar todos los clientes registrados',
        description: 'Retorna los vecinos con su límite de crédito, capital vigente y días de corte/pago.',
        responses: {
          200: {
            description: 'Listado de clientes',
          },
        },
      },
      post: {
        tags: ['Clientes'],
        summary: 'Registrar un nuevo cliente (vecino)',
        description: 'Registra un cliente validando que las tasas compensatoria y moratoria no superen los topes BCRP.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CrearClienteRequest' },
              examples: {
                nuevo_vecino: {
                  summary: 'Ejemplo de registro de vecino',
                  value: {
                    nombreCompleto: 'Juan Carlos Mendoza',
                    tipoDoc: 'DNI',
                    numDoc: '47859623',
                    ingresosNetos: 3200.0,
                    moneda: 'PEN',
                    tipoTasa: 'Efectiva',
                    tasa: 0.35,
                    teaMora: 0.25,
                    diaCorte: 15,
                    diaPago: 25,
                    limiteCredito: 2500.0,
                    maxMeses: 12,
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Cliente registrado con éxito',
          },
          400: {
            description: 'Validación regulatoria fallida o campos fuera de rango',
          },
        },
      },
    },
    '/api/clientes/{id}': {
      get: {
        tags: ['Clientes'],
        summary: 'Obtener información de un cliente',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Datos del cliente' },
          404: { description: 'Cliente no encontrado' },
        },
      },
    },
    '/api/clientes/{id}/estado-cuenta': {
      get: {
        tags: ['Clientes'],
        summary: 'Generar Estado de Cuenta consolidado al día de corte (A6)',
        description:
          'Agrupa las cuotas del ciclo actual, calcula intereses compensatorios, liquidación de moras anteriores y el total exigible consolidado.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'ID del cliente',
          },
          {
            name: 'fCorte',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            description: 'Fecha de corte de referencia (YYYY-MM-DD)',
          },
        ],
        responses: {
          200: {
            description: 'Estado de cuenta consolidado',
          },
          404: {
            description: 'Cliente no encontrado',
          },
        },
      },
    },
    '/api/pagos/liquidar': {
      post: {
        tags: ['Pagos'],
        summary: 'Liquidar cuota(s) con cálculo de mora e imputación legal (A7)',
        description:
          'Calcula el interés moratorio ($IM$) según días de atraso ($dm$). **Rechaza pagos parciales** (`montoRecibido < totalExigible`) e imputa en orden legal: 1° Mora, 2° Interés Compensatorio, 3° Capital.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LiquidarPagoRequest' },
              examples: {
                pago_con_mora: {
                  summary: 'Caso 2: Pago de cuota 2 con 10 días de atraso ($IM = 4.45)',
                  value: {
                    clienteId: '24722b03-3a2d-40d5-8d36-78d9aba7de8b',
                    fPago: '2026-06-25',
                    montoRecibido: 523.73,
                    usuario: 'CAJERO_ANA',
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Pago liquidado e imputado exitosamente',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LiquidarPagoResponse' },
              },
            },
          },
          400: {
            description: 'Pago parcial rechazado o saldo insuficiente',
          },
        },
      },
    },
    '/api/pagos/cliente/{clienteId}': {
      get: {
        tags: ['Pagos'],
        summary: 'Historial de pagos de un cliente',
        parameters: [
          {
            name: 'clienteId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Listado de pagos realizados' },
        },
      },
    },
    '/api/reportes/dashboard': {
      get: {
        tags: ['Reportes'],
        summary: 'Dashboard consolidado de métricas de cartera y cobranza',
        description:
          'Proporciona indicadores gerenciales en tiempo real: capital colocado, cartera vigente, cartera en mora, ratio de morosidad y TREA promedio ponderada por volumen.',
        responses: {
          200: {
            description: 'Métricas de dashboard calculadas',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DashboardResponse' },
              },
            },
          },
        },
      },
    },
    '/api/productos': {
      get: {
        tags: ['Productos'],
        summary: 'Listar catálogo de productos disponibles',
        responses: {
          200: { description: 'Catálogo de productos' },
        },
      },
    },
    '/api/health': {
      get: {
        tags: ['Sistema'],
        summary: 'Healthcheck de la API',
        responses: {
          200: { description: 'Servidor operativo y saludable' },
        },
      },
    },
  },
  components: {
    schemas: {
      SimularCreditoRequest: {
        type: 'object',
        required: [
          'precioLista',
          'moneda',
          'tipoTasa',
          'tasa',
          'modalidad',
          'plazoMeses',
          'diaCorte',
          'diaPago',
        ],
        properties: {
          precioLista: { type: 'number', example: 1500.0, description: 'Precio de lista o capital nominal (PL)' },
          precioContado: { type: 'number', example: 1500.0, description: 'Precio al contado para cálculo de TCEA (Pc)' },
          moneda: { type: 'string', enum: ['PEN', 'USD'], example: 'PEN' },
          tipoTasa: { type: 'string', enum: ['Efectiva', 'Nominal'], example: 'Nominal' },
          tasa: { type: 'number', example: 0.36, description: 'Tasa en formato decimal (0.36 = 36%)' },
          capitalizacion: { type: 'integer', example: 12, description: 'm capitalizaciones por año (12 mensual, 360 diaria)' },
          modalidad: { type: 'string', enum: ['Cuotas', 'PagoUnico'], example: 'Cuotas' },
          plazoMeses: { type: 'integer', example: 6, description: 'Número de cuotas n' },
          diasGracia: { type: 'integer', example: 30, description: 'Periodo de gracia total g en días' },
          fCompra: { type: 'string', format: 'date', example: '2026-03-15' },
          diaCorte: { type: 'integer', example: 15, minimum: 1, maximum: 28 },
          diaPago: { type: 'integer', example: 25, minimum: 1, maximum: 28 },
          horaCorte: { type: 'integer', example: 18, default: 18 },
        },
      },
      SimularCreditoResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'success' },
          data: {
            type: 'object',
            properties: {
              precioLista: { type: 'number', example: 1500.0 },
              precioContado: { type: 'number', example: 1500.0 },
              capitalCapitalizado: { type: 'number', example: 1545.0 },
              cuotaReferencial: { type: 'number', example: 285.2 },
              totalInteres: { type: 'number', example: 166.21 },
              totalAmortizacion: { type: 'number', example: 1545.0 },
              totalPagar: { type: 'number', example: 1711.21 },
              tcea: { type: 'number', example: 0.425739 },
              trea: { type: 'number', example: 0.425739 },
              cronograma: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    k: { type: 'integer', example: 1 },
                    fechaVencimiento: { type: 'string', example: '2026-04-25' },
                    saldoInicial: { type: 'number', example: 1545.0 },
                    interes: { type: 'number', example: 46.35 },
                    amortizacion: { type: 'number', example: 238.85 },
                    cuota: { type: 'number', example: 285.2 },
                    saldoFinal: { type: 'number', example: 1306.15 },
                    tK: { type: 'integer', example: 60 },
                  },
                },
              },
            },
          },
        },
      },
      EmitirCreditoRequest: {
        type: 'object',
        required: ['clienteId', 'modalidad'],
        properties: {
          clienteId: { type: 'string', example: '679257ff-1f60-405d-bea0-599de85d9ef0' },
          tiendaId: { type: 'string', description: 'Opcional, por defecto usa la tienda principal' },
          productoId: { type: 'string', description: 'Opcional si se especifica precioLista directo' },
          precioLista: { type: 'number', example: 1500.0 },
          modalidad: { type: 'string', enum: ['Cuotas', 'PagoUnico'], example: 'Cuotas' },
          plazoMeses: { type: 'integer', example: 6 },
          diasGracia: { type: 'integer', example: 30 },
          fCompra: { type: 'string', format: 'date', example: '2026-03-15' },
          usuario: { type: 'string', example: 'ASESOR_JUAN' },
        },
      },
      EmitirCreditoResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'success' },
          data: {
            type: 'object',
            properties: {
              credito: { type: 'object' },
              cuotas: { type: 'array', items: { type: 'object' } },
              nuevoCapitalVigente: { type: 'number', example: 1500.0 },
              lineaDisponible: { type: 'number', example: 1500.0 },
            },
          },
        },
      },
      CrearClienteRequest: {
        type: 'object',
        required: [
          'nombreCompleto',
          'tipoDoc',
          'numDoc',
          'ingresosNetos',
          'moneda',
          'tipoTasa',
          'tasa',
          'teaMora',
          'diaCorte',
          'diaPago',
          'limiteCredito',
          'maxMeses',
        ],
        properties: {
          nombreCompleto: { type: 'string', example: 'Carlos Quispe Mamani' },
          tipoDoc: { type: 'string', enum: ['DNI', 'CE', 'RUC'], example: 'DNI' },
          numDoc: { type: 'string', example: '10234567' },
          ingresosNetos: { type: 'number', example: 2800.0 },
          moneda: { type: 'string', enum: ['PEN', 'USD'], example: 'PEN' },
          tipoTasa: { type: 'string', enum: ['Nominal', 'Efectiva'], example: 'Nominal' },
          tasa: { type: 'number', example: 0.36 },
          capitalizacion: { type: 'integer', example: 12 },
          teaMora: { type: 'number', example: 0.36 },
          diaCorte: { type: 'integer', example: 15 },
          diaPago: { type: 'integer', example: 25 },
          limiteCredito: { type: 'number', example: 3000.0 },
          maxMeses: { type: 'integer', example: 12 },
        },
      },
      LiquidarPagoRequest: {
        type: 'object',
        required: ['clienteId', 'montoRecibido'],
        properties: {
          clienteId: { type: 'string', example: '24722b03-3a2d-40d5-8d36-78d9aba7de8b' },
          cuotaIds: { type: 'array', items: { type: 'string' } },
          fPago: { type: 'string', format: 'date', example: '2026-06-25' },
          montoRecibido: { type: 'number', example: 523.73 },
          usuario: { type: 'string', example: 'CAJERO_ANA' },
        },
      },
      LiquidarPagoResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'success' },
          data: {
            type: 'object',
            properties: {
              pagoRegistrado: {
                type: 'object',
                properties: {
                  totalExigibleBase: { type: 'number', example: 519.28 },
                  totalInteresMoratorio: { type: 'number', example: 4.45 },
                  totalPagado: { type: 'number', example: 523.73 },
                },
              },
              imputacionLegal: {
                type: 'object',
                properties: {
                  moratorio: { type: 'number', example: 4.45 },
                  compensatorio: { type: 'number', example: 23.14 },
                  capital: { type: 'number', example: 496.14 },
                },
              },
              nuevoCapitalVigente: { type: 'number', example: 1503.86 },
              lineaDisponible: { type: 'number', example: 996.14 },
            },
          },
        },
      },
      DashboardResponse: {
        type: 'object',
        properties: {
          resumenCartera: {
            type: 'object',
            properties: {
              totalCapitalColocado: { type: 'number', example: 1500.0 },
              carteraVigenteActiva: { type: 'number', example: 1500.0 },
              carteraVencidaEnMora: { type: 'number', example: 0.0 },
              ratioMorosidadPct: { type: 'number', example: 0.0 },
              treaPromedioPonderadaPct: { type: 'number', example: 42.57 },
            },
          },
          recaudacion: {
            type: 'object',
            properties: {
              totalRecaudado: { type: 'number', example: 523.73 },
              totalCapitalRecuperado: { type: 'number', example: 496.14 },
              totalInteresCompensatorioRecaudado: { type: 'number', example: 23.14 },
              totalInteresMoratorioRecaudado: { type: 'number', example: 4.45 },
            },
          },
          volumenOperativo: {
            type: 'object',
            properties: {
              totalClientes: { type: 'integer', example: 2 },
              totalCreditosEmitidos: { type: 'integer', example: 1 },
              totalCreditosActivos: { type: 'integer', example: 1 },
              totalCuotasEmitidas: { type: 'integer', example: 6 },
              totalCuotasPagadas: { type: 'integer', example: 1 },
            },
          },
        },
      },
    },
  },
};

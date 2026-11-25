-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Tienda" (
    "id_tienda" TEXT NOT NULL,
    "ruc" TEXT NOT NULL,
    "razon_social" TEXT NOT NULL,
    "nombre_comercial" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "telefono" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "rol" TEXT NOT NULL DEFAULT 'ADMIN_NEGOCIO',
    "moneda_defecto" TEXT NOT NULL DEFAULT 'PEN',
    "hora_corte" INTEGER NOT NULL DEFAULT 18,
    "estado" TEXT NOT NULL DEFAULT 'ACTIVO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tienda_pkey" PRIMARY KEY ("id_tienda")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id_cliente" TEXT NOT NULL,
    "id_tienda" TEXT NOT NULL,
    "tipo_doc" TEXT NOT NULL,
    "num_doc" TEXT NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "telefono" TEXT DEFAULT '',
    "direccion" TEXT DEFAULT '',
    "email" TEXT,
    "password_hash" TEXT,
    "ingresos_netos" DECIMAL(12,2) NOT NULL,
    "dia_corte" INTEGER NOT NULL,
    "dia_pago" INTEGER NOT NULL,
    "limite_credito" DECIMAL(12,2) NOT NULL,
    "capital_vigente" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "max_meses" INTEGER NOT NULL,
    "moneda" TEXT NOT NULL,
    "tipo_tasa" TEXT NOT NULL,
    "valor_tasa" DECIMAL(10,7) NOT NULL,
    "capitalizacion" INTEGER NOT NULL DEFAULT 12,
    "tea_mora" DECIMAL(10,7) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id_cliente")
);

-- CreateTable
CREATE TABLE "Producto" (
    "id_producto" TEXT NOT NULL,
    "id_tienda" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "marca" TEXT,
    "descripcion" TEXT,
    "unidad_medida" TEXT,
    "imagen_url" TEXT,
    "precio_contado" DECIMAL(12,2) NOT NULL,
    "precio_lista" DECIMAL(12,2) NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "permite_cuotas" BOOLEAN NOT NULL DEFAULT true,
    "permite_pago_unico" BOOLEAN NOT NULL DEFAULT true,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Producto_pkey" PRIMARY KEY ("id_producto")
);

-- CreateTable
CREATE TABLE "Credito" (
    "id_credito" TEXT NOT NULL,
    "id_tienda" TEXT NOT NULL,
    "id_cliente" TEXT NOT NULL,
    "id_producto" TEXT,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "modalidad" TEXT NOT NULL,
    "plazo_cuotas" INTEGER NOT NULL,
    "fecha_compra" TIMESTAMP(3) NOT NULL,
    "fecha_corte" TIMESTAMP(3) NOT NULL,
    "fecha_primer_pago" TIMESTAMP(3) NOT NULL,
    "fecha_vencimiento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dias_gracia" INTEGER NOT NULL,
    "precio_contado" DECIMAL(12,2) NOT NULL,
    "precio_lista" DECIMAL(12,2) NOT NULL,
    "tipo_tasa" TEXT NOT NULL DEFAULT 'Efectiva',
    "valor_tasa" DECIMAL(10,7) NOT NULL DEFAULT 0,
    "capitalizacion" INTEGER NOT NULL DEFAULT 12,
    "capital_capitalizado" DECIMAL(12,2) NOT NULL,
    "tea_aplicada" DECIMAL(10,7) NOT NULL,
    "tem_aplicada" DECIMAL(10,7) NOT NULL,
    "tea_mora" DECIMAL(10,7) NOT NULL,
    "cuota_referencial" DECIMAL(12,2) NOT NULL,
    "tcea" DECIMAL(10,7) NOT NULL,
    "trea" DECIMAL(10,7) NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'VIGENTE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Credito_pkey" PRIMARY KEY ("id_credito")
);

-- CreateTable
CREATE TABLE "Cuota" (
    "id_cuota" TEXT NOT NULL,
    "id_credito" TEXT NOT NULL,
    "id_cliente" TEXT NOT NULL,
    "nro_cuota" INTEGER NOT NULL,
    "tipo_periodo" TEXT NOT NULL DEFAULT 'Amortizacion',
    "fecha_vencimiento" TIMESTAMP(3) NOT NULL,
    "saldo_inicial" DECIMAL(12,2) NOT NULL,
    "interes" DECIMAL(12,2) NOT NULL,
    "amortizacion" DECIMAL(12,2) NOT NULL,
    "cuota_monto" DECIMAL(12,2) NOT NULL,
    "saldo_final" DECIMAL(12,2) NOT NULL,
    "dias_desde_compra" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "dias_mora" INTEGER NOT NULL DEFAULT 0,
    "interes_moratorio" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_pagado" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "fecha_pago" TIMESTAMP(3),

    CONSTRAINT "Cuota_pkey" PRIMARY KEY ("id_cuota")
);

-- CreateTable
CREATE TABLE "Pago" (
    "id_pago" TEXT NOT NULL,
    "id_cliente" TEXT NOT NULL,
    "id_credito" TEXT NOT NULL,
    "id_cuota" TEXT,
    "fecha_pago" TIMESTAMP(3) NOT NULL,
    "monto_recibido" DECIMAL(12,2) NOT NULL,
    "dias_mora" INTEGER NOT NULL,
    "interes_moratorio" DECIMAL(12,2) NOT NULL,
    "interes_compensatorio" DECIMAL(12,2) NOT NULL,
    "capital_amortizado" DECIMAL(12,2) NOT NULL,
    "metodo_pago" TEXT NOT NULL DEFAULT 'EFECTIVO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("id_pago")
);

-- CreateTable
CREATE TABLE "Bitacora" (
    "id_bitacora" TEXT NOT NULL,
    "id_tienda" TEXT,
    "usuario" TEXT NOT NULL DEFAULT 'SISTEMA',
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL DEFAULT 'SISTEMA',
    "id_entidad" TEXT,
    "detalle" TEXT NOT NULL,
    "fecha_hora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bitacora_pkey" PRIMARY KEY ("id_bitacora")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tienda_ruc_key" ON "Tienda"("ruc");

-- CreateIndex
CREATE UNIQUE INDEX "Tienda_email_key" ON "Tienda"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_email_key" ON "Cliente"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_id_tienda_num_doc_key" ON "Cliente"("id_tienda", "num_doc");

-- CreateIndex
CREATE UNIQUE INDEX "Producto_id_tienda_sku_key" ON "Producto"("id_tienda", "sku");

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_id_tienda_fkey" FOREIGN KEY ("id_tienda") REFERENCES "Tienda"("id_tienda") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_id_tienda_fkey" FOREIGN KEY ("id_tienda") REFERENCES "Tienda"("id_tienda") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credito" ADD CONSTRAINT "Credito_id_tienda_fkey" FOREIGN KEY ("id_tienda") REFERENCES "Tienda"("id_tienda") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credito" ADD CONSTRAINT "Credito_id_cliente_fkey" FOREIGN KEY ("id_cliente") REFERENCES "Cliente"("id_cliente") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credito" ADD CONSTRAINT "Credito_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "Producto"("id_producto") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cuota" ADD CONSTRAINT "Cuota_id_credito_fkey" FOREIGN KEY ("id_credito") REFERENCES "Credito"("id_credito") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cuota" ADD CONSTRAINT "Cuota_id_cliente_fkey" FOREIGN KEY ("id_cliente") REFERENCES "Cliente"("id_cliente") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_id_cliente_fkey" FOREIGN KEY ("id_cliente") REFERENCES "Cliente"("id_cliente") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_id_credito_fkey" FOREIGN KEY ("id_credito") REFERENCES "Credito"("id_credito") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_id_cuota_fkey" FOREIGN KEY ("id_cuota") REFERENCES "Cuota"("id_cuota") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bitacora" ADD CONSTRAINT "Bitacora_id_tienda_fkey" FOREIGN KEY ("id_tienda") REFERENCES "Tienda"("id_tienda") ON DELETE SET NULL ON UPDATE CASCADE;

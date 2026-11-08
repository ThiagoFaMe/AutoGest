"""
Comando idempotente para poblar datos iniciales de Taller Sergio (Córdoba Capital) para el Sprint 1.
Crea los 3 perfiles de usuario (Administrador, Administrativo, Operario), clientes, vehículos y aseguradoras.
"""
from datetime import date, timedelta
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.budgets.models import ItemPresupuesto, Presupuesto
from apps.budgets.services import (
    aprobar_presupuesto_y_crear_ot,
    emitir_presupuesto,
    sync_budget_items,
)
from apps.core.models import Cliente, CompaniaAseguradora, Vehiculo
from apps.users.models import Usuario


class Command(BaseCommand):
    help = "Inicializa únicamente los perfiles de usuario de Taller Sergio (o datos demo si se pasa --demo)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--demo",
            action="store_true",
            help="Carga además los datos de demostración (clientes, vehículos, presupuestos, órdenes, stock y facturas).",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        self.stdout.write("Verificando perfiles de usuario de Taller Sergio...")

        usuarios_demo = [
            {
                "email": "sergio@tallersergio.com.ar",
                "nombre_completo": "Sergio (Titular / Dirección General)",
                "rol": Usuario.Rol.ADMINISTRADOR,
                "password": "AdminSergio2026!",
                "is_staff": True,
                "is_superuser": True,
            },
            {
                "email": "administracion@tallersergio.com.ar",
                "nombre_completo": "Laura Gómez (Administración y Recepción)",
                "rol": Usuario.Rol.ADMINISTRATIVO,
                "password": "AdminLaura2026!",
                "is_staff": False,
                "is_superuser": False,
            },
            {
                "email": "chapa@tallersergio.com.ar",
                "nombre_completo": "Carlos Domínguez (Oficial Chapista)",
                "rol": Usuario.Rol.OPERARIO,
                "password": "TallerChapa2026!",
                "is_staff": False,
                "is_superuser": False,
            },
            {
                "email": "pintura@tallersergio.com.ar",
                "nombre_completo": "Martín Pereyra (Oficial Pintor)",
                "rol": Usuario.Rol.OPERARIO,
                "password": "TallerPintura2026!",
                "is_staff": False,
                "is_superuser": False,
            },
        ]

        for u_data in usuarios_demo:
            pwd = u_data.pop("password")
            user, created = Usuario.objects.get_or_create(
                email=u_data["email"],
                defaults=u_data,
            )
            if created:
                user.set_password(pwd)
                user.save()

        if not options.get("demo"):
            self.stdout.write(
                self.style.SUCCESS(
                    "Usuarios verificados. Omitiendo carga de datos de prueba (sistema limpio)."
                )
            )
            return

        aseguradoras_demo = [
            {
                "razon_social": "Sancor Cooperativa de Seguros Ltda.",
                "cuit": "30-50004946-0",
                "plazo_pago_dias": 30,
                "telefono": "0800-444-2850",
                "email_peritos": "siniestros.cordoba@sancorseguros.com",
            },
            {
                "razon_social": "Federación Patronal Seguros S.A.",
                "cuit": "30-50003196-0",
                "plazo_pago_dias": 45,
                "telefono": "0810-222-3337",
                "email_peritos": "peritajes.cba@fedpat.com.ar",
            },
            {
                "razon_social": "La Segunda Cooperativa Ltda. de Seguros",
                "cuit": "30-50001770-4",
                "plazo_pago_dias": 30,
                "telefono": "0351-421-8800",
                "email_peritos": "inspecciones.cordoba@lasegunda.com.ar",
            },
            {
                "razon_social": "San Cristóbal SMSG",
                "cuit": "30-50004533-3",
                "plazo_pago_dias": 60,
                "telefono": "0810-222-8887",
                "email_peritos": "liquidaciones.cba@sancristobal.com.ar",
            },
        ]

        for aseg in aseguradoras_demo:
            CompaniaAseguradora.objects.get_or_create(
                cuit=aseg["cuit"],
                defaults=aseg,
            )

        clientes_vehiculos_demo = [
            {
                "cliente": {
                    "dni": "32458910",
                    "nombre": "Mariano",
                    "apellido": "Ferreira",
                    "telefono": "351-6124890",
                    "email": "mferreira.cba@gmail.com",
                    "direccion": "Av. Colón 2450, Alberdi, Córdoba",
                },
                "vehiculos": [
                    {
                        "patente": "AF482KL",
                        "marca": "Volkswagen",
                        "modelo": "Amarok V6 Highline",
                        "anio": 2022,
                        "color": "Gris Indium (LR7H)",
                    }
                ],
            },
            {
                "cliente": {
                    "dni": "28910344",
                    "nombre": "Valeria",
                    "apellido": "Ledesma",
                    "telefono": "351-5489012",
                    "email": "valeria.ledesma@hotmail.com",
                    "direccion": "Bv. San Juan 850, Nueva Córdoba",
                },
                "vehiculos": [
                    {
                        "patente": "AE719MP",
                        "marca": "Toyota",
                        "modelo": "Corolla XEI 2.0",
                        "anio": 2021,
                        "color": "Blanco Perlado (070)",
                    }
                ],
            },
            {
                "cliente": {
                    "dni": "38120955",
                    "nombre": "Lucas",
                    "apellido": "Bustos",
                    "telefono": "351-3901122",
                    "email": "lucas.bustos@yahoo.com.ar",
                    "direccion": "Recta Martinolli 6120, Argüello, Córdoba",
                },
                "vehiculos": [
                    {
                        "patente": "NQP842",
                        "marca": "Ford",
                        "modelo": "Focus III SE Plus",
                        "anio": 2014,
                        "color": "Rojo Bari (M7283)",
                    },
                    {
                        "patente": "AD309TR",
                        "marca": "Peugeot",
                        "modelo": "208 Feline 1.6",
                        "anio": 2019,
                        "color": "Azul Quasar (KHK)",
                    },
                ],
            },
        ]

        for item in clientes_vehiculos_demo:
            c_data = item["cliente"]
            cliente, _ = Cliente.objects.get_or_create(
                dni=c_data["dni"],
                defaults=c_data,
            )
            for v_data in item["vehiculos"]:
                Vehiculo.objects.get_or_create(
                    patente=v_data["patente"],
                    defaults={**v_data, "cliente": cliente},
                )

        from apps.budgets.services import build_items_from_taller_forms, recalculate_budget_totals

        # Semilla de Presupuestos y Orden de Trabajo inicial (Sprint 2: HU-005, HU-006, HU-007)
        if Presupuesto.objects.count() == 0:
            v_amarok = Vehiculo.objects.filter(patente="AF482KL").first()
            v_corolla = Vehiculo.objects.filter(patente="AE719MP").first()
            v_focus = Vehiculo.objects.filter(patente="NQP842").first()
            sancor = CompaniaAseguradora.objects.filter(cuit="30-50004946-0").first()
            fed_pat = CompaniaAseguradora.objects.filter(cuit="30-50003196-0").first()

            if v_amarok and sancor:
                # 1) Planilla Aseguradora Aprobada -> Genera OT-2026-001 con sus 8 fases
                p1 = Presupuesto.objects.create(
                    tipo=Presupuesto.Tipo.ASEGURADORA,
                    vehiculo=v_amarok,
                    cliente=v_amarok.cliente,
                    compania=sancor,
                    nro_siniestro="SIN-SANCOR-44890",
                    nombre_perito="Ing. Roberto Sosa",
                    planilla_marcaciones={
                        "PARTE_DELANTERA__Paragolpes": {"C": True, "R": False, "P": True},
                        "PARTE_DELANTERA__Guardabarro Der.": {"C": False, "R": True, "P": True},
                        "LADO_DERECHO__Puerta Delantera": {"C": False, "R": True, "P": True},
                        "LADO_DERECHO__Espejo": {"C": True, "R": False, "P": True},
                    },
                    rubros_importes={
                        "mano_obra": 3200000,
                        "pintura": 0,
                        "mecanica": 0,
                        "electricidad": 0,
                        "tapiceria": 0,
                        "repuestos": 180000,
                        "iva": 0,
                        "incluir_repuestos_en_total": True,
                    },
                    observaciones="Siniestro lateral derecho según planilla con casillas [X].",
                )
                build_items_from_taller_forms(p1)
                recalculate_budget_totals(p1)
                emitir_presupuesto(p1)
                aprobar_presupuesto_y_crear_ot(
                    presupuesto=p1,
                    fecha_estimada_entrega=date.today() + timedelta(days=8),
                    nro_orden_aseguradora="OR-SANCOR-2026-881",
                )

            if v_corolla and fed_pat:
                # 2) Planilla Aseguradora Emitida (A la espera de orden pericial)
                p2 = Presupuesto.objects.create(
                    tipo=Presupuesto.Tipo.ASEGURADORA,
                    vehiculo=v_corolla,
                    cliente=v_corolla.cliente,
                    compania=fed_pat,
                    nro_siniestro="FP-2026-10934",
                    nombre_perito="Téc. Gustavo Almirón",
                    planilla_marcaciones={
                        "PARTE_TRASERA__Paragolpes": {"C": True, "R": False, "P": True},
                        "PARTE_TRASERA__Tapa Baúl/Mol./Port.": {"C": False, "R": True, "P": True},
                        "PARTE_TRASERA__Guardabarro Der.": {"C": False, "R": True, "P": True},
                    },
                    rubros_importes={
                        "mano_obra": 2000000,
                        "pintura": 0,
                        "mecanica": 0,
                        "electricidad": 0,
                        "tapiceria": 0,
                        "repuestos": 2300000,
                        "iva": 0,
                        "incluir_repuestos_en_total": True,
                    },
                    observaciones="Impacto trasero en baúl y paragolpes.",
                )
                build_items_from_taller_forms(p2)
                recalculate_budget_totals(p2)
                emitir_presupuesto(p2)

            if v_focus:
                # 3) Presupuesto Particular / Terceros Emitido (Formato Talonario Libre)
                p3 = Presupuesto.objects.create(
                    tipo=Presupuesto.Tipo.PARTICULAR,
                    vehiculo=v_focus,
                    cliente=v_focus.cliente,
                    detalle_libre=(
                        "Focus III   NQP 842\n"
                        "Puerta Del/Izq Pintar y Colocar.\n"
                        "Lateral Derecho Rep y Pintar.\n"
                        "M/O = $ 800.000\n"
                        "En Efectivo (Billete) $ 720.000"
                    ),
                    rubros_importes={
                        "mano_obra": 800000,
                        "repuestos": 0,
                        "descuento_efectivo_porc": 10,
                        "total_final": 720000,
                    },
                    observaciones="Cotización en talonario para cliente particular con descuento en efectivo.",
                )
                build_items_from_taller_forms(p3)
                recalculate_budget_totals(p3)
                emitir_presupuesto(p3)

        # Semilla de Avance de Fases para Sprint 3 (HU-008 y HU-009)
        from django.utils import timezone
        from apps.workorders.models import FaseReparacion, OrdenDeTrabajo

        u_laura = Usuario.objects.filter(email="administracion@tallersergio.com.ar").first()
        u_carlos = Usuario.objects.filter(email="chapa@tallersergio.com.ar").first()
        u_martin = Usuario.objects.filter(email="pintura@tallersergio.com.ar").first()

        ot1 = OrdenDeTrabajo.objects.order_by("id_orden").first()
        if ot1 and ot1.fases.filter(estado="completada").count() == 0:
            now = timezone.now()
            f1 = ot1.fases.filter(numero_secuencia=1).first()
            f2 = ot1.fases.filter(numero_secuencia=2).first()
            f3 = ot1.fases.filter(numero_secuencia=3).first()
            f4 = ot1.fases.filter(numero_secuencia=4).first()
            if f1 and f2 and f3 and f4:
                f1.estado = FaseReparacion.EstadoFase.COMPLETADA
                f1.fecha_inicio = now - timedelta(days=3, hours=6)
                f1.fecha_fin = now - timedelta(days=3, hours=4)
                f1.usuario_responsable = u_laura
                f1.observaciones = "Recepción de unidad y verificación de guardabarros enviado por Sancor."
                f1.save()

                f2.estado = FaseReparacion.EstadoFase.COMPLETADA
                f2.fecha_inicio = now - timedelta(days=3, hours=4)
                f2.fecha_fin = now - timedelta(days=2, hours=5)
                f2.usuario_responsable = u_carlos
                f2.observaciones = "Desmontaje de paragolpes, óptica derecha y panel interior de puerta."
                f2.save()

                f3.estado = FaseReparacion.EstadoFase.COMPLETADA
                f3.fecha_inicio = now - timedelta(days=2, hours=5)
                f3.fecha_fin = now - timedelta(days=1, hours=2)
                f3.usuario_responsable = u_carlos
                f3.observaciones = "Reemplazo de guardabarros y escuadrado de holguras de puerta."
                f3.save()

                f4.estado = FaseReparacion.EstadoFase.EN_CURSO
                f4.fecha_inicio = now - timedelta(days=1, hours=2)
                f4.usuario_responsable = u_martin
                f4.observaciones = "Enmasillado poliéster y lijado escalonado en sector Pintura."
                f4.save()

                ot1.estado_actual = f4.nombre_fase
                ot1.save(update_fields=["estado_actual"])

        # Segunda Orden de Trabajo con alerta de demora activa para demostrar HU-009 Criterio 2
        v_208 = Vehiculo.objects.filter(patente="AD309TR").first()
        ot2 = OrdenDeTrabajo.objects.filter(vehiculo__patente="AD309TR").first()
        if v_208 and OrdenDeTrabajo.objects.count() < 2:
            p4 = Presupuesto.objects.create(
                tipo=Presupuesto.Tipo.PARTICULAR,
                vehiculo=v_208,
                cliente=v_208.cliente,
                detalle_libre=(
                    "Peugeot 208   AD 309 TR\n"
                    "Portón trasero y paragolpes Rep y Pintar.\n"
                    "M/O = $ 650.000"
                ),
                rubros_importes={"mano_obra": 650000, "total_final": 650000},
                observaciones="Reparación particular de portón trasero.",
            )
            build_items_from_taller_forms(p4)
            recalculate_budget_totals(p4)
            emitir_presupuesto(p4)
            ot2 = aprobar_presupuesto_y_crear_ot(
                presupuesto=p4,
                fecha_ingreso=date.today() - timedelta(days=9),
                fecha_estimada_entrega=date.today() - timedelta(days=2),
            )
            now = timezone.now()
            for seq, hrs_ago_start, hrs_ago_end, resp, obs in [
                (1, 190, 185, u_laura, "Unidad ingresada al taller."),
                (2, 185, 160, u_carlos, "Desarme de portón trasero y faros."),
                (3, 160, 110, u_carlos, "Desabolladura de panel de cola."),
                (4, 110, 60, u_martin, "Imprimación aparejo alto sólido."),
            ]:
                f = ot2.fases.filter(numero_secuencia=seq).first()
                if f:
                    f.estado = FaseReparacion.EstadoFase.COMPLETADA
                    f.fecha_inicio = now - timedelta(hours=hrs_ago_start)
                    f.fecha_fin = now - timedelta(hours=hrs_ago_end)
                    f.usuario_responsable = resp
                    f.observaciones = obs
                    f.save()
            f5 = ot2.fases.filter(numero_secuencia=5).first()
            if f5:
                f5.estado = FaseReparacion.EstadoFase.EN_CURSO
                f5.fecha_inicio = now - timedelta(hours=60)
                f5.usuario_responsable = u_martin
                f5.observaciones = "Aplicación de base Azul Quasar (KHK) y barniz en cabina."
                f5.save()
                ot2.estado_actual = f5.nombre_fase
                ot2.save(update_fields=["estado_actual"])

        # Semilla de Inventario de Pañol y Consumos por OT para Sprint 4 (HU-010, HU-011 y HU-012)
        from apps.inventory.models import InsumoRepuesto, MovimientoStock
        from apps.inventory.services import registrar_consumo_ot, registrar_ingreso_stock

        insumos_demo = [
            {
                "codigo": "INS-001",
                "nombre": "Barniz Poliuretánico Alto Sólido 2K Glasurit",
                "categoria": InsumoRepuesto.Categoria.PINTURA,
                "unidad_medida": InsumoRepuesto.UnidadMedida.LITROS,
                "stock_actual": Decimal("6.00"),
                "stock_minimo": Decimal("4.00"),
                "costo_unitario": Decimal("38500.00"),
            },
            {
                "codigo": "INS-002",
                "nombre": "Primer Aparejo Poliuretánico Gris 2K",
                "categoria": InsumoRepuesto.Categoria.PREPARACION,
                "unidad_medida": InsumoRepuesto.UnidadMedida.LITROS,
                "stock_actual": Decimal("2.00"),
                "stock_minimo": Decimal("3.00"),
                "costo_unitario": Decimal("24000.00"),
            },
            {
                "codigo": "INS-003",
                "nombre": "Masilla Poliéster Ultraliviana Roberlo",
                "categoria": InsumoRepuesto.Categoria.PREPARACION,
                "unidad_medida": InsumoRepuesto.UnidadMedida.KILOGRAMOS,
                "stock_actual": Decimal("1.50"),
                "stock_minimo": Decimal("2.00"),
                "costo_unitario": Decimal("16800.00"),
            },
            {
                "codigo": "INS-004",
                "nombre": "Discos Abrasivos Lija Seco P320 (Caja x 50u)",
                "categoria": InsumoRepuesto.Categoria.ABRASIVOS,
                "unidad_medida": InsumoRepuesto.UnidadMedida.UNIDADES,
                "stock_actual": Decimal("45.00"),
                "stock_minimo": Decimal("15.00"),
                "costo_unitario": Decimal("950.00"),
            },
            {
                "codigo": "INS-005",
                "nombre": "Base Bicapa Colorimétrica Gris Indium (LR7H)",
                "categoria": InsumoRepuesto.Categoria.PINTURA,
                "unidad_medida": InsumoRepuesto.UnidadMedida.LITROS,
                "stock_actual": Decimal("3.50"),
                "stock_minimo": Decimal("1.50"),
                "costo_unitario": Decimal("46000.00"),
            },
            {
                "codigo": "REP-101",
                "nombre": "Paragolpes Delantero VW Amarok V6 Original",
                "categoria": InsumoRepuesto.Categoria.AUTOPARTES,
                "unidad_medida": InsumoRepuesto.UnidadMedida.UNIDADES,
                "stock_actual": Decimal("1.00"),
                "stock_minimo": Decimal("0.00"),
                "costo_unitario": Decimal("420000.00"),
            },
        ]

        for ins_data in insumos_demo:
            InsumoRepuesto.objects.get_or_create(
                codigo=ins_data["codigo"],
                defaults=ins_data,
            )

        if MovimientoStock.objects.count() == 0 and ot1 and u_laura and u_martin:
            barniz = InsumoRepuesto.objects.filter(codigo="INS-001").first()
            primer = InsumoRepuesto.objects.filter(codigo="INS-002").first()
            masilla = InsumoRepuesto.objects.filter(codigo="INS-003").first()
            lijas = InsumoRepuesto.objects.filter(codigo="INS-004").first()

            if barniz:
                registrar_ingreso_stock(
                    insumo=barniz,
                    cantidad=Decimal("4.00"),
                    costo_unitario=Decimal("38500.00"),
                    remito_comprobante="REM-0008-00412 Pinturerías Córdoba",
                    usuario=u_laura,
                )
            if masilla:
                registrar_consumo_ot(
                    insumo=masilla,
                    orden=ot1,
                    cantidad=Decimal("0.50"),
                    usuario=u_martin,
                    observacion_comprobante="Masillado puerta y guardabarros derecho",
                )
            if lijas:
                registrar_consumo_ot(
                    insumo=lijas,
                    orden=ot1,
                    cantidad=Decimal("8.00"),
                    usuario=u_martin,
                    observacion_comprobante="Lijado de preparación de superficie",
                )
            if primer and ot2:
                registrar_consumo_ot(
                    insumo=primer,
                    orden=ot2,
                    cantidad=Decimal("0.50"),
                    usuario=u_martin,
                    observacion_comprobante="Imprimación portón trasero Peugeot 208",
                )

        # Semilla de Cuentas por Cobrar, Flujo de Caja y KPIs para Sprint 5 (HU-013 y HU-014)
        from apps.finance.models import CuentaPorCobrar, MovimientoFinanciero
        from apps.finance.services import (
            emitir_factura_cuenta_por_cobrar,
            registrar_movimiento_financiero,
        )

        if CuentaPorCobrar.objects.count() == 0 and ot1 and u_laura:
            # 1) Factura de OT-2026-001 (Sancor Seguros - emitida hace 42 días -> vencida hace 12 días -> EN MORA)
            c1 = emitir_factura_cuenta_por_cobrar(
                orden=ot1,
                nro_factura="FAC-A-0001-00148",
                fecha_emision=date.today() - timedelta(days=42),
                monto_facturado=ot1.monto_total,
            )
            # Imputamos un pago parcial a cuenta de Sancor para demostrar saldo pendiente en mora
            registrar_movimiento_financiero(
                tipo=MovimientoFinanciero.TipoFlujo.INGRESO,
                categoria="Liquidación Aseguradora",
                concepto="Anticipo transferencia Sancor Factura FAC-A-0001-00148",
                monto=Decimal("1380000.00"),
                medio_pago=MovimientoFinanciero.MedioPago.TRANSFERENCIA,
                usuario=u_laura,
                fecha=date.today() - timedelta(days=15),
                cuenta=c1,
            )

            # 2) Segunda factura en plazo (emitida hace 5 días)
            if ot2:
                c2 = emitir_factura_cuenta_por_cobrar(
                    orden=ot2,
                    nro_factura="FAC-B-0001-00319",
                    fecha_emision=date.today() - timedelta(days=5),
                    monto_facturado=ot2.monto_total,
                )
                registrar_movimiento_financiero(
                    tipo=MovimientoFinanciero.TipoFlujo.INGRESO,
                    categoria="Cobro Particular",
                    concepto="Seña efectivo reparación Peugeot 208 (AD309TR)",
                    monto=Decimal("300000.00"),
                    medio_pago=MovimientoFinanciero.MedioPago.EFECTIVO,
                    usuario=u_laura,
                    fecha=date.today() - timedelta(days=4),
                    cuenta=c2,
                )

            # 3) Egresos de compras de insumos y servicios operativos (HU-014 Criterio 2)
            registrar_movimiento_financiero(
                tipo=MovimientoFinanciero.TipoFlujo.EGRESO,
                categoria="Compra Insumos",
                concepto="Pago Remito REM-0008-00412 Pinturerías Córdoba (Barniz y Primer)",
                monto=Decimal("245000.00"),
                medio_pago=MovimientoFinanciero.MedioPago.TRANSFERENCIA,
                usuario=u_laura,
                fecha=date.today() - timedelta(days=6),
            )
            registrar_movimiento_financiero(
                tipo=MovimientoFinanciero.TipoFlujo.EGRESO,
                categoria="Gasto Operativo",
                concepto="Factura EPEC Energía Trifásica Cabina de Pintura y Compresor",
                monto=Decimal("185000.00"),
                medio_pago=MovimientoFinanciero.MedioPago.TRANSFERENCIA,
                usuario=u_laura,
                fecha=date.today() - timedelta(days=2),
            )

        # Semilla de Turnos del Calendario de Ingresos al Taller
        from apps.workorders.models import TurnoTaller

        if TurnoTaller.objects.count() == 0:
            v_corolla = Vehiculo.objects.filter(patente="AE719MP").first()
            v_focus = Vehiculo.objects.filter(patente="NQP842").first()
            fed_pat = CompaniaAseguradora.objects.filter(cuit="30-50003196-0").first()

            TurnoTaller.objects.create(
                fecha_turno=date.today() + timedelta(days=1),
                hora_turno="09:00",
                tipo_turno=TurnoTaller.TipoTurno.INGRESO_REPARACION,
                estado=TurnoTaller.EstadoTurno.PROGRAMADO,
                vehiculo=v_corolla,
                compania=fed_pat,
                motivo_observaciones="Ingreso a planta para cambio de paragolpes trasero y reparación de baúl (Federación Patronal).",
            )
            TurnoTaller.objects.create(
                fecha_turno=date.today() + timedelta(days=2),
                hora_turno="10:30",
                tipo_turno=TurnoTaller.TipoTurno.INGRESO_REPARACION,
                estado=TurnoTaller.EstadoTurno.PROGRAMADO,
                vehiculo=v_focus,
                motivo_observaciones="Ingreso particular Focus III (pintar puerta delantera izquierda y lateral derecho).",
            )
            TurnoTaller.objects.create(
                fecha_turno=date.today() + timedelta(days=4),
                hora_turno="15:00",
                tipo_turno=TurnoTaller.TipoTurno.PERITAJE_SEGURO,
                estado=TurnoTaller.EstadoTurno.PROGRAMADO,
                cliente_nombre_libre="Gómez, Hernán",
                telefono_contacto="351-6891234",
                patente_referencia="AG120KL",
                vehiculo_referencia="Chevrolet Cruze LTZ Blanco",
                compania=fed_pat,
                motivo_observaciones="Visita del perito Téc. Gustavo Almirón para inspección de choque frontal.",
            )

        self.stdout.write(
            self.style.SUCCESS(
                "Semilla integral de Sprints 1, 2, 3, 4 y 5 aplicada exitosamente."
            )
        )

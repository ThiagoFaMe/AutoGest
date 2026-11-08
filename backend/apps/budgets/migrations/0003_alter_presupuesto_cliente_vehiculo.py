from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0001_initial"),
        ("budgets", "0002_presupuesto_detalle_libre_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="presupuesto",
            name="cliente",
            field=models.ForeignKey(
                blank=True,
                db_column="id_cliente",
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="presupuestos",
                to="core.cliente",
            ),
        ),
        migrations.AlterField(
            model_name="presupuesto",
            name="vehiculo",
            field=models.ForeignKey(
                blank=True,
                db_column="id_vehiculo",
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="presupuestos",
                to="core.vehiculo",
            ),
        ),
    ]

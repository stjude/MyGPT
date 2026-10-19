from django.db import migrations, models
from django.db.models import Count


def deduplicate_embedding_model_names(apps, schema_editor):
    EmbeddingModel = apps.get_model('testdb', 'EmbeddingModel')
    database = schema_editor.connection.alias
    duplicate_names = list(
        EmbeddingModel.objects.using(database)
        .values('model_name')
        .annotate(total=Count('pk'))
        .filter(total__gt=1)
    )
    distance_fields = (
        'best_distance_q',
        'worst_distance_q',
        'best_distance_ac',
        'worst_distance_ac',
        'best_distance_nac',
        'worst_distance_nac',
    )

    for duplicate in duplicate_names:
        records = list(
            EmbeddingModel.objects.using(database)
            .filter(model_name=duplicate['model_name'])
            .order_by('pk')
        )
        keeper = records[0]
        changed_fields = []
        for record in records[1:]:
            if keeper.model_size in ('', '-') and record.model_size not in ('', '-'):
                keeper.model_size = record.model_size
                changed_fields.append('model_size')
            for field in distance_fields:
                if getattr(keeper, field) == 0 and getattr(record, field) != 0:
                    setattr(keeper, field, getattr(record, field))
                    changed_fields.append(field)
            record.delete(using=database)
        if changed_fields:
            keeper.save(using=database, update_fields=list(dict.fromkeys(changed_fields)))


class Migration(migrations.Migration):

    dependencies = [
        ('testdb', '0058_model_unique_model_name'),
    ]

    operations = [
        migrations.RunPython(deduplicate_embedding_model_names, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='embeddingmodel',
            name='model_name',
            field=models.CharField(default='-', max_length=200, unique=True),
        ),
    ]

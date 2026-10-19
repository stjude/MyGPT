from django.db import migrations, models
from django.db.models import Count


def deduplicate_model_names(apps, schema_editor):
    Model = apps.get_model('testdb', 'Model')
    Question = apps.get_model('testdb', 'Question')
    Answer = apps.get_model('testdb', 'Answer')
    database = schema_editor.connection.alias
    duplicate_names = list(
        Model.objects.using(database)
        .values('model_name')
        .annotate(total=Count('pk'))
        .filter(total__gt=1)
    )

    for duplicate in duplicate_names:
        records = list(
            Model.objects.using(database)
            .filter(model_name=duplicate['model_name'])
            .order_by('pk')
        )
        keeper = records[0]
        changed = False
        for record in records[1:]:
            if keeper.model_size in ('', '-') and record.model_size not in ('', '-'):
                keeper.model_size = record.model_size
                changed = True
            Question.objects.using(database).filter(model_type_id=record.pk).update(model_type_id=keeper.pk)
            Answer.objects.using(database).filter(model_type_id=record.pk).update(model_type_id=keeper.pk)
            record.delete(using=database)
        if changed:
            keeper.save(using=database, update_fields=['model_size'])


class Migration(migrations.Migration):

    dependencies = [
        ('testdb', '0057_dataset_library_type\u200e'),
    ]

    operations = [
        migrations.RunPython(deduplicate_model_names, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='model',
            name='model_name',
            field=models.CharField(default='-', max_length=200, unique=True),
        ),
    ]

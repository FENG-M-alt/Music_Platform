from django.core.management.base import BaseCommand
from django.conf import settings
from music.models import Music
import os

class Command(BaseCommand):
    help = 'Preview or fix Music.file_path values by resolving them against MEDIA_ROOT and common Windows path issues.'

    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true', help='Apply fixes to the database (default is dry-run).')
        parser.add_argument('--limit', type=int, default=0, help='Limit number of records to process (0 = all).')

    def handle(self, *args, **options):
        apply_changes = options['apply']
        limit = options['limit']

        medias = Music.objects.all().order_by('id')
        if limit > 0:
            medias = medias[:limit]

        total = 0
        fixed = 0
        unchanged = 0
        not_found = 0
        candidates = []

        media_root = getattr(settings, 'MEDIA_ROOT', '') or ''

        for m in medias:
            total += 1
            original = m.file_path or ''
            resolved = None

            if not original:
                not_found += 1
                self.stdout.write(f"#{m.id}: empty file_path")
                continue

            # If path exists as-is, keep
            if os.path.exists(original):
                unchanged += 1
                self.stdout.write(f"#{m.id}: OK (exists): {original}")
                continue

            # Try as relative to MEDIA_ROOT
            if media_root:
                candidate = os.path.join(media_root, original)
                if os.path.exists(candidate):
                    resolved = os.path.abspath(candidate)

            # Try basename in MEDIA_ROOT
            if not resolved and media_root:
                basename = os.path.basename(original)
                candidate = os.path.join(media_root, basename)
                if os.path.exists(candidate):
                    resolved = os.path.abspath(candidate)

            # Try fixing Windows/Unix mixed formats
            if not resolved:
                path = original
                # replace forward/back slashes
                alt = path.replace('\\', '/')
                if alt.startswith('/') and ':' in alt:
                    # e.g. /D:/music/xxx -> D:/music/xxx
                    if len(alt) >= 3:
                        drive = alt[1:3]
                        rest = alt[3:]
                        candidate = f"{drive}{rest}"
                        if os.path.exists(candidate):
                            resolved = os.path.abspath(candidate)
                # try swapping slashes
                if not resolved:
                    candidate = path.replace('/', os.sep).replace('\\', os.sep)
                    if os.path.exists(candidate):
                        resolved = os.path.abspath(candidate)

            # Last resort: try common root drives
            if not resolved and os.name == 'nt' and ':' not in original:
                for drive in ['D:', 'C:']:
                    candidate = os.path.join(drive + os.sep, original.lstrip('\\/'))
                    if os.path.exists(candidate):
                        resolved = os.path.abspath(candidate)
                        break

            if resolved:
                candidates.append((m.id, original, resolved))
                self.stdout.write(f"#{m.id}: will fix -> {resolved}")
                if apply_changes:
                    m.file_path = resolved
                    m.save()
                    fixed += 1
            else:
                not_found += 1
                self.stdout.write(f"#{m.id}: NOT FOUND (tried MEDIA_ROOT and common fixes): {original}")

        # Summary
        self.stdout.write('\nSummary:')
        self.stdout.write(f'  Total scanned: {total}')
        self.stdout.write(f'  Unchanged (exists): {unchanged}')
        self.stdout.write(f'  Fixed (applied): {fixed}')
        self.stdout.write(f'  Not found / empty: {not_found}')
        self.stdout.write('\nRun with `--apply` to persist fixes (or `--limit N` to restrict).')

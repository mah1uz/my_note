import secrets
import string

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from accounts.models import AdminAuditEvent, AdminProfile

ALPHABET = string.ascii_letters + string.digits + '!@#$%^&*-_+=?'


class Command(BaseCommand):
    help = (
        'Create admin accounts (first is SUPER_ADMIN, rest ADMIN) with random '
        'passwords printed once. Save them immediately; they are never stored.'
    )

    def add_arguments(self, parser):
        parser.add_argument('--count', type=int, default=5)
        parser.add_argument('--prefix', type=str, default='admin')
        parser.add_argument('--reset', action='store_true',
                            help='Reset passwords for existing seeded admins and show them once.')

    @transaction.atomic
    def handle(self, *args, **options):
        user_model = get_user_model()
        created = []
        for index in range(1, int(options['count']) + 1):
            username = f"{options['prefix']}{index}" if int(options['count']) > 1 else options['prefix']
            user, user_created = user_model.objects.get_or_create(
                username=username,
                defaults={'email': f'{username}@rememberly.local', 'is_staff': True},
            )
            role = AdminProfile.Role.SUPER_ADMIN if index == 1 else AdminProfile.Role.ADMIN
            if user_created or options['reset']:
                password = ''.join(secrets.choice(ALPHABET) for _ in range(20))
                user.set_password(password)
                user.is_staff = True
                user.is_superuser = role == AdminProfile.Role.SUPER_ADMIN
                user.save()
            else:
                password = None
            profile, _ = AdminProfile.objects.get_or_create(
                django_user=user, defaults={'role': role, 'is_active': True},
            )
            AdminAuditEvent.objects.create(
                action='admin.seeded', actor_admin=None, target_admin=profile,
                metadata={'username': username, 'role': profile.role, 'source': 'seed_admins'},
            )
            created.append((username, profile.role, password))
        self.stdout.write('Admin accounts (passwords shown once — save them now):')
        for username, role, password in created:
            if password:
                self.stdout.write(f'  {username} [{role}]: {password}')
            else:
                self.stdout.write(f'  {username} [{role}]: already existed, password unchanged')

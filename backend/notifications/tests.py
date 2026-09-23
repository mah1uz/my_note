from calendar import monthrange
from datetime import date, timedelta
from decimal import Decimal

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import AppUser, SystemSetting
from finance.models import FinanceTransaction
from notes.models import Note, NoteItem

from .models import Notification


def task(user, title='EM Quiz', due_date=None, due_datetime=None, task_status='PENDING'):
    note = Note.objects.create(app_user=user, raw_text=title)
    return NoteItem.objects.create(
        note=note, item_type='TASK', title=title, is_confirmed=True,
        status=task_status, due_date=due_date, due_datetime=due_datetime,
    )


def spend(user, amount, day, currency='BDT'):
    return FinanceTransaction.objects.create(
        user=user, direction='DEBIT', amount=Decimal(str(amount)), currency=currency,
        label='Spend', transaction_at=f'{day.isoformat()}T12:00:00+06:00',
    )


def month_days(today, offset):
    month = today.month + offset
    year = today.year + (month - 1) // 12
    month = (month - 1) % 12 + 1
    first = date(year, month, 1)
    return first, first.replace(day=monthrange(year, month)[1])


class NotificationApiTests(APITestCase):
    def setUp(self):
        self.user = AppUser.objects.create(email='notify@example.com')
        self.other = AppUser.objects.create(email='other-notify@example.com')
        self.client.force_authenticate(self.user)
        self.url = '/api/v1/notifications/'

    def test_due_task_creates_exactly_one_row_across_polls(self):
        item = task(self.user, due_date=date.today() + timedelta(days=1))
        first = self.client.get(self.url)
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(len(first.data), 1)
        self.assertEqual(first.data[0]['type'], 'TASK_DUE_SOON')
        self.assertFalse(first.data[0]['read'])
        self.assertIn(item.title, first.data[0]['title'])
        second = self.client.get(self.url)
        self.assertEqual(len(second.data), 1)
        self.assertEqual(Notification.objects.filter(user=self.user).count(), 1)

    def test_completed_far_and_deleted_tasks_stay_silent(self):
        task(self.user, 'Done', due_date=date.today() + timedelta(days=1), task_status='COMPLETED')
        task(self.user, 'Far', due_date=date.today() + timedelta(days=9))
        note = Note.objects.create(app_user=self.user, raw_text='Gone')
        gone = NoteItem.objects.create(note=note, item_type='TASK', title='Gone', is_confirmed=True, due_date=date.today())
        note.delete()
        self.assertEqual(self.client.get(self.url).data, [])
        self.assertFalse(NoteItem.objects.filter(pk=gone.pk).exists())

    def test_changed_due_date_retires_stale_unread_row(self):
        item = task(self.user, due_date=date.today() + timedelta(days=1))
        self.assertEqual(len(self.client.get(self.url).data), 1)
        item.due_date = date.today() + timedelta(days=2)
        item.save(update_fields=('due_date', 'updated_at'))
        rows = self.client.get(self.url).data
        self.assertEqual(len(rows), 1)
        self.assertEqual(Notification.objects.filter(user=self.user).count(), 1)

    def test_read_and_read_all_are_owner_scoped(self):
        task(self.user, due_date=date.today() + timedelta(days=1))
        row = self.client.get(self.url).data[0]
        other_item = task(self.other, due_date=date.today() + timedelta(days=1))
        self.client.force_authenticate(self.other)
        other_rows = self.client.get(self.url).data
        self.assertEqual(len(other_rows), 1)
        self.assertNotEqual(other_rows[0]['id'], row['id'])
        self.assertEqual(
            self.client.post(f"/api/v1/notifications/{row['id']}/read/").status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.client.force_authenticate(self.user)
        read = self.client.post(f"/api/v1/notifications/{row['id']}/read/")
        self.assertTrue(read.data['read'])
        self.assertIsNotNone(read.data['read_at'])
        task(self.user, 'Second', due_date=date.today() + timedelta(days=1))
        self.assertEqual(len(self.client.get(self.url).data), 2)
        marked = self.client.post('/api/v1/notifications/read-all/')
        self.assertEqual(marked.data['marked_read'], 1)
        self.assertFalse(any(not row['read'] for row in self.client.get(self.url).data))
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_completion_fires_once_per_transition(self):
        item = task(self.user, 'Shampoo')
        revision = item.note.revision
        first = self.client.patch(
            f'/api/v1/items/{item.pk}/', {'revision': revision, 'status': 'COMPLETED'}, format='json',
        )
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        rows = [row for row in self.client.get(self.url).data if row['type'] == 'TASK_COMPLETED']
        self.assertEqual(len(rows), 1)
        # Saving again without a transition must not duplicate.
        item.refresh_from_db()
        again = self.client.patch(
            f'/api/v1/items/{item.pk}/',
            {'revision': item.note.revision, 'title': 'Shampoo plus'}, format='json',
        )
        self.assertEqual(again.status_code, status.HTTP_200_OK)
        rows = [row for row in self.client.get(self.url).data if row['type'] == 'TASK_COMPLETED']
        self.assertEqual(len(rows), 1)
        # Reopen then complete again: a new transition, a new row.
        item.refresh_from_db()
        self.client.patch(
            f'/api/v1/items/{item.pk}/',
            {'revision': item.note.revision, 'status': 'PENDING'}, format='json',
        )
        item.refresh_from_db()
        self.client.patch(
            f'/api/v1/items/{item.pk}/',
            {'revision': item.note.revision, 'status': 'COMPLETED'}, format='json',
        )
        rows = [row for row in self.client.get(self.url).data if row['type'] == 'TASK_COMPLETED']
        self.assertEqual(len(rows), 2)

    def test_expense_increase_above_threshold_fires_once(self):
        today = timezone.localdate()
        prev_from, _ = month_days(today, -1)
        this_from, _ = month_days(today, 0)
        spend(self.user, 100, prev_from + timedelta(days=5))
        spend(self.user, 120, this_from + timedelta(days=3))
        rows = self.client.get(self.url).data
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['type'], 'EXPENSE_INCREASED')
        self.assertIn('20%', rows[0]['message'])
        self.assertEqual(len(self.client.get(self.url).data), 1)

    def test_expense_below_threshold_equal_and_zero_stay_silent(self):
        today = timezone.localdate()
        prev_from, _ = month_days(today, -1)
        this_from, _ = month_days(today, 0)
        spend(self.user, 100, prev_from + timedelta(days=5))
        spend(self.user, 110, this_from + timedelta(days=3))
        self.assertEqual(self.client.get(self.url).data, [])

    def test_expense_zero_baseline_reports_amount_not_percentage(self):
        today = timezone.localdate()
        this_from, _ = month_days(today, 0)
        spend(self.user, 500, this_from + timedelta(days=3))
        rows = self.client.get(self.url).data
        self.assertEqual(len(rows), 1)
        self.assertIn('500', rows[0]['message'])
        self.assertNotIn('%', rows[0]['message'])
        self.assertIn('no recorded spending', rows[0]['message'])

    def test_expense_currencies_never_mix_and_threshold_is_configurable(self):
        today = timezone.localdate()
        prev_from, _ = month_days(today, -1)
        this_from, _ = month_days(today, 0)
        spend(self.user, 100, prev_from + timedelta(days=5), currency='BDT')
        spend(self.user, 120, this_from + timedelta(days=3), currency='BDT')
        rows = self.client.get(self.url).data
        self.assertEqual(len(rows), 1)
        self.assertIn('20%', rows[0]['message'])
        # A raised threshold silences the same 20% increase on re-evaluation.
        SystemSetting.objects.create(key='expense_mom_threshold_pct', value=50)
        Notification.objects.all().delete()
        self.assertEqual(self.client.get(self.url).data, [])
        # ...while a different currency is still judged on its own baseline.
        spend(self.user, 120, this_from + timedelta(days=4), currency='USD')
        rows = self.client.get(self.url).data
        self.assertEqual(len(rows), 1)
        self.assertIn('USD', rows[0]['message'])
        self.assertNotIn('%', rows[0]['message'])

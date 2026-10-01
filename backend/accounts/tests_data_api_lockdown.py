from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase

from . import apps


class DataApiLockdownTests(SimpleTestCase):
    def _connections(self, vendor):
        connection = MagicMock(vendor=vendor)
        return connection, {'default': connection}

    def test_skipped_on_sqlite(self):
        connection, registry = self._connections('sqlite')
        with patch.object(apps, 'connections', registry):
            apps.lock_down_data_api(using='default')
        connection.cursor.assert_not_called()

    def test_runs_on_postgresql(self):
        connection, registry = self._connections('postgresql')
        with patch.object(apps, 'connections', registry):
            apps.lock_down_data_api(using='default')
        cursor = connection.cursor.return_value.__enter__.return_value
        cursor.execute.assert_called_once_with(apps.LOCK_DOWN_DATA_API_SQL)

    def test_sql_enables_rls_and_revokes_api_roles(self):
        sql = apps.LOCK_DOWN_DATA_API_SQL
        self.assertIn('ENABLE ROW LEVEL SECURITY', sql)
        for role in ("'anon'", "'authenticated'"):
            self.assertIn(role, sql)
        self.assertIn('REVOKE ALL ON ALL TABLES', sql)
        self.assertIn('ALTER DEFAULT PRIVILEGES', sql)

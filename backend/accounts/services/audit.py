import hashlib

from accounts.models import AdminAuditEvent


def _ip_hash(request):
    if request is None:
        return ''
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR', '')
    ip = (forwarded.split(',')[0] if forwarded else request.META.get('REMOTE_ADDR', '')).strip()
    if not ip:
        return ''
    return hashlib.sha256(ip.encode('utf-8')).hexdigest()


def log_admin_action(action, request=None, actor=None, target_user=None, target_admin=None, reason='', metadata=None):
    return AdminAuditEvent.objects.create(
        action=action,
        actor_admin=actor,
        target_user=target_user,
        target_admin=target_admin,
        reason=(reason or '')[:500],
        metadata=dict(metadata or {}),
        ip_hash=_ip_hash(request),
    )

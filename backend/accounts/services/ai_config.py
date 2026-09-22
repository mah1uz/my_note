from accounts.models import SystemSetting

SERVER_AI_ENABLED_KEY = 'server_ai_enabled'


def get_server_ai_enabled():
    """Whether the shared server Groq key may be used (free trial). Defaults to on."""
    setting = SystemSetting.objects.filter(key=SERVER_AI_ENABLED_KEY).first()
    if setting is None:
        return True
    return bool(setting.value)


def set_server_ai_enabled(enabled):
    setting, _ = SystemSetting.objects.update_or_create(
        key=SERVER_AI_ENABLED_KEY, defaults={'value': bool(enabled)},
    )
    return bool(setting.value)

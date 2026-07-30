import 'package:flutter/material.dart';

import '../onboarding/onboarding_state.dart';

class NotificationSettingsPage extends StatefulWidget {
  const NotificationSettingsPage({
    super.key,
    required this.initial,
    required this.onChanged,
    this.onRequestPermission,
  });

  final OnboardingState initial;
  final ValueChanged<OnboardingState> onChanged;
  final Future<bool> Function()? onRequestPermission;

  @override
  State<NotificationSettingsPage> createState() =>
      _NotificationSettingsPageState();
}

class _NotificationSettingsPageState extends State<NotificationSettingsPage> {
  late OnboardingState _state;

  @override
  void initState() {
    super.initState();
    _state = widget.initial;
  }

  Future<void> _patch(OnboardingState next) async {
    setState(() => _state = next);
    await next.save();
    widget.onChanged(next);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0E12),
      appBar: AppBar(
        title: const Text('Notifications'),
        backgroundColor: const Color(0xFF0F1419),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text(
            'Escalations (^handle) are louder than soft @mentions: push, '
            'login popup, and optional email.',
            style: TextStyle(color: Color(0xFF94A3B8), height: 1.4),
          ),
          const SizedBox(height: 20),
          if (!_state.notificationPermissionGranted) ...[
            FilledButton.icon(
              onPressed: widget.onRequestPermission == null
                  ? null
                  : () async {
                      final ok = await widget.onRequestPermission!();
                      await _patch(
                        _state.copyWith(
                          askedNotificationPermission: true,
                          notificationPermissionGranted: ok,
                        ),
                      );
                    },
              icon: const Icon(Icons.notifications_active_outlined),
              label: const Text('Enable notifications'),
            ),
            const SizedBox(height: 16),
          ],
          SwitchListTile(
            title: const Text('Push on escalations (^)'),
            subtitle: const Text('High-priority channel — always recommended'),
            value: _state.pushEscalations,
            onChanged: (v) => _patch(_state.copyWith(pushEscalations: v)),
          ),
          SwitchListTile(
            title: const Text('Push on soft mentions (@)'),
            subtitle: const Text('Optional — can stay quiet'),
            value: _state.pushSoftMentions,
            onChanged: (v) => _patch(_state.copyWith(pushSoftMentions: v)),
          ),
          SwitchListTile(
            title: const Text('Email on escalations'),
            subtitle: const Text('Via SendGrid Extension when connected'),
            value: _state.emailEscalations,
            onChanged: (v) => _patch(_state.copyWith(emailEscalations: v)),
          ),
        ],
      ),
    );
  }
}

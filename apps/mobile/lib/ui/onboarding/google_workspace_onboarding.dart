import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../config.dart';
import '../../theme/theme.dart';
import 'auth_shell.dart';
import 'onboarding_state.dart';

/// Multi-step Google Workspace onboarding before the workspace shell.
class GoogleWorkspaceOnboarding extends StatefulWidget {
  const GoogleWorkspaceOnboarding({
    super.key,
    required this.state,
    required this.onContinueWithGoogle,
    required this.onSkipToWorkspace,
    required this.onFinished,
    required this.onOpenNotificationSettings,
  });

  final OnboardingState state;
  final Future<void> Function() onContinueWithGoogle;
  final VoidCallback onSkipToWorkspace;
  final ValueChanged<OnboardingState> onFinished;
  final VoidCallback onOpenNotificationSettings;

  @override
  State<GoogleWorkspaceOnboarding> createState() =>
      _GoogleWorkspaceOnboardingState();
}

class _GoogleWorkspaceOnboardingState extends State<GoogleWorkspaceOnboarding> {
  var _step = 0;
  var _busy = false;

  bool get _isDesktop {
    if (kIsWeb) return false;
    return Platform.isMacOS || Platform.isWindows || Platform.isLinux;
  }

  List<_StepCopy> get _steps => [
        const _StepCopy(
          title: 'Welcome to BEVEL',
          body:
              'Channels for humans and agents. @mention for a quiet timeline ping. '
              '^escalate when it needs the room.',
          icon: Icons.forum_outlined,
        ),
        _StepCopy(
          title: 'Google Workspace',
          body: _isDesktop
              ? 'Sign in with your work Google account in the system browser — '
                  'the same Auth.js path as the web app. We plant the session '
                  'when you return.'
              : 'Sign in with your work Google account in the in-app picker. '
                  'We then plant a secure workspace session for chat.',
          icon: Icons.apartment_outlined,
        ),
        const _StepCopy(
          title: 'Your workspace',
          body:
              'You land on your org host. Channels use ~slug. Mark the ones '
              'that matter as ^slug. Hermes on this Mac helps when you escalate.',
          icon: Icons.workspaces_outlined,
        ),
        const _StepCopy(
          title: 'Stay reachable',
          body:
              'Notifications wait until you open a workspace. Escalations are '
              'louder than @mentions. Change this anytime in settings.',
          icon: Icons.notifications_active_outlined,
        ),
      ];

  Future<void> _next() async {
    if (_step < _steps.length - 1) {
      setState(() => _step++);
      return;
    }
    setState(() => _busy = true);
    try {
      await widget.onContinueWithGoogle();
      final next = widget.state.copyWith(completedGoogleSignIn: true);
      await next.save();
      widget.onFinished(next);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final steps = _steps;
    final step = steps[_step];
    final p = context.bevel;
    final isLast = _step == steps.length - 1;

    return Scaffold(
      backgroundColor: p.cream,
      body: BevelAuthShell(
        footer: Text(
          'v${BevelConfig.versionLabel}',
          style: TextStyle(fontSize: 11, color: p.subtle, letterSpacing: 0.3),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                BevelMark(size: 22, palette: p),
                const SizedBox(width: 10),
                const BevelWordmark(),
                const Spacer(),
                Text(
                  '${_step + 1} / ${steps.length}',
                  style: TextStyle(fontSize: 11, color: p.subtle),
                ),
              ],
            ),
            const SizedBox(height: 18),
            Row(
              children: List.generate(steps.length, (i) {
                final active = i <= _step;
                return Expanded(
                  child: Container(
                    height: 2,
                    margin: EdgeInsets.only(right: i < steps.length - 1 ? 5 : 0),
                    decoration: BoxDecoration(
                      color: active ? p.accent : p.border,
                      borderRadius: BorderRadius.circular(99),
                    ),
                  ),
                );
              }),
            ),
            const SizedBox(height: 28),
            Center(
              child: Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  color: p.cream,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: p.border),
                ),
                child: Icon(step.icon, size: 28, color: p.accent),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              step.title,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 10),
            Text(
              step.body,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontSize: 14,
                    height: 1.5,
                  ),
            ),
            if (_step == 1) ...[
              const SizedBox(height: 18),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: p.cream.withValues(alpha: 0.7),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: p.border),
                ),
                child: Text(
                  _isDesktop
                      ? 'Use your org Google account. After Google, this window '
                          'comes back via bevel://auth/complete.'
                      : 'Use your org Google account (not a personal alias if '
                          'SSO is required). After Google, you return via '
                          'bevel://auth/complete.',
                  style: TextStyle(color: p.muted, height: 1.45, fontSize: 12),
                ),
              ),
            ],
            const SizedBox(height: 28),
            FilledButton(
              onPressed: _busy ? null : _next,
              child: _busy
                  ? SizedBox(
                      height: 18,
                      width: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: p.cream,
                      ),
                    )
                  : Text(isLast ? 'Continue with Google' : 'Next'),
            ),
            const SizedBox(height: 8),
            if (isLast)
              TextButton(
                onPressed: _busy ? null : widget.onSkipToWorkspace,
                child: Text(
                  'I already signed in — open ${Uri.parse(BevelConfig.workspaceUrl).host}',
                  textAlign: TextAlign.center,
                ),
              )
            else
              TextButton(
                onPressed: () => setState(() => _step = steps.length - 1),
                child: const Text('Skip to sign-in'),
              ),
            TextButton(
              onPressed: widget.onOpenNotificationSettings,
              child: Text(
                'Notification settings',
                style: TextStyle(color: p.subtle, fontWeight: FontWeight.w500),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StepCopy {
  const _StepCopy({
    required this.title,
    required this.body,
    required this.icon,
  });
  final String title;
  final String body;
  final IconData icon;
}

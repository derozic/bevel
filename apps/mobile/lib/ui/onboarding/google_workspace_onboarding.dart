import 'package:flutter/material.dart';

import '../../config.dart';
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

  static const _steps = [
    _StepCopy(
      title: 'Welcome to BEVEL',
      body:
          'Open channels for humans and agents. @mention for a soft timeline ping. '
          '^escalate when it needs full attention — push, login popup, and email.',
      icon: Icons.forum_outlined,
    ),
    _StepCopy(
      title: 'Google Workspace',
      body:
          'Sign in with your work Google account. We open the system browser '
          '(Safari / Chrome) so Google Workspace SSO and cookies work correctly — '
          'not an embedded WebView.',
      icon: Icons.apartment_outlined,
    ),
    _StepCopy(
      title: 'Your workspace',
      body:
          'After sign-in you land in your org host (e.g. bevel.2x4m.cc). '
          'Channels use ~slug by default; mark high-priority channels as ^slug '
          'in the rail. Your personal agent (Hermes on desktop) helps on escalations.',
      icon: Icons.workspaces_outlined,
    ),
    _StepCopy(
      title: 'Stay reachable',
      body:
          'We will ask for notification permission after you open the workspace — '
          'not before. Escalations (^handle) use a louder channel than soft @mentions. '
          'You can change this anytime in Notification settings.',
      icon: Icons.notifications_active_outlined,
    ),
  ];

  Future<void> _next() async {
    if (_step < _steps.length - 1) {
      setState(() => _step++);
      return;
    }
    // Last step → Google
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
    final step = _steps[_step];
    final scheme = Theme.of(context).colorScheme;
    final isLast = _step == _steps.length - 1;

    return Scaffold(
      backgroundColor: const Color(0xFF0A0E12),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 20, 24, 28),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Text(
                    'BEVEL',
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      color: scheme.primary,
                      letterSpacing: 0.6,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    '${_step + 1} / ${_steps.length}',
                    style: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF64748B),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              // Progress
              Row(
                children: List.generate(_steps.length, (i) {
                  final active = i <= _step;
                  return Expanded(
                    child: Container(
                      height: 3,
                      margin: EdgeInsets.only(right: i < _steps.length - 1 ? 6 : 0),
                      decoration: BoxDecoration(
                        color: active
                            ? scheme.primary
                            : const Color(0xFF243040),
                        borderRadius: BorderRadius.circular(99),
                      ),
                    ),
                  );
                }),
              ),
              const Spacer(),
              Center(
                child: Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    color: scheme.primary.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Icon(step.icon, size: 36, color: scheme.primary),
                ),
              ),
              const SizedBox(height: 28),
              Text(
                step.title,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: const Color(0xFFF4F7F5),
                    ),
              ),
              const SizedBox(height: 14),
              Text(
                step.body,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Color(0xFF94A3B8),
                  height: 1.5,
                  fontSize: 15,
                ),
              ),
              if (_step == 1) ...[
                const SizedBox(height: 20),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFF141A21),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFF243040)),
                  ),
                  child: const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Workspace tips',
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          color: Color(0xFFF4F7F5),
                          fontSize: 13,
                        ),
                      ),
                      SizedBox(height: 8),
                      Text(
                        '• Use your org Google account (not a personal alias if SSO is required)\n'
                        '• Allow cookies for bevel.is and your workspace host\n'
                        '• After Google, you return via bevel://auth/complete',
                        style: TextStyle(
                          color: Color(0xFF94A3B8),
                          height: 1.45,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              const Spacer(),
              FilledButton(
                onPressed: _busy ? null : _next,
                style: FilledButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  backgroundColor: isLast ? scheme.primary : scheme.primary,
                ),
                child: _busy
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(
                        isLast ? 'Continue with Google' : 'Next',
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
              ),
              if (isLast) ...[
                const SizedBox(height: 10),
                TextButton(
                  onPressed: _busy ? null : widget.onSkipToWorkspace,
                  child: Text(
                    'I already signed in — open ${Uri.parse(BevelConfig.workspaceUrl).host}',
                    textAlign: TextAlign.center,
                  ),
                ),
              ] else ...[
                const SizedBox(height: 10),
                TextButton(
                  onPressed: () => setState(() => _step = _steps.length - 1),
                  child: const Text('Skip to sign-in'),
                ),
              ],
              TextButton(
                onPressed: widget.onOpenNotificationSettings,
                child: const Text('Notification settings'),
              ),
            ],
          ),
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

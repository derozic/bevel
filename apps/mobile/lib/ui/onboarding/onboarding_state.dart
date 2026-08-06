import 'package:shared_preferences/shared_preferences.dart';

/// Persisted native onboarding + permission outcomes.
class OnboardingState {
  OnboardingState({
    this.completedGoogleSignIn = false,
    this.completedWorkspaceOpen = false,
    this.askedNotificationPermission = false,
    this.notificationPermissionGranted = false,
    this.emailEscalations = true,
    this.pushSoftMentions = false,
    this.pushEscalations = true,
    this.userEmail = '',
    this.userId = '',
    this.userName = '',
    this.lastWorkspacePath = '/~general',
    this.sessionHealthy = false,
  });

  final bool completedGoogleSignIn;
  final bool completedWorkspaceOpen;
  final bool askedNotificationPermission;
  final bool notificationPermissionGranted;
  final bool emailEscalations;
  final bool pushSoftMentions;
  final bool pushEscalations;
  /// From native OAuth return deep link (bevel://auth/complete?email=)
  final String userEmail;
  final String userId;
  final String userName;
  /// Last path opened in the workspace WebView (restored on relaunch).
  final String lastWorkspacePath;
  /// Last session probe reported an authenticated user in the WebView jar.
  final bool sessionHealthy;

  bool get needsOnboarding => !completedGoogleSignIn;

  /// Prompt for notifications after first workspace open, once.
  bool get shouldPromptNotifications =>
      completedWorkspaceOpen && !askedNotificationPermission;

  OnboardingState copyWith({
    bool? completedGoogleSignIn,
    bool? completedWorkspaceOpen,
    bool? askedNotificationPermission,
    bool? notificationPermissionGranted,
    bool? emailEscalations,
    bool? pushSoftMentions,
    bool? pushEscalations,
    String? userEmail,
    String? userId,
    String? userName,
    String? lastWorkspacePath,
    bool? sessionHealthy,
  }) {
    return OnboardingState(
      completedGoogleSignIn:
          completedGoogleSignIn ?? this.completedGoogleSignIn,
      completedWorkspaceOpen:
          completedWorkspaceOpen ?? this.completedWorkspaceOpen,
      askedNotificationPermission:
          askedNotificationPermission ?? this.askedNotificationPermission,
      notificationPermissionGranted: notificationPermissionGranted ??
          this.notificationPermissionGranted,
      emailEscalations: emailEscalations ?? this.emailEscalations,
      pushSoftMentions: pushSoftMentions ?? this.pushSoftMentions,
      pushEscalations: pushEscalations ?? this.pushEscalations,
      userEmail: userEmail ?? this.userEmail,
      userId: userId ?? this.userId,
      userName: userName ?? this.userName,
      lastWorkspacePath: lastWorkspacePath ?? this.lastWorkspacePath,
      sessionHealthy: sessionHealthy ?? this.sessionHealthy,
    );
  }

  static const _prefix = 'bevel.onboarding.';

  static Future<OnboardingState> load() async {
    final p = await SharedPreferences.getInstance();
    return OnboardingState(
      completedGoogleSignIn: p.getBool('${_prefix}google') ?? false,
      completedWorkspaceOpen: p.getBool('${_prefix}workspace') ?? false,
      askedNotificationPermission: p.getBool('${_prefix}notif_asked') ?? false,
      notificationPermissionGranted:
          p.getBool('${_prefix}notif_granted') ?? false,
      emailEscalations: p.getBool('${_prefix}email_esc') ?? true,
      pushSoftMentions: p.getBool('${_prefix}push_soft') ?? false,
      pushEscalations: p.getBool('${_prefix}push_esc') ?? true,
      userEmail: p.getString('${_prefix}email') ?? '',
      userId: p.getString('${_prefix}user_id') ?? '',
      userName: p.getString('${_prefix}user_name') ?? '',
      lastWorkspacePath:
          p.getString('${_prefix}last_path') ?? '/~general',
      sessionHealthy: p.getBool('${_prefix}session_ok') ?? false,
    );
  }

  Future<void> save() async {
    final p = await SharedPreferences.getInstance();
    await p.setBool('${_prefix}google', completedGoogleSignIn);
    await p.setBool('${_prefix}workspace', completedWorkspaceOpen);
    await p.setBool('${_prefix}notif_asked', askedNotificationPermission);
    await p.setBool('${_prefix}notif_granted', notificationPermissionGranted);
    await p.setBool('${_prefix}email_esc', emailEscalations);
    await p.setBool('${_prefix}push_soft', pushSoftMentions);
    await p.setBool('${_prefix}push_esc', pushEscalations);
    await p.setString('${_prefix}email', userEmail);
    await p.setString('${_prefix}user_id', userId);
    await p.setString('${_prefix}user_name', userName);
    await p.setString('${_prefix}last_path', lastWorkspacePath);
    await p.setBool('${_prefix}session_ok', sessionHealthy);
  }
}

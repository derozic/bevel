import 'dart:io' show Directory, File, Platform, Process, ProcessStartMode;

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:url_launcher/url_launcher.dart';

import 'hermes_handoff.dart';

/// How Hermes was discovered on this Mac.
enum HermesPresence {
  missing,
  appOnly,
  cliOnly,
  appAndCli,
}

/// Result of probing Hermes Desktop / CLI / local backends.
///
/// Official desktop architecture (Nous docs):
/// - Packaged app / `hermes desktop` launches a headless **`hermes serve`**
///   backend that exposes the **tui_gateway** JSON-RPC/WebSocket API.
/// - Messaging **gateway** (`hermes gateway`, often :8642) is a *separate*
///   process for Telegram/Discord/etc. and is not the desktop chat backend.
/// - Remote desktop backends commonly bind **:9119** (`hermes serve --port 9119`).
///
/// Docs: https://hermes-agent.nousresearch.com/docs/user-guide/desktop
class HermesBridgeStatus {
  const HermesBridgeStatus({
    required this.presence,
    required this.appBundlePath,
    required this.cliPath,
    required this.serveOnline,
    required this.serveUrl,
    required this.serveDetail,
    required this.messagingGatewayOnline,
    required this.messagingGatewayUrl,
    required this.messagingGatewayDetail,
    required this.probedAt,
  });

  final HermesPresence presence;
  final String? appBundlePath;
  final String? cliPath;

  /// `hermes serve` / desktop tui_gateway backend reachable.
  final bool serveOnline;
  final String serveUrl;
  final String serveDetail;

  /// Optional messaging API gateway (OpenAI-compatible :8642 path).
  final bool messagingGatewayOnline;
  final String messagingGatewayUrl;
  final String messagingGatewayDetail;

  final DateTime probedAt;

  /// Backward-compatible alias: treat desktop backend as primary "online".
  bool get gatewayOnline => serveOnline;

  bool get isInstalled =>
      presence == HermesPresence.appOnly ||
      presence == HermesPresence.cliOnly ||
      presence == HermesPresence.appAndCli;

  String get summary {
    final parts = <String>[];
    switch (presence) {
      case HermesPresence.missing:
        parts.add('Hermes not found');
        break;
      case HermesPresence.appOnly:
        parts.add('Hermes.app found');
        break;
      case HermesPresence.cliOnly:
        parts.add('hermes CLI found');
        break;
      case HermesPresence.appAndCli:
        parts.add('Hermes.app + CLI');
        break;
    }
    parts.add(serveOnline ? 'serve online' : 'serve offline');
    if (messagingGatewayOnline) parts.add('messaging gateway');
    return parts.join(' · ');
  }
}

/// Launch outcome for handoff to Hermes Desktop.
class HermesLaunchResult {
  const HermesLaunchResult({
    required this.ok,
    required this.method,
    required this.message,
    this.handoff,
  });

  final bool ok;
  final String method;
  final String message;
  final HermesHandoffV1? handoff;
}

/// macOS bridge: detect Hermes Desktop/CLI, probe backends, launch with handoff.
///
/// Aligns with official Desktop docs:
/// https://hermes-agent.nousresearch.com/docs/user-guide/desktop
///
/// Preferred launch:
/// `hermes desktop --cwd <project>` (or `HERMES_DESKTOP_CWD`)
class HermesBridge {
  HermesBridge({
    /// Desktop / `hermes serve` status probe (remote-backend docs use 9119).
    this.serveStatusUrls = const [
      'http://127.0.0.1:9119/api/status',
      'http://127.0.0.1:9119/',
    ],
    /// Messaging API gateway (separate process; OpenWebUI-style).
    this.messagingGatewayHealthUrl = 'http://127.0.0.1:8642/health',
    this.installDocsUrl =
        'https://hermes-agent.nousresearch.com/docs/user-guide/desktop',
    http.Client? httpClient,
  }) : _http = httpClient ?? http.Client();

  final List<String> serveStatusUrls;
  final String messagingGatewayHealthUrl;
  final String installDocsUrl;
  final http.Client _http;

  /// Last successful probe (UI cache).
  HermesBridgeStatus? lastStatus;

  /// Last handoff prepared for the operator.
  HermesHandoffV1? lastHandoff;

  static const macBundleId = 'com.nousresearch.hermes';

  static bool get isSupportedPlatform {
    if (kIsWeb) return false;
    return Platform.isMacOS || Platform.isLinux || Platform.isWindows;
  }

  Future<HermesBridgeStatus> probe() async {
    final appPath = await _findHermesApp();
    final cli = await _findHermesCli();
    final serve = await _probeAny(serveStatusUrls);
    final messaging = await _probeUrl(messagingGatewayHealthUrl);

    HermesPresence presence;
    if (appPath != null && cli != null) {
      presence = HermesPresence.appAndCli;
    } else if (appPath != null) {
      presence = HermesPresence.appOnly;
    } else if (cli != null) {
      presence = HermesPresence.cliOnly;
    } else {
      presence = HermesPresence.missing;
    }

    final status = HermesBridgeStatus(
      presence: presence,
      appBundlePath: appPath,
      cliPath: cli,
      serveOnline: serve.$1,
      serveUrl: serve.$3,
      serveDetail: serve.$2,
      messagingGatewayOnline: messaging.$1,
      messagingGatewayUrl: messagingGatewayHealthUrl,
      messagingGatewayDetail: messaging.$2,
      probedAt: DateTime.now(),
    );
    lastStatus = status;
    return status;
  }

  /// Copy handoff to clipboard and launch Hermes (Desktop GUI or CLI).
  ///
  /// Surfaces (official Nous front ends, shared HERMES_HOME):
  /// - `desktop` — [Desktop](https://hermes-agent.nousresearch.com/docs/user-guide/desktop)
  /// - `cli` — interactive [CLI](https://hermes-agent.nousresearch.com/docs/user-guide/cli)
  /// - `cli-query` — non-interactive `hermes chat -q "…"` with skill preload
  ///
  /// Desktop order:
  /// 1. `hermes desktop --cwd <path>`
  /// 2. Hermes.app (`com.nousresearch.hermes`)
  ///
  /// CLI order (macOS Terminal when interactive):
  /// 1. `hermes -s bevel-workspace chat -q "…"` when surface is cli-query
  /// 2. Terminal.app running `hermes -s …` (and optional cwd)
  Future<HermesLaunchResult> openWithHandoff(HermesHandoffV1 handoff) async {
    final payload = handoff.withDefaultReturn();
    lastHandoff = payload;

    await Clipboard.setData(ClipboardData(text: payload.toClipboardText()));

    if (!isSupportedPlatform) {
      return HermesLaunchResult(
        ok: false,
        method: 'unsupported',
        message: 'Hermes bridge is desktop/CLI only',
        handoff: payload,
      );
    }

    final status = lastStatus ?? await probe();
    final cwd = await _resolveCwd(payload);
    final surface = payload.surface.toLowerCase();

    if (surface == 'cli' || surface == 'cli-query') {
      final cliResult = await _openCli(status, payload, cwd);
      if (cliResult != null) return cliResult;
    } else {
      final desktopResult = await _openDesktop(status, payload, cwd);
      if (desktopResult != null) return desktopResult;
      // Desktop unavailable — fall through to interactive CLI
      final cliResult = await _openCli(
        status,
        payload.copyWith(surface: 'cli'),
        cwd,
      );
      if (cliResult != null) return cliResult;
    }

    try {
      await launchUrl(
        Uri.parse(installDocsUrl),
        mode: LaunchMode.externalApplication,
      );
    } catch (_) {}

    return HermesLaunchResult(
      ok: false,
      method: 'clipboard-fallback',
      message: status.isInstalled
          ? 'Could not launch Hermes; handoff on clipboard. Try: hermes desktop  or  hermes -s bevel-workspace'
          : 'Hermes not installed; docs opened + handoff on clipboard',
      handoff: payload,
    );
  }

  Future<HermesLaunchResult?> _openDesktop(
    HermesBridgeStatus status,
    HermesHandoffV1 payload,
    String? cwd,
  ) async {
    if (status.cliPath != null) {
      final args = <String>['desktop'];
      if (cwd != null) args.addAll(['--cwd', cwd]);
      final r = await Process.run(
        status.cliPath!,
        args,
        environment: {
          ...Platform.environment,
          if (cwd != null) 'HERMES_DESKTOP_CWD': cwd,
        },
      );
      if (r.exitCode == 0) {
        return HermesLaunchResult(
          ok: true,
          method: cwd != null ? 'cli-desktop-cwd' : 'cli-desktop',
          message: cwd != null
              ? 'Opened hermes desktop --cwd $cwd (handoff on clipboard)'
              : 'Opened hermes desktop (handoff on clipboard, mode=${payload.mode})',
          handoff: payload,
        );
      }
    }

    if (status.appBundlePath != null && Platform.isMacOS) {
      final r = await Process.run(
        'open',
        ['-a', status.appBundlePath!],
        environment: {
          ...Platform.environment,
          if (cwd != null) 'HERMES_DESKTOP_CWD': cwd,
        },
      );
      if (r.exitCode == 0) {
        return HermesLaunchResult(
          ok: true,
          method: 'app',
          message: cwd != null
              ? 'Opened Hermes.app with HERMES_DESKTOP_CWD=$cwd; handoff on clipboard'
              : 'Opened Hermes.app with handoff on clipboard (${payload.mode})',
          handoff: payload,
        );
      }
      final r2 = await Process.run('open', ['-b', macBundleId]);
      if (r2.exitCode == 0) {
        return HermesLaunchResult(
          ok: true,
          method: 'app-bundle-id',
          message: 'Opened Hermes via $macBundleId; handoff on clipboard',
          handoff: payload,
        );
      }
    }
    return null;
  }

  /// Official CLI: https://hermes-agent.nousresearch.com/docs/user-guide/cli
  Future<HermesLaunchResult?> _openCli(
    HermesBridgeStatus status,
    HermesHandoffV1 payload,
    String? cwd,
  ) async {
    final hermes = status.cliPath;
    if (hermes == null) return null;

    final skillCsv = payload.skillsFlag.isEmpty
        ? 'bevel-workspace'
        : payload.skillsFlag;
    final prompt = payload.prompt?.trim() ?? '';
    final surface = payload.surface.toLowerCase();

    // Non-interactive single query: hermes -s skill chat -q "…"
    if (surface == 'cli-query' && prompt.isNotEmpty) {
      final args = <String>[
        '-s',
        skillCsv,
        'chat',
        '-q',
        prompt,
      ];
      try {
        await Process.start(
          hermes,
          args,
          workingDirectory: cwd,
          mode: ProcessStartMode.detached,
          environment: Platform.environment,
        );
        return HermesLaunchResult(
          ok: true,
          method: 'cli-query',
          message:
              'Started hermes chat -q with -s $skillCsv'
              '${cwd != null ? ' (cwd $cwd)' : ''}; handoff on clipboard',
          handoff: payload,
        );
      } catch (_) {
        // fall through to interactive Terminal
      }
    }

    // Interactive CLI in Terminal.app (macOS)
    if (Platform.isMacOS) {
      final shellCwd = cwd != null ? 'cd ${shellQuote(cwd)} && ' : '';
      final cmd =
          '${shellCwd}${shellQuote(hermes)} -s ${shellQuote(skillCsv)}';
      final script =
          'tell application "Terminal"\n'
          '  activate\n'
          '  do script ${appleScriptString(cmd)}\n'
          'end tell';
      final r = await Process.run('osascript', ['-e', script]);
      if (r.exitCode == 0) {
        return HermesLaunchResult(
          ok: true,
          method: 'cli-terminal',
          message:
              'Opened Terminal with hermes -s $skillCsv; handoff on clipboard. '
              'Paste or run /bevel-workspace skill. Resume later: hermes -c',
          handoff: payload,
        );
      }
    }

    // Linux/Windows fallback: detached interactive (may not attach TTY)
    try {
      await Process.start(
        hermes,
        ['-s', skillCsv],
        workingDirectory: cwd,
        mode: ProcessStartMode.detached,
      );
      return HermesLaunchResult(
        ok: true,
        method: 'cli-detached',
        message: 'Started hermes -s $skillCsv (detached); handoff on clipboard',
        handoff: payload,
      );
    } catch (_) {
      return null;
    }
  }

  static String shellQuote(String s) {
    if (s.isEmpty) return "''";
    return "'${s.replaceAll("'", "'\\''")}'";
  }

  static String appleScriptString(String s) {
    return '"${s.replaceAll(r'\', r'\\').replaceAll('"', r'\"')}"';
  }

  /// Build a handoff for the current workspace view.
  HermesHandoffV1 handoffForWorkspace({
    required String workspaceUrl,
    String? channel,
    String? prompt,
    String mode = 'build',
    String surface = 'desktop',
    String? repo,
    String? tenant,
    String? projectPath,
    String? successCriteria,
    List<String> skills = const ['bevel-workspace'],
  }) {
    final h = HermesHandoffV1(
      source: 'bevel',
      target: 'hermes-desktop',
      surface: surface,
      tenant: tenant,
      channel: channel,
      workspaceUrl: workspaceUrl,
      mode: mode,
      skills: skills,
      successCriteria: successCriteria ??
          'Return to BEVEL with a short status summary via returnUrl',
      prompt: prompt ??
          'Continue from BEVEL workspace: $workspaceUrl'
              '${channel != null ? ' (channel ^$channel)' : ''}'
              '${tenant != null ? ' tenant=$tenant' : ''}'
              '${projectPath != null ? '\nProject path: $projectPath' : ''}'
              '\n\nClipboard has BEVEL_HERMES_HANDOFF JSON. '
              'CLI: hermes -s bevel-workspace · Desktop: hermes desktop --cwd. '
              'When done: open returnUrl or bevel://hermes/return.',
      repo: repo,
      projectPath: projectPath,
      createdAt: DateTime.now().toUtc().toIso8601String(),
    ).withDefaultReturn();
    lastHandoff = h;
    return h;
  }

  Future<String?> _resolveCwd(HermesHandoffV1 payload) async {
    final candidates = <String?>[
      payload.projectPath,
      Platform.environment['BEVEL_HERMES_CWD'],
      Platform.environment['HERMES_DESKTOP_CWD'],
    ];
    for (final c in candidates) {
      if (c == null || c.isEmpty) continue;
      if (await Directory(c).exists()) return c;
    }
    // Infer from monorepo name if repo looks like owner/name and ~/dev/name exists
    final repo = payload.repo;
    if (repo != null && repo.contains('/')) {
      final name = repo.split('/').last;
      final home = Platform.environment['HOME'];
      if (home != null) {
        for (final root in ['$home/dev/$name', '$home/src/$name', '$home/$name']) {
          if (await Directory(root).exists()) return root;
        }
      }
    }
    return null;
  }

  Future<(bool, String, String)> _probeAny(List<String> urls) async {
    for (final url in urls) {
      final r = await _probeUrl(url);
      if (r.$1) return (true, r.$2, url);
    }
    final last = urls.isNotEmpty ? urls.first : '';
    return (false, 'unreachable', last);
  }

  Future<(bool, String)> _probeUrl(String url) async {
    try {
      final res = await _http
          .get(Uri.parse(url))
          .timeout(const Duration(seconds: 2));
      if (res.statusCode >= 200 && res.statusCode < 500) {
        // 401 on /api/status still means serve is up (auth gate engaged).
        return (true, 'HTTP ${res.statusCode}');
      }
      return (false, 'HTTP ${res.statusCode}');
    } catch (e) {
      return (false, e.runtimeType.toString());
    }
  }

  Future<String?> _findHermesApp() async {
    if (!Platform.isMacOS) return null;

    // Bundle id first (official: com.nousresearch.hermes)
    try {
      final r = await Process.run('mdfind', [
        'kMDItemCFBundleIdentifier == "$macBundleId"',
      ]);
      if (r.exitCode == 0) {
        final line = (r.stdout as String)
            .split('\n')
            .map((e) => e.trim())
            .firstWhere((e) => e.endsWith('.app'), orElse: () => '');
        if (line.isNotEmpty) return line;
      }
    } catch (_) {}

    const candidates = [
      '/Applications/Hermes.app',
      '/Applications/Hermes Agent.app',
      '/Applications/Hermes Desktop.app',
    ];
    for (final path in candidates) {
      if (await Directory(path).exists()) return path;
    }
    final home = Platform.environment['HOME'];
    if (home != null) {
      for (final name in ['Hermes.app', 'Hermes Agent.app', 'Hermes Desktop.app']) {
        final p = '$home/Applications/$name';
        if (await Directory(p).exists()) return p;
      }
    }
    try {
      final r = await Process.run('mdfind', [
        'kMDItemKind == Application && kMDItemDisplayName == "Hermes*"',
      ]);
      if (r.exitCode == 0) {
        final lines = (r.stdout as String)
            .split('\n')
            .map((e) => e.trim())
            .where((e) => e.endsWith('.app'));
        for (final line in lines) {
          final lower = line.toLowerCase();
          if (lower.contains('hermes') &&
              !lower.contains('hermes-engine') &&
              !lower.contains('react-native')) {
            return line;
          }
        }
      }
    } catch (_) {}
    return null;
  }

  Future<String?> _findHermesCli() async {
    // Official packager override
    final override = Platform.environment['HERMES_DESKTOP_HERMES'] ??
        Platform.environment['HERMES_BIN'];
    if (override != null && override.isNotEmpty) {
      if (await File(override).exists()) return override;
    }

    try {
      final r = await Process.run('which', ['hermes']);
      if (r.exitCode == 0) {
        final path = (r.stdout as String).trim().split('\n').first;
        if (path.isNotEmpty && await File(path).exists()) return path;
      }
    } catch (_) {}

    final home = Platform.environment['HOME'] ?? '';
    final candidates = <String>[
      if (home.isNotEmpty) ...[
        '$home/.local/bin/hermes',
        '$home/.hermes/bin/hermes',
        '$home/.hermes/hermes-agent/venv/bin/hermes',
        '$home/bin/hermes',
      ],
      '/usr/local/bin/hermes',
      '/opt/homebrew/bin/hermes',
    ];
    for (final path in candidates) {
      if (await File(path).exists()) return path;
    }
    return null;
  }

  void dispose() {
    _http.close();
  }
}

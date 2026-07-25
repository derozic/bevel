import 'dart:convert';

/// Shared v1 handoff payload (agents INTEROP.md + BEVEL bridge).
class HermesHandoffV1 {
  /// Keep field set in lockstep with agents `src/agents/hermes/handoff.ts` + schema.
  const HermesHandoffV1({
    this.source = 'bevel',
    this.target = 'hermes-desktop',
    this.surface = 'desktop',
    this.tenant,
    this.channel,
    this.workspaceUrl,
    this.returnUrl,
    this.repo,
    this.projectPath,
    this.agentId = 'hermes',
    this.sessionId,
    this.skills = const ['bevel-workspace'],
    this.mode = 'build',
    this.prompt,
    this.successCriteria,
    this.evidence = const [],
    this.fleetMessageId,
    this.constraints = const {
      'noDocker': true,
      'useCaddy': true,
    },
    this.createdAt,
  });

  static const clipboardPrefix = 'BEVEL_HERMES_HANDOFF:';

  final String source;
  final String target;
  /// `desktop` | `cli` | `cli-query` — Nous front ends sharing HERMES_HOME.
  final String surface;
  final String? tenant;
  final String? channel;
  final String? workspaceUrl;
  final String? returnUrl;
  final String? repo;
  /// Absolute path for `hermes desktop --cwd` / HERMES_DESKTOP_CWD / CLI cwd.
  final String? projectPath;
  final String agentId;
  final String? sessionId;
  /// Preload via `hermes -s a,b` (CLI docs: skill preload at launch).
  final List<String> skills;
  final String mode;
  final String? prompt;
  /// Short “done when” for Desktop/CLI mission.
  final String? successCriteria;
  final List<String> evidence;
  final String? fleetMessageId;
  final Map<String, dynamic> constraints;
  final String? createdAt;

  factory HermesHandoffV1.fromQuery(Map<String, String> q) {
    final skillsRaw = q['skills'];
    return HermesHandoffV1(
      source: q['source'] ?? 'bevel',
      target: q['target'] ?? 'hermes-desktop',
      surface: q['surface'] ?? 'desktop',
      tenant: q['tenant'],
      channel: q['channel'],
      workspaceUrl: q['workspaceUrl'],
      returnUrl: q['returnUrl'],
      repo: q['repo'],
      projectPath: q['projectPath'] ?? q['cwd'],
      agentId: q['agentId'] ?? 'hermes',
      sessionId: q['sessionId'],
      skills: skillsRaw == null || skillsRaw.isEmpty
          ? const ['bevel-workspace']
          : skillsRaw.split(',').map((s) => s.trim()).where((s) => s.isNotEmpty).toList(),
      mode: q['mode'] ?? 'build',
      prompt: q['prompt'],
      successCriteria: q['successCriteria'],
      fleetMessageId: q['fleetMessageId'],
      createdAt: DateTime.now().toUtc().toIso8601String(),
    );
  }

  factory HermesHandoffV1.fromJson(Map<String, dynamic> json) {
    final skillsJson = json['skills'];
    List<String> skills = const ['bevel-workspace'];
    if (skillsJson is List) {
      skills = skillsJson.map((e) => '$e').where((s) => s.isNotEmpty).toList();
    } else if (skillsJson is String && skillsJson.isNotEmpty) {
      skills = skillsJson.split(',').map((s) => s.trim()).where((s) => s.isNotEmpty).toList();
    }
    return HermesHandoffV1(
      source: (json['source'] as String?) ?? 'bevel',
      target: (json['target'] as String?) ?? 'hermes-desktop',
      surface: (json['surface'] as String?) ?? 'desktop',
      tenant: json['tenant'] as String?,
      channel: json['channel'] as String?,
      workspaceUrl: json['workspaceUrl'] as String?,
      returnUrl: json['returnUrl'] as String?,
      repo: json['repo'] as String?,
      projectPath: (json['projectPath'] as String?) ?? (json['cwd'] as String?),
      agentId: (json['agentId'] as String?) ?? 'hermes',
      sessionId: json['sessionId'] as String?,
      skills: skills,
      mode: (json['mode'] as String?) ?? 'build',
      prompt: json['prompt'] as String?,
      successCriteria: json['successCriteria'] as String?,
      evidence: () {
        final e = json['evidence'];
        if (e is List) {
          return e.map((x) => '$x').where((s) => s.isNotEmpty).toList();
        }
        return const <String>[];
      }(),
      fleetMessageId: json['fleetMessageId'] as String?,
      constraints: (json['constraints'] as Map<String, dynamic>?) ??
          const {'noDocker': true, 'useCaddy': true},
      createdAt: json['createdAt'] as String?,
    );
  }

  HermesHandoffV1 copyWith({
    String? channel,
    String? workspaceUrl,
    String? returnUrl,
    String? repo,
    String? projectPath,
    String? surface,
    String? mode,
    String? prompt,
    String? tenant,
    List<String>? skills,
    String? successCriteria,
    List<String>? evidence,
    String? fleetMessageId,
  }) {
    return HermesHandoffV1(
      source: source,
      target: target,
      surface: surface ?? this.surface,
      tenant: tenant ?? this.tenant,
      channel: channel ?? this.channel,
      workspaceUrl: workspaceUrl ?? this.workspaceUrl,
      returnUrl: returnUrl ?? this.returnUrl,
      repo: repo ?? this.repo,
      projectPath: projectPath ?? this.projectPath,
      agentId: agentId,
      sessionId: sessionId,
      skills: skills ?? this.skills,
      mode: mode ?? this.mode,
      prompt: prompt ?? this.prompt,
      successCriteria: successCriteria ?? this.successCriteria,
      evidence: evidence ?? this.evidence,
      fleetMessageId: fleetMessageId ?? this.fleetMessageId,
      constraints: constraints,
      createdAt: createdAt ?? DateTime.now().toUtc().toIso8601String(),
    );
  }

  Map<String, dynamic> toJson() => {
        'v': 1,
        'source': source,
        'target': target,
        'surface': surface,
        if (tenant != null) 'tenant': tenant,
        if (channel != null) 'channel': channel,
        if (workspaceUrl != null) 'workspaceUrl': workspaceUrl,
        if (returnUrl != null) 'returnUrl': returnUrl,
        if (repo != null) 'repo': repo,
        if (projectPath != null) 'projectPath': projectPath,
        if (projectPath != null) 'cwd': projectPath,
        'agentId': agentId,
        if (sessionId != null) 'sessionId': sessionId,
        if (skills.isNotEmpty) 'skills': skills,
        'mode': mode,
        if (prompt != null) 'prompt': prompt,
        if (successCriteria != null) 'successCriteria': successCriteria,
        if (evidence.isNotEmpty) 'evidence': evidence,
        if (fleetMessageId != null) 'fleetMessageId': fleetMessageId,
        'constraints': constraints,
        'createdAt': createdAt ?? DateTime.now().toUtc().toIso8601String(),
      };

  /// Official CLI flags for skill preload: `hermes -s a,b`
  String get skillsFlag => skills.where((s) => s.isNotEmpty).join(',');

  String toClipboardText() =>
      '$clipboardPrefix\n${const JsonEncoder.withIndent('  ').convert(toJson())}\n';

  static HermesHandoffV1? tryParseClipboard(String text) {
    final trimmed = text.trim();
    final body = trimmed.startsWith(clipboardPrefix)
        ? trimmed.substring(clipboardPrefix.length).trim()
        : trimmed;
    try {
      final map = jsonDecode(body) as Map<String, dynamic>;
      if (map['v'] != 1) return null;
      return HermesHandoffV1.fromJson(map);
    } catch (_) {
      return null;
    }
  }

  /// Prefer short deep link; large prompts rely on clipboard.
  String toBevelOpenDeepLink() {
    final params = <String, String>{};
    if (prompt != null && prompt!.length <= 1200) {
      params['prompt'] = prompt!;
    }
    if (channel != null) params['channel'] = channel!;
    if (mode.isNotEmpty) params['mode'] = mode;
    if (repo != null) params['repo'] = repo!;
    if (tenant != null) params['tenant'] = tenant!;
    if (sessionId != null) params['sessionId'] = sessionId!;
    if (workspaceUrl != null) params['workspaceUrl'] = workspaceUrl!;
    final q = Uri(queryParameters: params).query;
    return q.isEmpty ? 'bevel://hermes/open' : 'bevel://hermes/open?$q';
  }

  static String returnDeepLink({
    String? channel,
    String status = 'done',
    String? summary,
  }) {
    final params = <String, String>{'status': status};
    if (channel != null) params['channel'] = channel;
    if (summary != null && summary.isNotEmpty) params['summary'] = summary;
    return Uri(scheme: 'bevel', host: 'hermes', path: '/return', queryParameters: params)
        .toString();
  }

  /// Ensure returnUrl is populated for Desktop → BEVEL close-the-loop.
  HermesHandoffV1 withDefaultReturn() {
    if (returnUrl != null && returnUrl!.isNotEmpty) return this;
    return copyWith(
      returnUrl: returnDeepLink(channel: channel, status: 'done'),
    );
  }
}

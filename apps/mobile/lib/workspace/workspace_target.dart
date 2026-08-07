import '../config.dart';

/// Where the native shell opens — top-level Private or a product org host.
enum WorkspaceKind { private, org }

class WorkspaceTarget {
  const WorkspaceTarget({
    required this.kind,
    required this.id,
    required this.name,
    required this.host,
    required this.homePath,
    this.slug,
    this.subtitle,
  });

  final WorkspaceKind kind;
  /// Stable id: `private` or tenant slug.
  final String id;
  final String name;
  /// Hostname only (no scheme), e.g. bevel.is or bevel.2x4m.cc.
  final String host;
  /// Path after open: /me for private, /~general for org.
  final String homePath;
  final String? slug;
  final String? subtitle;

  bool get isPrivate => kind == WorkspaceKind.private;

  String get origin => 'https://$host';

  Uri homeUri() => Uri.parse(origin).replace(path: homePath);

  /// Platform apex private space (agents only) — always available.
  static WorkspaceTarget private({String? platformHost}) {
    final host = (platformHost ?? Uri.parse(BevelConfig.baseUrl).host)
        .toLowerCase()
        .split(':')
        .first;
    return WorkspaceTarget(
      kind: WorkspaceKind.private,
      id: 'private',
      name: 'Private',
      host: host.isEmpty ? 'bevel.is' : host,
      homePath: '/me',
      subtitle: 'Just you and your agents',
    );
  }

  factory WorkspaceTarget.org({
    required String slug,
    required String name,
    required String host,
    String homePath = '/~general',
    String? subtitle,
  }) {
    final cleanHost = host.toLowerCase().split(':').first;
    return WorkspaceTarget(
      kind: WorkspaceKind.org,
      id: slug.toLowerCase(),
      name: name,
      host: cleanHost,
      homePath: homePath,
      slug: slug.toLowerCase(),
      subtitle: subtitle ?? cleanHost,
    );
  }

  Map<String, String> toPrefs() => {
        'kind': kind.name,
        'id': id,
        'name': name,
        'host': host,
        'homePath': homePath,
        if (slug != null) 'slug': slug!,
        if (subtitle != null) 'subtitle': subtitle!,
      };

  static WorkspaceTarget? fromPrefs(Map<String, String> m) {
    final kindRaw = m['kind'];
    final host = m['host']?.trim() ?? '';
    final name = m['name']?.trim() ?? '';
    final id = m['id']?.trim() ?? '';
    if (host.isEmpty || id.isEmpty) return null;
    if (kindRaw == WorkspaceKind.private.name || id == 'private') {
      return WorkspaceTarget(
        kind: WorkspaceKind.private,
        id: 'private',
        name: name.isEmpty ? 'Private' : name,
        host: host,
        homePath: m['homePath']?.isNotEmpty == true ? m['homePath']! : '/me',
        subtitle: m['subtitle'],
      );
    }
    return WorkspaceTarget(
      kind: WorkspaceKind.org,
      id: id,
      name: name.isEmpty ? id : name,
      host: host,
      homePath:
          m['homePath']?.isNotEmpty == true ? m['homePath']! : '/~general',
      slug: m['slug'] ?? id,
      subtitle: m['subtitle'],
    );
  }
}

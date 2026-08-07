import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../config.dart';
import 'workspace_target.dart';

/// Loads product workspaces for the chooser (Private is always first).
class WorkspaceCatalog {
  WorkspaceCatalog({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  Uri get _tenantsUri =>
      Uri.parse('${BevelConfig.apiBaseUrl}/api/v1/tenants');

  /// Private + orgs the email is likely allowed into (policy filter when present).
  Future<List<WorkspaceTarget>> listForEmail(String? email) async {
    final private = WorkspaceTarget.private();
    final orgs = await listOrgs(email: email);
    return [private, ...orgs];
  }

  Future<List<WorkspaceTarget>> listOrgs({String? email}) async {
    try {
      final res = await _client.get(
        _tenantsUri,
        headers: const {'Accept': 'application/json'},
      ).timeout(const Duration(seconds: 12));
      if (res.statusCode < 200 || res.statusCode >= 300) {
        debugPrint('WorkspaceCatalog tenants ${res.statusCode}');
        return _fallbackOrgs();
      }
      final body = jsonDecode(res.body);
      final list = body is Map ? body['tenants'] : body;
      if (list is! List) return _fallbackOrgs();

      final emailNorm = (email ?? '').trim().toLowerCase();
      final domain =
          emailNorm.contains('@') ? emailNorm.split('@').last : '';

      final out = <WorkspaceTarget>[];
      for (final raw in list) {
        if (raw is! Map) continue;
        final slug = (raw['slug'] ?? '').toString().trim().toLowerCase();
        final name = (raw['name'] ?? slug).toString().trim();
        if (slug.isEmpty || slug == 'private') continue;
        final active = raw['is_active'] != false &&
            (raw['status'] == null ||
                raw['status'].toString().toLowerCase() == 'active');
        if (!active) continue;

        final hosts = <String>[];
        final hList = raw['hosts'];
        if (hList is List) {
          for (final h in hList) {
            final s = h.toString().toLowerCase().split(':').first.trim();
            if (s.isNotEmpty) hosts.add(s);
          }
        }
        final domainHost = (raw['domain'] ?? '').toString().toLowerCase();
        if (domainHost.isNotEmpty) hosts.add(domainHost);

        final host = _pickProductionHost(hosts);
        if (host == null) continue;

        // Closed auth policy (explicit emails/domains) → only show if matched.
        // Empty policy → show (membership may be granted server-side on enter).
        if (emailNorm.isNotEmpty &&
            _hasClosedPolicy(raw) &&
            !_emailAllowed(emailNorm, domain, raw)) {
          continue;
        }

        out.add(
          WorkspaceTarget.org(
            slug: slug,
            name: name.isEmpty ? slug : name,
            host: host,
            subtitle: host,
          ),
        );
      }

      if (out.isEmpty) return _fallbackOrgs();
      out.sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
      return out;
    } catch (e) {
      debugPrint('WorkspaceCatalog error: $e');
      return _fallbackOrgs();
    }
  }

  static bool _hasClosedPolicy(Map raw) {
    final policy = raw['auth_policy'];
    if (policy is! Map) return false;
    final emails = policy['allowed_emails'];
    final domains = policy['allowed_domains'];
    final hasEmails = emails is List && emails.isNotEmpty;
    final hasDomains = domains is List && domains.isNotEmpty;
    return hasEmails || hasDomains;
  }

  static bool _emailAllowed(String email, String domain, Map raw) {
    final policy = raw['auth_policy'];
    if (policy is! Map) return true;
    final emails = policy['allowed_emails'];
    final domains = policy['allowed_domains'];
    final defaults = policy['default_for_domains'];
    final hasEmails = emails is List && emails.isNotEmpty;
    final hasDomains = domains is List && domains.isNotEmpty;
    if (!hasEmails && !hasDomains) return true;
    if (hasEmails) {
      for (final e in emails) {
        if (e.toString().toLowerCase().trim() == email) return true;
      }
    }
    if (hasDomains && domain.isNotEmpty) {
      for (final d in domains) {
        if (d.toString().toLowerCase().trim() == domain) return true;
      }
    }
    if (defaults is List && domain.isNotEmpty) {
      for (final d in defaults) {
        if (d.toString().toLowerCase().trim() == domain) return true;
      }
    }
    // comma.cm / derozic often on 2x4m — don't over-filter open memberships
    return !hasEmails && !hasDomains;
  }

  /// Prefer public production host over *.lvh.me.
  static String? _pickProductionHost(List<String> hosts) {
    if (hosts.isEmpty) return null;
    final prod = hosts.where((h) {
      final x = h.toLowerCase();
      return !x.contains('lvh.me') &&
          x != 'localhost' &&
          !x.startsWith('127.') &&
          x.contains('.');
    }).toList();
    if (prod.isNotEmpty) {
      // Prefer bevel.* product hosts
      final bevel = prod.where((h) => h.startsWith('bevel.')).toList();
      return (bevel.isNotEmpty ? bevel.first : prod.first);
    }
    return hosts.first;
  }

  List<WorkspaceTarget> _fallbackOrgs() {
    return [
      WorkspaceTarget.org(
        slug: '2x4m',
        name: '2x4m',
        host: Uri.parse(BevelConfig.workspaceUrl).host,
        subtitle: Uri.parse(BevelConfig.workspaceUrl).host,
      ),
    ];
  }
}

import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import '../../config.dart';
import '../../theme/theme.dart';

class EscalationItem {
  EscalationItem({
    required this.id,
    required this.actorLabel,
    required this.bodyPreview,
    this.channelSlug,
    this.createdAt,
    this.ackedAt,
  });

  final String id;
  final String actorLabel;
  final String bodyPreview;
  final String? channelSlug;
  final String? createdAt;
  final String? ackedAt;

  bool get isUnacked => ackedAt == null || ackedAt!.isEmpty;

  factory EscalationItem.fromJson(Map<String, dynamic> j) {
    return EscalationItem(
      id: j['id'] as String? ?? '',
      actorLabel: j['actorLabel'] as String? ?? 'Someone',
      bodyPreview: j['bodyPreview'] as String? ?? '',
      channelSlug: j['channelSlug'] as String?,
      createdAt: j['createdAt'] as String?,
      ackedAt: j['ackedAt'] as String?,
    );
  }
}

/// Fetches unacked escalations for the signed-in user (via session proxy headers later).
class EscalationRepository {
  EscalationRepository({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  Map<String, String> _identityHeaders({
    String? userEmail,
    String? userId,
  }) {
    final headers = <String, String>{
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };
    // Trusted caller key (release dart-define) — required by API identity guard
    final key = BevelConfig.fleetInternalApiKey;
    if (key.isNotEmpty) {
      headers['X-Fleet-Internal-Key'] = key;
    }
    if (userEmail != null && userEmail.isNotEmpty) {
      headers['X-Bevel-User-Email'] = userEmail;
    }
    if (userId != null && userId.isNotEmpty) {
      headers['X-Bevel-User-Id'] = userId;
    }
    return headers;
  }

  Future<List<EscalationItem>> fetchUnacked({
    String? userEmail,
    String? userId,
  }) async {
    if ((userEmail == null || userEmail.isEmpty) &&
        (userId == null || userId.isEmpty)) {
      return [];
    }
    final uri = Uri.parse(
      '${BevelConfig.apiBaseUrl}/api/v1/timeline?kind=escalation&unacked=true&limit=50',
    );
    try {
      final res = await _client.get(
        uri,
        headers: _identityHeaders(userEmail: userEmail, userId: userId),
      );
      if (res.statusCode < 200 || res.statusCode >= 300) return [];
      final data = jsonDecode(res.body) as Map<String, dynamic>;
      final items = (data['items'] as List? ?? [])
          .whereType<Map>()
          .map((e) => EscalationItem.fromJson(Map<String, dynamic>.from(e)))
          .where((e) => e.id.isNotEmpty && e.isUnacked)
          .toList();
      return items;
    } catch (_) {
      return [];
    }
  }

  Future<bool> ack(String itemId, {String? userEmail, String? userId}) async {
    final uri = Uri.parse(
      '${BevelConfig.apiBaseUrl}/api/v1/timeline/$itemId/ack',
    );
    try {
      final res = await _client.post(
        uri,
        headers: _identityHeaders(userEmail: userEmail, userId: userId),
      );
      return res.statusCode >= 200 && res.statusCode < 300;
    } catch (_) {
      return false;
    }
  }
}

/// Full-screen / modal queue of hard escalations (^handle).
class EscalationInboxSheet extends StatelessWidget {
  const EscalationInboxSheet({
    super.key,
    required this.items,
    required this.onAck,
    required this.onOpen,
    required this.onDismiss,
  });

  final List<EscalationItem> items;
  final Future<void> Function(EscalationItem item) onAck;
  final void Function(EscalationItem item) onOpen;
  final VoidCallback onDismiss;

  static Future<void> showIfNeeded(
    BuildContext context, {
    required List<EscalationItem> items,
    required Future<void> Function(EscalationItem item) onAck,
    required void Function(EscalationItem item) onOpen,
  }) async {
    if (items.isEmpty || !context.mounted) return;
    final p = context.bevel;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      isDismissible: false,
      enableDrag: false,
      backgroundColor: p.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => EscalationInboxSheet(
        items: items,
        onAck: onAck,
        onOpen: onOpen,
        onDismiss: () => Navigator.of(ctx).pop(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final p = context.bevel;
    final height = MediaQuery.sizeOf(context).height * 0.72;
    return SafeArea(
      child: SizedBox(
        height: height,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 12, 8),
              child: Row(
                children: [
                  BevelMark(size: 28, palette: p),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Escalations',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        Text(
                          '${items.length} need you — louder than a soft mention',
                          style: TextStyle(fontSize: 12, color: p.muted),
                        ),
                      ],
                    ),
                  ),
                  TextButton(
                    onPressed: onDismiss,
                    child: const Text('Later'),
                  ),
                ],
              ),
            ),
            Divider(height: 1, color: p.border),
            Expanded(
              child: ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: items.length,
                separatorBuilder: (_, _) => const SizedBox(height: 10),
                itemBuilder: (context, i) {
                  final item = items[i];
                  return Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: p.surfaceRaised,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: p.accent.withValues(alpha: 0.35)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(
                              item.actorLabel,
                              style: TextStyle(
                                fontWeight: FontWeight.w600,
                                color: p.ink,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              item.channelSlug != null
                                  ? '~${item.channelSlug}'
                                  : '^escalation',
                              style: TextStyle(
                                fontSize: 11,
                                fontFamily: 'monospace',
                                color: p.accent,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          item.bodyPreview,
                          maxLines: 4,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 13,
                            height: 1.35,
                            color: p.muted,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            FilledButton(
                              onPressed: () => onOpen(item),
                              child: const Text('Open'),
                            ),
                            const SizedBox(width: 8),
                            OutlinedButton(
                              onPressed: () => onAck(item),
                              child: const Text('Ack'),
                            ),
                          ],
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

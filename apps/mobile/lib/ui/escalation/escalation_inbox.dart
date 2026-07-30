import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import '../../config.dart';

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
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      isDismissible: false,
      enableDrag: false,
      backgroundColor: const Color(0xFF0F1419),
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
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF59E0B).withValues(alpha: 0.18),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(
                      Icons.priority_high_rounded,
                      color: Color(0xFFFBBF24),
                      size: 22,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Escalations',
                          style: Theme.of(context)
                              .textTheme
                              .titleMedium
                              ?.copyWith(
                                fontWeight: FontWeight.w700,
                                color: const Color(0xFFF4F7F5),
                              ),
                        ),
                        Text(
                          '${items.length} need your attention — more than a normal notification',
                          style: const TextStyle(
                            fontSize: 12,
                            color: Color(0xFF94A3B8),
                          ),
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
            const Divider(height: 1, color: Color(0xFF243040)),
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
                      color: const Color(0xFF141A21),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: const Color(0xFFF59E0B).withValues(alpha: 0.35),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(
                              item.actorLabel,
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                color: Color(0xFFF4F7F5),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              item.channelSlug != null
                                  ? '~${item.channelSlug}'
                                  : '^escalation',
                              style: const TextStyle(
                                fontSize: 11,
                                fontFamily: 'monospace',
                                color: Color(0xFFFBBF24),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          item.bodyPreview,
                          maxLines: 4,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 13,
                            height: 1.35,
                            color: Color(0xFFCBD5E1),
                          ),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            FilledButton(
                              style: FilledButton.styleFrom(
                                backgroundColor: const Color(0xFFF59E0B),
                                foregroundColor: const Color(0xFF1C1917),
                              ),
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

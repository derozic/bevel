import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config.dart';

/// Optional POST of Hermes return summary into FastAPI fleet messages.
///
/// Requires build-time:
///   --dart-define=BEVEL_API_URL=https://api.bevel.is
///   --dart-define=FLEET_INTERNAL_API_KEY=…
///
/// Failures are silent — UI toast already shows the summary.
class HermesReturnReporter {
  HermesReturnReporter._();

  static const String _fleetKey = String.fromEnvironment(
    'FLEET_INTERNAL_API_KEY',
    defaultValue: '',
  );

  static const String _tenant = String.fromEnvironment(
    'BEVEL_FLEET_TENANT',
    defaultValue: '2x4m',
  );

  static Future<bool> postChannelNote({
    required String channel,
    required String status,
    String? summary,
    http.Client? client,
  }) async {
    if (_fleetKey.isEmpty) return false;
    final httpClient = client ?? http.Client();
    try {
      final base = BevelConfig.apiBaseUrl.replaceAll(RegExp(r'/$'), '');
      final uri = Uri.parse(
        '$base/api/v1/fleet/channels/${Uri.encodeComponent(channel)}/messages'
        '?tenant=${Uri.encodeComponent(_tenant)}',
      );
      final body = jsonEncode({
        'id': 'hermes_return_${DateTime.now().millisecondsSinceEpoch}',
        'speakerId': 'agent:hermes',
        'speakerName': 'Hermes',
        'speakerType': 'agent',
        'agentId': 'hermes',
        'body':
            '**Hermes Desktop return** ($status)'
            '${summary == null || summary.isEmpty ? '' : '\n$summary'}',
        'status': 'final',
        'tags': ['hermes', 'handoff', 'return'],
      });
      final res = await httpClient
          .post(
            uri,
            headers: {
              'Content-Type': 'application/json',
              'X-Fleet-Internal-Key': _fleetKey,
            },
            body: body,
          )
          .timeout(const Duration(seconds: 5));
      return res.statusCode >= 200 && res.statusCode < 300;
    } catch (_) {
      return false;
    } finally {
      if (client == null) httpClient.close();
    }
  }
}

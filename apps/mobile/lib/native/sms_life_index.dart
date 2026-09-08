// Classify SMS as noise vs a life moment.
///
/// Google Messages / SMS is a bad product surface and a good archive:
/// OTPs, short codes, and marketing drown the few texts that actually
/// mark a life (hospital, landed, born, died, job, eviction).
///
/// This is the Android parallel of the iMessage inbox index — local first,
/// owner-only, never a workspace dump.

enum SmsSignal {
  noise,
  ordinary,
  life,
  critical,
}

class SmsLifeMoment {
  const SmsLifeMoment({
    required this.id,
    required this.address,
    required this.body,
    required this.ts,
    required this.isFromMe,
    required this.signal,
    required this.tags,
  });

  final String id;
  final String address;
  final String body;
  final int ts;
  final bool isFromMe;
  final SmsSignal signal;
  final List<String> tags;

  bool get matters =>
      signal == SmsSignal.life || signal == SmsSignal.critical;
}

/// Obvious 2FA / marketing / carrier junk — not a life timeline.
final _otpOnly = RegExp(r'^\s*\d{4,8}\s*$');
final _otpPhrase = RegExp(
  r'\b(verification code|one[ -]?time (code|password)|otp|passcode|'
  r'your code is|is your code|do not share)\b',
  caseSensitive: false,
);
final _marketing = RegExp(
  r'\b(unsubscribe|reply stop|percent off|% off|limited time|'
  r'free shipping|download our app|bit\.ly| tap to )\b',
  caseSensitive: false,
);
final _shortCode = RegExp(r'^\d{4,6}$');

/// Things that tend to be true even when the medium is SMS.
const _criticalTags = <String, List<String>>{
  'emergency': [
    '911',
    'ambulance',
    'hospital',
    'icu',
    'er ',
    'emergency',
    'unconscious',
    'overdose',
  ],
  'death': [
    'passed away',
    'passed on',
    'died',
    'funeral',
    'hospice',
    'rest in peace',
    'rip ',
  ],
  'birth': ['in labor', 'went into labor', 'baby is here', 'we had a baby', 'born at'],
  'harm': [
    'accident',
    'car wreck',
    'crashed',
    'shot',
    'stabbed',
    'missing person',
  ],
};

const _lifeTags = <String, List<String>>{
  'health': ['surgery', 'diagnosis', 'cancer', 'chemo', 'miscarriage'],
  'travel': ['just landed', 'landed in', 'boarding', 'flight cancelled', 'delayed flight'],
  'work': ['job offer', 'laid off', 'got fired', 'i quit', 'accepted the offer'],
  'home': ['evicted', 'foreclosure', 'house burned', 'apartment fire'],
  'kin': ['engaged', 'we got married', 'divorced', 'deployed'],
};

SmsLifeMoment classifySms({
  required String id,
  required String address,
  required String body,
  required int ts,
  required bool isFromMe,
}) {
  final text = body.trim();
  final addr = address.trim();

  if (_shortCode.hasMatch(addr) ||
      _otpOnly.hasMatch(text) ||
      _otpPhrase.hasMatch(text) ||
      _marketing.hasMatch(text)) {
    return SmsLifeMoment(
      id: id,
      address: addr,
      body: text,
      ts: ts,
      isFromMe: isFromMe,
      signal: SmsSignal.noise,
      tags: const ['noise'],
    );
  }

  final lower = ' $text '.toLowerCase();
  final tags = <String>[];

  for (final entry in _criticalTags.entries) {
    if (entry.value.any((p) => lower.contains(p))) {
      tags.add(entry.key);
    }
  }
  if (tags.isNotEmpty) {
    return SmsLifeMoment(
      id: id,
      address: addr,
      body: text,
      ts: ts,
      isFromMe: isFromMe,
      signal: SmsSignal.critical,
      tags: tags,
    );
  }

  for (final entry in _lifeTags.entries) {
    if (entry.value.any((p) => lower.contains(p))) {
      tags.add(entry.key);
    }
  }
  if (tags.isNotEmpty) {
    return SmsLifeMoment(
      id: id,
      address: addr,
      body: text,
      ts: ts,
      isFromMe: isFromMe,
      signal: SmsSignal.life,
      tags: tags,
    );
  }

  return SmsLifeMoment(
    id: id,
    address: addr,
    body: text,
    ts: ts,
    isFromMe: isFromMe,
    signal: SmsSignal.ordinary,
    tags: const [],
  );
}

List<SmsLifeMoment> classifySmsBatch(List<SmsLifeMoment> raw) {
  return raw.where((m) => m.matters).toList()
    ..sort((a, b) {
      final rank = b.signal.index.compareTo(a.signal.index);
      if (rank != 0) return rank;
      return b.ts.compareTo(a.ts);
    });
}

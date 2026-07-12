import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import 'config.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const BevelApp());
}

class BevelApp extends StatelessWidget {
  const BevelApp({super.key});

  @override
  Widget build(BuildContext context) {
    const accent = Color(0xFF22C55E);
    final scheme = ColorScheme.fromSeed(
      seedColor: accent,
      brightness: Brightness.dark,
      primary: accent,
      surface: const Color(0xFF0F1419),
    );

    return MaterialApp(
      title: BevelConfig.appName,
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: scheme,
        scaffoldBackgroundColor: const Color(0xFF0A0E12),
        appBarTheme: const AppBarTheme(
          centerTitle: false,
          elevation: 0,
          backgroundColor: Color(0xFF0F1419),
          foregroundColor: Color(0xFFF4F7F5),
        ),
        cardTheme: CardThemeData(
          color: const Color(0xFF141A21),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: const BorderSide(color: Color(0xFF243040)),
          ),
        ),
      ),
      home: const BevelHomePage(),
    );
  }
}

class BevelHomePage extends StatefulWidget {
  const BevelHomePage({super.key});

  @override
  State<BevelHomePage> createState() => _BevelHomePageState();
}

class _BevelHomePageState extends State<BevelHomePage> {
  String? _status;

  Future<void> _open(Uri uri) async {
    setState(() => _status = 'Opening ${uri.host}${uri.path}…');
    try {
      final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (!ok && mounted) {
        setState(() => _status = 'Could not open $uri');
      } else if (mounted) {
        setState(() => _status = null);
      }
    } catch (e) {
      if (mounted) setState(() => _status = 'Failed: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final platforms = <_PlatformCard>[
      _PlatformCard(
        title: 'iOS',
        subtitle: 'iPhone and iPad · TestFlight / App Store',
        icon: Icons.phone_iphone_rounded,
        onOpen: () => _open(BevelConfig.workspaceUri()),
      ),
      _PlatformCard(
        title: 'Android',
        subtitle: 'Phone and tablet · Play Store / APK',
        icon: Icons.phone_android_rounded,
        onOpen: () => _open(BevelConfig.workspaceUri()),
      ),
      _PlatformCard(
        title: 'Mac Silicon',
        subtitle: 'arm64 Flutter desktop · M-series only',
        icon: Icons.desktop_mac_rounded,
        onOpen: () => _open(BevelConfig.workspaceUri()),
      ),
    ];

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              width: 28,
              height: 28,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: scheme.primary.withValues(alpha: 0.18),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                'B',
                style: TextStyle(
                  color: scheme.primary,
                  fontWeight: FontWeight.w800,
                  fontSize: 14,
                ),
              ),
            ),
            const SizedBox(width: 10),
            const Text(BevelConfig.appName),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Copy workspace URL',
            onPressed: () async {
              await Clipboard.setData(
                ClipboardData(text: BevelConfig.baseUrl),
              );
              if (mounted) {
                setState(() => _status = 'Copied ${BevelConfig.baseUrl}');
              }
            },
            icon: const Icon(Icons.link_rounded),
          ),
        ],
      ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 720),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 40),
              children: [
                Text(
                  BevelConfig.appTagline,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.w600,
                        color: const Color(0xFFF4F7F5),
                      ),
                ),
                const SizedBox(height: 8),
                Text(
                  'One Flutter codebase ships to iOS, Android, and Apple Silicon '
                  'Mac. Open your workspace to join channels with humans and agents.',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: const Color(0xFF9AA8B5),
                        height: 1.45,
                      ),
                ),
                const SizedBox(height: 20),
                FilledButton.icon(
                  onPressed: () => _open(BevelConfig.workspaceUri()),
                  icon: const Icon(Icons.forum_outlined),
                  label: const Text('Open workspace'),
                  style: FilledButton.styleFrom(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 20,
                      vertical: 14,
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                OutlinedButton.icon(
                  onPressed: () =>
                      _open(BevelConfig.workspaceUri(BevelConfig.loginPath)),
                  icon: const Icon(Icons.login_rounded),
                  label: const Text('Sign in'),
                ),
                const SizedBox(height: 28),
                Text(
                  'Release targets',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        color: const Color(0xFF9AA8B5),
                        letterSpacing: 0.6,
                      ),
                ),
                const SizedBox(height: 12),
                ...platforms.map(
                  (p) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Card(
                      child: ListTile(
                        leading: Icon(p.icon, color: scheme.primary),
                        title: Text(p.title),
                        subtitle: Text(p.subtitle),
                        trailing: const Icon(Icons.chevron_right_rounded),
                        onTap: p.onOpen,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  'Workspace: ${BevelConfig.baseUrl}\n'
                  'Client v${BevelConfig.versionLabel}',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: const Color(0xFF6B7A88),
                        height: 1.5,
                      ),
                ),
                if (_status != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    _status!,
                    style: TextStyle(color: scheme.primary, fontSize: 13),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _PlatformCard {
  const _PlatformCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.onOpen,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final VoidCallback onOpen;
}

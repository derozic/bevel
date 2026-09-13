import 'package:flutter/material.dart';

import '../../config.dart';
import '../../theme/theme.dart';

/// Desktop-only switch: production bevel.is ↔ local Caddy .lvh.me.
class DeveloperModeTile extends StatelessWidget {
  const DeveloperModeTile({super.key, this.onChanged});

  /// Called after the preference is saved (remap workspace, close WebView).
  final ValueChanged<bool>? onChanged;

  @override
  Widget build(BuildContext context) {
    if (!BevelConfig.supportsDeveloperMode) return const SizedBox.shrink();
    final p = context.bevel;

    return ValueListenableBuilder<bool>(
      valueListenable: BevelConfig.developerMode,
      builder: (context, enabled, _) {
        return Material(
          color: Colors.transparent,
          child: SwitchListTile(
            contentPadding: EdgeInsets.zero,
            secondary: Icon(
              enabled ? Icons.science_outlined : Icons.public_outlined,
              color: p.accent,
            ),
            title: const Text('Developer mode'),
            subtitle: Text(
              enabled
                  ? 'Local Caddy · ${Uri.parse(BevelConfig.baseUrl).host}'
                  : 'Production · bevel.is',
              style: TextStyle(color: p.muted, fontSize: 12),
            ),
            value: enabled,
            onChanged: (next) async {
              await BevelConfig.setDeveloperMode(next);
              onChanged?.call(next);
            },
          ),
        );
      },
    );
  }
}

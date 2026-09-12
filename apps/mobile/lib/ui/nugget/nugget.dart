// Dart mirror of @bevel/schema nuggets — enough to stage template/page
// in the native pane without parsing the full Zod tree.

import 'dart:convert';

enum NuggetScale { atom, molecule, organism, template, page }

enum NuggetPlacement { thread, pane, page }

class BevelNugget {
  const BevelNugget({
    required this.scale,
    required this.source,
    required this.title,
    this.summary,
    this.href,
    this.atoms = const [],
    this.related = const [],
    this.sections = const [],
    this.placement,
  });

  final NuggetScale scale;
  final String source;
  final String title;
  final String? summary;
  final String? href;
  final List<({String? label, String? value})> atoms;
  final List<BevelNugget> related;
  final List<({String title, String body})> sections;
  final NuggetPlacement? placement;

  NuggetPlacement get resolvedPlacement {
    if (placement != null) return placement!;
    switch (scale) {
      case NuggetScale.page:
        return NuggetPlacement.page;
      case NuggetScale.template:
        return NuggetPlacement.pane;
      case NuggetScale.atom:
      case NuggetScale.molecule:
      case NuggetScale.organism:
        return NuggetPlacement.thread;
    }
  }

  static BevelNugget? tryParseRaw(String raw) {
    var text = raw.trim();
    const prefix = 'bevel-nugget:v1';
    if (text.startsWith(prefix)) {
      text = text.substring(prefix.length).trim();
    }
    try {
      final decoded = jsonDecode(text);
      if (decoded is Map<String, dynamic>) return tryParse(decoded);
      if (decoded is Map) {
        return tryParse(Map<String, dynamic>.from(decoded));
      }
    } catch (_) {}
    return null;
  }

  static NuggetScale? parseScale(String? raw) {
    switch (raw) {
      case 'atom':
        return NuggetScale.atom;
      case 'molecule':
        return NuggetScale.molecule;
      case 'organism':
        return NuggetScale.organism;
      case 'template':
        return NuggetScale.template;
      case 'page':
        return NuggetScale.page;
      default:
        return null;
    }
  }

  static BevelNugget? tryParse(Map<String, dynamic> json) {
    final scale = parseScale(json['scale'] as String?);
    final title = json['title'] as String?;
    final source = json['source'] as String?;
    if (scale == null || title == null || source == null) return null;
    final atomsRaw = json['atoms'];
    final atoms = <({String? label, String? value})>[];
    if (atomsRaw is List) {
      for (final item in atomsRaw) {
        if (item is Map) {
          atoms.add((
            label: item['label'] as String?,
            value: item['value'] as String?,
          ));
        }
      }
    }
    final related = <BevelNugget>[];
    final relatedRaw = json['related'];
    if (relatedRaw is List) {
      for (final item in relatedRaw) {
        if (item is Map) {
          final child = tryParse(Map<String, dynamic>.from(item));
          if (child != null) related.add(child);
        }
      }
    }
    final sections = <({String title, String body})>[];
    final sectionsRaw = json['sections'];
    if (sectionsRaw is List) {
      for (final item in sectionsRaw) {
        if (item is Map) {
          final t = item['title'] as String?;
          final b = item['body'] as String?;
          if (t != null && b != null) sections.add((title: t, body: b));
        }
      }
    }
    NuggetPlacement? placement;
    switch (json['placement'] as String?) {
      case 'pane':
        placement = NuggetPlacement.pane;
      case 'page':
        placement = NuggetPlacement.page;
      case 'thread':
        placement = NuggetPlacement.thread;
    }
    return BevelNugget(
      scale: scale,
      source: source,
      title: title,
      summary: json['summary'] as String?,
      href: json['href'] as String?,
      atoms: atoms,
      related: related,
      sections: sections,
      placement: placement,
    );
  }
}

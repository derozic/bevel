import 'dart:ui';

import 'package:share_plus/share_plus.dart';

/// System share sheet (iOS UIActivityViewController / Android Intent.ACTION_SEND).
class SharingService {
  const SharingService();

  /// Share a workspace invite, channel link, or agent transcript snippet.
  ///
  /// On iPad the share sheet is a popover — [sharePositionOrigin] must be set
  /// or UIActivityViewController presents from nowhere / fails.
  Future<ShareResult> shareWorkspace({
    required String title,
    required String text,
    Uri? uri,
    Rect? sharePositionOrigin,
  }) {
    if (uri != null) {
      return SharePlus.instance.share(
        ShareParams(
          title: title,
          subject: title,
          uri: uri,
          sharePositionOrigin: sharePositionOrigin,
        ),
      );
    }
    return SharePlus.instance.share(
      ShareParams(
        title: title,
        text: text,
        subject: title,
        sharePositionOrigin: sharePositionOrigin,
      ),
    );
  }

  Future<ShareResult> shareFiles({
    required List<XFile> files,
    String? subject,
    String? text,
  }) {
    return SharePlus.instance.share(
      ShareParams(
        files: files,
        subject: subject,
        text: text,
      ),
    );
  }
}

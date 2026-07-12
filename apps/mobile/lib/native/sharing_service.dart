import 'package:share_plus/share_plus.dart';

/// System share sheet (iOS UIActivityViewController / Android Intent.ACTION_SEND).
class SharingService {
  const SharingService();

  /// Share a workspace invite, channel link, or agent transcript snippet.
  Future<ShareResult> shareWorkspace({
    required String title,
    required String text,
    Uri? uri,
  }) {
    final body = uri == null ? text : '$text\n$uri';
    return SharePlus.instance.share(
      ShareParams(
        title: title,
        text: body,
        subject: title,
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

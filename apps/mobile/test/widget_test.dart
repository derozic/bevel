import 'package:flutter_test/flutter_test.dart';

import 'package:bevel_app/main.dart';

void main() {
  testWidgets('BEVEL home shows workspace actions', (tester) async {
    await tester.pumpWidget(const BevelApp());

    expect(find.text('BEVEL'), findsOneWidget);
    expect(find.text('Open workspace'), findsOneWidget);
    expect(find.text('iOS'), findsOneWidget);
    expect(find.text('Android'), findsOneWidget);
    expect(find.text('Mac Silicon'), findsOneWidget);
  });
}
